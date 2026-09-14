import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';
import { prisma } from '../config/db';
import { queueService, BatchProgressEvent } from '../services/queue.service';
import { validationService } from '../services/validation.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { normalizeDocumentNumber } from '../utils/regex';
import { ExcelRowItem } from '../services/excel.service';

export function extractFichaNumber(pdfFilename?: string, excelFilename?: string): string {
  const combined = `${pdfFilename || ''} ${excelFilename || ''}`;
  const match = combined.match(/\b(\d{6,8})\b/);
  return match ? match[1] : 'Sin Ficha';
}

export class BatchController {
  /**
   * RF-024 al RF-031: Carga dual de PDF y Excel e inicio de lote
   */
  async uploadBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const pdfFile = files?.pdf?.[0];
      const excelFile = files?.excel?.[0];

      if (!pdfFile || !excelFile) {
        res.status(400).json({
          error: 'Debe subir obligatoriamente tanto el archivo PDF de cédulas como el archivo Excel (.xlsx)',
        });
        return;
      }

      // Validar extensiones
      const pdfExt = path.extname(pdfFile.originalname).toLowerCase();
      const excelExt = path.extname(excelFile.originalname).toLowerCase();

      if (pdfExt !== '.pdf') {
        res.status(400).json({ error: 'El archivo de cédulas debe tener formato PDF (.pdf)' });
        return;
      }

      if (excelExt !== '.xlsx' && excelExt !== '.xls') {
        res.status(400).json({ error: 'La lista de validación debe ser un archivo Excel (.xlsx o .xls)' });
        return;
      }

      // Crear registro de lote en estado QUEUED
      const batch = await prisma.processingBatch.create({
        data: {
          userId,
          pdfFilename: pdfFile.originalname,
          excelFilename: excelFile.originalname,
          status: 'QUEUED',
        },
      });

      // Encolar procesamiento en segundo plano (RF-030)
      await queueService.enqueueBatchProcessing(batch.id, pdfFile.path, excelFile.path);

