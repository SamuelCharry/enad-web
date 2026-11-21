import { ReportTable as Table } from './TableExport'
import { useReportQuery } from './navigation'
import type { ReportFilters, School } from '../../domain/types'
import { useGroups } from '../../data/groups'
import { getAttendanceReport } from '../../data/reports'
import { subjectLabel } from '../../domain/levels'
import { Button, Card, EmptyState } from '../../ui/components'
import { matchesSchool, number, percent } from './model'
import { LiveState, ReportRead } from './ReportState'
import { GroupRoster } from './StudentHistory'

function SchoolDetail({ school, filters }: { school: School; filters: ReportFilters }) {
  const {params, update} = useReportQuery()
  const campus = params.get('campus') ?? undefined
  const groupId = params.get('group')
  const { groups, loading, error } = useGroups(school.id,{campus,campusName:school.campuses.find(c=>c.id===campus)?.name,groupId:campus && groupId || undefined})
  const setCampus = (value?:string) => update({campus:value,group:undefined})
  const setGroup = (value:string) => update({group:value || undefined})
  const campuses = new Map(school.campuses.map(c => [c.id, c.name]))
  const local = groups.filter(g => g.schoolId === school.id)
  for (const g of local) {
    if (!school.campuses.some(c => c.id === g.campus || c.name === g.campus)) {
      campuses.set(g.campus, g.campus || 'Sin sede asignada')
    }
  }
  const visible = local.filter(g => g.campus === campus || g.campus === campuses.get(campus ?? ''))
  const selected = visible.find(g => g.id === groupId)
  const scope = { ...filters, schoolId: school.id, campus }
  return <LiveState loading={loading} error={error}>
    <h3>{school.name}</h3>
    {campus === undefined ? campuses.size ? <Table caption="Sedes de la institución" headers={['Sede', 'Grupos']} rows={Array.from(campuses, ([id, name]) => ({
      key: id, cells: [<Button key="open" variant="ghost" onClick={() => setCampus(id)}>{name}</Button>, number(local.filter(g => g.campus === id || g.campus === name).length)],
    }))} /> : <EmptyState title="No hay sedes registradas." description="Solicita el registro de una sede en Carga de datos." /> :
      <><Button onClick={() => setCampus(undefined)}>Volver a sedes</Button>
        <h4>{campuses.get(campus) ?? campus}</h4>
        {selected ? <><Button onClick={() => setGroup('')}>Volver a grupos</Button><GroupRoster group={selected} filters={scope} /></> :
          !visible.length ? <EmptyState title="No hay grupos en esta sede." description="Revisa otra sede o solicita la asignación de grupos." /> :
            <ReportRead query={JSON.stringify(scope)} load={() => getAttendanceReport(scope)}>{r => {
              const rates = new Map(r.byGroup.map(row => [row.groupId, row.rate]))
              return <Table caption="Grupos de la sede" headers={['Grupo', 'Área', 'Docente', 'Estudiantes', 'Tasa de asistencia']} rows={visible.map(g => ({
                key: g.id, cells: [<Button key="open" variant="ghost" onClick={() => setGroup(g.id)}>{g.name}</Button>, subjectLabel(g.subject), g.teacherName, number(g.studentIds.length), percent(rates.get(g.id))],
              }))} />
            }}</ReportRead>}
      </>}
  </LiveState>
}

export function Institutions({ filters, schools }: { filters: ReportFilters; schools: School[] }) {
  const {update} = useReportQuery()
  const selected = filters.schoolId
  const setSchool = (id:string) => update({schoolId:id || undefined,campus:undefined,group:undefined})
  const visible = schools.filter(s => matchesSchool(s, filters))
  const school = visible.find(s => s.id === selected)
  return <><h2>Instituciones</h2><Card>
    {school ? <><Button onClick={() => setSchool('')}>Volver a instituciones</Button>
      <SchoolDetail key={school.id} school={school} filters={filters} /></> :
      visible.length ? <Table caption="Instituciones en la selección" headers={['Institución', 'Municipio', 'Departamento', 'Sedes']}
        rows={visible.map(s => ({ key: s.id, cells: [<Button key="open" variant="ghost" onClick={() => setSchool(s.id)}>{s.name}</Button>, s.municipality, s.department, number(s.campuses.length)] }))} />
        : <EmptyState title="No hay instituciones en esta selección." description="Limpia los filtros para consultar otras instituciones." />}
  </Card></>
}
