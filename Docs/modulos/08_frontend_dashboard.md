# 💻 Módulo 08: Frontend y Experiencia de Usuario

## 1. Descripción General
El **Módulo Frontend y Experiencia de Usuario** es la aplicación web interactiva construida en **React**, **TypeScript** y **Vite**, estilizada con **Tailwind CSS** y complementada con la librería de iconos vectoriales **Lucide React**.

Ofrece a los instructores y administradores del SENA una interfaz moderna, limpia, intuitiva y de alto impacto visual, diseñada bajo los principios de cero distracciones, rendimiento fluido y soporte completo para modo oscuro y claro.

---

## 2. Archivos y Estructura Clave
```
frontend/src/
├── api/
│   └── client.ts              # Instancia Axios con interceptores JWT y manejo de 401
├── components/
│   ├── auth/                  # Modales de timeout, cambio de clave y confirmaciones
│   └── layout/
│       └── Navbar.tsx         # Barra superior con estado de usuario, tema y logout
├── hooks/
│   └── useInactivityTimeout.ts # Hook de detección de inactividad a los 30 min
├── pages/
│   ├── Login.tsx              # Vista de inicio de sesión (100% sin scroll vertical)
│   ├── RegisterRequest.tsx    # Formulario de solicitud de acceso institucional
│   ├── ForgotPassword.tsx     # Solicitud de recuperación de contraseña por correo
│   ├── ResetPassword.tsx      # Restablecimiento de clave con token y toggle de visibilidad
│   ├── Dashboard.tsx          # Panel principal de carga de lotes y validación interactiva
│   ├── FichasHistory.tsx      # Historial de fichas procesadas y descargas
│   └── AdminRequests.tsx      # Bandeja de aprobación de usuarios para administradores
├── stores/
│   ├── authStore.ts           # Estado global de autenticación persistente con Zustand
│   └── themeStore.ts          # Gestión del tema visual (Light / Dark mode)
└── App.tsx                    # Enrutador principal, guards de acceso y layout maestro
```

---

## 3. Principales Características de Diseño e Interacción

### A. Vista de Inicio de Sesión Sin Scroll (Zero Scroll)
- Diseñada específicamente para ajustarse de manera milimétrica a la altura de la ventana gráfica (`h-screen overflow-hidden` / `100dvh`).
- El pie de página exterior general se oculta en esta vista para evitar cualquier barra de desplazamiento vertical en monitores de cualquier resolución (desde portátiles de 1366x768 hasta pantallas de 4K).
- Incluye el selector de visibilidad de contraseña con iconos SVG vectoriales (`Eye` y `EyeOff`), garantizando ergonomía sin emojis informales.

### B. Dashboard de Procesamiento en Tiempo Real
- **Zona de Carga Drag & Drop**: Admite arrastrar o seleccionar simultáneamente el archivo PDF de cédulas y la planilla de Excel (`.xls`/`.xlsx`).
- **Barra de Telemetría**: Muestra el porcentaje de avance, la página actual siendo analizada y el desglose en vivo entre documentos procesados vía Fast-Track (código de barras) y vía OCR.
- **Filtros Rápidos y Búsqueda**: Permite filtrar aprendices por estado: *Todos*, *Validados*, *Discrepancias* o *No Encontrados*.
- **Visor Comparativo**: Al hacer clic en cualquier aprendiz con discrepancia, se despliega una vista lado a lado comparando los datos de la planilla con el texto extraído del documento escaneado.

### D. Transformación y Adaptabilidad Completa a Dispositivos Móviles (Mobile First)
- **Transformación de Vistas Tabulares a Tarjetas Táctiles**: En pantallas móviles (`< 768px`), las tablas anchas de reportes, solicitudes y usuarios no se comprimen ni generan desbordamientos confusos; se transforman completamente en **tarjetas táctiles interactivas** (`Card View`) con badges contextuales, datos clave jerarquizados y botones de acción rápida de fácil pulsación con el pulgar.
- **Barra de Navegación Móvil Inferior (`MobileBottomNav`)**: En dispositivos móviles se oculta el menú superior convencional y se despliega una barra fija inferior tipo App nativa (`Panel`, `Fichas`, `Admin`) con efecto glassmorphism (`backdrop-blur-md`) y soporte para áreas seguras (`safe-bottom`).
- **Modales Adaptables (Bottom Sheet Style)**: Las ventanas emergentes (edición manual de documentos, cambio de clave, confirmaciones) se ajustan automáticamente a la base de la pantalla táctil como hojas deslizables (`rounded-t-3xl`) con límites de altura (`max-h-[90vh]`) y scroll suave para evitar bloqueos del teclado virtual en smartphones.
