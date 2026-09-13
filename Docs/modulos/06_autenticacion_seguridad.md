# 🔒 Módulo 06: Autenticación, Seguridad y Control de Acceso

## 1. Descripción General
El **Módulo de Autenticación, Seguridad y Control de Acceso** protege los recursos del sistema y garantiza que únicamente personal institucional autorizado del SENA pueda procesar expedientes de identidad o acceder a información confidencial de los aprendices.

Implementa un esquema riguroso de seguridad que cumple con los requerimientos funcionales institucionales: autenticación mediante JSON Web Tokens (JWT), roles diferenciados (`ADMIN` e `INSTRUCTOR`), políticas de contraseñas robustas, bloqueo temporal ante ataques de fuerza bruta y detección de inactividad.

---

## 2. Archivos y Componentes Clave
- **Controlador de Autenticación**: [`backend/src/controllers/auth.controller.ts`](file:///c:/Users/Lenovo/Documents/SENA/OCR/backend/src/controllers/auth.controller.ts)
- **Middlewares de Seguridad**:
  - `backend/src/middlewares/auth.middleware.ts`: Verificación de validez de JWT, comprobación de revocación y control de roles.
- **Librerías Utilizadas**:
  - `jsonwebtoken`: Emisión y validación criptográfica de tokens con firma HMAC-SHA256.
  - `bcrypt`: Hashing unidireccional de contraseñas con salt (factor de coste 10/12).

---

## 3. Matriz de Roles y Permisos (RBAC)

| Funcionalidad / Endpoint | Rol `INSTRUCTOR` | Rol `ADMIN` |
|---|:---:|:---:|
| Iniciar Sesión (`POST /api/auth/login`) | ✅ | ✅ |
| Cargar Lote de Cédulas y Planilla (`POST /api/batch/upload`) | ✅ | ✅ |
| Consultar Historial de Fichas Propias | ✅ | ✅ |
| Descargar Reportes Excel / PDF | ✅ | ✅ |
| Ver Solicitudes de Registro Pendientes (`GET /api/admin/requests/pending`) | ❌ | ✅ |
| Aprobar o Rechazar Solicitudes (`POST /api/admin/requests/:id/accept`) | ❌ | ✅ |
| Configuración del Sistema y Auditoría Global | ❌ | ✅ |

---

## 4. Políticas de Seguridad Implementadas

### A. Política de Contraseñas Fuertes (RF-003)
Toda contraseña debe cumplir obligatoriamente con las siguientes reglas validadas en tiempo real:
- Al menos **1 letra mayúscula** (`[A-Z]`).
- Al menos **4 caracteres numéricos** (`[0-9]`).
- Al menos **1 símbolo o carácter especial** (`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]`).
- Longitud mínima de 8 caracteres.

### B. Bloqueo Progresivo por Intentos Fallidos (Anti-Fuerza Bruta)
- Si un usuario introduce una contraseña incorrecta **5 veces consecutivas**, la cuenta pasa a estado bloqueado temporalmente durante **15 minutos**.
- Se envía automáticamente una notificación de seguridad por correo electrónico alertando al usuario y facilitando un enlace de desbloqueo/restablecimiento.

### C. Inactividad de Sesión y Revocación Dinámica
- **Timeout por Inactividad**: Si no se registra interacción del usuario durante **30 minutos**, la sesión caduca automáticamente en el cliente y el token se invalida.
- **Revocación por Reinicio de Servidor**: Los tokens incluyen una huella temporal vinculada a la sesión activa; si el servidor se reinicia o se cambia la contraseña, todas las sesiones previas quedan invalidadas de inmediato (`401 Unauthorized`).

### D. Flujo de Primer Acceso (`requiresPasswordChange`)
- Cuando un nuevo instructor es aprobado por el administrador, el sistema le asigna una **contraseña temporal aleatoria** y marca la bandera `requiresPasswordChange = true`.
- Al iniciar sesión por primera vez, el sistema intercepta la navegación y exige de forma obligatoria el cambio de contraseña por una definitiva antes de permitir el acceso al Dashboard.
