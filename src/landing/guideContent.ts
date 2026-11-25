export const guideRoles = [
  { value: 'docente', label: 'Docente' },
  { value: 'seguimiento', label: 'Coordinación / Fundación' },
  { value: 'administracion', label: 'Gestión de la fundación' },
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
        'Abre ENAd Móvil. En Usuario, escribe el usuario o el correo que te entregó la fundación.',
        'Escribe tu contraseña y toca Entrar. Usa el botón del ojo si necesitas revisar lo que escribiste.',
      ],
      portal: 'Desde el navegador del celular, toca Ingresar al portal e ingresa con la misma cuenta. Allí también puedes tomar asistencia, evaluar, organizar grupos y registrar horas.',
      image: { file: '01_login_filled', alt: 'Ingreso a ENAd Móvil con el usuario escrito, la contraseña oculta y el botón Entrar.' },
    },
    {
      title: 'Empezar desde Hoy',
      actions: [
        'En ENAd Móvil, consulta la fecha y la semana de implementación.',
        'Toca Evaluación formativa, Reportar asistencia o Reportar horas según la tarea que vayas a registrar.',
        'Para cargar una lista desde una foto, toca Escanear lista de estudiantes y revisa los nombres antes de guardarla.',
      ],
      portal: 'En Hoy puedes evaluar, reportar asistencia o registrar horas. También puedes consultar los registros por enviar y abrir Actividad de hoy.',
    },
    {
      title: 'Guardar la asistencia',
      actions: [
        'Abre Asistencia, elige uno de tus grupos y revisa la fecha de la clase.',
        'Marca Asistió o No asistió junto a cada nombre. Si el estudiante se retiró, toca Retirado y confirma. El retiro quedará en su ficha al guardar.',
        'Revisa el porcentaje de estudiantes que asistieron y cuántos quedan por marcar. Las filas que cambiaste dicen Sin guardar hasta que guardes la lista.',
        'Cuando todos tengan una marca, toca Guardar asistencia. Pendiente de envío indica que la marca ya quedó en tu dispositivo. Guardado confirma que el servidor la recibió.',
      ],
      portal: 'En Recolección de datos, elige Asistencia. Revisa la institución, el grupo y la fecha antes de marcar la lista.',
      image: { file: '05_docente_asistencia_guardada', alt: 'Asistencia de Abejitas. El encabezado indica «Asistió el 100 % de los estudiantes» y «0 por marcar · 0 sin guardar». Las filas muestran Guardado.' },
    },
    {
      title: 'Evaluar por nivel',
      actions: [
        'Desde Hoy, abre Evaluación formativa y elige Lectura o Matemáticas. Selecciona el momento de evaluación y revisa la sede. Elige un grupo o deja Todos mis estudiantes de la sede.',
        'Consulta la leyenda al pie de la lista. En la fila de cada estudiante, toca el nivel que alcanzó, del 1 al 6. Cada cambio queda Sin guardar.',
        'Si aparece Completar datos del perfil, toca el ícono de persona. Completa solo lo que falte de sexo, edad o muestra y toca Guardar datos. En ese perfil también encontrarás Retirar estudiante.',
        'Toca Guardar al pie de la pantalla para guardar todas las filas marcadas. El número entre paréntesis indica cuántas son. Para deshacer esos cambios, toca Descartar.',
      ],
      portal: 'En Recolección de datos, abre Evaluación formativa. Selecciona la materia y el momento para ver la lista.',
      image: { file: '09_docente_evaluado', alt: 'Lista de Lectura con un nivel marcado por estudiante. La leyenda identifica el 4 como Párrafo y el 3 como Palabra. Al pie aparece Guardar (0).' },
    },
    {
      title: 'Organizar tus grupos',
      actions: [
        'En Grupos, elige la institución, la sede y la materia. Toca Crear grupo, escribe el nombre y confirma.',
        'Abre tu grupo y toca Añadir al grupo para escoger estudiantes. Para quitar a alguien, abre el menú junto a su nombre, toca Quitar del grupo y confirma. Los grupos de otros docentes son de solo lectura.',
        'Para agrupar por nivel, toca Sugerir grupos. Indica cuántos docentes participarán y toca Ver propuesta. Elige el grupo que acompañarás, revisa sus integrantes y toca Aceptar mi grupo.',
      ],
      portal: 'Abre Grupos en Recolección de datos. Selecciona la sede y la materia antes de crear tu grupo o pedir una propuesta.',
      image: { file: '10_docente_grupos', alt: 'Grupos de Lectura con el docente de cada grupo y el botón Sugerir grupos.' },
    },
    {
      title: 'Registrar tus horas',
      actions: [
        'En Horas, revisa la semana y toca el día que vas a reportar. Usa Cambiar semana si necesitas otra fecha. Si trabajas en varias instituciones, elige la correspondiente.',
        'Completa Horas programadas y Horas realizadas. Si trabajaste menos horas de las programadas, selecciona el Motivo de horas no realizadas y escribe el detalle.',
        'Toca Guardar. Si ya existe un reporte para esa institución y ese día, revisa los valores antes de confirmar el reemplazo.',
      ],
      portal: 'En Recolección de datos, abre Horas y selecciona la institución y la fecha del reporte.',
      image: { file: '13_docente_horas_requiere_motivo', alt: 'Reporte diario con menos horas realizadas que programadas y el campo Motivo de horas no realizadas.' },
    },
    {
      title: 'Revisar Mis datos',
      actions: [
        'Abre Mis datos y revisa tu institución, sede y jornada. Para corregir tu nombre, toca Editar nombre, escríbelo y toca Guardar nombre.',
        'Despliega Mis grupos y toca un grupo para ver sus integrantes. Para abrir la lista de estudiantes, toca Gestionar estudiantes.',
        'Abre Reportes de horas para consultar lo que registraste en los últimos 30 días.',
      ],
      portal: 'Desde Inicio, entra en Visualización de datos. En Mis grupos puedes abrir un grupo y consultar el historial de un estudiante.',
      image: { file: '15_docente_mis_datos', alt: 'Mis datos muestra el perfil docente con Editar nombre, la sección Mis grupos y el botón Gestionar estudiantes.' },
    },
  ],
  seguimiento: [
    {
      title: 'Consultar el resumen',
      actions: [
        'Ingresa con tu cuenta de Coordinación o Fundación y abre Resumen. En el portal, empieza por Visualización de datos.',
        'En Por revisar, elige el momento de evaluación. Consulta los grupos sin evaluación, los docentes sin asistencia esta semana y las sedes con baja asistencia.',
        'Consulta los totales en Alcance del informe. Coordinación puede consultar sus colegios asignados y Fundación, todo el programa.',
        'Para acotar la consulta, abre Filtros. Elige proyecto, departamento o municipio según lo que necesites. Selecciona una institución para poder escoger su sede.',
      ],
      image: { file: '20_fundacion_resumen', alt: 'Resumen de Fundación con el selector de momento y las tres alertas de Por revisar. Debajo se ven los totales de estudiantes y docentes.' },
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
        'En ENAd Móvil, abre Resumen o Instituciones y revisa los filtros. Para exportar una sola sede, elige primero su institución.',
        'Toca Exportar Excel. En ENAd Móvil, elige dónde guardar o compartir el archivo. En el portal, búscalo en las descargas del navegador.',
      ],
    },
  ],
  administracion: [
    {
      title: 'Descargar la plantilla',
      actions: [
        'Ingresa con tu cuenta de fundación y abre Carga de datos. Selecciona el tipo de registro que vas a cargar, por ejemplo, Estudiantes.',
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
        'En Pausas y vacaciones, toca Añadir pausa. Escribe el nombre y elige las fechas en Desde y Hasta. Toca Guardar configuración.',
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
