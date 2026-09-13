import { EventEmitter } from 'events';
import fs from 'fs';
import { prisma } from '../config/db';
import { pdfService } from './pdf.service';
import { ocrService } from './ocr.service';
import { excelService, ExcelRowItem } from './excel.service';
import { validationService } from './validation.service';
import { normalizeDocumentNumber } from '../utils/regex';

export interface BatchProgressEvent {
  batchId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  isPaused?: boolean;
  totalPages: number;
  processedPages: number;
  percentage: number;
  currentDocument?: string;
  error?: string;
}

interface BatchSignal {
  paused: boolean;
  cancelled: boolean;
  resumeResolver?: () => void;
}

class QueueService extends EventEmitter {
  private batchSignals = new Map<string, BatchSignal>();
  private lastProgress = new Map<string, BatchProgressEvent>();

  getLastProgress(batchId: string): BatchProgressEvent | undefined {
    return this.lastProgress.get(batchId);
  }

  isPaused(batchId: string): boolean {
    return Boolean(this.batchSignals.get(batchId)?.paused);
  }

  isCancelled(batchId: string): boolean {
    return Boolean(this.batchSignals.get(batchId)?.cancelled);
  }

  pauseBatch(batchId: string): boolean {
    let sig = this.batchSignals.get(batchId);
    if (!sig) {
      sig = { paused: true, cancelled: false };
      this.batchSignals.set(batchId, sig);
    } else {
      if (sig.cancelled || sig.paused) return false;
      sig.paused = true;
    }

    console.log(`⏸️ [PAUSA] Lote ${batchId} pausado por el usuario.`);
    const last = this.lastProgress.get(batchId);
    this.emitProgress({
      batchId,
      status: 'PROCESSING',
      isPaused: true,
      totalPages: last?.totalPages || 0,
      processedPages: last?.processedPages || 0,
      percentage: last?.percentage || 0,
    });
    return true;
  }

  resumeBatch(batchId: string): boolean {
    const sig = this.batchSignals.get(batchId);
    if (!sig || !sig.paused) return false;
    sig.paused = false;
    if (sig.resumeResolver) {
      sig.resumeResolver();
      sig.resumeResolver = undefined;
    }
    console.log(`▶️ [REANUDAR] Lote ${batchId} reanudado.`);
    const last = this.lastProgress.get(batchId);
    this.emitProgress({
      batchId,
      status: 'PROCESSING',
      isPaused: false,
      totalPages: last?.totalPages || 0,
      processedPages: last?.processedPages || 0,
      percentage: last?.percentage || 0,
    });
    return true;
  }

  cancelBatch(batchId: string): boolean {
    let sig = this.batchSignals.get(batchId);
    if (!sig) {
      sig = { paused: false, cancelled: true };
      this.batchSignals.set(batchId, sig);
    } else {
      sig.cancelled = true;
      sig.paused = false;
      if (sig.resumeResolver) {
        sig.resumeResolver();
        sig.resumeResolver = undefined;
      }
    }
    console.log(`🛑 [CANCELAR] Lote ${batchId} cancelado por el usuario.`);
    const last = this.lastProgress.get(batchId);
    this.emitProgress({
      batchId,
      status: 'FAILED',
      isPaused: false,
      totalPages: last?.totalPages || 0,
      processedPages: last?.processedPages || 0,
      percentage: last?.percentage || 0,
      error: 'Procesamiento cancelado por el usuario',
    });
    return true;
  }

  private async waitIfPausedOrCancelled(batchId: string): Promise<boolean> {
    const sig = this.batchSignals.get(batchId);
    if (!sig) return false;
    if (sig.cancelled) return true;
    while (sig.paused && !sig.cancelled) {
      await new Promise<void>((resolve) => {
        sig.resumeResolver = resolve;
      });
    }
    return sig.cancelled;
  }

  /**
   * RF-029, RF-030, RF-031:
   * Encola y ejecuta el procesamiento del lote de documentos de manera asíncrona
   */
  async enqueueBatchProcessing(
    batchId: string,
    pdfPath: string,
    excelPath: string
  ): Promise<void> {
    if (!this.batchSignals.has(batchId)) {
      this.batchSignals.set(batchId, { paused: false, cancelled: false });
    }
    // Iniciar procesamiento en background sin bloquear la respuesta HTTP
    setImmediate(async () => {
      await this.processBatchJob(batchId, pdfPath, excelPath);
    });
  }

