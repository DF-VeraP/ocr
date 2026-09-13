import sharp from 'sharp';
import {
  BinaryBitmap,
  HybridBinarizer,
  RGBLuminanceSource,
  PDF417Reader,
  QRCodeReader,
  DecodeHintType,
  BarcodeFormat,
} from '@zxing/library';

export interface DecodedBarcodeResult {
  format: 'PDF417' | 'QR_CODE' | 'OTHER';
  rawText: string;
  documentNumber?: string;
  primerApellido?: string;
  segundoApellido?: string;
  primerNombre?: string;
  segundoNombre?: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  sexo?: string;
  fechaNacimiento?: string;
  grupoSanguineo?: string;
  municipioCodigo?: string;
  afisCodigo?: string;
}

export class BarcodeService {
  private pdf417Reader = new PDF417Reader();
  private qrReader = new QRCodeReader();
  private pdf417Hints = new Map<DecodeHintType, any>();
  private qrHints = new Map<DecodeHintType, any>();

  constructor() {
    this.pdf417Hints.set(DecodeHintType.TRY_HARDER, true);
    this.pdf417Hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

    this.qrHints.set(DecodeHintType.TRY_HARDER, true);
    this.qrHints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  }

  /**
   * Decodifica la estructura estándar de una cédula de ciudadanía colombiana (PDF417).
   * La Registraduría Nacional codifica los datos tras la cabecera "PubDSK_":
   * - Offset 16..24: Código AFIS / dactilar (8 caracteres)
   * - Offset 24..34: Número de cédula (10 caracteres con ceros a la izquierda)
   * - Offset 34..57: Primer apellido (23 caracteres)
   * - Offset 57..80: Segundo apellido (23 caracteres)
   * - Offset 80..103: Primer nombre (23 caracteres)
   * - Offset 103..126: Segundo nombre (23 caracteres)
   * - Offset 126..128: Sexo (M/F)
   * - Offset 128..136: Fecha de nacimiento YYYYMMDD (8 caracteres)
   * - Offset 136..142: Código DANE de municipio
   * - Offset 142..144+: Grupo sanguíneo y factor RH (A+, B+, O+, AB+, etc.)
   */
  parseColombianPdf417(raw: string): DecodedBarcodeResult | null {
    const pubIdx = raw.indexOf('PubDSK_');
    if (pubIdx === -1) return null;

    try {
      const sub = raw.slice(pubIdx);
      const docNumRaw = sub.slice(24, 34);
      const docNum = docNumRaw.replace(/^0+/, '').trim();
      const ap1 = sub.slice(34, 57).replace(/[\u0000\s]+$/g, '').trim();
      const ap2 = sub.slice(57, 80).replace(/[\u0000\s]+$/g, '').trim();
      const nom1 = sub.slice(80, 103).replace(/[\u0000\s]+$/g, '').trim();
      const nom2 = sub.slice(103, 126).replace(/[\u0000\s]+$/g, '').trim();

      // Sexo
      const genderChunk = sub.slice(126, 128);
      const genderMatch = genderChunk.match(/[MF]/i);
      const sexo = genderMatch ? genderMatch[0].toUpperCase() : '';

      // Fecha de nacimiento
      const ymd = sub.slice(128, 136);
      let fechaNacimiento = '';
      if (/^\d{8}$/.test(ymd)) {
        const year = ymd.slice(0, 4);
        const month = ymd.slice(4, 6);
        const day = ymd.slice(6, 8);
        fechaNacimiento = `${day}/${month}/${year}`;
      }

      // Código municipio
      const muni = sub.slice(136, 142).trim();

      // Factor RH
      const rhMatch = sub.slice(142, 148).match(/(?:AB|A|B|O)[+-]/i);
      const rh = rhMatch ? rhMatch[0].toUpperCase() : '';

      // Código biométrico
      const afis = sub.slice(16, 24).trim();

      const nombres = [nom1, nom2].filter(Boolean).join(' ');
      const apellidos = [ap1, ap2].filter(Boolean).join(' ');
      const nombreCompleto = `${nombres} ${apellidos}`.trim();

      if (docNum && /^\d{5,11}$/.test(docNum)) {
        return {
          format: 'PDF417',
          rawText: raw,
          documentNumber: docNum,
          primerApellido: ap1,
          segundoApellido: ap2,
          primerNombre: nom1,
          segundoNombre: nom2,
          nombres,
          apellidos,
          nombreCompleto,
          sexo,
          fechaNacimiento,
          grupoSanguineo: rh,
          municipioCodigo: muni,
          afisCodigo: afis,
        };
      }
    } catch (err) {
      console.warn('[BarcodeService] Error parseando datos de PDF417:', err);
    }

    return null;
  }

