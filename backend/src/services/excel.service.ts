import * as xlsx from 'xlsx';
import { normalizeDocumentNumber } from '../utils/regex';

export interface ExcelRowItem {
  identificacionOriginal: string;
  identificacionLimpia: string;
  nombreOficial: string;
  estadoOficial: string;
}

export class ExcelService {
  /**
   * RF-027, RF-053, RF-054:
   * Valida columnas: Identificación, Nombre, Estado
   * Localiza automáticamente la fila de encabezados aunque haya títulos previos (como en reportes SENA)
   * Limpia prefijos como "CC - " o "TI - "
   */
  parseExcel(filePathOrBuffer: string | Buffer): {
    isValid: boolean;
    error?: string;
    rows: ExcelRowItem[];
  } {
    try {
      const workbook = typeof filePathOrBuffer === 'string'
        ? xlsx.readFile(filePathOrBuffer)
        : xlsx.read(filePathOrBuffer, { type: 'buffer' });

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        return { isValid: false, error: 'El archivo Excel no contiene hojas de datos', rows: [] };
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawMatrix: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (rawMatrix.length === 0) {
        return { isValid: false, error: 'La primera hoja del archivo Excel está vacía', rows: [] };
      }

      // Buscar la fila que contiene los encabezados requeridos
      let headerRowIndex = -1;
      let idCol = -1;
      let nameCol = -1;
      let statusCol = -1;

      for (let r = 0; r < Math.min(25, rawMatrix.length); r++) {
        const row = rawMatrix[r];
        if (!Array.isArray(row)) continue;

        const currentIdCol = row.findIndex((cell) => /identificaci[oó]n|documento|cedula/i.test(String(cell).trim()));
        const currentNameCol = row.findIndex((cell) => /nombre|aprendiz|titular/i.test(String(cell).trim()));
        const currentStatusCol = row.findIndex((cell) => /estado/i.test(String(cell).trim()));

        if (currentIdCol !== -1 && currentNameCol !== -1 && currentStatusCol !== -1) {
          headerRowIndex = r;
          idCol = currentIdCol;
          nameCol = currentNameCol;
          statusCol = currentStatusCol;
          break;
        }
      }

      if (headerRowIndex === -1) {
        return {
          isValid: false,
          error: "El archivo Excel debe contener las columnas: 'Identificación', 'Nombre' y 'Estado'",
          rows: [],
        };
      }

      const rows: ExcelRowItem[] = [];

      for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
        const row = rawMatrix[r];
        if (!Array.isArray(row)) continue;

        const rawId = String(row[idCol] || '').trim();
        const rawName = String(row[nameCol] || '').trim();
        const rawStatus = String(row[statusCol] || '').trim();

        if (!rawId && !rawName) continue; // Saltar filas en blanco

        // RF-054: Limpiar prefijos tipo "CC - ", "TI - " y normalizar dígitos
        const idLimpia = normalizeDocumentNumber(rawId);

        rows.push({
          identificacionOriginal: rawId,
          identificacionLimpia: idLimpia,
          nombreOficial: rawName,
          estadoOficial: rawStatus,
        });
      }

      return { isValid: true, rows };
    } catch (err: any) {
      console.error('Error al procesar archivo Excel:', err);
      return { isValid: false, error: `Error de lectura en Excel: ${err.message}`, rows: [] };
    }
  }
}

export const excelService = new ExcelService();
