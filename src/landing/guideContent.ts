export const guideRoles = [
  { value: 'docente', label: 'Docente' },
  { value: 'seguimiento', label: 'Coordinación / Fundación' },
  { value: 'administracion', label: 'Administración' },
] as const

export type GuideRole = typeof guideRoles[number]['value']

export function guideRoleFromParam(param: string | null): GuideRole {
  return guideRoles.find(role => role.value === param)?.value ?? 'docente'
}

interface GuideStep {
  title: string
  actions: string[]
  portal?: string
  image?: { file: string; alt: string }
}

export const stepsByRole: Record<GuideRole, GuideStep[]> = {
  docente: [
    {
      title: 'Ingresar con tu cuenta',
      actions: [
        'Abre ENAd Móvil. En Usuario, escribe el usuario o el correo que te entregó administración.',
        'Escribe tu contraseña y toca Entrar. Usa el botón del ojo si necesitas revisar lo que escribiste.',
      ],
      portal: 'Desde el navegador del celular, toca Ingresar al portal e ingresa con la misma cuenta. Allí también puedes tomar asistencia, evaluar, organizar grupos y registrar horas.',
      image: { file: '01_login_filled', alt: 'Ingreso a ENAd Móvil con el usuario escrito, la contraseña oculta y el botón Entrar.' },
    },
    {
      title: 'Empezar desde Hoy',
      actions: [
        'En Hoy, toca Reportar asistencia para abrir la lista de tu grupo, o Evaluación formativa para registrar un nivel.',
        'Usa la barra inferior para pasar a Grupos, Horas o Mis datos. Toca Hoy para volver a los accesos de clase.',
      ],
      portal: 'Desde Inicio, abre Recolección de datos para registrar tu clase. En Visualización de datos encuentras Mis datos.',
      image: { file: '02_docente_hoy', alt: 'Pantalla Hoy con los grupos del docente y los accesos a Evaluación formativa y Reportar asistencia.' },
    },
    {
      title: 'Guardar la asistencia',
      actions: [
        'Abre Asistencia, elige uno de tus grupos y revisa la fecha de la clase.',
        'Marca Asistió o No asistió junto a cada nombre. Usa Retirado solo si el estudiante se retiró y confirma la decisión. Al guardar, también quedará retirado en su ficha.',
        'Cuando todos tengan una marca, toca Guardar asistencia. Por guardar indica que aún falta ese toque. Pendiente de envío indica que la marca ya quedó en el dispositivo. Guardado indica que el servidor la confirmó.',
      ],
      portal: 'En Recolección de datos, elige Asistencia. Revisa la institución, el grupo y la fecha antes de marcar la lista.',
      image: { file: '05_docente_asistencia_guardada', alt: 'Lista de asistencia con Asistió seleccionado y el estado Guardado junto a los estudiantes.' },
    },
    {
      title: 'Evaluar por nivel',
      actions: [
        'Desde Hoy, abre Evaluación formativa y elige Lectura o Matemáticas. Selecciona el momento de evaluación, por ejemplo, Línea base.',
        'Revisa la sede. Elige un grupo o consulta todos los estudiantes de la sede. Toca el nombre de quien vas a evaluar.',
        'Revisa el sexo, la edad y la muestra. Marca el nivel que alcanzó en esa materia y toca Guardar evaluación antes de pasar al siguiente estudiante.',
      ],
      portal: 'En Recolección de datos, abre Evaluación formativa. Selecciona la materia y el momento para ver la lista.',
      image: { file: '09_docente_evaluado', alt: 'Ficha de Lectura con sexo, edad, muestra y el nivel Párrafo seleccionado para un estudiante evaluado.' },
    },
    {
      title: 'Organizar tus grupos',
      actions: [
        'En Grupos, elige la institución, la sede y la materia. Toca Crear grupo, escribe el nombre y confirma.',
        'Abre tu grupo y toca Añadir al grupo para escoger estudiantes. Para quitar a alguien, usa la opción junto a su nombre y confirma. Los grupos de otros docentes son de solo lectura.',
        'Para agrupar por nivel, toca Sugerir grupos. Indica cuántos docentes participarán y toca Ver propuesta. Elige el grupo que acompañarás, revisa sus integrantes y toca Aceptar mi grupo.',
      ],
      portal: 'Abre Grupos en Recolección de datos. Selecciona la sede y la materia antes de crear tu grupo o pedir una propuesta.',
      image: { file: '10_docente_grupos', alt: 'Grupos de Lectura con el docente de cada grupo y el botón Sugerir grupos.' },
    },
    {
      title: 'Registrar tus horas',
      actions: [
        'En Horas, revisa la semana de implementación y toca el día que vas a reportar. Si trabajas en varias instituciones, elige la correspondiente.',
        'Escribe las horas programadas y las realizadas ese día. Si realizaste menos de las programadas, elige un motivo y escribe el detalle.',
        'Toca Guardar. Si ya existe un reporte para esa institución y ese día, revisa los valores antes de confirmar el reemplazo.',
      ],
      portal: 'En Recolección de datos, abre Horas y selecciona la institución y la fecha del reporte.',
      image: { file: '13_docente_horas_requiere_motivo', alt: 'Reporte diario con menos horas realizadas que programadas y el campo Motivo de horas no realizadas.' },
    },
    {
      title: 'Revisar Mis datos',
      actions: [
        'Abre Mis datos para comprobar tu institución, sede y jornada. Si necesitas corregir tu nombre, toca Editar nombre y guarda el cambio.',
        'Despliega Mis grupos y toca un grupo para revisar sus integrantes. Más abajo, consulta tus indicadores y el historial de horas de los últimos 30 días.',
      ],
      portal: 'Desde Inicio, entra en Visualización de datos. En Mis grupos puedes abrir un grupo y consultar el historial de un estudiante.',
      image: { file: '15_docente_mis_datos', alt: 'Mis datos muestra el perfil docente, la institución, la sede y el apartado Mis grupos.' },
    },
  ],
  seguimiento: [
    {
      title: 'Consultar el resumen',
      actions: [
        'Ingresa con tu cuenta de Coordinación o Fundación y abre Resumen. En el portal, empieza por Visualización de datos.',
        'Revisa estudiantes, docentes, instituciones y sedes. Coordinación consulta sus regiones asignadas y Fundación consulta todo el programa. Ambos perfiles son de solo lectura.',
        'Para acotar la consulta, abre Filtros. Elige proyecto, departamento o municipio según lo que necesites. Selecciona una institución para poder escoger su sede.',
      ],
      image: { file: '20_fundacion_resumen', alt: 'Resumen del portal de fundación con Filtros y los totales de estudiantes, docentes, instituciones, sedes y grupos.' },
    },
    {
      title: 'Identificar envíos pendientes',
      actions: [
        'Abre Seguimiento y selecciona la semana de implementación. Comprueba las fechas que aparecen bajo el resumen de envíos.',
        'Lee las columnas de asistencia y horas para cada docente. Activa Solo pendientes para ver a quién le falta al menos uno de los dos reportes.',
      ],
      image: { file: '21_fundacion_seguimiento', alt: 'Seguimiento de envíos con selector de semana, opción Solo pendientes y columnas de asistencia y horas.' },
    },
    {
      title: 'Llegar a un estudiante',
      actions: [
        'En Instituciones, busca Rezago por institución y toca el nombre de una institución.',
        'Despliega la sede y abre el grupo. Busca al estudiante en la lista para consultar sus niveles de lectura y matemáticas y su asistencia en ese grupo.',
      ],
      portal: 'En Visualización de datos, abre Instituciones. Toca la institución, después la sede y por último el grupo para ver sus estudiantes.',
      image: { file: '24_fundacion_sedes_grupos', alt: 'Detalle de una institución con una sede desplegada y sus grupos de Lectura y Matemáticas.' },
    },
    {
      title: 'Comparar niveles y rezago',
      actions: [
        'En Instituciones, elige Lectura o Matemáticas. Compara la distribución de niveles en Línea base y Línea media 1.',
        'Consulta Rezago por institución para ver qué proporción de los estudiantes evaluados quedó en los tres primeros niveles de la materia en cada momento.',
      ],
      portal: 'En Visualización de datos, abre Niveles y selecciona la materia que quieres consultar.',
      image: { file: '22_fundacion_instituciones', alt: 'Informe de Instituciones con Lectura seleccionada y la comparación del rezago entre Línea base y Línea media 1.' },
    },
    {
      title: 'Revisar horas y asistencia',
      actions: [
        'Abre Horas y asistencia. En Tasa de asistencia, elige Institución, Grupo o Docente según la comparación que necesitas.',
        'En Horas semanales por docente, abre un nombre para comparar las horas programadas y realizadas por semana.',
      ],
      image: { file: '26_fundacion_horas_asistencia', alt: 'Horas y asistencia muestra la tasa por institución y el inicio del informe de horas semanales por docente.' },
    },
    {
      title: 'Exportar a Excel',
      actions: [
        'Comprueba los filtros del informe. Si necesitas una sola sede, selecciona primero su institución.',
        'Toca Exportar Excel. En ENAd Móvil, elige dónde guardar o compartir el archivo. En el portal, búscalo en las descargas del navegador.',
      ],
    },
  ],
  administracion: [
    {
      title: 'Descargar la plantilla',
      actions: [
        'Ingresa con tu cuenta de administración y abre Carga de datos. Selecciona el tipo de registro que vas a cargar, por ejemplo, Estudiantes.',
        'Toca Importar archivo y luego Descargar plantilla. Completa una fila por registro y conserva los encabezados del archivo.',
      ],
      portal: 'Desde Inicio, abre Recolección de datos. Allí encontrarás Carga de datos con las secciones de instituciones y sedes, docentes, estudiantes, grupos y evaluaciones históricas.',
      image: { file: '40_admin_carga_de_datos', alt: 'Menú Carga de datos con los directorios de importación y la configuración del programa.' },
    },
    {
      title: 'Revisar las filas con errores',
      actions: [
        'Toca Subir archivo y selecciona el Excel (.xlsx) o CSV que completaste. En el portal, usa el campo Archivo de Excel o CSV.',
        'En la vista previa, revisa la columna Validación. Usa el número de fila para encontrar el dato en tu archivo, corregirlo y volver a subirlo.',
      ],
      image: { file: '41_admin_vista_previa_con_error', alt: 'Vista previa de una carga de estudiantes con filas válidas y una fila con errores de muestra, edad, grado y sexo.' },
    },
    {
      title: 'Importar y comprobar el resultado',
      actions: [
        'Revisa cuántas filas son válidas. Si decides continuar, toca el botón para importar esas filas. Las filas con errores quedan fuera de la carga.',
        'Al terminar, lee el resultado de la importación. Comprueba los registros creados y los omitidos antes de preparar otra carga.',
      ],
      image: { file: '42_admin_importado', alt: 'Importación terminada con el resultado de filas creadas y omitidas debajo de la vista previa.' },
    },
    {
      title: 'Configurar el programa',
      actions: [
        'Desde Carga de datos, abre Configuración del programa. Revisa el nombre del proyecto, el año y la fecha de inicio de implementación.',
        'En Pausas y vacaciones, registra el nombre y las fechas de cada pausa. Revisa el calendario y toca Guardar configuración.',
      ],
    },
    {
      title: 'Activar una cuenta docente',
      actions: [
        'Desde Carga de datos, abre Docentes. Busca al docente por nombre o correo y abre su registro para editarlo.',
        'Marca Cuenta activa. Comprueba las instituciones y sedes asignadas y guarda los cambios. Pídele al docente que ingrese con su cuenta.',
      ],
    },
  ],
}
