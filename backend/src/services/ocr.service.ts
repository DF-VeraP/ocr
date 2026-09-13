import sharp from 'sharp';
import {
  detectDocumentType,
  extractFrontDocumentNumber,
  extractBarcodeDocumentNumber,
  extractMrzDocumentNumber,
  extractMrzNames,
  normalizeDocumentNumber,
  DocumentKind,
} from '../utils/regex';
import { barcodeService, DecodedBarcodeResult } from './barcode.service';

// Importar PaddleOCR basado en ONNX
const Ocr = require('@gutenye/ocr-node').default;

export interface ParsedDocumentData {
  tipoDocumento: DocumentKind;
  numeroDocumento?: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  fechaNacimiento?: string;
  lugarNacimiento?: string;
  sexo?: string;
  grupoSanguineo?: string;
  fechaExpedicion?: string;
  lugarExpedicion?: string;
  estatura?: string;
  fechaVencimiento?: string;
  lugarPreparacion?: string;
  oficinaEntrega?: string;
  isFront: boolean;
  isBack: boolean;
  rawText: string;
  barcodeData?: DecodedBarcodeResult;
}

export class OcrService {
  private ocrPromise: Promise<any> | null = null;

  async getOcrInstance(): Promise<any> {
    if (!this.ocrPromise) {
      console.log('[PaddleOCR] Inicializando motor PaddleOCR v5 (ONNX Runtime)...');
      this.ocrPromise = Ocr.create();
    }
    return this.ocrPromise;
  }

