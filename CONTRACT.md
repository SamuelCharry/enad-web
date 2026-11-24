# ENAd Web v2

El portal React y ENAd Móvil comparten Firebase Auth y Firestore. La sección 8 del contrato común define los permisos, los registros y las funciones de v2. Las secciones anteriores siguen vigentes donde §8 conserva su comportamiento. [Contrato de datos](../docs/contract.md) · [Producto](../PRODUCT.md) · [Diseño](../DESIGN.md)

## Acceso y navegación

La portada, la guía pública y el ingreso están en `#/`, `#/guia` y `#/login`. El portal usa HashRouter. La ruta `#/portal` abre la página inicial del perfil activo. Los enlaces anteriores bajo `#/recoleccion` y `#/visualizacion` conservan la selección de colegio, fecha y grupo cuando corresponda.

| Perfil | Secciones bajo `#/portal/` | Alcance |
| --- | --- | --- |
| Docente | `hoy`, `asistencia`, `evaluacion`, `grupos`, `estudiantes`, `horas`, `actividades`, `pendientes`, `mis-datos`, `ayuda` | Colegios de `schoolIds` y grupos propios para registros de clase y planes |
| Coordinador | `inicio`, `personas`, `colegios`, `estudiantes`, `revision`, `grupos`, `actividades`, `reportes`, `descargas` | Colegios de `schoolIds`, edición de sus docentes y consulta de actividades |
| Fundación | Las secciones de coordinación y `programa` | Todos los colegios, perfiles y actividades |

El menú lateral admite teclado, indica la sección actual y se puede contraer. Hasta 900 px se abre como diálogo con foco contenido. Ayuda ofrece las guías de tareas docentes. Las pantallas usan texto en español de Colombia y los componentes y variables de `src/ui/`.

## Escrituras compartidas con la aplicación

| Operación | Documento o función |
| --- | --- |
| Asistencia | `students/{sid}/attendance/{gid}_{date}`. La marca de retiro y la actualización del estudiante se guardan juntas. |
| Evaluación | `students/{sid}/evaluations/{uuid}`. El reintento conserva el identificador. La muestra registrada puede ser nula. El nivel actual sigue la precedencia de momentos del contrato común. |
| Horas | `hours/{uid}_{schoolId}_{date}`. Planeadas y realizadas admiten de 0 a 24 en pasos de media hora. El detalle del motivo admite hasta 200 caracteres. |
| Actividad del día | `groups/{gid}/plan/{date}`. Cada grupo tiene un plan por fecha. Elegir otra actividad actualiza el mismo documento. |
| Revisión de nombres | El registro docente queda provisional y entra en la cola del colegio. Aprobar, corregir y descartar actualizan la ficha con quién y cuándo la revisó. Unir invoca `mergeStudents({fromId, intoId})`. |
| Personas | `createAccount`, `resetPassword` y `deleteAccount` se invocan en `southamerica-east1`. La contraseña generada se muestra al completar la operación. El inicio de sesión del operador se conserva. |
| Reorganización | Mover estudiantes actualiza los dos grupos en una transacción. Los grupos con `teacherId: null` se muestran como «Sin docente». |

Las fechas de clase usan el calendario de Colombia. Los timestamps se escriben en formato ISO. Pendientes guarda el identificador de cada envío por cuenta, conserva los fallos y comprueba la confirmación del servidor mediante los metadatos de Firestore. Las correcciones en Reportes comprueban la versión del registro y conservan el autor y el identificador originales.

## Consultas y descargas

Inicio compara la asistencia de esta semana con los mismos días de la anterior. La comparación de niveles usa estudiantes con resultados en los dos momentos. Los reportes consultan los registros dentro del alcance del perfil y los filtros elegidos. La descarga completa contiene las hojas Docentes, Estudiantes, Grupos, Asistencia, Evaluaciones, Horas, Actividades y Plan. Cada tabla se puede descargar por separado. [Presupuesto de lecturas](src/data/READ_BUDGET.md)

## Verificación local

Desde `web-portal/` se ejecuta `npm run typecheck && npm test && npm run lint && npm run build`. Vitest usa datos de prueba en memoria. Para una sesión de prueba integrada, inicia o compila Vite con `VITE_USE_EMULATORS=true` y el proyecto local `demo-enad`. Auth usa 9099, Firestore 8080 y Functions 5001. `VITE_EMULATOR_HOST` permite cambiar el host local. El smoke de Playwright verifica 375, 768 y 1440 px y acepta credenciales de emulador mediante `ENAD_USER` y `ENAD_PASS`.

W2 mantiene el portal autenticado. O2 mantiene OCR, las reglas de nombres, el adaptador de estudiantes y el diálogo de alta y edición en Estudiantes. R2 mantiene las reglas, índices y funciones del backend compartido.
