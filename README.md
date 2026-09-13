# 🇨🇴 SENA OCR | Sistema de Extracción y Validación de Cédulas

Sistema institucional integral para la extracción automatizada y de alta velocidad de datos desde documentos de identidad colombianos (PDF escaneados) y validación cruzada contra listas oficiales de matrícula del SENA en Excel (`.xlsx` / `.xls`).

---

## ⚡ Características Principales

1. **Doble Motor de Extracción Híbrido:**
   - **Fast-Track (Código de Barras PDF417):** Decodificación instantánea de la trama de datos RNEC (Cédula de Ciudadanía colombiana) con **100% de exactitud criptográfica** mediante `@zxing/library`.
   - **Motor Neuronal OCR (PaddleOCR v5 + ONNX Runtime):** Inferencia en CPU local multi-hilo con modelos precalentados en RAM (`ch_PP-OCRv4`), más fallback de respaldo en Tesseract OCR para español.
2. **Cotejo Automatizado con Planillas SENA:**
   - Normalización fonética y cálculo de similitud Levenshtein / Jaro-Winkler.
   - Clasificación por aprendices: `VALIDADO`, `CON_DISCREPANCIA`, `NO_ENCONTRADO` y `DOCUMENTO_NO_RECONOCIDO`.
   - Exportación de reportes ejecutivos consolidados en Excel y PDF.
3. **Seguridad Institucional y Control de Acceso (RBAC):**
   - Autenticación JWT con roles `ADMIN` e `INSTRUCTOR`.
   - Flujo de aprobación de cuentas por Administrador y contraseñas temporales.
   - Políticas de contraseñas seguras (RF-003), bloqueo anti-fuerza bruta y detección de inactividad (30 min).
4. **Notificaciones Transaccionales por Correo (SMTP):**
   - Alertas automáticas para nuevas solicitudes, aprobación de cuentas y recuperación de contraseñas.
5. **Experiencia de Usuario Moderna:**
   - Construida en React + Vite + Tailwind CSS + Lucide Icons.
   - Interfaz con selector de visibilidad de contraseña con iconos `Eye`/`EyeOff` (sin emojis) y vista de Login con **cero scroll**.
   - Soporte para Modo Oscuro y Claro.

---

## 📚 Documentación Técnica por Módulos

Para consultar el detalle técnico, diagramas de arquitectura y especificaciones de cada módulo, consulta la suite de documentación:

- **[Índice Maestro de la Documentación](docs/README.md)**
  - [Módulo 01: Ingesta y Procesamiento de PDF](docs/modulos/01_ingesta_pdf.md)
  - [Módulo 02: Lectura de Códigos de Barras (PDF417 Fast-Track)](docs/modulos/02_codigo_barras.md)
  - [Módulo 03: Reconocimiento Óptico (PaddleOCR ONNX)](docs/modulos/03_ocr_paddle_onnx.md)
  - [Módulo 04: Cotejo y Validación con Planillas Excel](docs/modulos/04_validacion_cotejo_excel.md)
  - [Módulo 05: Cola y Procesamiento Asíncrono de Lotes](docs/modulos/05_cola_procesamiento.md)
  - [Módulo 06: Autenticación, Seguridad y Control de Acceso](docs/modulos/06_autenticacion_seguridad.md)
  - [Módulo 07: Notificaciones y Servicio de Correo SMTP](docs/modulos/07_notificaciones_correo.md)
  - [Módulo 08: Frontend y Experiencia de Usuario](docs/modulos/08_frontend_dashboard.md)
  - [Módulo 09: Administración y Gestión de Solicitudes](docs/modulos/09_administracion_solicitudes.md)
  - [Módulo 10: Arquitectura de Despliegue en VPS y Dokploy](docs/modulos/10_despliegue_arquitectura.md)
- **Manual de Operaciones:** [Guía Completa de Despliegue en VPS con Dokploy](DOKPLOY_DEPLOYMENT_GUIDE.md)

---

## 🔑 Credenciales Predeterminadas (Semilla Inicial)

- **Administrador:** `admin@sena.edu.co`
- **Contraseña Inicial:** `Admin2026*`

---

## 🛠️ Ejecución Local para Desarrollo

### 1. Iniciar el Backend (Puerto 5000)
```bash
cd backend
npm install
npm run dev
```

### 2. Iniciar el Frontend (Puerto 5173)
```bash
cd frontend
npm install
npm run dev
```

El frontend estará disponible en: [http://localhost:5173](http://localhost:5173) y conectará automáticamente con el backend en el puerto `5000`.

---

## 🚀 Despliegue en Servidor VPS (Dokploy / Docker Compose)

El proyecto incluye configuración nativa para desplegar en un solo clic mediante **Dokploy** o **Docker Compose**:

```bash
# Iniciar todos los contenedores en producción
docker compose up -d --build
```

Consulta la guía detallada paso a paso en [DOKPLOY_DEPLOYMENT_GUIDE.md](DOKPLOY_DEPLOYMENT_GUIDE.md).