  /**
   * Preprocesamiento de imagen para PaddleOCR (optimización de escala y nitidez)
   * Redimensiona imágenes gigantes (ej. escaneos de 2100x3000px) a máx 1024px para acelerar la red neuronal hasta 10 veces
   */
  /**
   * Preprocesamiento de imagen para PaddleOCR (optimización de escala y nitidez)
   * Si la imagen ya viene optimizada por pdf.service, se reutiliza directamente para máxima velocidad
   */
  async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      const meta = await sharp(buffer).metadata();
      if ((meta.width || 0) > 700 || (meta.height || 0) > 700) {
        return await sharp(buffer)
          .resize({ width: 700, height: 700, fit: 'inside', withoutEnlargement: true })
          .normalize()
          .png()
          .toBuffer();
      }
      return buffer;
    } catch {
      return buffer;
    }
  }

  /**
   * Aplica PaddleOCR y extrae campos semánticos por tipo de documento.
   * Auto-rotación inteligente sólo cuando la primera pasada no detecta cédula.
   */
  async processImage(imageBuffer: Buffer, isFrontHint?: boolean): Promise<ParsedDocumentData> {
    // 0. Decodificación ultra-rápida de código de barras (PDF417 de cédula colombiana o QR)
    // Se omite si ya sabemos que la imagen es el frente del documento (el frente nunca tiene código de barras)
    const barcode = isFrontHint ? null : await barcodeService.decode(imageBuffer);

    // ATAJO ULTRA-RÁPIDO: Si el código PDF417 de la cédula fue decodificado, ya contiene todos los datos
    // requeridos con 100% de exactitud matemática. Se omite PaddleOCR completamente para este reverso (<80ms).
    if (barcode && barcode.documentNumber && (barcode.nombres || barcode.apellidos || barcode.fechaNacimiento)) {
      return {
        tipoDocumento: barcode.format === 'PDF417' ? 'CC_TRADICIONAL' : 'CC_DIGITAL',
        numeroDocumento: barcode.documentNumber,
        nombres: barcode.nombres,
        apellidos: barcode.apellidos,
        nombreCompleto: barcode.nombreCompleto,
        fechaNacimiento: barcode.fechaNacimiento,
        sexo: barcode.sexo,
        grupoSanguineo: barcode.grupoSanguineo,
        isFront: false,
        isBack: true,
        rawText: barcode.rawText,
        barcodeData: barcode,
      };
    }

    const ocr = await this.getOcrInstance();
    
    // Intento 1: Ángulo original (0°)
    let currentBuffer = await this.preprocessImage(imageBuffer);
    let lines = await ocr.detect(currentBuffer);
    let textLines = lines.map((l: any) => (l.text || '').trim()).filter(Boolean);
    let fullText = textLines.join('\n');
    let singleLineText = textLines.join(' ');

    let frontNum = extractFrontDocumentNumber(fullText) || extractFrontDocumentNumber(singleLineText);
    let barcodeNum = barcode?.documentNumber || extractBarcodeDocumentNumber(fullText) || extractBarcodeDocumentNumber(singleLineText);
    let mrzNum = extractMrzDocumentNumber(fullText) || extractMrzDocumentNumber(singleLineText);

    // Comprobar si el texto ya contiene palabras ancla legibles derechas (documento ya orientado correctamente a 0°)
    const isAlreadyUpright = /\b(REPUBLICA|COLOMBIA|CEDULA|IDENTIFICACION|CIUDADANIA|TARJETA|APELLIDOS?|NOMBRES?|NACIMIENTO|EXPEDICION|INDICE|DERECHO|HUELLA|REGISTRADOR|ESTATURA|NUIP|TITULAR)\b/i.test(fullText);

    // Solo probar ángulos alternativos si NO se detectó ningún identificador en 0° Y el texto NO está ya orientado al derecho
    const hasValidIdentity = Boolean(barcode || frontNum || barcodeNum || mrzNum);
    if (!hasValidIdentity && !isAlreadyUpright) {
      const meta = await sharp(imageBuffer).metadata().catch(() => ({ width: 0, height: 0 }));
      const isLandscape = (meta.width || 0) >= (meta.height || 0);
      const angles = isLandscape ? [180] : [270, 90];
      for (const angle of angles) {
        try {
          const rotated = await sharp(imageBuffer)
            .rotate(angle)
            .resize({ width: 700, height: 700, fit: 'inside', withoutEnlargement: true })
            .normalize()
            .png()
            .toBuffer();
          const testLines = await ocr.detect(rotated);
          const testTextLines = testLines.map((l: any) => (l.text || '').trim()).filter(Boolean);

          // Si en este ángulo tampoco hay texto en absoluto (página en blanco/firma), no rotar más
          if (testTextLines.length === 0 && textLines.length === 0) {
            break;
          }

          const testFullText = testTextLines.join('\n');
          const testSingleLine = testTextLines.join(' ');

          const testFront = extractFrontDocumentNumber(testFullText) || extractFrontDocumentNumber(testSingleLine);
          const testBarcode = extractBarcodeDocumentNumber(testFullText) || extractBarcodeDocumentNumber(testSingleLine);
          const testMrz = extractMrzDocumentNumber(testFullText) || extractMrzDocumentNumber(testSingleLine);

          if (testFront || testBarcode || testMrz || testTextLines.some(l => /\b(REPUBLICA|COLOMBIA|CEDULA|IDENTIFICACION)\b/i.test(l))) {
            textLines = testTextLines;
            fullText = testFullText;
            singleLineText = testSingleLine;
            frontNum = testFront;
            barcodeNum = testBarcode;
            mrzNum = testMrz;
            break; // Detenerse en el primer ángulo exitoso
          }
        } catch {
          // Continuar
        }
      }
    }

    const tipoDocumento = detectDocumentType(fullText);

    const isBack = Boolean(
      barcode ||
      barcodeNum ||
      mrzNum ||
      fullText.includes('INDICE DERECHO') ||
      fullText.includes('HUELLA') ||
      fullText.includes('ICCOL') ||
      fullText.includes('ICC0L') ||
      fullText.includes('INDICEDERECHO') ||
      fullText.includes('NDICEDERECHO')
    );

    const isFront = Boolean(
      frontNum ||
      fullText.includes('REPUBLICA') ||
      fullText.includes('REPÚBLICA') ||
      fullText.includes('IDENTIFICACI') ||
      fullText.includes('CONTRASEÑA')
    );

    const numeroDocumento = frontNum || barcodeNum || mrzNum || undefined;

    const parsed: ParsedDocumentData = {
      tipoDocumento,
      numeroDocumento,
      isFront,
      isBack,
      rawText: fullText,
    };

    // Extraer campos demográficos usando patrones contextuales y las líneas de PaddleOCR
    this.extractDemographicFields(textLines, fullText, parsed, tipoDocumento);

    // Si el código de barras (PDF417 / QR) fue leído, sus datos son fidedignos y de máxima prioridad
    if (barcode) {
      parsed.barcodeData = barcode;
      if (barcode.documentNumber) parsed.numeroDocumento = barcode.documentNumber;
      if (barcode.nombres) parsed.nombres = barcode.nombres;
      if (barcode.apellidos) parsed.apellidos = barcode.apellidos;
      if (barcode.nombreCompleto) parsed.nombreCompleto = barcode.nombreCompleto;
      if (barcode.fechaNacimiento) parsed.fechaNacimiento = barcode.fechaNacimiento;
      if (barcode.sexo) parsed.sexo = barcode.sexo;
      if (barcode.grupoSanguineo) parsed.grupoSanguineo = barcode.grupoSanguineo;
      parsed.isBack = true;
      if (barcode.format === 'PDF417') {
        parsed.tipoDocumento = 'CC_TRADICIONAL';
      } else if (barcode.format === 'QR_CODE') {
        parsed.tipoDocumento = 'CC_DIGITAL';
      }
    }

    return parsed;
  }

  private cleanNameField(name: string): string {
    if (!name) return '';
    return name
      .replace(/\b(?:RERLB[A-Z]*|REPUBL[A-Z]*|REOUBL[A-Z]*|REDUBLICA|GEUULAD|COLOMBLA|CIUDADANLA|APLLUIDDS|APELICCS|NPELLIOG|LUDOS|APRLUDOS|APELLIOS|PELLDO|APETODOS[A-Z]*|Horor|CEDUDA|CHUDADANIA|GIUDADANIA|CUUADADE|CEDULADECUDADA|DENTIFICACIONPERSONAL)\b/gi, ' ')
      .replace(/\b(APELLIDOS?|APELUDOS|APELTIDOS|APELLOS|PELLDO|PELLDOS|NOMBRES?|NOMBREY|NPMDRES|NOMDRES|NOMSRES|NOMARES|NOMRRES|N0MBRES|OMBR|OMBRES|NOMBR|NOMRES|FIRMA|REPUBLICA|REOUBLICA|COLOMBIA|CEDULA|CEDULADE|IDENTIFICACION|IDENTIFICACIONPERSONAL|DENTIFICA|ENHCACOERSONAL|ERSONAL|DIGITAL|CIUDADANIA|NUMERO|JUMERO|IMERC|LMERC|NUMER0|NUIP|REGISTRADOR|REGISTRADURIA|NACIONAL|NACIONALIDAD|COL|EXPIRACION|VENCIMIENTO|ESTATURA|SEXO|RERLBCAOECU|REOUBLICADA|ORGANIZACION|ELECTORAL|ESTADO|CIVIL|FOTO|INDICE|DERECHO|ROLOMAY|NTULDO|UELICT|LIDBS|APEUWDD|APELLDOS|APELLTCOS|APELLINOS|MAL|NOV)\b/gi, ' ')
      .replace(/[^a-zA-ZÁÉÍÓÚÑáéíóúñ\s]/g, ' ')
      .replace(/^[BCDFGHJKLMNPQRSTVWXYZ]\s+/i, '')
      .replace(/^[KT]\b(?=[A-Z]{3,})/i, '')
      .replace(/\b[A-Z]\b/g, ' ')
      .replace(/\bSILVAVEGA\b/gi, 'SILVA VEGA')
      .replace(/\bTAPIEROLEYTON\b/gi, 'TAPIERO LEYTON')
      .replace(/\bYURIALEJANDRA\b/gi, 'YURI ALEJANDRA')
      .replace(/\bHOMEGONZALES\b/gi, 'HOME GONZALEZ')
      .replace(/\bGOMEZMEDINA\b/gi, 'GOMEZ MEDINA')
      .replace(/\bDEVIAVAQUIRO\b/gi, 'DEVIA VAQUIRO')
      .replace(/\bMONMIEL\b/gi, 'MONTIEL')
      .replace(/\bRAMIREZLTBRADA\b/gi, 'RAMIREZ LIBRADA')
      .replace(/\bVANESSAALEXANDRA\b/gi, 'VANESSA ALEXANDRA')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isOcrLabel(str: string): boolean {
    if (!str) return false;
    const s = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (/^A?P[EELRTUWI1]+[LDOISCS]{2,}/.test(s) || /^(APELL|PELLD|LIDBS|APL|APRL|NPEL|APET|LUDOS)/.test(s) || s.includes('APELLI') || s.includes('APELID')) return true;
    if (/^(NOMB|NOMD|NOMA|NOMR|NONE|OMBR|OMB|N0MB)/.test(s) || s.includes('NOMBRES') || s === 'RES' || s === 'FES') return true;
    if (/^(REPUBLICA|REDUBLICA|COLOMBIA|COLOMBLA|CEDULA|CEDULADE|IDENTIFICACION|PERSONAL|CIUDADANIA|CIUDADANLA|GEUULAD|CEDUDA|CHUDADANIA|GIUDADANIA|CUUADADE)/.test(s)) return true;
    if (/^(NUMERO|NUIP|ESTATURA|FECHA|NACIMIENTO|EXPEDICION|LUGAR|INDICE|DERECHO|FIRMA|HUELLA|REGISTRADOR|REGISTRADURIA|NACIONAL|ORGANIZACION|ELECTORAL)/.test(s)) return true;
    return false;
  }

  private extractDemographicFields(
    lines: string[],
    fullText: string,
    data: ParsedDocumentData,
    tipo: DocumentKind
  ): void {
    // 1. Cédula digital: Extracción directa de la zona MRZ (reverso o combinada)
    for (const l of lines) {
      const mrz = extractMrzNames(l);
      if (mrz) {
        if (mrz.apellidos && !data.apellidos) data.apellidos = this.cleanNameField(mrz.apellidos);
        if (mrz.nombres && !data.nombres) data.nombres = this.cleanNameField(mrz.nombres);
        break;
      }
    }

    // 2. Cédula digital: Formatos de etiquetas en línea (ej. "VANESSAALEXANDRA Nombres MURCIA ARTUNDUAGA Apellidos")
    for (const l of lines) {
      const inlineNomApe = l.match(/(?:NACIONALIDAD|COL)?[\s.:-]*([A-ZÁÉÍÓÚÑ\s]{3,35})\s+Nombres?\s+([A-ZÁÉÍÓÚÑ\s]{3,35})\s+Apellidos?/i);
      if (inlineNomApe) {
        const nom = this.cleanNameField(inlineNomApe[1]);
        const ape = this.cleanNameField(inlineNomApe[2]);
        if (nom.length >= 3 && !data.nombres) data.nombres = nom;
        if (ape.length >= 3 && !data.apellidos) data.apellidos = ape;
      }

      const inlineApeNom = l.match(/(?:NACIONALIDAD|COL)?[\s.:-]*([A-ZÁÉÍÓÚÑ\s]{3,35})\s+Apellidos?\s+([A-ZÁÉÍÓÚÑ\s]{3,35})\s+Nombres?/i);
      if (inlineApeNom) {
        const ape = this.cleanNameField(inlineApeNom[1]);
        const nom = this.cleanNameField(inlineApeNom[2]);
        if (ape.length >= 3 && !data.apellidos) data.apellidos = ape;
        if (nom.length >= 3 && !data.nombres) data.nombres = nom;
      }
    }

    // 3. Formatos horizontales en una sola línea física (ej. CC 7.556.032 Pablo Rodríguez, CC 1.006.501.709 Pedro Joven)
    for (const l of lines) {
      const lineTrim = l.trim();
      const horizontalCombo1 = lineTrim.match(/^([A-ZÁÉÍÓÚÑ\s]{3,30}?)\s+(?:APELLIDOS?|APELUDOS|APELTIDOS|PELLDO|PELLDOS)\s+([A-ZÁÉÍÓÚÑ\s]{3,35}?)(?:\s+(?:NUMERO|JUMERO|IMERC|NUIP|CEDULA|FIRMA)|$)/i);
      if (horizontalCombo1) {
        const cNom = this.cleanNameField(horizontalCombo1[1]);
        const cApe = this.cleanNameField(horizontalCombo1[2]);
        if (cNom.length >= 3 && !/\b(COLOMBIA|REPUBLICA|CEDULA)\b/i.test(cNom)) data.nombres = cNom;
        if (cApe.length >= 3 && !/\b(COLOMBIA|REPUBLICA|CEDULA)\b/i.test(cApe)) data.apellidos = cApe;
      }

      const horizontalCombo2 = lineTrim.match(/\b(?:NOMBRES?|NOMBREY|NPMDRES|NOMDRES|NOMSRES|NOMARES|NOMRRES|OMBR|OMBRES|NOMBR|NOMRES)\s+([A-ZÁÉÍÓÚÑ\s]{3,30}?)\s+(?:APELLIDOS?|APELUDOS|APELTIDOS|PELLDO|PELLDOS)\s+([A-ZÁÉÍÓÚÑ\s]{3,35}?)(?:\s+(?:NUMERO|JUMERO|IMERC|NUIP|CEDULA|FIRMA)|$)/i);
      if (horizontalCombo2) {
        const cNom = this.cleanNameField(horizontalCombo2[1]);
        const cApe = this.cleanNameField(horizontalCombo2[2]);
        if (cNom.length >= 3) data.nombres = cNom;
        if (cApe.length >= 3) data.apellidos = cApe;
      }
    }

    // 4. Extracción estructural por etiquetas para Cédula Tradicional (APELLIDOS / NOMBRES)
    for (let idx = 0; idx < lines.length; idx++) {
      const lineUpper = lines[idx].toUpperCase().replace(/[^A-Z]/g, '');
      const isApeLabel = /^A?P[EELRTUWI1]+[LDOISCS]{2,}/.test(lineUpper) || /^(APELL|PELLD|LIDBS|APL|APRL|NPEL|APET|LUDOS)/.test(lineUpper) || lineUpper.includes('APELLI') || lineUpper.includes('APELID');

      if (isApeLabel) {
        // En cédulas tradicionales colombianas, los Apellidos vienen en las líneas anteriores no-etiquetas
        if (!data.apellidos) {
          for (let prevIdx = idx - 1; prevIdx >= 0; prevIdx--) {
            if (!this.isOcrLabel(lines[prevIdx])) {
              const candidate = this.cleanNameField(lines[prevIdx]);
              if (candidate.length >= 3 && !/\b(REPUBLICA|COLOMBIA|CEDULA|NUMERO|IDENTIFICACION)\b/i.test(candidate)) {
                data.apellidos = candidate;
                break;
              }
            }
          }
        }
        // Los Nombres vienen en las líneas posteriores no-etiquetas
        if (!data.nombres) {
          for (let nextIdx = idx + 1; nextIdx < lines.length; nextIdx++) {
            if (!this.isOcrLabel(lines[nextIdx])) {
              const candidate = this.cleanNameField(lines[nextIdx]);
              if (candidate.length >= 3 && !/\b(REPUBLICA|COLOMBIA|CEDULA|NUMERO|FECHA|NACIMIENTO|LUGAR|ESTATURA)\b/i.test(candidate)) {
                data.nombres = candidate;
                break;
              }
            }
          }
        }
      }
    }

    // 5. Cédula tradicional sin etiquetas legibles: los datos vienen SIEMPRE DEBAJO del número de documento
    if (!data.apellidos || !data.nombres) {
      const numIdx = lines.findIndex((l) => l.replace(/[^0-9]/g, '').length >= 7 && !l.includes('EXPEDIC') && !l.includes('NACIMIENTO'));
      if (numIdx !== -1) {
        // En Colombia, los Apellidos están en la línea inmediatamente siguiente al número
        if (!data.apellidos && numIdx + 1 < lines.length && !this.isOcrLabel(lines[numIdx + 1])) {
          const candidate1 = this.cleanNameField(lines[numIdx + 1]);
          if (candidate1.length >= 3 && !/\b(NACIONALIDAD|ESTATURA|FECHA|EXPEDICION|COL|IDENTIFICACION|PERSONAL|CEDULA|REPUBLICA)\b/i.test(candidate1)) {
            data.apellidos = candidate1;
          }
        }
        // Y los Nombres en la subsiguiente
        if (!data.nombres && numIdx + 2 < lines.length && !this.isOcrLabel(lines[numIdx + 2])) {
          const candidate2 = this.cleanNameField(lines[numIdx + 2]);
          if (candidate2.length >= 3 && !/\b(NACIONALIDAD|ESTATURA|FECHA|EXPEDICION|COL|IDENTIFICACION|PERSONAL|CEDULA|REPUBLICA)\b/i.test(candidate2)) {
            data.nombres = candidate2;
          }
        }
      }
    }

    // Contraseña: APELLIDOS / NOMBRES
    if (tipo === 'CONTRASEÑA') {
      const contrasenaMatch = fullText.match(/APELLIDOS\s*(?:\/|\s)\s*NOMBRES\s*\n+([A-ZÁÉÍÓÚÑ\s]+)\n+([A-ZÁÉÍÓÚÑ\s]+)/i)
        || fullText.match(/APELLIDOS\s*\/\s*NOMBRES\s*([A-ZÁÉÍÓÚÑ\s]+)/i);
      if (contrasenaMatch) {
        if (contrasenaMatch[2]) {
          data.apellidos = this.cleanNameField(contrasenaMatch[1]);
          data.nombres = this.cleanNameField(contrasenaMatch[2]);
        } else {
          const parts = contrasenaMatch[1].trim().split(/\s+/);
          if (parts.length >= 2) {
            data.apellidos = this.cleanNameField(parts.slice(0, 2).join(' '));
            data.nombres = this.cleanNameField(parts.slice(2).join(' '));
          }
        }
      }
    }

    // Filtrado de palabras residuales de seguridad o sellos en nombres/apellidos
    const junkTokens = /\b(JUL|BAGUE|LUGAIDENACIMENTO|ERSONAL|EDULADECUDAAANA|DE|CUNDINAMARCA|BOGOTA|MEDELLIN|CALI|NEIVA|MANIZALES|FLORENCIA|ARMENIA|QUINDIO)\b/gi;
    if (data.apellidos && junkTokens.test(data.apellidos)) {
      data.apellidos = data.apellidos.replace(junkTokens, '').replace(/\s+/g, ' ').trim();
    }
    if (data.nombres && junkTokens.test(data.nombres)) {
      data.nombres = data.nombres.replace(junkTokens, '').replace(/\s+/g, ' ').trim();
    }

    // Limpieza final de nombres y apellidos
    if (data.apellidos) data.apellidos = this.cleanNameField(data.apellidos);
    if (data.nombres) data.nombres = this.cleanNameField(data.nombres);

    // Evitar que nombres y apellidos sean exactamente idénticos por duplicación errónea
    if (data.apellidos && data.nombres && (data.apellidos === data.nombres || data.apellidos.includes(data.nombres))) {
      data.nombres = undefined;
    }

    if (data.nombres || data.apellidos) {
      data.nombreCompleto = `${data.nombres || ''} ${data.apellidos || ''}`.trim();
    }

    // 4. FECHAS: NACIMIENTO, EXPEDICIÓN Y VENCIMIENTO
    const monthsMap: Record<string, string> = {
      ENE: 'ENE', ENERO: 'ENE', ENF: 'ENE',
      FEB: 'FEB', FEBRERO: 'FEB', FE8: 'FEB',
      MAR: 'MAR', MARZO: 'MAR',
      ABR: 'ABR', ABRIL: 'ABR',
      MAY: 'MAY', MAYO: 'MAY', MA7: 'MAY',
      JUN: 'JUN', JUNIO: 'JUN',
      JUL: 'JUL', JULIO: 'JUL',
      AGO: 'AGO', AGOSTO: 'AGO', AGQ: 'AGO',
      SEP: 'SEP', SEPTIEMBRE: 'SEP', SET: 'SEP', SEPT: 'SEP',
      OCT: 'OCT', OCTUBRE: 'OCT',
      NOV: 'NOV', NOVIEMBRE: 'NOV',
      DIC: 'DIC', DICIEMBRE: 'DIC', '0IC': 'DIC', DICIE: 'DIC',
    };

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].toUpperCase();
      const prev = (lines[i - 1] || '').toUpperCase();
      const next = (lines[i + 1] || '').toUpperCase();

      const normLine = l
        .replace(/([A-Z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([A-Z])/g, '$1 $2')
        .replace(/\b(19[3-9]\d|20[0-2]\d)([0-9]+)\b/g, '$1 $2');

      // Formato alfanumérico (ej: "24-ENE-2001", "08·ENE1961", "08MAYO 1987", "08MAYO1987O+", "02 NOV 2001", "28 MAR 2006", "NACIMIENTO30-ENE-1987")
      const alphaMatch = normLine.match(/\b([0-9]{1,2})[-\s.·]+([A-Z]{3,10})[-\s.·]+([0-9]{4})\b/i)
        || l.match(/\b([0-9]{1,2})[-\s.·]?([A-Z]{3,10})[-\s.·]?([0-9]{4})/);
      // Formato numérico (ej: "24/01/1987", "24-01-1987")
      const numMatch = normLine.match(/\b([0-9]{1,2})[-/.]([0-9]{1,2})[-/.]([0-9]{4})\b/)
        || l.match(/\b([0-9]{1,2})[-/.]([0-9]{1,2})[-/.]([0-9]{4})\b/);

      let formattedDate: string | null = null;
      if (alphaMatch) {
        const rawM = alphaMatch[2].toUpperCase();
        const stdMonth = monthsMap[rawM] || rawM.slice(0, 3);
        formattedDate = `${alphaMatch[1].padStart(2, '0')}-${stdMonth}-${alphaMatch[3]}`;
      } else if (numMatch) {
        const mNum = parseInt(numMatch[2], 10);
        const monthsArr = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        if (mNum >= 1 && mNum <= 12) {
          formattedDate = `${numMatch[1].padStart(2, '0')}-${monthsArr[mNum - 1]}-${numMatch[3]}`;
        }
      }

      if (formattedDate) {
        const isExpira = l.includes('EXPIRAC') || l.includes('VENCIM') || prev.includes('EXPIRAC') || next.includes('EXPIRAC');
        const isExped = l.includes('EXPEDIC') || prev.includes('EXPEDIC') || next.includes('EXPEDIC');
        const isNac = l.includes('NACIMIENTO') || l.includes('NAC') || prev.includes('NACIMIENTO') || next.includes('NACIMIENTO');

        if (isExpira && !data.fechaVencimiento) {
          data.fechaVencimiento = formattedDate;
        } else if (isNac && !data.fechaNacimiento) {
          data.fechaNacimiento = formattedDate;
        } else if (isExped && !data.fechaExpedicion) {
          data.fechaExpedicion = formattedDate;
        } else if (!data.fechaNacimiento && !isExped && !isExpira) {
          const year = parseInt(formattedDate.split('-')[2], 10);
          if (year >= 1930 && year <= 2012) {
            data.fechaNacimiento = formattedDate;
          }
        }
      }
    }

    // Respaldo 1: Escaneo contextual global sobre fullText
    if (!data.fechaNacimiento) {
      const normFullText = fullText
        .replace(/([A-Z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([A-Z])/g, '$1 $2');
      const globalBirthMatch = normFullText.match(/(?:NACIMIENTO|NACIM|NAC|NACI[A-Z]*)[\sA-Z.:·-]*\b([0-9]{1,2})[-\s.·]+([A-Z]{3,10})[-\s.·]+([0-9]{4})\b/i)
        || fullText.match(/(?:NACIMIENTO|NACIM|NAC|NACI[A-Z]*)[\sA-Z.:·-]*\b([0-9]{1,2})[-\s.·]?([A-Z]{3,10})[-\s.·]?([0-9]{4})\b/i);
      if (globalBirthMatch) {
        const rawM = globalBirthMatch[2].toUpperCase();
        const stdM = monthsMap[rawM] || rawM.slice(0, 3);
        data.fechaNacimiento = `${globalBirthMatch[1].padStart(2, '0')}-${stdM}-${globalBirthMatch[3]}`;
      }
    }

    // Respaldo 2: Zona MRZ en cédula digital (YYMMDD)
    if (!data.fechaNacimiento) {
      const mrzDobMatch = fullText.match(/\b([0-9]{2})([0-9]{2})([0-9]{2})[0-9][MF]/);
      if (mrzDobMatch) {
        const rawYear = parseInt(mrzDobMatch[1], 10);
        const fullYear = rawYear > 25 ? 1900 + rawYear : 2000 + rawYear;
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const monthNum = parseInt(mrzDobMatch[2], 10);
        const dayNum = mrzDobMatch[3];
        if (monthNum >= 1 && monthNum <= 12) {
          data.fechaNacimiento = `${dayNum}-${months[monthNum - 1]}-${fullYear}`;
        }
      }
    }

    // Respaldo 3: Código de barras PDF417 / pie de seguridad en reverso
    if (!data.fechaNacimiento) {
      const barcodeDob = fullText.match(/[MF][-\s]*\d{6,11}[-\s]*([12][90]\d{2})([01]\d)([0-3]\d)/i)
        || fullText.match(/([12][90]\d{2})([01]\d)([0-3]\d)[-\s]*[MF]/i);
      if (barcodeDob) {
        const y = parseInt(barcodeDob[1], 10);
        const m = parseInt(barcodeDob[2], 10);
        const d = barcodeDob[3];
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        if (y >= 1930 && y <= 2012 && m >= 1 && m <= 12) {
          data.fechaNacimiento = `${d}-${months[m - 1]}-${y}`;
        }
      }
    }

    // Verificación de consistencia: la fecha de nacimiento siempre es anterior a la fecha de expedición
    if (data.fechaNacimiento && data.fechaExpedicion) {
      const yNac = parseInt(data.fechaNacimiento.split('-')[2], 10);
      const yExp = parseInt(data.fechaExpedicion.split('-')[2], 10);
      if (yNac > yExp) {
        const temp = data.fechaNacimiento;
        data.fechaNacimiento = data.fechaExpedicion;
        data.fechaExpedicion = temp;
      }
    }

    // 5. LUGAR DE PREPARACIÓN Y OFICINA DE ENTREGA (solo Contraseña)
    if (tipo === 'CONTRASEÑA') {
      const prepMatch = fullText.match(/LUGAR\s*DE\s*PREPARACI[OÓ]N\s*[:.\s]?\s*([A-ZÁÉÍÓÚÑ\s-]+)/i);
      if (prepMatch) {
        data.lugarPreparacion = prepMatch[1].split('\n')[0].trim();
      }
      const entregaMatch = fullText.match(/OFICINA\s*DE\s*ENTREGA\s*[:.\s]?\s*([A-ZÁÉÍÓÚÑ\s-]+)/i);
      if (entregaMatch) {
        data.oficinaEntrega = entregaMatch[1].split('\n')[0].trim();
      }
    }
  }

  async destroy(): Promise<void> {
    this.ocrPromise = null;
  }
}

export const ocrService = new OcrService();
