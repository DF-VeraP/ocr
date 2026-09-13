# 🧠 Módulo 03: Reconocimiento Óptico de Caracteres (PaddleOCR + ONNX Runtime)

## 1. Descripción General
El **Módulo de Reconocimiento Óptico de Caracteres (OCR)** es el motor de visión artificial del sistema cuando no es posible extraer datos mediante el código de barras (por ejemplo, documentos que solo incluyen el anverso/frente, fotocopias borrosas o cédulas antiguas). 

Implementa una arquitectura neuronal moderna basada en **PaddleOCR v5** ejecutada a través de **ONNX Runtime** en CPU multi-hilo, lo que elimina la necesidad de Python en tiempo de ejecución y garantiza tiempos de respuesta ultrarrápidos con modelos precalentados en la memoria RAM del servidor.

---

## 2. Archivos y Componentes Clave
- **Servicio Principal**: [`backend/src/services/ocr.service.ts`](file:///c:/Users/Lenovo/Documents/SENA/OCR/backend/src/services/ocr.service.ts)
- **Modelos de Red Neuronal**:
  - `ch_PP-OCRv4_det.onnx`: Red de detección de cajas delimitadoras de texto (Text Detection).
  - `ch_PP-OCRv4_rec.onnx`: Red de reconocimiento de secuencias de texto (Text Recognition).
  - `ppocr_keys_v1.txt`: Diccionario de caracteres para decodificación CTC.
- **Motor Secundario / Fallback**:
  - `tesseract.js`: Motor OCR tradicional basado en LSTM entrenado para el idioma español (`spa`).

---

## 3. Flujo de Inferencia Neuronal y Heurística

```mermaid
flowchart TD
    ImgIn[Imagen de Entrada] --> Prewarm{¿Modelos ONNX en RAM?}
    Prewarm -- No --> LoadModels[Cargar Modelos ONNX y Diccionario CTC]
    Prewarm -- Sí --> InferenceDet[Inferencia: Text Detection (DBNet)]
    LoadModels --> InferenceDet

    InferenceDet --> CropBoxes[Recortar Cajas de Texto y Normalizar Altura]
    CropBoxes --> InferenceRec[Inferencia: Text Recognition (SVTR/CRNN)]
    InferenceRec --> CTC[Decodificación CTC con Diccionario]
    CTC --> TextBoxes[Lista de Textos con Coordenadas y Confianza]

    TextBoxes --> Heuristics[Motor Heurístico y Expresiones Regulares]
    Heuristics --> ExtrNum[Extracción de Número de Cédula / NUIP]
    Heuristics --> ExtrApe[Extracción de Apellidos y Nombres]
    Heuristics --> ExtrFechas[Extracción de Fechas Nacimiento / Expedición]
    Heuristics --> ExtrRH[Extracción de RH]

    ExtrNum --> FallbackCheck{¿Datos Clave Detectados?}
    FallbackCheck -- Sí --> FinalRes[Retornar Resultado OCR]
    FallbackCheck -- No --> TessFallback[Fallback a Tesseract OCR (spa)]
    TessFallback --> FinalRes
```

---

## 4. Algoritmos Heurísticos de Extracción de Cédula
Debido a la diversidad de formatos de cédula en Colombia (Cédula Blanca/Café antigua, Cédula Amarilla con Hologramas y Cédula Digital de Policarbonato), el módulo aplica una batería de expresiones regulares y análisis de proximidad espacial:

1. **Número de Cédula (NUIP)**:
   - Patrones de búsqueda: `/\b(?:NUMERO|No\.?|C\.?C\.?|CEDULA)?\s*([1-9][0-9]{6,9})\b/i`.
   - Limpieza de puntos y separadores (`1.098.765.432` -> `1098765432`).
2. **Apellidos y Nombres**:
   - Detección de anclas clave como `APELLIDOS`, `NOMBRES`, `REPÚBLICA DE COLOMBIA`, `IDENTIFICACIÓN`.
   - Extracción de líneas subsiguientes ignorando títulos y sellos de agua.
3. **Puntuación de Confianza**:
   - Ponderación matemática calculada en función de la certeza del modelo en los caracteres del documento y la consistencia de los campos biográficos extraídos.

---

## 5. Parámetros de Entrada y Salida

### Entrada:
```typescript
interface OcrProcessOptions {
  imageBuffer: Buffer;
  confidenceThreshold?: number; // Umbral mínimo de certeza (default: 0.60)
}
```

### Salida:
```typescript
interface OcrExtractionResult {
  nuip?: string;
  nombres?: string;
  apellidos?: string;
  nombreCompleto?: string;
  fechaNacimiento?: string;
  rh?: string;
  confidence: number;
  engine: 'PADDLE_OCR_ONNX' | 'TESSERACT_FALLBACK';
  rawText: string;
}
```
