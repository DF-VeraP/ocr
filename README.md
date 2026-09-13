# SENA OCR | Sistema de Extracción y Validación de Cédulas

Sistema integral para la extracción automatizada de datos desde documentos de identidad colombianos (PDF escaneados) y validación cruzada contra listas oficiales de matrícula en Excel (.xlsx / .xls).

> **Nota sobre Visualización y Almacenamiento:**
> Se descarta rotundamente el uso de servicios externos de imágenes como Cloudinary. En su lugar, el sistema segmenta el PDF original de lote y genera un archivo PDF individual e independiente por cada persona (conteniendo únicamente las páginas de su cédula). En la interfaz de usuario se presenta una tabla interactiva (ej: `10006 - Daniel Felipe`); al hacer clic en dicha fila, se despliega toda la información extraída del titular junto con el visor integrado de su PDF individual correspondiente.

---

## 🚀 Arquitectura del Proyecto

```text
OCR/
├── Docs/                              # Archivos de prueba oficiales
│   ├── DOCUMENTOS FICHA 3590737 (1).pdf
│   ├── reporte_inscripcion 3574135 (1).xls
│   └── Documentacion/
│       ├── Requisitos.md              # 83 Requisitos Funcionales y 35 RNF
│       └── Historias_de_Usuario.md    # 16 Historias de Usuario en formato Gherkin
├── backend/                           # Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/schema.prisma           # Modelos relacionales
│   ├── src/
│   │   ├── config/                    # Configuración DB, JWT, Nodemailer
│   │   ├── controllers/               # Auth, Admin, Batch
│   │   ├── middlewares/               # JWT guard, Rate limiting (RF-006), Multer
│   │   ├── routes/                    # API endpoints REST
│   │   ├── services/                  # OCR Tesseract, PDF split individual, Excel, Validation
│   │   └── server.ts                  # Servidor Express y SSE
└── frontend/                          # React 18 + Vite + TailwindCSS + Zustand
    ├── src/
    │   ├── api/                       # Cliente Axios con interceptor Bearer
    │   ├── components/                # Dropzone dual, ProgressBar SSE, Grid de cédulas, Reporte
    │   ├── pages/                     # Login, Solicitud, Recuperación, Admin, Dashboard
    │   └── stores/                    # AuthStore, ThemeStore (Modo Oscuro)
```

---

## 🔑 Credenciales Predeterminadas (Semilla Inicial)

- **Administrador:** `admin@sena.edu.co`
- **Contraseña Inicial:** `Admin2026*`

---

## 🛠️ Ejecución Local

### 1. Iniciar el Backend (Puerto 5000)
```bash
cd backend
npm run dev
```

### 2. Iniciar el Frontend (Puerto 5173)
```bash
cd frontend
npm run dev
```

El frontend estará disponible en: [http://localhost:5173](http://localhost:5173) y redirigirá las peticiones `/api` al backend en el puerto `5000`.
