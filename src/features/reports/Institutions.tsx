import { useState } from 'react'
import type { ReportFilters, School } from '../../domain/types'
import { useGroups } from '../../data/groups'
import { getAttendanceReport } from '../../data/reports'
import { useSchools } from '../../data/scope'
import { subjectLabel } from '../../domain/levels'
import { Button, Card, EmptyState, Table } from '../../ui/components'
import { matchesSchool, number, percent } from './model'
import { LiveState, ReportRead } from './ReportState'
import { Roster } from './Roster'

function SchoolDetail({ school, filters }: { school: School; filters: ReportFilters }) {
  const { groups, loading, error } = useGroups(school.id)
  const [campus, setCampus] = useState<string | undefined>(filters.campus)
  const [groupId, setGroup] = useState('')
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
    }))} /> : <EmptyState title="No hay sedes registradas." /> :
      <>{!filters.campus && <Button onClick={() => { setCampus(undefined); setGroup('') }}>Volver a sedes</Button>}
        <h4>{campuses.get(campus) ?? campus}</h4>
        {selected ? <><Button onClick={() => setGroup('')}>Volver a grupos</Button><Roster group={selected} filters={scope} /></> :
          !visible.length ? <EmptyState title="No hay grupos en esta sede." /> :
            <ReportRead query={JSON.stringify(scope)} load={() => getAttendanceReport(scope)}>{r => {
              const rates = new Map(r.byGroup.map(row => [row.groupId, row.rate]))
              return <Table caption="Grupos de la sede" headers={['Grupo', 'Área', 'Docente', 'Estudiantes', 'Tasa de asistencia']} rows={visible.map(g => ({
                key: g.id, cells: [<Button key="open" variant="ghost" onClick={() => setGroup(g.id)}>{g.name}</Button>, subjectLabel(g.subject), g.teacherName, number(g.studentIds.length), percent(rates.get(g.id))],
              }))} />
            }}</ReportRead>}
      </>}
  </LiveState>
}

export function Institutions({ filters }: { filters: ReportFilters }) {
  const { schools, loading, error } = useSchools()
  const [selected, setSchool] = useState(filters.schoolId ?? '')
  const visible = schools.filter(s => matchesSchool(s, filters))
  const school = visible.find(s => s.id === selected)
  return <><h2>Instituciones</h2><Card><LiveState loading={loading} error={error}>
    {school ? <>{!filters.schoolId && <Button onClick={() => setSchool('')}>Volver a instituciones</Button>}
      <SchoolDetail key={school.id} school={school} filters={filters} /></> :
      visible.length ? <Table caption="Instituciones en la selección" headers={['Institución', 'Municipio', 'Departamento', 'Sedes']}
        rows={visible.map(s => ({ key: s.id, cells: [<Button key="open" variant="ghost" onClick={() => setSchool(s.id)}>{s.name}</Button>, s.municipality, s.department, number(s.campuses.length)] }))} />
        : <EmptyState title="No hay instituciones en esta selección." />}
  </LiveState></Card></>
}