  /**
   * Intenta decodificar códigos QR (utilizados en cédulas digitales nuevas)
   */
  parseQrCode(raw: string): DecodedBarcodeResult | null {
    if (!raw || raw.length < 15) return null;

    // Solo aceptar URLs válidas de la Registraduría o texto claro (descartar streams binarios encriptados)
    const isUrl = /^https?:\/\//i.test(raw);
    const hasRegistraduria = /registraduria\.gov\.co/i.test(raw);
    if (!isUrl && !hasRegistraduria) return null;

    const docMatch = raw.match(/\b(\d{7,10})\b/);
    return {
      format: 'QR_CODE',
      rawText: raw,
      documentNumber: docMatch ? docMatch[1] : undefined,
    };
  }

  /**
   * Intenta decodificar códigos de barras (PDF417 prioritario, luego QR).
   * Prueba variaciones óptimas: recorte del tercio inferior a 2x de escala,
   * y ángulos de rotación (0°, 180°, 90°, 270°).
   */
  async decode(imageBuffer: Buffer): Promise<DecodedBarcodeResult | null> {
    try {
      const meta = await sharp(imageBuffer).metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;
      if (w < 100 || h < 100) return null;

      // Probar prioritariamente ángulo normal (0°), luego 180° sólo si falló
      const angles = [0, 180];

      for (const angle of angles) {
        let base = sharp(imageBuffer);
        if (angle !== 0) {
          base = base.rotate(angle);
        }
        const rotatedBuf = await base.toBuffer();
        const rMeta = await sharp(rotatedBuf).metadata();
        const rW = rMeta.width!;
        const rH = rMeta.height!;

        // El código PDF417 en cédulas colombianas está en la mitad inferior
        // Usar 1x (o escalar sólo si la imagen original es menor a 600px) para máxima velocidad
        const targetWidth = rW < 600 ? Math.round(rW * 1.5) : rW;

        const crops = [
          // 1. Recorte inferior 50% (zona de código de barras/MRZ)
          sharp(rotatedBuf).extract({
            left: 0,
            top: Math.floor(rH * 0.50),
            width: rW,
            height: Math.floor(rH * 0.50),
          }).resize(targetWidth).grayscale(),
          // 2. Imagen completa (fallback)
          sharp(rotatedBuf).resize(targetWidth).grayscale(),
        ];

        for (const cropPipeline of crops) {
          try {
            const { data, info } = await cropPipeline.raw().toBuffer({ resolveWithObject: true });
            const source = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
            const bitmap = new BinaryBitmap(new HybridBinarizer(source));

            // Intentar PDF417 (< 15ms)
            try {
              const result = this.pdf417Reader.decode(bitmap, this.pdf417Hints);
              if (result && result.getText()) {
                const parsed = this.parseColombianPdf417(result.getText());
                if (parsed) {
                  return parsed;
                }
              }
            } catch {
              // No encontrado en este recorte
            }

            // Intentar QR Code (< 10ms)
            try {
              const qrResult = this.qrReader.decode(bitmap, this.qrHints);
              if (qrResult && qrResult.getText()) {
                const parsedQr = this.parseQrCode(qrResult.getText());
                if (parsedQr) {
                  return parsedQr;
                }
              }
            } catch {
              // No encontrado
            }
          } catch {
            // Error en recorte
          }
        }
      }
    } catch (err) {
      console.warn('[BarcodeService] Error decodificando imagen:', err);
    }

    return null;
  }
}

export const barcodeService = new BarcodeService();
