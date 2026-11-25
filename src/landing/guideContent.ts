export const guideRoles = [
  { value: 'docente', label: 'Docente' },
  { value: 'coordinador', label: 'Coordinación' },
  { value: 'fundacion', label: 'Fundación' },
] as const

export type GuideRole = typeof guideRoles[number]['value']

export function guideRoleFromParam(param: string | null): GuideRole {
  if (param === 'seguimiento') return 'coordinador'
  if (param === 'administracion') return 'fundacion'
  return guideRoles.find(role => role.value === param)?.value ?? 'docente'
}

interface GuideStep {
  title: string
  actions: string[]
  image: { file: string; alt: string }
}

const login: GuideStep = {
  title: 'Ingresar con tu cuenta',
  actions: [
    'Abre ENAd Móvil. En Usuario, escribe el usuario o correo que te entregó la fundación.',
    'Escribe tu contraseña y toca Entrar. El botón del ojo te permite revisar la contraseña antes de enviarla.',
  ],
  image: { file: 'ingreso', alt: 'Formulario de ingreso con los campos Usuario y Contraseña y el botón Entrar.' },
}

const review: GuideStep = {
  title: 'Revisar un nombre',
  image: { file: 'revision', alt: 'Revisar muestra los nombres registrados y las opciones para aprobarlos o corregirlos.' },
  actions: [
    'Abre Revisar. Lee el nombre registrado y compáralo con los nombres que aparecen en el colegio.',
    'Si está bien escrito, toca Aprobar. Si necesitas corregirlo, toca Corregir nombre, escribe los nombres y apellidos y toca Guardar nombre.',
    'Si crees que dos fichas corresponden al mismo estudiante, consulta con la fundación. La unión de fichas todavía no está habilitada en la demostración.',
  ],
}

const reports: GuideStep = {
  title: 'Consultar los envíos de la semana',
  image: { file: 'seguimiento', alt: 'Seguimiento de envíos con el selector de semana y la opción Solo pendientes.' },
  actions: [
    'En Más, toca Reportes y abre la pestaña Seguimiento.',
    'Elige la Semana de implementación. Revisa las columnas de asistencia y horas de cada docente.',
    'Activa Solo pendientes para ver quién tiene algún registro por enviar.',
    'Para consultar otros informes, abre Instituciones y elige Lectura o Matemáticas. En Horas y asistencia puedes comparar las tasas de asistencia y ver las horas semanales por docente.',
  ],
}

const downloads: GuideStep = {
  title: 'Descargar registros',
  image: { file: 'descargas', alt: 'Secciones que se pueden exportar a Excel desde Descargas.' },
  actions: [
    'En Más, abre Descargas. Elige la sección que necesitas o toca Descargar todo.',
    'Cuando se abra el menú del teléfono, elige dónde guardar o compartir el archivo de Excel.',
  ],
}