  private async processBatchJob(
    batchId: string,
    pdfPath: string,
    excelPath: string
  ): Promise<void> {
    try {
      console.log(`\n🚀 [INICIO PROCESAMIENTO] Lote ${batchId}`);

      if (await this.waitIfPausedOrCancelled(batchId)) {
        throw new Error('Procesamiento cancelado por el usuario');
      }

      // 1. Marcar como PROCESSING
      await prisma.processingBatch.update({
        where: { id: batchId },
        data: { status: 'PROCESSING' },
      });

      this.emitProgress({
        batchId,
        status: 'PROCESSING',
        totalPages: 0,
        processedPages: 0,
        percentage: 0,
      });

      // 2. Parsear el archivo Excel
      const excelBuffer = fs.readFileSync(excelPath);
      const excelParsed = excelService.parseExcel(excelBuffer);

      if (!excelParsed.isValid) {
        throw new Error(`Error en el archivo Excel: ${excelParsed.error}`);
      }

      // Guardar filas de Excel en un mapa O(1) y persistir en la base de datos en lote (createMany)
      const excelMap = new Map<string, ExcelRowItem>();
      for (const row of excelParsed.rows) {
        excelMap.set(row.identificacionLimpia, row);
      }

      if (excelParsed.rows.length > 0) {
        await prisma.excelRecord.createMany({
          data: excelParsed.rows.map((row) => ({
            batchId,
            identificacionOriginal: row.identificacionOriginal,
            identificacionLimpia: row.identificacionLimpia,
            nombreOficial: row.nombreOficial,
            estadoOficial: row.estadoOficial,
          })),
        });
      }

      // 3. Procesar PDF en streaming continuo de páginas (inicia OCR desde la página 1 de inmediato)
      const pdfBuffer = fs.readFileSync(pdfPath);
      let totalPages = 1;
      const documentsMap = new Map<string, any>();
      let processedPagesCount = 0;

      await pdfService.streamImagesFromPdf(
        pdfBuffer,
        async (detectedTotal) => {
          totalPages = detectedTotal || 1;
          await prisma.processingBatch.update({
            where: { id: batchId },
            data: { totalPages },
          }).catch(() => null);

          // Notificación inmediata: la UI recibe las páginas totales al instante (< 200ms)
          this.emitProgress({
            batchId,
            status: 'PROCESSING',
            totalPages,
            processedPages: 0,
            percentage: 2,
          });
        },
        async (pageImages, pageNum, docTotalPages) => {
          if (await this.waitIfPausedOrCancelled(batchId)) {
            throw new Error('Procesamiento cancelado por el usuario');
          }

          const parsedResults: { img: (typeof pageImages)[0]; parsed: any }[] = [];
          for (const img of pageImages) {
            try {
              const isFrontHint = pageImages.length === 2 ? img.imageIndex === 0 : undefined;
              const parsed = await ocrService.processImage(img.buffer, isFrontHint);
              parsedResults.push({ img, parsed });
            } catch (imgError) {
              console.error(`Error procesando imagen de página ${pageNum}:`, imgError);
              parsedResults.push({ img, parsed: null });
            }
          }

          for (const { img, parsed } of parsedResults) {
            if (!parsed) continue;

              let rawNum = parsed.numeroDocumento;

              // 1. Reconciliación numérica inteligente con el Excel del lote
              const normalizedCandidate = rawNum ? normalizeDocumentNumber(rawNum) : '';
              if (normalizedCandidate && !excelMap.has(normalizedCandidate)) {
                for (const [idLimpia, excelRow] of excelMap.entries()) {
                  const isSubmatch = (idLimpia.endsWith(normalizedCandidate) || normalizedCandidate.endsWith(idLimpia) || idLimpia.startsWith(normalizedCandidate) || normalizedCandidate.startsWith(idLimpia));
                  if (isSubmatch && Math.abs(normalizedCandidate.length - idLimpia.length) <= 5) {
                    const rowTokens = validationService.cleanName(excelRow.nombreOficial).split(/\s+/).filter(t => t.length >= 4);
                    const pageUpper = parsed.rawText.toUpperCase();
                    const hasNameMatch = rowTokens.some(t => pageUpper.includes(t));
                    if (hasNameMatch || Math.abs(normalizedCandidate.length - idLimpia.length) <= 2) {
                      console.log(`[Reconciliación Cédula] Número ${rawNum} corregido a ${idLimpia} (${excelRow.nombreOficial})`);
                      rawNum = idLimpia;
                      parsed.numeroDocumento = idLimpia;
                      break;
                    }
                  }
                }
              }

              // 2. Reconciliación por nombre completo o texto de la página si el número falló
              if (!rawNum || !excelMap.has(normalizeDocumentNumber(rawNum))) {
                if (parsed.nombreCompleto && parsed.nombreCompleto.trim().length >= 4) {
                  for (const [idLimpia, excelRow] of excelMap.entries()) {
                    const evalRes = validationService.evaluateNameMatch(parsed.nombreCompleto, excelRow.nombreOficial);
                    if (evalRes.isStrongMatch || evalRes.ratio >= 0.50) {
                      console.log(`[Reconciliación Nombre] Página ${img.pageNumber} ("${parsed.nombreCompleto}") asociada a ${excelRow.nombreOficial} (CC ${idLimpia})`);
                      rawNum = idLimpia;
                      parsed.numeroDocumento = idLimpia;
                      break;
                    }
                  }
                }

                if (!rawNum || !excelMap.has(normalizeDocumentNumber(rawNum))) {
                  const pageUpper = parsed.rawText.toUpperCase();
                  for (const [idLimpia, excelRow] of excelMap.entries()) {
                    const officialTokens = validationService.cleanName(excelRow.nombreOficial)
                      .split(/\s+/)
                      .filter((t) => t.length >= 4 && !['SENA', 'COLOMBIA', 'DE', 'DEL'].includes(t));
                    if (officialTokens.length >= 2) {
                      const matchedTokens = officialTokens.filter((t) => pageUpper.includes(t));
                      if (matchedTokens.length >= 2 || (officialTokens.length === 2 && matchedTokens.length >= 1)) {
                        console.log(`[Reconciliación Texto Página] Documento en página ${img.pageNumber} coincide con ${excelRow.nombreOficial} (CC ${idLimpia})`);
                        rawNum = idLimpia;
                        parsed.numeroDocumento = idLimpia;
                        if (!parsed.nombreCompleto || parsed.nombreCompleto.length < 5) {
                          parsed.nombreCompleto = excelRow.nombreOficial;
                        }
                        break;
                      }
                    }
                  }
                }
              }

              if (!rawNum) {
                console.warn(`[OCR] No se detectó número ni nombre registrable en página ${img.pageNumber}, imagen ${img.imageIndex}`);
                continue;
              }

              const docNum = normalizeDocumentNumber(rawNum);
              let current = documentsMap.get(docNum);
              if (!current) {
                current = {
                  numeroDocumento: docNum,
                  tipoDocumento: parsed.tipoDocumento === 'CONTRASEÑA' ? 'CONTRASENA' : parsed.tipoDocumento,
                  tieneFrente: false,
                  tieneReverso: false,
                  fotoUrl: null,
                };
                documentsMap.set(docNum, current);
              }

              if (parsed.isFront || parsed.tipoDocumento === 'CONTRASEÑA') {
                current.tieneFrente = true;
                if (parsed.nombres) current.nombres = parsed.nombres;
                if (parsed.apellidos) current.apellidos = parsed.apellidos;
                if (parsed.nombreCompleto) current.nombreCompleto = parsed.nombreCompleto;
                if (parsed.fechaNacimiento) current.fechaNacimiento = parsed.fechaNacimiento;
                if (parsed.lugarNacimiento) current.lugarNacimiento = parsed.lugarNacimiento;
                if (parsed.sexo) current.sexo = parsed.sexo;
                if (parsed.grupoSanguineo) current.grupoSanguineo = parsed.grupoSanguineo;
                if (parsed.fechaExpedicion) current.fechaExpedicion = parsed.fechaExpedicion;
                if (parsed.lugarExpedicion) current.lugarExpedicion = parsed.lugarExpedicion;
                if (parsed.estatura) current.estatura = parsed.estatura;
                if (parsed.fechaVencimiento) current.fechaVencimiento = parsed.fechaVencimiento;
                if (parsed.lugarPreparacion) current.lugarPreparacion = parsed.lugarPreparacion;
                if (parsed.oficinaEntrega) current.oficinaEntrega = parsed.oficinaEntrega;
              }

              if (parsed.isBack) {
                current.tieneReverso = true;
                if (parsed.nombres && !current.nombres) current.nombres = parsed.nombres;
                if (parsed.apellidos && !current.apellidos) current.apellidos = parsed.apellidos;
                if (parsed.nombreCompleto && !current.nombreCompleto) current.nombreCompleto = parsed.nombreCompleto;
                if (parsed.fechaNacimiento && !current.fechaNacimiento) current.fechaNacimiento = parsed.fechaNacimiento;
                if (parsed.lugarNacimiento && !current.lugarNacimiento) current.lugarNacimiento = parsed.lugarNacimiento;
                if (parsed.grupoSanguineo && !current.grupoSanguineo) current.grupoSanguineo = parsed.grupoSanguineo;
                if (parsed.sexo && !current.sexo) current.sexo = parsed.sexo;
                if (parsed.fechaExpedicion && !current.fechaExpedicion) current.fechaExpedicion = parsed.fechaExpedicion;
                if (parsed.lugarExpedicion && !current.lugarExpedicion) current.lugarExpedicion = parsed.lugarExpedicion;
                if (parsed.fechaVencimiento && !current.fechaVencimiento) current.fechaVencimiento = parsed.fechaVencimiento;
              }
            }

          processedPagesCount = pageNum;
          const currentProgressPct = Math.min(98, Math.max(3, Math.round((pageNum / docTotalPages) * 100)));

          // Progreso en tiempo real con cada página procesada
          this.emitProgress({
            batchId,
            status: 'PROCESSING',
            totalPages: docTotalPages,
            processedPages: pageNum,
            percentage: currentProgressPct,
          });

          if (pageNum % 2 === 0 || pageNum === docTotalPages) {
            await prisma.processingBatch.update({
              where: { id: batchId },
              data: { processedPages: pageNum },
            }).catch(() => null);
          }
        }
      );

      if (await this.waitIfPausedOrCancelled(batchId)) {
        throw new Error('Procesamiento cancelado por el usuario');
      }

      // 5. Validar cada documento contra el Excel y almacenar en la BD
      for (const [entryDocNum, docData] of documentsMap.entries()) {
        let docNum = entryDocNum;
        if (await this.waitIfPausedOrCancelled(batchId)) {
          throw new Error('Procesamiento cancelado por el usuario');
        }

        // Evitar duplicaciones de nombres/apellidos
        if (docData.nombres && docData.apellidos && (docData.nombres === docData.apellidos || docData.apellidos.includes(docData.nombres))) {
          docData.nombres = undefined;
        }

        // Reconciliación con matriz de Excel para separar palabras pegadas por OCR o enriquecer datos
        let excelItem = excelMap.get(docNum);
        if (!excelItem) {
          // Búsqueda inteligente por nombre oficial si el OCR tuvo una discrepancia menor en el número
          const currentTestName = docData.nombreCompleto || `${docData.nombres || ''} ${docData.apellidos || ''}`.trim();
          if (currentTestName && currentTestName.length > 5) {
            for (const [exNum, item] of excelMap.entries()) {
              if (item.nombreOficial) {
                const evalMatch = validationService.evaluateNameMatch(currentTestName, item.nombreOficial);
                // Si ambos apellidos/nombres coinciden fuertemente o ratio >= 0.70
                if (evalMatch.ratio >= 0.70 && (evalMatch.hasGivenNameMatch || evalMatch.hasSurnameMatch)) {
                  excelItem = item;
                  docNum = exNum;
                  docData.numeroDocumento = exNum;
                  break;
                }
              }
            }
          }
        }
        if (excelItem && excelItem.nombreOficial) {
          const officialWords = excelItem.nombreOficial.split(/\s+/).filter(Boolean);
          const fixGlued = (text?: string | null): string | null => {
            if (!text) return null;
            let res = text;
            for (let j = 0; j < officialWords.length - 1; j++) {
              const glued = (officialWords[j] + officialWords[j + 1]).toUpperCase();
              const spaced = (officialWords[j] + ' ' + officialWords[j + 1]).toUpperCase();
              const regex = new RegExp(`\\b${glued}\\b`, 'gi');
              res = res.replace(regex, spaced);
            }
            return res.replace(/\s+/g, ' ').trim();
          };
          if (docData.nombres) docData.nombres = fixGlued(docData.nombres);
          if (docData.apellidos) docData.apellidos = fixGlued(docData.apellidos);
          if (docData.nombreCompleto) docData.nombreCompleto = fixGlued(docData.nombreCompleto);

          // Si el número coincide con el Excel y el nombre extraído concuerda (nombres o apellidos o ratio)
          const currentTestName = docData.nombreCompleto || `${docData.nombres || ''} ${docData.apellidos || ''}`.trim();
          const evalMatch = validationService.evaluateNameMatch(currentTestName, excelItem.nombreOficial);
          if (evalMatch.hasGivenNameMatch || evalMatch.hasSurnameMatch || evalMatch.ratio >= 0.35 || !currentTestName) {
            docData.nombreCompleto = excelItem.nombreOficial;
            const mid = officialWords.length <= 3 ? 1 : Math.floor(officialWords.length / 2);
            docData.nombres = officialWords.slice(0, mid).join(' ');
            docData.apellidos = officialWords.slice(mid).join(' ');
          }
        }

        if (!docData.nombreCompleto || docData.nombreCompleto.includes('undefined')) {
          docData.nombreCompleto = `${docData.nombres || ''} ${docData.apellidos || ''}`.trim() || null;
        }

        const isContrasena = docData.tipoDocumento === 'CONTRASENA';
        const valResult = validationService.validateDocument(
          docNum,
          docData.nombreCompleto || `${docData.nombres || ''} ${docData.apellidos || ''}`.trim() || null,
          docData.tieneFrente,
          docData.tieneReverso,
          isContrasena,
          excelMap
        );

        await prisma.extractedDocument.create({
          data: {
            batchId,
            numeroDocumento: docNum,
            tipoDocumento: docData.tipoDocumento,
            nombres: docData.nombres || null,
            apellidos: docData.apellidos || null,
            nombreCompleto: docData.nombreCompleto || null,
            fechaNacimiento: docData.fechaNacimiento || null,
            lugarNacimiento: docData.lugarNacimiento || null,
            sexo: docData.sexo || null,
            grupoSanguineo: docData.grupoSanguineo || null,
            fechaExpedicion: docData.fechaExpedicion || null,
            lugarExpedicion: docData.lugarExpedicion || null,
            estatura: docData.estatura || null,
            fechaVencimiento: docData.fechaVencimiento || null,
            lugarPreparacion: docData.lugarPreparacion || null,
            oficinaEntrega: docData.oficinaEntrega || null,
            fotoUrl: docData.fotoUrl || null,
            tieneFrente: docData.tieneFrente,
            tieneReverso: docData.tieneReverso,
            estadoCompletitud: valResult.estadoCompletitud,
            estadoValidacion: valResult.estadoValidacion,
            detalleDiscrepancias: valResult.discrepancias ? (valResult.discrepancias as any) : undefined,
          },
        });
      }

      // 6. Finalizar lote si el registro aún existe en BD
      await prisma.processingBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          processedPages: totalPages,
          completedAt: new Date(),
        },
      }).catch((err) => {
        console.warn(`[Lote ${batchId}] No se pudo actualizar estado final a COMPLETED (posiblemente eliminado):`, err.message);
      });

      this.emitProgress({
        batchId,
        status: 'COMPLETED',
        totalPages,
        processedPages: totalPages,
        percentage: 100,
      });

      console.log(`✅ [PROCESAMIENTO COMPLETADO] Lote ${batchId} finalizado exitosamente.`);
    } catch (error: any) {
      const isCancelled = error.message === 'Procesamiento cancelado por el usuario';
      if (isCancelled) {
        console.log(`🛑 [LOTE CANCELADO] Lote ${batchId} cancelado por el usuario.`);
      } else {
        console.error(`❌ [ERROR EN LOTE] ${batchId}:`, error);
      }

      await prisma.processingBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorMessage: isCancelled ? 'Procesamiento cancelado por el usuario' : (error.message || 'Error desconocido durante el procesamiento'),
        },
      }).catch((err) => {
        console.warn(`[Lote ${batchId}] No se pudo marcar como FAILED (posiblemente eliminado):`, err.message);
      });

      this.emitProgress({
        batchId,
        status: 'FAILED',
        isPaused: false,
        totalPages: 0,
        processedPages: 0,
        percentage: 0,
        error: isCancelled ? 'Procesamiento cancelado por el usuario' : error.message,
      });
    } finally {
      this.batchSignals.delete(batchId);
      this.lastProgress.delete(batchId);

      // RF-047, RNF-025: Eliminar archivos temporales de disco
      try {
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        if (fs.existsSync(excelPath)) fs.unlinkSync(excelPath);
        console.log(`🧹 [LIMPIEZA] Archivos temporales eliminados para el lote ${batchId}`);
      } catch (cleanErr) {
        console.warn('Error al limpiar archivos temporales:', cleanErr);
      }
    }
  }

  private emitProgress(event: BatchProgressEvent): void {
    const prev = this.lastProgress.get(event.batchId) || {
      batchId: event.batchId,
      status: event.status,
      totalPages: 0,
      processedPages: 0,
      percentage: 0,
    };
    const updated: BatchProgressEvent = {
      ...prev,
      ...event,
      isPaused: event.isPaused !== undefined ? event.isPaused : this.isPaused(event.batchId),
    };
    this.lastProgress.set(event.batchId, updated);
    this.emit(`progress:${event.batchId}`, updated);
    this.emit('progress', updated);
  }
}

export const queueService = new QueueService();
