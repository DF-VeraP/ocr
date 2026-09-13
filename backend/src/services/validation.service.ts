import { ExcelRowItem } from './excel.service';

export interface DiscrepancyItem {
  campo: string;
  valorOcr: string;
  valorExcel: string;
}

export interface ValidationResult {
  estadoValidacion: 'EXISTE' | 'NO_EXISTE' | 'DISCREPANCIA';
  estadoCompletitud: 'COMPLETO' | 'INCOMPLETA';
  discrepancias?: DiscrepancyItem[];
}

export class ValidationService {
  /**
   * Valida un documento OCR contra el conjunto de registros de Excel.
   * Aplica validación estricta de parámetros:
   * - Número de cédula exacto o reconciliado
   * - Presencia obligatoria de Nombres de Pila Y Apellidos
   * - Detección de palabras residuales de escaneo / formato
   * - Completitud de ambas caras (frente + reverso o contraseña)
   */
  validateDocument(
    numeroDocumento: string,
    nombreOcr: string | null,
    tieneFrente: boolean,
    tieneReverso: boolean,
    isContrasena: boolean,
    excelMap: Map<string, ExcelRowItem>
  ): ValidationResult {
    // RF-044: Completitud física (contraseña solo tiene frente)
    const estadoCompletitud: 'COMPLETO' | 'INCOMPLETA' =
      isContrasena
        ? (tieneFrente ? 'COMPLETO' : 'INCOMPLETA')
        : (tieneFrente && tieneReverso ? 'COMPLETO' : 'INCOMPLETA');

    // 1. Buscar en matriz de Excel por número exacto o reconciliado
    let excelItem = excelMap.get(numeroDocumento);
    let idDiscrepancy: DiscrepancyItem | null = null;

    if (!excelItem && nombreOcr) {
      // Buscar si algún aprendiz coincide por nombre completo con alta certidumbre
      const cleanedOcr = this.cleanName(nombreOcr);
      for (const [id, row] of excelMap.entries()) {
        const cleanedOfficial = this.cleanName(row.nombreOficial);
        const comp = this.evaluateNameMatch(cleanedOcr, cleanedOfficial);
        if (comp.isStrongMatch) {
          excelItem = row;
          idDiscrepancy = {
            campo: 'Número de Documento',
            valorOcr: numeroDocumento || 'No detectado',
            valorExcel: row.identificacionOriginal,
          };
          break;
        }
      }
    }

    if (!excelItem) {
      return {
        estadoValidacion: 'NO_EXISTE',
        estadoCompletitud,
      };
    }

    const discrepancias: DiscrepancyItem[] = [];
    if (idDiscrepancy) {
      discrepancias.push(idDiscrepancy);
    }

    // 2. Si no hay nombre extraído por OCR
    if (!nombreOcr || nombreOcr.trim().length === 0) {
      discrepancias.push({
        campo: 'Nombre Completo',
        valorOcr: 'No detectado por OCR',
        valorExcel: excelItem.nombreOficial,
      });
      return {
        estadoValidacion: 'DISCREPANCIA',
        estadoCompletitud,
        discrepancias,
      };
    }

    // 3. Validación de parámetros de nombre
    const ocrNormalized = this.cleanName(nombreOcr);
    const excelNormalized = this.cleanName(excelItem.nombreOficial);

    const nameEval = this.evaluateNameMatch(ocrNormalized, excelNormalized);
    const isExactId = !idDiscrepancy;

    if (nameEval.hasNoiseWords) {
      discrepancias.push({
        campo: 'Ruido / Formato OCR',
        valorOcr: nombreOcr,
        valorExcel: excelItem.nombreOficial,
      });
    }

    // Si el número de cédula es 100% exacto al de la matriz Excel:
    if (isExactId) {
      // Basta con que coincidan los nombres de pila O los apellidos (o ratio >= 0.40) sin palabras de ruido
      if (!nameEval.hasGivenNameMatch && !nameEval.hasSurnameMatch && nameEval.ratio < 0.40) {
        discrepancias.push({
          campo: 'Nombre Completo',
          valorOcr: nombreOcr,
          valorExcel: excelItem.nombreOficial,
        });
      }
    } else {
      // Si el número no coincidió exactamente, la validación de nombre debe ser estricta
      if (!nameEval.hasGivenNameMatch) {
        discrepancias.push({
          campo: 'Nombres de Pila',
          valorOcr: nombreOcr,
          valorExcel: `Faltan nombres oficiales (${nameEval.expectedGivenNames})`,
        });
      }

      if (!nameEval.hasSurnameMatch) {
        discrepancias.push({
          campo: 'Apellidos',
          valorOcr: nombreOcr,
          valorExcel: `Faltan apellidos oficiales (${nameEval.expectedSurnames})`,
        });
      }

      if (nameEval.ratio < 0.60 && !discrepancias.some((d) => d.campo.includes('Nombre'))) {
        discrepancias.push({
          campo: 'Coincidencia Parcial de Nombre',
          valorOcr: nombreOcr,
          valorExcel: excelItem.nombreOficial,
        });
      }
    }

    // 4. Determinar estado final verídico
    if (discrepancias.length === 0) {
      return {
        estadoValidacion: 'EXISTE',
        estadoCompletitud,
      };
    }

    return {
      estadoValidacion: 'DISCREPANCIA',
      estadoCompletitud,
      discrepancias,
    };
  }