      // RF-031: Responder inmediatamente al cliente
      res.status(202).json({
        mensaje: 'Archivos recibidos. El procesamiento del lote ha iniciado en segundo plano.',
        batchId: batch.id,
        status: 'QUEUED',
      });
    } catch (error: any) {
      console.error('Error en uploadBatch:', error);
      res.status(500).json({ error: `Error al iniciar el lote: ${error.message}` });
    }
  }

  /**
   * RF-065, RF-066: Transmisión Server-Sent Events (SSE) del progreso en tiempo real
   */
  streamBatchProgress(req: AuthenticatedRequest, res: Response): void {
    const { batchId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Enviar estado actual (priorizar memoria activa en QueueService para no desfasar porcentaje)
    const memProgress = queueService.getLastProgress(batchId);
    if (memProgress) {
      res.write(`data: ${JSON.stringify(memProgress)}\n\n`);
    } else {
      prisma.processingBatch.findUnique({ where: { id: batchId } }).then((b) => {
        if (b) {
          const pct = b.status === 'COMPLETED'
            ? 100
            : (b.totalPages > 0 ? Math.round((b.processedPages / b.totalPages) * 100) : 0);
          const isPaused = queueService.isPaused(batchId);
          res.write(`data: ${JSON.stringify({
            batchId: b.id,
            status: b.status,
            isPaused,
            totalPages: b.totalPages,
            processedPages: b.processedPages,
            percentage: pct,
          })}\n\n`);
        }
      });
    }

    const onProgress = (event: BatchProgressEvent) => {
      if (event.batchId === batchId) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (event.status === 'COMPLETED' || event.status === 'FAILED') {
          queueService.removeListener(`progress:${batchId}`, onProgress);
          res.end();
        }
      }
    };

    queueService.on(`progress:${batchId}`, onProgress);

    req.on('close', () => {
      queueService.removeListener(`progress:${batchId}`, onProgress);
    });
  }

  /**
   * Obtener todos los lotes de procesamiento organizados por Número de Ficha
   */
  async getAllBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const whereClause = req.user?.role === 'ADMIN' ? {} : { userId };

      const batches = await prisma.processingBatch.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              documents: true,
              excelRows: true,
            },
          },
          documents: {
            select: {
              estadoValidacion: true,
            },
          },
        },
      });

      const formattedBatches = batches.map((b) => {
        const numeroFicha = extractFichaNumber(b.pdfFilename, b.excelFilename);
        const validCount = b.documents.filter((d) => d.estadoValidacion === 'EXISTE').length;
        const discrepancyCount = b.documents.filter((d) => d.estadoValidacion === 'DISCREPANCIA').length;
        const nonExcelCount = b.documents.filter((d) => d.estadoValidacion === 'NO_EXISTE').length;
        const percentage = b.status === 'COMPLETED'
          ? 100
          : (b.totalPages > 0 ? Math.round((b.processedPages / b.totalPages) * 100) : 0);

        return {
          id: b.id,
          userId: b.userId,
          pdfFilename: b.pdfFilename,
          excelFilename: b.excelFilename,
          numeroFicha,
          status: b.status,
          totalPages: b.totalPages,
          processedPages: b.processedPages,
          percentage,
          errorMessage: b.errorMessage,
          createdAt: b.createdAt,
          completedAt: b.completedAt,
          totalDocuments: b._count.documents,
          totalExcel: b._count.excelRows,
          validCount,
          discrepancyCount,
          nonExcelCount,
        };
      });

      res.json({ batches: formattedBatches });
    } catch (error: any) {
      console.error('Error en getAllBatches:', error);
      res.status(500).json({ error: `Error al obtener listado de lotes: ${error.message}` });
    }
  }

  /**
   * Obtener el lote más reciente del usuario actual para persistencia y recuperación tras suspensión o recarga
   */
  async getLatestBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const whereClause = req.user?.role === 'ADMIN' ? {} : { userId };

      const batch = await prisma.processingBatch.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          totalPages: true,
          processedPages: true,
          pdfFilename: true,
          excelFilename: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      });

      if (!batch) {
        res.json({ batch: null });
        return;
      }

      const percentage = batch.status === 'COMPLETED'
        ? 100
        : (batch.totalPages > 0 ? Math.round((batch.processedPages / batch.totalPages) * 100) : 0);

      const numeroFicha = extractFichaNumber(batch.pdfFilename, batch.excelFilename);

      res.json({
        batch: {
          ...batch,
          numeroFicha,
        },
        percentage,
      });
    } catch (error: any) {
      console.error('Error en getLatestBatch:', error);
      res.status(500).json({ error: `Error al consultar el último lote: ${error.message}` });
    }
  }

  /**
   * Consultar estado del lote por polling
   */
  async getBatchStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const batch = await prisma.processingBatch.findUnique({
        where: { id: batchId },
        select: {
          id: true,
          status: true,
          totalPages: true,
          processedPages: true,
          pdfFilename: true,
          excelFilename: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      });

      if (!batch) {
        res.status(404).json({ error: 'Lote no encontrado' });
        return;
      }

      const numeroFicha = extractFichaNumber(batch.pdfFilename, batch.excelFilename);
      const isPaused = queueService.isPaused(batchId);
      const memProgress = queueService.getLastProgress(batchId);

      const percentage = memProgress?.percentage !== undefined
        ? memProgress.percentage
        : (batch.status === 'COMPLETED'
            ? 100
            : (batch.totalPages > 0 ? Math.round((batch.processedPages / batch.totalPages) * 100) : 0));
      const totalPages = memProgress?.totalPages || batch.totalPages;
      const processedPages = memProgress?.processedPages !== undefined ? memProgress.processedPages : batch.processedPages;

      res.json({
        batch: {
          ...batch,
          totalPages,
          processedPages,
          numeroFicha,
          isPaused,
        },
        percentage,
        isPaused,
      });
    } catch (error) {
      res.status(500).json({ error: 'Error al consultar estado del lote' });
    }
  }

  /**
   * RF-067 al RF-071: Listado de cédulas procesadas con filtros y búsqueda
   */
  async getBatchDocuments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const { tipo, estado, search } = req.query;

      const whereClause: any = { batchId };

      if (tipo && tipo !== 'TODOS') {
        whereClause.tipoDocumento = tipo;
      }

      if (estado && estado !== 'TODOS') {
        whereClause.estadoValidacion = estado;
      }

      if (search && typeof search === 'string') {
        const q = search.trim();
        whereClause.OR = [
          { numeroDocumento: { contains: q, mode: 'insensitive' } },
          { nombreCompleto: { contains: q, mode: 'insensitive' } },
          { nombres: { contains: q, mode: 'insensitive' } },
          { apellidos: { contains: q, mode: 'insensitive' } },
        ];
      }

      const documents = await prisma.extractedDocument.findMany({
        where: whereClause,
        orderBy: { createdAt: 'asc' },
      });

      res.json({ documents });
    } catch (error) {
      console.error('Error al obtener documentos del lote:', error);
      res.status(500).json({ error: 'Error al consultar documentos' });
    }
  }

  /**
   * Actualizar manualmente los datos extraídos de un documento y re-validar con el Excel del lote
   */
  async updateBatchDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId, documentId } = req.params;
      const {
        tipoDocumento,
        numeroDocumento,
        nombres,
        apellidos,
        nombreCompleto,
        fechaNacimiento,
        lugarNacimiento,
      } = req.body;

      const existingDoc = await prisma.extractedDocument.findUnique({
        where: { id: documentId },
      });

      if (!existingDoc || existingDoc.batchId !== batchId) {
        res.status(404).json({ error: 'Documento no encontrado en este lote' });
        return;
      }

      const cleanNum = numeroDocumento !== undefined && numeroDocumento !== null
        ? normalizeDocumentNumber(String(numeroDocumento))
        : existingDoc.numeroDocumento;
      const cleanTipo = tipoDocumento || existingDoc.tipoDocumento;
      const cleanNombres = nombres !== undefined ? String(nombres).trim() : existingDoc.nombres;
      const cleanApellidos = apellidos !== undefined ? String(apellidos).trim() : existingDoc.apellidos;
      const cleanFullName = (nombreCompleto !== undefined ? String(nombreCompleto).trim() : null)
        || `${cleanNombres || ''} ${cleanApellidos || ''}`.trim()
        || existingDoc.nombreCompleto;
      const cleanFechaNac = fechaNacimiento !== undefined ? String(fechaNacimiento).trim() : existingDoc.fechaNacimiento;
      const cleanLugarNac = lugarNacimiento !== undefined ? String(lugarNacimiento).trim() : existingDoc.lugarNacimiento;

      // Obtener registros oficiales de Excel del lote para revalidar
      const excelRecords = await prisma.excelRecord.findMany({
        where: { batchId },
      });

      const excelMap = new Map<string, ExcelRowItem>();
      for (const r of excelRecords) {
        excelMap.set(r.identificacionLimpia, {
          identificacionOriginal: r.identificacionOriginal,
          identificacionLimpia: r.identificacionLimpia,
          nombreOficial: r.nombreOficial,
          estadoOficial: r.estadoOficial,
        });
      }

      const isContrasena = cleanTipo === 'CONTRASENA';
      const valResult = validationService.validateDocument(
        cleanNum,
        cleanFullName || null,
        existingDoc.tieneFrente,
        existingDoc.tieneReverso,
        isContrasena,
        excelMap
      );

      const updated = await prisma.extractedDocument.update({
        where: { id: documentId },
        data: {
          tipoDocumento: cleanTipo as any,
          numeroDocumento: cleanNum,
          nombres: cleanNombres || null,
          apellidos: cleanApellidos || null,
          nombreCompleto: cleanFullName || null,
          fechaNacimiento: cleanFechaNac || null,
          lugarNacimiento: cleanLugarNac || null,
          estadoValidacion: valResult.estadoValidacion,
          estadoCompletitud: valResult.estadoCompletitud,
          detalleDiscrepancias: valResult.discrepancias ? (valResult.discrepancias as any) : null,
        },
      });

      res.json({
        mensaje: 'Documento actualizado y revalidado exitosamente',
        document: updated,
      });
    } catch (error: any) {
      console.error('Error en updateBatchDocument:', error);
      res.status(500).json({ error: `Error al actualizar documento: ${error.message}` });
    }
  }

  /**
   * RF-060, RF-061, RF-062: Reporte oficial (solo cédulas que existen en el Excel)
   */
  async getBatchReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;

      // Obtener todos los registros del Excel para este lote
      const excelRecords = await prisma.excelRecord.findMany({
        where: { batchId },
      });

      // Obtener los documentos OCR correspondientes
      const ocrDocuments = await prisma.extractedDocument.findMany({
        where: { batchId },
      });

      const ocrMap = new Map<string, any>();
      for (const doc of ocrDocuments) {
        ocrMap.set(doc.numeroDocumento, doc);
      }

      // Construir reporte filtrado exclusivamente por las personas del Excel
      const reportItems = excelRecords.map((excelRow) => {
        let ocrMatch = ocrMap.get(excelRow.identificacionLimpia);

        // Cruce secundario inteligente por nombre oficial si el número tuvo ruido de escaneo
        if (!ocrMatch) {
          for (const doc of ocrDocuments) {
            const nameToTest = doc.nombreCompleto || `${doc.nombres || ''} ${doc.apellidos || ''}`.trim();
            if (nameToTest && validationService.evaluateNameMatch(nameToTest, excelRow.nombreOficial).isStrongMatch) {
              ocrMatch = doc;
              break;
            }
          }
        }

        return {
          identificacion: excelRow.identificacionOriginal,
          identificacionLimpia: excelRow.identificacionLimpia,
          nombreOficial: excelRow.nombreOficial,
          estadoOficial: excelRow.estadoOficial,
          encontradoEnPdf: Boolean(ocrMatch),
          tipoDocumento: ocrMatch?.tipoDocumento || 'NO_DETECTADO',
          nombreOcr: ocrMatch?.nombreCompleto || `${ocrMatch?.nombres || ''} ${ocrMatch?.apellidos || ''}`.trim() || null,
          fechaNacimiento: ocrMatch?.fechaNacimiento || null,
          fotoUrl: ocrMatch?.fotoUrl || null,
          estadoValidacion: ocrMatch ? ocrMatch.estadoValidacion : 'NO_APORTADO',
          estadoCompletitud: ocrMatch ? ocrMatch.estadoCompletitud : 'INCOMPLETA',
          discrepancias: ocrMatch?.detalleDiscrepancias || null,
        };
      });

      res.json({ report: reportItems });
    } catch (error) {
      console.error('Error al generar reporte:', error);
      res.status(500).json({ error: 'Error al generar reporte del lote' });
    }
  }

  /**
   * RF-064: Exportar reporte a Excel (.xlsx)
   */
  async exportBatchExcel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;

      const excelRecords = await prisma.excelRecord.findMany({ where: { batchId } });
      const ocrDocuments = await prisma.extractedDocument.findMany({ where: { batchId } });

      const ocrMap = new Map<string, any>();
      for (const doc of ocrDocuments) {
        ocrMap.set(doc.numeroDocumento, doc);
      }

      const rowsForExport = excelRecords.map((item, idx) => {
        let match = ocrMap.get(item.identificacionLimpia);
        if (!match) {
          for (const doc of ocrDocuments) {
            const nameToTest = doc.nombreCompleto || `${doc.nombres || ''} ${doc.apellidos || ''}`.trim();
            if (nameToTest && validationService.evaluateNameMatch(nameToTest, item.nombreOficial).isStrongMatch) {
              match = doc;
              break;
            }
          }
        }

        return {
          'No.': idx + 1,
          'Número Identificación': item.identificacionOriginal,
          'Nombre Oficial': item.nombreOficial,
          'Estado Inscripción': item.estadoOficial,
          'Encontrado en PDF': match ? 'SÍ' : 'NO',
          'Tipo Documento': match?.tipoDocumento || 'N/A',
          'Nombre Extraído (OCR)': match?.nombreCompleto || 'N/A',
          'Fecha Nacimiento (OCR)': match?.fechaNacimiento || 'N/A',
          'Estado Validación': match ? match.estadoValidacion : 'DOCUMENTO NO APORTADO',
          'Completitud': match ? match.estadoCompletitud : 'INCOMPLETA',
        };
      });

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(rowsForExport);
      xlsx.utils.book_append_sheet(wb, ws, 'Reporte de Validación');

      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', `attachment; filename=Reporte_Validacion_${batchId}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buf);
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      res.status(500).json({ error: 'Error al exportar reporte a Excel' });
    }
  }

  /**
   * Eliminar todos los lotes y registros generados por la carga de archivos
   */
  async deleteAllBatches(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const deleteDocs = await prisma.extractedDocument.deleteMany({});
      const deleteExcel = await prisma.excelRecord.deleteMany({});
      const deleteBatches = await prisma.processingBatch.deleteMany({});

      // Limpiar archivos temporales de subida
      const tempDir = path.resolve(__dirname, '../../uploads/temp');
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignorar archivos en uso
          }
        }
      }

      res.status(200).json({
        mensaje: 'Todos los datos de lotes y archivos cargados fueron eliminados exitosamente de la base de datos.',
        deletedBatches: deleteBatches.count,
        deletedDocuments: deleteDocs.count,
        deletedExcelRows: deleteExcel.count,
      });
    } catch (error: any) {
      console.error('Error en deleteAllBatches:', error);
      res.status(500).json({ error: `Error al eliminar los datos: ${error.message}` });
    }
  }

  /**
   * Eliminar un lote específico y sus documentos asociados
   */
  async deleteBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      await prisma.extractedDocument.deleteMany({ where: { batchId } });
      await prisma.excelRecord.deleteMany({ where: { batchId } });
      await prisma.processingBatch.delete({ where: { id: batchId } });

      res.status(200).json({
        mensaje: 'Lote y sus registros asociados eliminados exitosamente de la base de datos.',
      });
    } catch (error: any) {
      console.error('Error en deleteBatch:', error);
      res.status(500).json({ error: `Error al eliminar el lote: ${error.message}` });
    }
  }

  /**
   * Pausar el procesamiento de un lote
   */
  async pauseBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const success = queueService.pauseBatch(batchId);
      if (!success) {
        res.status(400).json({ error: 'No se pudo pausar el lote. Verifique que esté en proceso y no esté pausado o finalizado.' });
        return;
      }
      res.json({ mensaje: 'Lote pausado exitosamente', isPaused: true });
    } catch (error: any) {
      console.error('Error en pauseBatch:', error);
      res.status(500).json({ error: `Error al pausar el lote: ${error.message}` });
    }
  }

  /**
   * Reanudar el procesamiento de un lote pausado
   */
  async resumeBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const success = queueService.resumeBatch(batchId);
      if (!success) {
        res.status(400).json({ error: 'No se pudo reanudar el lote. Verifique que esté actualmente en pausa.' });
        return;
      }
      res.json({ mensaje: 'Lote reanudado exitosamente', isPaused: false });
    } catch (error: any) {
      console.error('Error en resumeBatch:', error);
      res.status(500).json({ error: `Error al reanudar el lote: ${error.message}` });
    }
  }

  /**
   * Cancelar el procesamiento de un lote
   */
  async cancelBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { batchId } = req.params;
      const success = queueService.cancelBatch(batchId);
      if (!success) {
        const batch = await prisma.processingBatch.findUnique({ where: { id: batchId } });
        if (batch && (batch.status === 'PROCESSING' || batch.status === 'QUEUED')) {
          await prisma.processingBatch.update({
            where: { id: batchId },
            data: { status: 'FAILED', errorMessage: 'Procesamiento cancelado por el usuario' },
          });
        }
      }
      res.json({ mensaje: 'Procesamiento de lote cancelado exitosamente', cancelled: true });
    } catch (error: any) {
      console.error('Error en cancelBatch:', error);
      res.status(500).json({ error: `Error al cancelar el lote: ${error.message}` });
    }
  }
}

export const batchController = new BatchController();
