# Historias de Usuario con Criterios de Aceptación
## Sistema de Extracción y Validación de Cédulas

Este documento define las Historias de Usuario (HU) siguiendo la metodología ágil y el estándar **INVEST**, con criterios de aceptación estructurados en formato **Gherkin / BDD (Dado que / Cuando / Entonces)** y listas de verificación comprobables, cubriendo los 83 Requisitos Funcionales (**RF**) y las directrices técnicas (**RNF**).

---

## Índice de Módulos

1. [Módulo 1: Autenticación, Seguridad y Solicitudes](#1-módulo-de-autenticación-seguridad-y-solicitudes)
2. [Módulo 2: Carga de Archivos y Procesamiento Asíncrono](#2-módulo-de-carga-de-archivos-y-procesamiento-asíncrono)
3. [Módulo 3: Motor OCR, Preprocesamiento y Extracción de Datos](#3-módulo-de-motor-ocr-preprocesamiento-y-extracción-de-datos)
4. [Módulo 4: Segmentación y Generación de PDF Individual](#4-módulo-de-segmentación-y-generación-de-pdf-individual-por-titular)
5. [Módulo 5: Validación, Cruce con Excel y Generación de Reportes](#5-módulo-de-validación-cruce-con-excel-y-generación-de-reportes)
6. [Módulo 6: Panel de Visualización y Monitoreo en Tiempo Real](#6-módulo-de-panel-de-visualización-y-monitoreo-en-tiempo-real)
7. [Módulo 7: Administración de Usuarios y Solicitudes](#7-módulo-de-administración-de-usuarios-y-solicitudes)

---

## 1. Módulo de Autenticación, Seguridad y Solicitudes

### HU-001: Solicitud de Registro de Nuevo Usuario
- **Como:** Visitante no autenticado.
- **Quiero:** Enviar una solicitud de registro ingresando mi correo electrónico y una contraseña segura.
- **Para:** Solicitar acceso al sistema y que el administrador evalúe mi aprobación.
- **Requisitos cubiertos:** `RF-001`, `RF-002`, `RF-003`, `RF-004`, `RF-005`, `RF-006`, `RF-007`, `RF-079`, `RNF-021`, `RNF-023`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Validación de campos obligatorios:**
   - **Dado que** el visitante completa el formulario de solicitud,
   - **Cuando** ingresa un correo y contraseña válidos,
   - **Entonces** el sistema verifica que la contraseña contenga al menos 1 letra mayúscula, al menos 4 números y al menos 1 carácter especial (símbolo).
2. **Unicidad de correo electrónico:**
   - **Dado que** el correo ya existe en la base de datos (como usuario activo o solicitud previa),
   - **Cuando** intenta registrarse de nuevo,
   - **Entonces** el sistema rechaza la operación con el mensaje: *"El correo electrónico ya se encuentra registrado"*.
3. **Limitación de tasa (Rate Limiting):**
   - **Dado que** un visitante envía solicitudes repetidas,
   - **Cuando** supera el límite de 3 solicitudes desde el mismo correo en una ventana de 4 horas,
   - **Entonces** el sistema bloquea nuevas solicitudes de ese correo durante ese periodo indicando el tiempo de espera.
4. **Almacenamiento seguro y estado inicial:**
   - **Dado que** la solicitud cumple todas las validaciones,
   - **Cuando** se guarda en la base de datos,
   - **Entonces** queda en estado `"pendiente"`, la contraseña se encripta con `bcrypt` (cost factor 10+) y se envía un correo automático al administrador notificando la nueva solicitud.

---

### HU-002: Aprobación y Rechazo de Solicitudes de Registro
- **Como:** Administrador del sistema.
- **Quiero:** Revisar las solicitudes pendientes para aceptarlas o rechazarlas de forma controlada.
- **Para:** Garantizar que únicamente personal autorizado acceda a la plataforma.
- **Requisitos cubiertos:** `RF-008`, `RF-009`, `RF-010`, `RF-011`, `RF-012`, `RF-013`, `RF-072`, `RF-073`, `RF-075`, `RF-076`, `RF-080`, `RF-082`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Listado de solicitudes:**
   - **Dado que** el administrador ingresa a la vista de administración,
   - **Cuando** consulta la bandeja de solicitudes,
   - **Entonces** puede visualizar el listado de solicitudes pendientes con fecha de creación y correo.
2. **Aprobación de solicitud y generación de credenciales:**
   - **Dado que** el administrador pulsa *"Aceptar"* sobre una solicitud pendiente,
   - **Cuando** se procesa la aprobación,
   - **Entonces**:
     - El usuario se crea en estado activo con la marca `requiere_cambio_clave = true`.
     - El sistema genera una contraseña temporal criptográficamente segura.
     - Se envía un correo electrónico al solicitante con su contraseña temporal y el enlace de inicio de sesión.
     - La solicitud cambia su estado a `"aceptada"`.
3. **Rechazo silencioso:**
   - **Dado que** el administrador pulsa *"Rechazar"* sobre una solicitud,
   - **Cuando** confirma el rechazo,
   - **Entonces** la solicitud pasa a estado `"rechazada"` y el sistema **NO** envía ningún correo electrónico al solicitante.

---

### HU-003: Inicio de Sesión y Cambio Forzoso de Clave Temporal
- **Como:** Usuario con cuenta activa.
- **Quiero:** Iniciar sesión con mi correo y contraseña y actualizar mi clave en el primer acceso.
- **Para:** Acceder de forma segura a las funciones del sistema y establecer mi propia contraseña confidencial.
- **Requisitos cubiertos:** `RF-014`, `RF-015`, `RF-020`, `RF-021`, `RF-022`, `RNF-022`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Autenticación con JWT y Refresh Token:**
   - **Dado que** el usuario ingresa sus credenciales correctas,
   - **Cuando** el sistema valida el correo y la contraseña contra el hash de bcrypt,
   - **Entonces** emite un `access_token` JWT de corta duración y un `refresh_token` seguro en cookie `HttpOnly` / `SameSite`.
2. **Forzar cambio en el primer inicio:**
   - **Dado que** el usuario inicia sesión por primera vez con su contraseña temporal,
   - **Cuando** se autentica exitosamente,
   - **Entonces** el sistema bloquea la navegación general y redirige obligatoriamente a la pantalla de *"Cambio de Contraseña"*, impidiendo continuar hasta que defina una nueva clave que cumpla las políticas (1 mayúscula, 4 números, 1 símbolo).
3. **Opción Recordarme:**
   - **Dado que** el usuario marca la casilla *"Recordarme"*,
   - **Cuando** cierra el navegador y vuelve a abrirlo,
   - **Entonces** la sesión se mantiene activa prolongando la validez del refresh token.
4. **Cierre de sesión:**
   - **Dado que** el usuario autenticado presiona *"Cerrar Sesión"*,
   - **Cuando** confirma la acción,
   - **Entonces** el refresh token queda invalidado en el backend y los tokens locales son destruidos.

---

### HU-004: Bloqueo de Cuenta por Intentos Fallidos
- **Como:** Sistema de seguridad.
- **Quiero:** Bloquear temporalmente el acceso tras 3 intentos fallidos consecutivos de login.
- **Para:** Mitigar ataques de fuerza bruta o suplantación de identidad.
- **Requisitos cubiertos:** `RF-016`, `RF-017`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Conteo de intentos:**
   - **Dado que** un usuario ingresa una contraseña incorrecta,
   - **Cuando** falla el intento,
   - **Entonces** el contador de intentos fallidos incrementa en 1 y se le notifica cuántos intentos le quedan.
2. **Bloqueo a los 3 intentos:**
   - **Dado que** se alcanzan 3 intentos fallidos consecutivos,
   - **Cuando** ocurre el tercer fallo,
   - **Entonces** la cuenta queda bloqueada por un periodo estricto de 30 minutos, rechazando cualquier intento con el mensaje *"Cuenta bloqueada temporalmente. Intente nuevamente en 30 minutos"*.
3. **Desbloqueo automático:**
   - **Dado que** transcurrieron los 30 minutos de penalización,
   - **Cuando** el usuario ingresa sus credenciales correctas,
   - **Entonces** el sistema permite el acceso y reinicia el contador de intentos a 0.

---

### HU-005: Recuperación de Contraseña por Correo
- **Como:** Usuario con cuenta bloqueada o clave olvidada.
- **Quiero:** Solicitar un enlace de recuperación a mi correo electrónico.
- **Para:** Restablecer mi contraseña de forma autónoma y recuperar el acceso.
- **Requisitos cubiertos:** `RF-018`, `RF-019`, `RF-023`, `RF-081`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Solicitud de restablecimiento:**
   - **Dado que** el usuario ingresa su correo en la vista de recuperación,
   - **Cuando** solicita el restablecimiento,
   - **Entonces** el sistema genera un token seguro con vigencia de 30 minutos y envía un correo con el enlace directo.
2. **Reinicio de intentos y actualización:**
   - **Dado que** el usuario ingresa al enlace dentro de los 30 minutos,
   - **Cuando** establece su nueva contraseña conforme a las políticas,
   - **Entonces** la contraseña se actualiza, la cuenta se desbloquea de inmediato y el contador de intentos fallidos se reinicia a 0.
3. **Expiración de token:**
   - **Dado que** pasaron más de 30 minutos desde la solicitud,
   - **Cuando** el usuario hace clic en el enlace,
   - **Entonces** el sistema muestra el error: *"El enlace de recuperación ha expirado"*.

---

## 2. Módulo de Carga de Archivos y Procesamiento Asíncrono

### HU-006: Carga Unificada de PDF y Archivo Excel de Validación
- **Como:** Usuario autenticado.
- **Quiero:** Cargar simultáneamente un archivo PDF con cédulas escaneadas y un archivo Excel (.xlsx) con la lista oficial.
- **Para:** Iniciar la extracción automatizada y contrastar la documentación contra la lista oficial.
- **Requisitos cubiertos:** `RF-024`, `RF-025`, `RF-026`, `RF-027`, `RF-028`, `RF-029`, `RNF-034`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Validación de formatos de archivo:**
   - **Dado que** el usuario selecciona los archivos para subir,
   - **Cuando** el sistema inspecciona los tipos MIME y extensiones,
   - **Entonces** solo admite archivos con extensión `.pdf` para documentos y `.xlsx` para la matriz de validación.
2. **Validación de estructura del Excel:**
   - **Dado que** el archivo Excel se procesa inicialmente en la carga,
   - **Cuando** se leen los encabezados de la primera hoja,
   - **Entonces** debe contener de forma obligatoria las columnas: `Identificación`, `Nombre` y `Estado`. Si falta alguna, la carga es rechazada con un mensaje descriptivo.
3. **Creación del Lote de Procesamiento:**
   - **Dado que** ambos archivos son válidos,
   - **Cuando** se confirma la subida unificada,
   - **Entonces** se crea un registro de `"Lote"` en PostgreSQL en estado `"procesando"` con timestamp, usuario responsable y metadata de los archivos.

---

### HU-007: Encolamiento y Procesamiento en Segundo Plano
- **Como:** Usuario del sistema.
- **Quiero:** Que el procesamiento del PDF se ejecute en segundo plano mediante colas de trabajo.
- **Para:** Recibir confirmación inmediata sin que mi pantalla ni el servidor se bloqueen ante archivos grandes (hasta 1000 páginas).
- **Requisitos cubiertos:** `RF-030`, `RF-031`, `RNF-005`, `RNF-018`, `RNF-019`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Respuesta inmediata (202 Accepted):**
   - **Dado que** la carga de archivos finalizó con éxito,
   - **Cuando** se crea el lote,
   - **Entonces** el backend responde inmediatamente al cliente HTTP con el `id_lote` y estado `"en cola / procesando"`, sin esperar a que termine el OCR.
2. **Integración con BullMQ y Redis:**
   - **Dado que** se registra la tarea,
   - **Cuando** ingresa a la cola de BullMQ (`document-processing-queue`),
   - **Entonces** los workers toman la tarea de forma asíncrona, gestionando reintentos y liberando memoria del hilo principal de Node.js.

---

## 3. Módulo de Motor OCR, Preprocesamiento y Extracción de Datos

### HU-008: Preprocesamiento de Páginas y Ejecución OCR
- **Como:** Motor de extracción del sistema.
- **Quiero:** Convertir cada página del PDF a imagen optimizada y procesarla con OpenCV y Tesseract.
- **Para:** Obtener el texto de la más alta calidad posible, incluso en escaneos con ruido, inclinación o bajo contraste.
- **Requisitos cubiertos:** `RF-032`, `RF-033`, `RF-034`, `RF-047`, `RNF-006`, `RNF-007`, `RNF-025`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Conversión y resolución:**
   - Cada página del PDF se convierte a una imagen en alta resolución (mínimo 300 DPI).
2. **Pipeline de preprocesamiento OpenCV:**
   - La imagen pasa por:
     - Conversión a escala de grises.
     - Reducción de ruido (filtro Gaussiano / bilateral).
     - Corrección automática de ángulo/inclinación (deskewing).
     - Binarización adaptativa (Otsu thresholding).
3. **Limpieza estricta de archivos temporales:**
   - Una vez finalizado el lote (sea con éxito o fallo), todas las imágenes temporales y el PDF descargado en disco se eliminan de forma automática e inmediata.

---

### HU-009: Detección de Tipo de Documento y Extracción de Campos
- **Como:** Motor de extracción.
- **Quiero:** Clasificar el documento y extraer todos sus campos demográficos de forma selectiva.
- **Para:** Mapear fielmente la información según el formato oficial (Cédula Tradicional, Cédula Digital, Tarjeta de Identidad o Contraseña).
- **Requisitos cubiertos:** `RF-035`, `RF-036`, `RF-037`, `RF-038`, `RF-039`, `RF-040`, `RF-041`, `RF-045`, `RF-046`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Detección del tipo de documento:**
   - Si contiene encabezado `TARJETA DE IDENTIDAD` $\rightarrow$ Tipo `TI`.
   - Si contiene `CONTRASEÑA` o `REGISTRADURÍA ... COMPROBANTE` $\rightarrow$ Tipo `Contraseña`.
   - Si contiene `NUIP` con zona MRZ / diseño policarbonato $\rightarrow$ Tipo `CC Digital`.
   - Si contiene `CÉDULA DE CIUDADANÍA` con holograma amarillo $\rightarrow$ Tipo `CC Tradicional`.
2. **Extracción del número de documento (Frente y Reverso):**
   - **Frente:** Extraído mediante regex (`/(?:NUMERO|NUIP)\s*([\d\.]+)/i`).
   - **Reverso Código de Barras:** Extraído de la cadena inferior (`/[A-Z]-\d+-\d+-[MF]-(\d+)-\d+/`).
   - **Reverso MRZ (Digital):** Extraído de la segunda línea ICAO (`/\bCOL(\d{8,10})</`).
3. **Normalización obligatoria:**
   - Todos los números de documento se limpian de puntos, comas, guiones y espacios (ej. `"1.118.020.827"` $\rightarrow$ `"1118020827"`).
4. **Campos comunes y específicos por documento:**
   - **Comunes:** Nombres, Apellidos, Fecha Nacimiento, Lugar Nacimiento, Sexo, RH, Fecha/Lugar Expedición.
   - **Estatura:** Se extrae obligatoriamente en CC Tradicional y CC Digital; se deja `null` en TI y Contraseña.
   - **Fecha de Vencimiento:** Se extrae en TI y CC Digital; se deja `null` en CC Tradicional.
   - **Lugar de Preparación y Oficina de Entrega:** Se extraen únicamente si el documento es `Contraseña`.

---

### HU-010: Emparejamiento Frente-Reverso y Control de Completitud
- **Como:** Motor de extracción.
- **Quiero:** Emparejar las caras frontal y trasera usando el número de documento normalizado.
- **Para:** Consolidar una sola entidad completa por persona e identificar hojas sueltas o incompletas.
- **Requisitos cubiertos:** `RF-043`, `RF-044`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Documento en una sola página (Frente y Reverso juntos):**
   - **Dado que** una página del PDF contiene tanto el frente como el reverso en la misma imagen,
   - **Cuando** el sistema procesa ambas secciones,
   - **Entonces** consolida la cédula completa directamente con ambos lados en un solo registro.
2. **Documento en páginas separadas:**
   - **Dado que** el frente viene en una página y el reverso en otra distinta,
   - **Cuando** el sistema extrae el número del frente y el número del reverso,
   - **Entonces** realiza el cruce determinista: `frente.numero == reverso.numero`.
3. **Marcado de documentos incompletos:**
   - **Dado que** se detecta un frente sin reverso correspondiente (o viceversa),
   - **Cuando** finaliza el análisis del lote,
   - **Entonces** el registro se marca con el estado de validación `"incompleta"`.

---

## 4. Módulo de Segmentación y Generación de PDF Individual por Titular

### HU-011: Segmentación y Generación de PDF Individual de Cédula por Persona
- **Como:** Analista / Usuario del sistema.
- **Quiero:** Que a partir del archivo PDF del lote escaneado, el sistema extraiga y genere un archivo PDF individual e independiente que contenga exclusivamente la cédula (frente y reverso) correspondiente a cada persona.
- **Para:** Auditar el documento original de cada persona por separado (ej: consultar exclusivamente el PDF de la cédula de Daniel Felipe) junto con su información extraída, eliminando la dependencia de servicios de imágenes en la nube como Cloudinary.
- **Requisitos cubiertos:** `RF-042`, `RF-048`, `RF-049`, `RF-050`, `RF-051`, `RF-052`, `RNF-008`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Segmentación y aislamiento de páginas:**
   - **Dado que** se procesa un lote de cédulas en PDF,
   - **Cuando** el sistema detecta y agrupa las páginas pertenecientes a un mismo titular (frente y/o reverso emparejados por número de documento),
   - **Entonces** se compila un nuevo documento PDF que incluye únicamente las páginas de dicha persona.
2. **Nomenclatura limpia:**
   - El archivo PDF individual generado se nombra con el número de documento limpio de la persona (ej: `10006.pdf`).
3. **Almacenamiento local seguro:**
   - El PDF individual se almacena en el sistema de archivos del servidor (almacenamiento local seguro), sin recurrir a Cloudinary ni subir imágenes a servicios de terceros.
   - En caso de reprocesamiento del lote, el archivo se actualiza o sobrescribe limpiamente.
4. **Persistencia de la ruta:**
   - La ruta interna o identificador del archivo se guarda en PostgreSQL asociada al registro de la persona.

---

## 5. Módulo de Validación, Cruce con Excel y Generación de Reportes

### HU-012: Cruce de Datos OCR vs Matriz Excel
- **Como:** Analista / Usuario del sistema.
- **Quiero:** Que el sistema compare automáticamente los datos extraídos contra el archivo Excel.
- **Para:** Conocer al instante quiénes están matriculados, quiénes faltan y si hay errores en nombres o documentos.
- **Requisitos cubiertos:** `RF-053`, `RF-054`, `RF-055`, `RF-056`, `RF-057`, `RF-058`, `RF-059`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Limpieza del campo Identificación en Excel:**
   - El sistema lee la columna `Identificación` y elimina los prefijos como `"CC - "` o `"TI - "` y puntos para obtener el número puro (ej: `"CC - 1.118.020.827"` $\rightarrow$ `"1118020827"`).
2. **Clasificación del Estado de Validación:**
   - **Existe:** Si el número de documento extraído por OCR coincide exactamente con un número presente en el Excel y los nombres coinciden.
   - **No Existe:** Si la cédula fue leída en el PDF pero su número de documento **no** figura en el listado del Excel.
   - **Discrepancia:** Si el número de documento existe en el Excel, pero los nombres y apellidos extraídos por el OCR difieren del nombre registrado en la columna `Nombre` del Excel (se aplica comparación con tolerancia fonética o Levenshtein para evitar falsos positivos por tildes).

---

### HU-013: Generación y Exportación del Reporte de Validación
- **Como:** Usuario del sistema.
- **Quiero:** Visualizar el reporte consolidado y poder descargarlo en formatos PDF y Excel.
- **Para:** Compartir los resultados oficiales de la ficha con las autoridades académicas o administrativas.
- **Requisitos cubiertos:** `RF-060`, `RF-061`, `RF-062`, `RF-063`, `RF-064`.
- **Prioridad:** Alta (RF-060/061/062 en MVP; Exportación PDF/XLSX Prioridad Media).

#### Criterios de Aceptación
1. **Filtro de visualización del reporte:**
   - El reporte consolidado de la ficha muestra **únicamente** las personas que existen en el archivo Excel oficial.
2. **Columnas del reporte:**
   - Incluye: Número de documento, Nombres y Apellidos, Estado de validación (Existe / Discrepancia) y detalle de los campos con discrepancia señalados en color diferencial.
3. **Exportación:**
   - El usuario cuenta con dos botones de exportación:
     - **Exportar a Excel:** Genera un archivo `.xlsx` estructurado con estilos y estados.
     - **Exportar a PDF:** Genera un documento PDF imprimible con encabezados formales institucionales.

---

## 6. Módulo de Panel de Visualización y Monitoreo en Tiempo Real

### HU-014: Monitoreo en Vivo del Procesamiento de Lotes
- **Como:** Usuario que cargó un lote.
- **Quiero:** Observar una barra de progreso en tiempo real con el porcentaje de avance y páginas procesadas.
- **Para:** Conocer el estado de la tarea sin tener que recargar la página manualmente.
- **Requisitos cubiertos:** `RF-065`, `RF-066`, `RF-083`, `RNF-020`.
- **Prioridad:** Alta (MVP).

#### Criterios de Aceptación
1. **Actualización en tiempo real:**
   - A través de Server-Sent Events (SSE) o WebSocket conectado a los eventos de BullMQ, la barra de progreso se actualiza fluidamente indicando: `X de Y páginas procesadas (Z%)`.
2. **Notificación de finalización en panel:**
   - Al llegar al 100%, el panel muestra una alerta interactiva tipo Toast/Banner: *"Procesamiento completado con éxito"*, habilitando inmediatamente la visualización de resultados.
3. **Sin envío de correos spam:**
   - El sistema **NO** envía correos electrónicos al finalizar el lote (la confirmación es exclusivamente en el panel).

---

### HU-015: Explorador Interactivo de Cédulas y Filtros Avanzados
- **Como:** Usuario del sistema.
- **Quiero:** Navegar por la lista de cédulas procesadas con su foto, datos y filtros por tipo y estado.
- **Para:** Auditar rápidamente los casos especiales o revisar los datos individuales de cualquier aprendiz.
- **Requisitos cubiertos:** `RF-067`, `RF-068`, `RF-069`, `RF-070`, `RF-071`, `RNF-015`, `RNF-016`, `RNF-017`.
- **Prioridad:** Alta para lista/foto; Media para filtros avanzados.

#### Criterios de Aceptación
1. **Tabla interactiva y visualización de PDF propio:**
   - La interfaz muestra una tabla con la lista de personas procesadas (ej: fila con documento `10006`, nombre `Daniel Felipe`, tipo de documento y badge de estado de validación).
   - Al hacer clic en la fila de una persona (ej: `10006 Daniel Felipe`), se abre un panel/modal interactivo que presenta toda la información extraída del titular junto con un visor embebido interactivo de su PDF individual propio (el PDF exclusivo con la cédula de esa persona).
2. **Filtros funcionales:**
   - Selector por **Tipo de Documento:** Todos, Cédula de Ciudadanía (Tradicional/Digital), Tarjeta de Identidad, Contraseña.
   - Selector por **Estado de Validación:** Todos, Existe, No Existe, Discrepancia, Incompleta.
3. **Buscador predictivo en tiempo real:**
   - Un campo de búsqueda que filtra instantáneamente por coincidencia de número de cédula o nombre/apellido.
4. **Diseño Responsive y Modo Oscuro:**
   - La interfaz se adapta a móvil, tablet y escritorio con soporte para tema claro y tema oscuro (TailwindCSS).

---

## 7. Módulo de Administración de Usuarios y Solicitudes

### HU-016: Panel de Control de Usuarios Activos y Desactivación
- **Como:** Administrador del sistema.
- **Quiero:** Visualizar la lista de usuarios con acceso al sistema y tener la posibilidad de deshabilitar cuentas cuando sea necesario.
- **Para:** Controlar la seguridad y revocar accesos a funcionarios que ya no requieran usar la herramienta.
- **Requisitos cubiertos:** `RF-077`, `RF-078`.
- **Prioridad:** Media / Baja.

#### Criterios de Aceptación
1. **Control de acceso:**
   - Solo los usuarios con rol `ADMIN` pueden visualizar y operar este panel.
2. **Listado:**
   - Vista de tabla con correo, fecha de ingreso, estado (activo/inactivo) y último inicio de sesión.
3. **Desactivación de usuarios:**
   - El administrador puede alternar el estado de un usuario a `"inactivo"`.
   - Si un usuario inactivo intenta iniciar sesión, el sistema rechaza el acceso informando: *"Su cuenta ha sido desactivada. Contacte al administrador"*.

---

## Matriz de Trazabilidad: Requisitos vs Historias de Usuario

| Módulo | Requisitos Funcionales Cubiertos | Historias de Usuario Asignadas |
| :--- | :--- | :--- |
| **1. Autenticación y Solicitudes** | `RF-001` al `RF-023`, `RF-079`, `RF-080`, `RF-081`, `RF-082` | **HU-001, HU-002, HU-003, HU-004, HU-005** |
| **2. Carga de Archivos** | `RF-024` al `RF-031` | **HU-006, HU-007** |
| **3. OCR y Extracción** | `RF-032` al `RF-047` | **HU-008, HU-009, HU-010** |
| **4. Segmentación y PDF Individual** | `RF-048` al `RF-052` | **HU-011** |
| **5. Validación con Excel** | `RF-053` al `RF-064` | **HU-012, HU-013** |
| **6. Panel y Visualización** | `RF-065` al `RF-073`, `RF-083` | **HU-014, HU-015** |
| **7. Administración** | `RF-074` al `RF-078` | **HU-002, HU-016** |
| **8. Notificaciones** | `RF-079` al `RF-083` | Inmersas en **HU-001, HU-002, HU-005, HU-014** |
