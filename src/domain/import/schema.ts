/** Workbook types offered by Carga de datos. */
export type ImportKind = 'schools' | 'teachers' | 'students' | 'groups' | 'evaluations'
/** Column identity, display label and accepted header spellings. */
export interface ImportColumn { key: string; label: string; required: boolean; aliases: string[] }
function col(key: string, label: string, required = false, aliases: string[] = []): ImportColumn { return { key, label, required, aliases } }
const school = col('schoolId', 'Institución', true, ['IE', 'Código institución', 'ID institución', 'Institución educativa'])
const campus = col('campus', 'Sede', false, ['ID sede', 'Nombre de la sede'])
const code = col('code', 'Código del estudiante', true, ['Código', 'Código estudiante'])
const subject = col('subject', 'Área', true, ['Asignatura']), sample = col('sample', 'Muestra'), shift = col('jornada', 'Jornada')
/** Ordered columns shared by upload validation and downloadable templates. */
export const importColumns: Record<ImportKind, ImportColumn[]> = {
  students: [school, campus, code, col('fullName', 'Nombre del estudiante', true, ['nombre', 'estudiante', 'nombre completo']),
    col('grade', 'Grado', true, ['curso']), col('gender', 'Sexo', false, ['género']), col('age', 'Edad'), sample],
  teachers: [col('fullName', 'Nombre del docente', true, ['nombre', 'docente', 'nombre completo']),
  col('username', 'Usuario'), school, campus, shift, col('email', 'Correo electrónico', false, ['correo', 'e-mail'])],
  groups: [
    school,
    campus,
    col('name', 'Nombre del grupo', true, ['nombre', 'grupo']),
    subject,
    col('teacherId', 'ID docente', true, ['UID docente', 'Código docente'])
  ],
  schools: [
    col('id', 'ID institución', true, ['Código institución', 'schoolId']),
    col('name', 'Nombre de la institución', true, ['nombre', 'Institución', 'IE']),
    col('projectId', 'Proyecto', true),
    col('region', 'Región', true),
    col('department', 'Departamento', true),
    col('municipality', 'Municipio', true),
    col('zone', 'Zona', true),
    col('campusId', 'ID sede'),
    col('campusName', 'Nombre de la sede', false, ['sede']),
    shift
  ],
  evaluations: [
    school,
    code,
    subject,
    col('moment', 'Momento', true),
    col('level', 'Nivel', true),
    col('date', 'Fecha', true),
    sample,
    col('teacherId', 'ID docente'),
    col('groupId', 'ID grupo')
  ],
}