  private static readonly STOPWORDS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'SAN', 'SANTA', 'DA', 'DOS', 'DAS']);

  public cleanName(name: string): string {
    return name
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/\b(APELLIDOS?|APELUDOS|APELTIDOS|APELLOS|PELLDO|PELLDOS|NOMBRES?|NOMBREY|FIRMA|REPUBLICA|REDUBLICA|COLOMBIA|COLOMBLA|CEDULA|CEDULADE|IDENTIFICACION|DIGITAL|CIUDADANIA|NUMERO|NUIP|REGISTRADOR|NACIONAL|GEUULAD|APLLUIDDS|APELICCS|NPELLIOG|LUDOS|APRLUDOS|APELLIOS|APETODOS[A-Z]*|Horor|NTULDO|UELICT|LIDBS|APEUWDD|APELLDOS|APELLTCOS|APELLINOS)\b/gi, ' ')
      .replace(/^[BCDFGHJKLMNPQRSTVWXYZ]\s+/i, '')
      .replace(/^[KT]\b(?=[A-Z]{3,})/i, '')
      .replace(/[^A-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public evaluateNameMatch(ocrName: string, officialName: string) {
    const ocrClean = this.cleanName(ocrName);
    const officialClean = this.cleanName(officialName);

    // Filtrar tokens vacíos, stopwords y tokens de menos de 3 letras
    const ocrTokens = ocrClean
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !ValidationService.STOPWORDS.has(t));
    const officialTokens = officialClean
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !ValidationService.STOPWORDS.has(t));

    if (officialTokens.length === 0 || ocrTokens.length === 0) {
      return {
        isStrongMatch: false,
        ratio: 0,
        hasGivenNameMatch: false,
        hasSurnameMatch: false,
        hasNoiseWords: false,
        expectedGivenNames: '',
        expectedSurnames: '',
      };
    }

    // En formato SENA: los primeros tokens suelen ser nombres y los últimos apellidos
    const mid = officialTokens.length <= 3 ? 1 : Math.floor(officialTokens.length / 2);
    const givenTokens = officialTokens.slice(0, mid);
    const surnameTokens = officialTokens.slice(mid);

    let matchCount = 0;
    const matchedTokens: string[] = [];

    for (const ot of officialTokens) {
      const match = ocrTokens.some((oc) => {
        if (oc === ot) return true;
        // Levenshtein de distancia 1 (ej. GONZALES vs GONZALEZ, SAB vs SABI, ZUNIGA vs ZUÑIGA)
        if (oc.length >= 3 && ot.length >= 3 && this.levenshtein(oc, ot) <= 1) {
          return true;
        }
        // Substring permitido solo con longitud suficiente (>=3) y ratio de longitud >= 0.70
        if (oc.length >= 3 && ot.length >= 3) {
          const minLen = Math.min(oc.length, ot.length);
          const maxLen = Math.max(oc.length, ot.length);
          if ((ot.includes(oc) || oc.includes(ot)) && minLen / maxLen >= 0.70) {
            return true;
          }
        }
        return false;
      });

      if (match) {
        matchCount++;
        matchedTokens.push(ot);
      }
    }

    const hasGivenNameMatch = givenTokens.some((g) => matchedTokens.includes(g));
    const hasSurnameMatch = surnameTokens.some((s) => matchedTokens.includes(s));
    const ratio = matchCount / officialTokens.length;

    // Detectar si el texto OCR contiene palabras de etiqueta residual que no fueron limpiadas
    const hasNoiseWords = /\b(APELL[A-Z]*|PELLDO|NTULDO|UELICT|LIDBS|APEUWDD|APLLUIDDS|APELICCS|NPELLIOG|APRLUDOS|GEUULAD|REDUBLICA)\b/i.test(ocrClean);

    let isStrongMatch = false;
    if (officialTokens.length <= 2) {
      isStrongMatch = (matchCount >= 1 && (hasGivenNameMatch || hasSurnameMatch));
    } else {
      const bothSurnamesMatch = surnameTokens.length >= 2 && surnameTokens.every((s) => matchedTokens.includes(s));
      isStrongMatch = bothSurnamesMatch || (matchCount >= 2 && (hasGivenNameMatch || hasSurnameMatch)) || ratio >= 0.60;
    }

    return {
      isStrongMatch,
      ratio,
      hasGivenNameMatch,
      hasSurnameMatch,
      hasNoiseWords,
      expectedGivenNames: givenTokens.join(' '),
      expectedSurnames: surnameTokens.join(' '),
    };
  }

  public compareNames(name1: string, name2: string): boolean {
    const res = this.evaluateNameMatch(name1, name2);
    return res.isStrongMatch && res.hasGivenNameMatch && res.hasSurnameMatch && !res.hasNoiseWords;
  }

  public levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
}

export const validationService = new ValidationService();
