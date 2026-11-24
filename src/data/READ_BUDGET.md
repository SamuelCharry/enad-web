# Presupuesto de lecturas de ENAd Web

El contador de Vitest monta las rutas del portal con autenticación, calendario y directorios. El semestre de prueba incluye 5 instituciones, 300 estudiantes, 25 grupos, 12 docentes, 15.000 asistencias, 2.000 evaluaciones y 1.000 registros de horas. La medición en frío empieza sin resultados en memoria ni en la sesión. La reapertura desmonta y vuelve a montar la ruta con la misma identidad y filtros.

El contador suma los documentos que devuelve cada consulta, al menos una lectura por consulta vacía y al menos una por cada bloque de hasta 1.000 entradas coincidentes en una agregación. La medición de producción puede incluir lecturas de las reglas de seguridad y entradas adicionales examinadas por el índice. Las pruebas se ejecutan con un SDK simulado.

## Lecturas por página

El presupuesto se mide con las rutas antiguas para cubrir también sus redirecciones. La columna de reapertura incluye las lecturas de la sesión, los filtros y el contador de nombres por revisar. La caché evita repetir las consultas del informe.

| Página | Tope en frío | Tope de reapertura |
| --- | ---: | ---: |
| Hoy docente | 5 | — |
| Inicio de coordinación o fundación | 300 | — |
| Asistencia, Evaluación, Horas, Grupos, Estudiantes o Mis datos | 400 | — |
| Directorios, datos históricos e importaciones | 400 | — |
| Reportes de resumen, seguimiento, instituciones, horas, niveles, docentes y comparación | 1.500 | 15 |

En los datos de prueba, Hoy cuesta una lectura. El número de pendientes proviene del dispositivo. Al reabrir con escrituras pendientes se observan únicamente los documentos sin acuse. En Asistencia se carga la lista del grupo elegido. Inicio consulta por colegio las marcas presentes y ausentes de ambas semanas y el total de horas. El historial de movimiento de niveles se consulta al abrir ese detalle. La barra lateral escucha la cola de nombres del perfil. Las descargas completas leen las entidades solicitadas cuando la persona pulsa descargar.

En Resumen, una semana con pocas marcas de asistencia se resuelve con una consulta de documentos. Para las semanas con muchas marcas, el informe lee el padrón de la institución una sola vez y usa sus identificadores para dividir la búsqueda en hasta 30 rangos simultáneos. Los rangos también cubren a estudiantes que ya salieron del padrón. La prueba de latencia usa un reloj simulado, con 250 ms por consulta de documentos y 7 s para la suma de horas. Comprueba que el informe completo está disponible a los 8 s.

## Índices para el despliegue

La tabla recoge los índices base de los informes. Para v2, la cola de nombres usa `needsReview` y `schoolId`, la lista de docentes combina `rol` con `schoolIds array-contains` y la descarga de planes por colegio usa `schoolId` y `date` en el grupo de colecciones `plan`. En cada fila los campos siguen el orden del índice. El equipo de despliegue debe aplicar el manifiesto y esperar a que los índices estén listos antes de publicar el portal.

| Colección | Ámbito | Campos y dirección |
| --- | --- | --- |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, savedAt DESC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, savedAt DESC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, savedAt DESC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, groupId ASC, savedAt DESC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, date ASC, groupId ASC, teacherId ASC, savedAt DESC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, groupId ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, studentId ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, status ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, studentId ASC, status ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, groupId ASC, status ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, groupId ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, groupId ASC, teacherId ASC, status ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, groupId ASC, studentId ASC, status ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, groupId ASC, studentId ASC, status ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, status ASC, date ASC, studentId ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, studentId ASC, date ASC, groupId ASC, teacherId ASC, savedAt DESC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, studentId ASC, groupId ASC, teacherId ASC, status ASC, date ASC` |
| `attendance` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, studentId ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, savedAt DESC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, savedAt DESC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, savedAt DESC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, studentId ASC, savedAt DESC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, moment ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, groupId ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, studentId ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, studentId ASC, groupId ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, studentId ASC, date ASC, groupId ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, studentId ASC, moment ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, studentId ASC, savedAt DESC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, studentId ASC, moment ASC, savedAt DESC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, subject ASC, moment ASC, studentId ASC, savedAt DESC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, teacherId ASC, date ASC` |
| `evaluations` | `COLLECTION_GROUP` | `schoolId ASC, studentId ASC, date ASC` |
| `hours` | `COLLECTION` | `schoolId ASC, savedAt DESC` |
| `hours` | `COLLECTION` | `schoolId ASC, date ASC` |
| `hours` | `COLLECTION` | `schoolId ASC, teacherId ASC, date ASC` |
| `hours` | `COLLECTION` | `schoolId ASC, teacherId ASC, savedAt DESC, date ASC` |
| `hours` | `COLLECTION` | `schoolId ASC, date ASC, plannedHours ASC, workedHours ASC` |
| `hours` | `COLLECTION` | `schoolId ASC, teacherId ASC, date ASC, plannedHours ASC, workedHours ASC` |
| `students` | `COLLECTION` | `schoolId ASC, active ASC, retired ASC, levels.lectura.level ASC, levels.lectura.moment ASC` |
| `students` | `COLLECTION` | `schoolId ASC, active ASC, retired ASC, levels.matematicas.level ASC, levels.matematicas.moment ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.lectura.moment ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.lectura.moment ASC, levels.lectura.level ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.lectura.moment ASC, age ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.lectura.moment ASC, gender ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.lectura.moment ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.lectura.moment ASC, levels.lectura.level ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.lectura.moment ASC, age ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.lectura.moment ASC, gender ASC, levels.lectura.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.matematicas.moment ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.matematicas.moment ASC, levels.matematicas.level ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.matematicas.moment ASC, age ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, levels.matematicas.moment ASC, gender ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.matematicas.moment ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.matematicas.moment ASC, levels.matematicas.level ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.matematicas.moment ASC, age ASC, levels.matematicas.date ASC` |
| `students` | `COLLECTION` | `schoolId ASC, campus ASC, levels.matematicas.moment ASC, gender ASC, levels.matematicas.date ASC` |

### Configuraciones de campo individual

| Colección | Campo | Ámbito y dirección |
| --- | --- | --- |
| `attendance` | `schoolId` | `COLLECTION ASC, COLLECTION_GROUP ASC` |
| `evaluations` | `schoolId` | `COLLECTION ASC, COLLECTION_GROUP ASC` |
| `attendance` | `studentId` | `COLLECTION ASC, COLLECTION DESC, COLLECTION_GROUP ASC` |
| `evaluations` | `studentId` | `COLLECTION ASC, COLLECTION DESC, COLLECTION_GROUP ASC` |
