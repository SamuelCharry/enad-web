# Presupuesto de lecturas de ENAd Web

El contador de Vitest monta las rutas del portal con autenticación, calendario y directorios. El semestre de prueba incluye 5 instituciones, 300 estudiantes, 25 grupos, 12 docentes, 15.000 asistencias, 2.000 evaluaciones y 1.000 registros de horas. La medición en frío empieza sin resultados en memoria ni en la sesión. La reapertura desmonta y vuelve a montar la ruta con la misma identidad y filtros.

El contador suma los documentos que devuelve cada consulta, al menos una lectura por consulta vacía y al menos una por cada bloque de hasta 1.000 entradas coincidentes en una agregación. La medición de producción puede incluir lecturas de las reglas de seguridad y entradas adicionales examinadas por el índice. Las pruebas se ejecutan con un SDK simulado.

## Lecturas por página

Se ejecutaron las pantallas anteriores y las actuales sobre los mismos datos de prueba. La reapertura de los informes incluye las lecturas del portal para cargar la sesión, los permisos y los filtros. La caché evita repetir las consultas del informe.

| Página | Antes en frío | Después en frío | Reapertura |
| --- | ---: | ---: | ---: |
| Inicio · coordinación | 18.362 | 242 | — |
| Inicio · fundación | 18.362 | 242 | — |
| Inicio · administración | 18.362 | 242 | — |
| Docente · Hoy | 308 | 62 | — |
| Docente · Mis datos | 2.259 | 177 | — |
| Docente · Asistencia | 125 | 77 | — |
| Docente · Evaluación | 305 | 77 | — |
| Docente · Horas | 125 | 65 | — |
| Docente · Grupos | 69 | 69 | — |
| Docente · Estudiantes | 64 | 64 | — |
| Informe · Resumen | 16.363 | 999 | 8 |
| Informe · Seguimiento | 16.039 | 89 | 8 |
| Informe · Instituciones | 11 | 7 | 7 |
| Informe · Horas y asistencia | 16.095 | 629 | 9 |
| Informe · Niveles | 1.274 | 149 | 8 |
| Informe · Seguimiento docente | 18.363 | 819 | 8 |
| Informe · Comparación | 18.363 | 644 | 8 |
| Administración · Instituciones | 11 | 11 | — |
| Administración · Docentes | 23 | 23 | — |
| Administración · Estudiantes | 358 | 316 | — |
| Administración · Grupos | 358 | 41 | — |
| Administración · Evaluaciones | 71 | 71 | — |
| Administración · Configuración | 2 | 2 | — |
| Administración · Calidad | 354 | 345 | — |
| Administración · Importaciones | 15 | 15 | — |

## Índices para el despliegue

El manifiesto contiene 61 índices compuestos. En cada fila los campos siguen el orden del índice. El equipo de despliegue debe aplicar el manifiesto y esperar a que los índices estén listos antes de publicar el portal.

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
