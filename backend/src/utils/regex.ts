/**
 * Expresiones regulares y utilidades de normalización para documentos de identidad colombianos
 */

// Normalizar números quitando puntos, comas, guiones y espacios
export function normalizeDocumentNumber(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[^0-9]/g, '');
}

// Extraer número de cédula del frente
// Ejemplos: "NUMERO 1.118.020.827", "JMERO 1117.504.107", "NUMER17.655.933", "16190609", "1.110.461.846", "wEo1.080.933.48G", "1.055:830.844", "wo40.595:316"
export function extractFrontDocumentNumber(text: string): string | null {
  const prepared = text
    .replace(/([0-9])A([0-9])/g, '$11$2')
    .replace(/([0-9]):([0-9])/g, '$1.$2')
    .replace(/([0-9]),([0-9])/g, '$1.$2')
    .replace(/([0-9])[Gg](?=[^0-9A-Za-z]|$)/g, '$10')
    .replace(/([0-9])[Oo](?=[^0-9A-Za-z]|$)/g, '$10');

  // 1. Con etiqueta explícita (NUMERO, NUIP, etc.) permitiendo prefijos con ruido de escaneo
  const prefixMatch = prepared.match(/(?:NUMERO|N[ÚU]MERO|NUMER|NUR\)?|JMERO|JUMERO|UMER|ERO|WEAO|wEo|VCRo|MBo|HBERo|HB|p[0o]|c[0o]|n[0o]|wo|NUIP|NUP|NUI|C[EÉ]DULA(?:\s*DE\s*CIUDADAN[A-Z]*)?|No\.?|#\)?|CA\s*o|CAD|OA\s*O-?)[\s.:-]*([0-9][0-9.\s,:-]{4,28})/i)
    || prepared.match(/([0-9][0-9.\s]{5,20}[0-9])\s*[:.\s]?\s*(?:NUMERO|N[ÚU]MERO|NUIP)/i)
    || prepared.match(/\bA([0-9]{1,4}(?:[.,:\s][0-9]{2,4}){1,3})\b/);

  if (prefixMatch && prefixMatch[1]) {
    const tokens = prefixMatch[1].trim().split(/\s+/);
    for (const tok of tokens) {
      let cleanCandidate = tok
        .replace(/[Gg]$/g, '0')
        .replace(/[Oo]/g, '0')
        .replace(/[Il]/g, '1')
        .replace(/[^0-9]/g, '');

      // Si tiene 10 dígitos, es un NUIP/Cédula estándar válida
      if (cleanCandidate.length === 10) {
        return cleanCandidate;
      }

      // Si tiene 11 dígitos y termina en 1 o 0 (artefacto de línea de tabla o versión), recortar el último dígito
      if (cleanCandidate.length === 11 && (cleanCandidate.endsWith('1') || cleanCandidate.endsWith('0'))) {
        return cleanCandidate.slice(0, 10);
      }

      // Si tiene 10 u 11 dígitos con artefacto al final de cédulas de 8 dígitos (ej. 8323281001 -> 83232810)
      if (cleanCandidate.length === 10 && (cleanCandidate.endsWith('01') || cleanCandidate.endsWith('00'))) {
        const candidate8 = cleanCandidate.slice(0, 8);
        if (candidate8.length === 8) {
          cleanCandidate = candidate8;
        }
      }

      if (cleanCandidate.length >= 6 && cleanCandidate.length <= 10) {
        return cleanCandidate;
      }
    }
  }

  // 2. Número con formato colombiano con puntos/comas explícitos: ej. "1.110.461.846", "1.117.489.405", "1117.504.107", "1.080.933.480", "1.055.830.844", "40.595.316"
  const dottedMatches = prepared.matchAll(/([0-9]{1,4}(?:[.,:\s][0-9A-Za-z]{2,4}){1,3})/g);
  for (const dm of dottedMatches) {
    let digits = dm[1]
      .replace(/[Gg]$/g, '0')
      .replace(/[Oo]/g, '0')
      .replace(/[Il]/g, '1')
      .replace(/[^0-9]/g, '');

    if (digits.length === 11 && (digits.endsWith('1') || digits.endsWith('0'))) {
      digits = digits.slice(0, 10);
    }

    if (digits.length >= 7 && digits.length <= 10) {
      return digits;
    }
  }

  // 3. Número suelto de 7 a 10 dígitos (ej. "16190609", "17689664")
  const standaloneMatches = prepared.matchAll(/\b([0-9]{7,10})\b/g);
  for (const sm of standaloneMatches) {
    const d = sm[1];
    if (d.length >= 7 && d.length <= 10 && !d.startsWith('19') && !d.startsWith('20')) {
      return d;
    }
  }

  return null;
}

// Extraer número del reverso o pie de seguridad de Registraduría
// Ejemplos: "P-4400600-01301292-M-1118020827-20220606", "R-4400100-01535873-F-1055830844-20251204"
export function extractBarcodeDocumentNumber(text: string): string | null {
  const match = text.match(/[A-Z0-9]{1,2}[-\s]*\d+[-\s]+\d+[-\s]*[MF][-\s]*(\d{6,11})[-\s\d]*/i)
    || text.match(/[-_\s][FM][-_\s]+(\d{6,11})[-_\s]/i);
  if (match && match[1]) {
    const candidate = match[1].replace(/^0+/, '');
    // Evitar fechas de expedición o códigos de formato tipo 20140617
    if (candidate.length >= 7 && candidate.length <= 10 && !candidate.startsWith('19') && !candidate.startsWith('20')) {
      return candidate;
    }
  }
  return null;
}

// Extraer número del reverso desde la zona de lectura mecánica (MRZ) - Cédula Digital
// Ejemplo: "8705080F3302244C0L1117493336<3", "0607085M3407172COL1083876262<8", "0111023F3404089C0L1003806124<1"
export function extractMrzDocumentNumber(text: string): string | null {
  // En MRZ colombiano, la segunda línea tiene el formato:
  // YYMMDD{checksum}[MF]YYMMDD{checksum}C[O0]L{NUMERO_DOCUMENTO}[<0-9]
  const mrz2Match = text.match(/\d{6,7}[MF]\d{6,7}C[O0]L(\d{6,11})[<0-9]/i)
    || text.match(/C[O0]L(\d{7,10})[<0-9]/i);
  if (mrz2Match && mrz2Match[1]) {
    return mrz2Match[1].replace(/^0+/, '');
  }

  // Fallback genérico para C[O0]L seguido de dígitos
  const match = text.match(/C[O0]L\s*(\d{6,11})[<0-9\s]/i);
  if (match && match[1]) {
    return match[1].replace(/^0+/, '');
  }
  return null;
}

// Extraer nombres y apellidos de la línea MRZ en Cédula Digital
// Ejemplos: "MURCIAKARTUNDUAGAKKVANESSAKALE", "MUNOZ<BARRETO<<NATALI<<<<<<<<<"
export function extractMrzNames(text: string): { nombres?: string; apellidos?: string } | null {
  const clean = text.replace(/K/g, '<');
  const mrzMatch = clean.match(/([A-Z]+(?:<[A-Z]+)*)<<([A-Z]+(?:<[A-Z]+)*)/i);
  if (mrzMatch) {
    const rawApe = mrzMatch[1].replace(/</g, ' ').trim();
    const rawNom = mrzMatch[2].replace(/</g, ' ').trim();
    if (rawApe.length >= 3 && rawNom.length >= 3) {
      return {
        apellidos: rawApe,
        nombres: rawNom,
      };
    }
  }
  return null;
}

// Detectar el tipo de documento analizando las palabras clave del OCR
export type DocumentKind = 'CC_TRADICIONAL' | 'CC_DIGITAL' | 'TI' | 'CONTRASEÑA';

export function detectDocumentType(text: string): DocumentKind {
  const clean = text.toUpperCase();

  if (clean.includes('CONTRASEÑA') || clean.includes('COMPROBANTE ES VALIDO') || clean.includes('OFICINA DE ENTREGA')) {
    return 'CONTRASEÑA';
  }

  if (clean.includes('TARJETA DE IDENTIDAD')) {
    return 'TI';
  }

  // Cédula digital: tiene "NUIP", "FECHA DE EXPIRACION" o zona MRZ ("ICCOL" / "ICC0L")
  if (clean.includes('NUIP') || clean.includes('EXPIRACI') || clean.includes('ICCOL') || clean.includes('ICC0L') || clean.includes('NACIONALIDAD')) {
    return 'CC_DIGITAL';
  }

  // Cédula de ciudadanía tradicional (amarilla)
  return 'CC_TRADICIONAL';
}
