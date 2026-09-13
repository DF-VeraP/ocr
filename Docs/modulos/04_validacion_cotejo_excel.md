# 📑 Módulo 04: Cotejo y Validación con Planillas Excel

## 1. Descripción General
El **Módulo de Cotejo y Validación con Excel** es el núcleo de verificación del negocio. Su función es comparar de manera automatizada y exhaustiva los datos obtenidos de los documentos escaneados (mediante el Módulo 02 de Código de Barras o el Módulo 03 de OCR) contra la planilla oficial de inscripción o matrícula del SENA en formato `.xls` o `.xlsx`.

El módulo determina si la identidad del aprendiz está debidamente sustentada por el documento aportado, detectando suplantaciones, discrepancias en nombres, errores tipográficos o documentos faltantes.

---

## 2. Archivos y Componentes Clave
- **Servicio de Excel**: [`backend/src/services/excel.service.ts`](file:///c:/Users/Lenovo/Documents/SENA/OCR/backend/src/services/excel.service.ts)
- **Servicio de Validación y Cotejo**: [`backend/src/services/validation.service.ts`](file:///c:/Users/Lenovo/Documents/SENA/OCR/backend/src/services/validation.service.ts)
- **Librerías Utilizadas**:
  - `xlsx`: Lectura, interpretación y generación de hojas de cálculo Excel.

---

## 3. Flujo de Cotejo Automatizado

```mermaid
flowchart TD
    ExcelFile[Planilla SENA .xls/.xlsx] --> ParseExcel[Parsear Filas: Documento, Nombres, Apellidos]
    DocData[Datos Extraídos: Barcode / OCR] --> MatchEngine[Motor de Cotejo Bidireccional]
    ParseExcel --> MatchEngine

    MatchEngine --> Step1{¿Coincide Número de Documento?}
    Step1 -- No --> CheckFuzzyNum{Búsqueda por Similitud Numérica / Transposición}
    CheckFuzzyNum -- Encontrado --> FlagNumDiscrepancy[Marcar: DISCREPANCIA_NUMERO]
    CheckFuzzyNum -- No --> NotFound[Marcar: NO_ENCONTRADO_EN_PLANILLA]

    Step1 -- Sí --> Step2{¿Coincidencia Exacta de Nombres y Apellidos?}
    Step2 -- Sí --> Validated[Estado: VALIDADO (100% Match)]
    Step2 -- No --> Step3[Calcular Distancia de Levenshtein / Jaro-Winkler]
    
    Step3 --> SimCheck{¿Similitud >= 85%?}
    SimCheck -- Sí --> ValidatedFuzzy[Estado: VALIDADO_CON_ADVERTENCIA (Tilde/Espacio)]
    SimCheck -- No --> NameDiscrepancy[Estado: CON_DISCREPANCIA_NOMBRES]
```

---

## 4. Algoritmos de Normalización y Similitud
Para evitar falsos negativos ocasionados por errores humanos comunes (tildes omitidas, nombres invertidos o abreviaturas), el módulo aplica:

1. **Normalización Fonética y Alfanumérica**:
   - Conversión a mayúsculas sostenidas (`toUpperCase()`).
   - Remoción de marcas diacríticas y tildes mediante NFD (`normalize('NFD').replace(/[\u0300-\u036f]/g, '')`).
   - Limpieza de caracteres no alfabéticos y colapso de espacios múltiples (`"  JUAN   DE   DIOS  "` -> `"JUAN DE DIOS"`).
2. **Cálculo de Distancia de Edición**:
   - Algoritmo de **Levenshtein** para cuantificar el número mínimo de operaciones (inserciones, supresiones o sustituciones) necesarias para transformar el nombre de la cédula en el de la planilla.
   - Puntuación porcentual de afinidad: $\text{Similitud} = 1 - \frac{\text{Distancia}}{\max(\text{len}_1, \text{len}_2)}$.

---

## 5. Clasificación de Estados de Aprendiz

| Estado | Significado | Acción Recomendada en el SENA |
|---|---|---|
| **`VALIDADO`** | El número de cédula y los nombres/apellidos coinciden plenamente. | Ficha lista para aprobación y cierre de matrícula. |
| **`CON_DISCREPANCIA`** | El número coincide pero los nombres difieren significativamente (ej: falta un apellido o difiere una letra crítica). | Requiere revisión manual por parte del instructor o administrador. |
| **`NO_ENCONTRADO`** | El aprendiz de la planilla no tiene cédula aportada en el PDF. | Solicitar al aprendiz el envío de su documento de identidad. |
| **`DOCUMENTO_NO_RECONOCIDO`** | La página del PDF es ilegible, borrosa o no corresponde a una cédula. | Solicitar nuevo escaneo legible. |

---

## 6. Generación de Reportes Consolidados
Al finalizar el cotejo, el servicio genera automáticamente un libro Excel enriquecido con:
- Pestaña de **Resumen Ejecutivo**: Totales, porcentajes de efectividad, métricas de velocidad (Fast-Track vs OCR).
- Pestaña de **Detalle por Aprendiz**: Fila a fila con semáforo de colores (Verde = Validado, Amarillo = Advertencia, Rojo = Discrepancia/Faltante).
- Columnas comparativas: *Documento Planilla vs Documento Cédula*, *Nombres Planilla vs Nombres Cédula*, *Método de Extracción Utilizado*, *Página del PDF de Origen*.