export const stepsByRole: Record<GuideRole, GuideStep[]> = {
  docente: [
    login,
    {
      title: 'Empezar desde Hoy',
      image: { file: 'hoy', alt: 'Hoy muestra las acciones para evaluar, reportar asistencia y registrar horas.' },
      actions: [
        'En Hoy, revisa la fecha y la semana de implementación.',
        'Toca Evaluación formativa, Reportar asistencia o Reportar horas para abrir el registro que vas a completar.',
        'Abre Actividad de hoy para consultar el plan de tu grupo.',
      ],
    },
    {
      title: 'Guardar la asistencia',
      image: { file: 'asistencia', alt: 'Lista del grupo con las opciones Asistió, No asistió y Retirado por estudiante.' },
      actions: [
        'Desde Hoy, toca Reportar asistencia. Elige tu grupo y revisa la fecha de clase.',
        'Junto al nombre de cada estudiante, marca Asistió o No asistió. Si se retiró del programa, elige Retirado y confirma.',
        'Cuando toda la lista esté marcada, toca Guardar asistencia. Sin conexión, el registro queda pendiente de envío en el celular.',
      ],
    },
    {
      title: 'Evaluar por nivel',
      image: { file: 'evaluacion', alt: 'Evaluación de Lectura con el grupo y el momento seleccionados.' },
      actions: [
        'Desde Hoy, abre Evaluación formativa. Elige Lectura o Matemáticas.',
        'Selecciona el momento de evaluación y el grupo que vas a evaluar. Consulta la leyenda de niveles y marca el nivel que alcanzó cada estudiante.',
        'Toca Guardar al pie de la lista. El número entre paréntesis indica cuántos cambios vas a guardar.',
      ],
    },
    {
      title: 'Organizar tus grupos',
      image: { file: 'grupos', alt: 'Primer paso de Sugerir grupos con selector de momento y número de docentes.' },
      actions: [
        'En Grupos, elige la institución, la sede y la materia. Toca Crear grupo para darle un nombre y añadir estudiantes.',
        'Para formar un grupo según los niveles evaluados, toca Sugerir grupos. Elige el momento, indica cuántos docentes participarán y toca Ver propuesta.',
        'Revisa los integrantes, toca Elegir mi grupo y selecciona el que acompañarás. Ajusta el nombre y toca Crear mi grupo.',
      ],
    },
    {
      title: 'Añadir un estudiante',
      image: { file: 'estudiante', alt: 'Añadir estudiante muestra las coincidencias que encuentra la app al escribir el nombre.' },
      actions: [
        'En Mis datos, toca Gestionar estudiantes y abre Añadir estudiante. Escribe el nombre completo para buscar si ya está en la lista.',
        'Revisa el nombre y el grado de cada coincidencia. Si corresponde a otro estudiante, toca No, es un estudiante nuevo, completa los datos y elige Crear nuevo.',
        'Si tienes una lista en papel, desde Hoy puedes tocar Escanear lista de estudiantes. Toma una foto o elige una imagen, revisa cada nombre y toca Guardar.',
      ],
    },
    {
      title: 'Registrar tus horas',
      image: { file: 'horas', alt: 'Reporte de horas con días de la semana y horas programadas y realizadas.' },
      actions: [
        'Desde Hoy, abre Reportar horas. Toca el día que vas a reportar y revisa la institución. Para registrar otra semana, toca Cambiar semana.',
        'Completa Horas programadas y Horas realizadas. Si realizaste menos horas de las previstas, selecciona el motivo y completa el detalle que te pida la app.',
        'Toca Guardar. Si ya habías reportado ese día, comprueba los valores antes de confirmar el cambio.',
      ],
    },
    {
      title: 'Revisar Mis datos y los envíos',
      image: { file: 'pendientes', alt: 'Pantalla Pendientes con los registros que esperan conexión.' },
      actions: [
        'En Mis datos, revisa tu perfil y los grupos a tu cargo. Para corregir tu nombre, toca Editar nombre y confirma con Guardar nombre.',
        'Abre Pendientes. Cuando hay registros por enviar también puedes abrir la lista desde Hoy.',
        'Revisa los registros que siguen en el celular. Cuando recuperes la conexión, toca Reintentar envío. La lista queda vacía cuando termina el envío.',
      ],
    },
  ],
  coordinador: [
    {
      title: 'Consultar tus colegios',
      image: { file: 'inicio', alt: 'Inicio de Coordinación con los asuntos por atender en sus colegios.' },
      actions: [
        'Ingresa con tu cuenta de coordinación. En Inicio, revisa Por atender para identificar docentes sin registros o grupos sin evaluación en tus colegios.',
        'Abre Colegios y busca una institución asignada. Toca su nombre y elige un grupo para consultar sus estudiantes.',
      ],
    },
    review,
    reports,
    { ...downloads, image: { file: 'mas', alt: 'Menú Más de Coordinación con el acceso a Descargas.' } },
  ],
  fundacion: [
    {
      title: 'Revisar el programa',
      image: { file: 'inicio', alt: 'Inicio de Fundación con las alertas del programa.' },
      actions: [
        'Ingresa con tu cuenta de fundación. En Inicio, consulta Por atender para ver nombres por revisar, docentes sin registros y grupos que requieren seguimiento.',
        'En Esta semana, consulta asistencia y horas trabajadas. Abre Colegios para revisar una institución o Personas para buscar a un docente.',
      ],
    },
    review,
    { ...reports, image: { file: 'mas', alt: 'Menú Más de Fundación con el acceso a Reportes.' } },
    {
      title: 'Importar registros',
      image: { file: 'importar', alt: 'Importar archivo permite elegir colegios, docentes, estudiantes, grupos o evaluaciones.' },
      actions: [
        'Abre Más y toca Importar archivo. Elige el tipo de registro, por ejemplo, Estudiantes.',
        'Toca Descargar plantilla, completa una fila por registro y conserva los encabezados. Regresa a la app, toca Subir archivo y elige el Excel o CSV.',
        'Revisa la columna Validación. Si hay errores, corrige las filas en el archivo y vuelve a subirlo. Toca Importar para cargar las filas válidas y consulta el resultado.',
      ],
    },
    {
      title: 'Configurar el calendario',
      image: { file: 'calendario', alt: 'Configuración del programa con el inicio de implementación, las pausas y el botón Guardar configuración.' },
      actions: [
        'En Más, abre Configuración del programa. Revisa el proyecto, el año y la fecha de inicio de implementación.',
        'En Pausas y vacaciones, toca Añadir pausa, escribe el nombre y elige las fechas Desde y Hasta. Toca Guardar configuración.',
      ],
    },
    downloads,
  ],
}
