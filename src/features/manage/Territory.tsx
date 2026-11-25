import { useState } from 'react'
import { Link } from 'react-router-dom'
import { collection } from 'firebase/firestore'
import { db } from '../../data/firebase'
import { rows } from '../../data/reads'
import { useStudents } from '../../data/students'
import { useGroups } from '../../data/groups'
import { subjectLabel } from '../../domain/levels'
import type { School } from '../../domain/types'
import { reportLink } from '../reports/navigation'
import { LiveState, ReportRead } from '../reports/ReportState'
import departments from './colombia-departments.json'
import { departmentId, unknown } from './territoryGeography'
import './territory.css'

const regionName = (id: string) => departments.find(d => d.id === id)?.name ?? 'Sin departamento identificado'
const scale = ['#d8d9d3', '#f9aea8', '#f27169', '#db302f', '#971e29']
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)
type Mode = 'presence' | 'schools' | 'campuses'
type Community = 'Docentes' | 'Estudiantes' | 'Grupos'
function Students({schoolId}: {schoolId: string}) {
  const { students, ...state } = useStudents(schoolId)
  return <LiveState {...state}>{students.length ? <ul>{students.map(s => <li key={s.id}><Link to={'/portal/reportes/estudiante?' + new URLSearchParams({schoolId, student:s.id})}>{s.fullName}</Link><small>{s.retired ? 'Retirado' : s.grade ? 'Grado ' + s.grade : 'Grado sin registrar'}</small></li>)}</ul> : <p>Sin estudiantes registrados.</p>}</LiveState>
}
function Groups({school}: {school: School}) {
  const { groups, ...state } = useGroups(school.id)
  return <LiveState {...state}>{groups.length ? <ul>{groups.map(g => <li key={g.id}><Link to={reportLink('instituciones', {schoolId:school.id, campus:school.campuses.find(c => c.name === g.campus)?.id ?? g.campus ?? ''}, {group:g.id})}>{g.name}</Link><small>{subjectLabel(g.subject)} · {plural(g.studentIds.length,'estudiante','estudiantes')}</small></li>)}</ul> : <p>Sin grupos registrados.</p>}</LiveState>
}
function SchoolDetails({ school }: { school: School }) {
  const [tab, setTab] = useState<Community>('Docentes')
  return <><h3>{school.name}</h3><p className="territory-note">{[school.municipality, plural(school.campuses.length,'sede','sedes')].filter(Boolean).join(' · ')}</p>
    <div className="territory-tabs" role="group" aria-label="Comunidad del colegio">{(['Docentes','Estudiantes','Grupos'] as const).map(item => <button key={item} aria-pressed={item === tab} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="territory-members">{tab === 'Estudiantes' ? <Students schoolId={school.id}/> : tab === 'Grupos' ? <Groups school={school}/> :
      <ReportRead query={school.id} load={() => rows<{fullName:string; uid:string}>(collection(db,'schools',school.id,'teachers'))}>{teachers => teachers.length ? <ul>{[...teachers].sort((a,b) => a.fullName.localeCompare(b.fullName,'es')).map(t => <li key={t.id}><Link to={'/portal/reportes/docentes?' + new URLSearchParams({schoolId:school.id,teacher:t.uid || t.id})}>{t.fullName}</Link></li>)}</ul> : <p>Sin docentes registrados.</p>}</ReportRead>}</div></>
}

export function Territory({schools}: {schools: School[]}) {
  const [mode, setMode] = useState<Mode>('presence')
  const [selected, setSelected] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [hover, setHover] = useState('')
  const byRegion = new Map<string, School[]>()
  for (const school of schools) {
    const id = departmentId(school.department)
    if (!byRegion.has(id)) byRegion.set(id, [])
    byRegion.get(id)!.push(school)
  }
  const count = (id: string) => {
    const local = byRegion.get(id) ?? []
    return mode === 'campuses' ? local.reduce((n,s) => n+s.campuses.length,0) : local.length
  }
  const ranked = [...byRegion.keys()].sort((a,b) => count(b)-count(a) || regionName(a).localeCompare(regionName(b),'es'))
  const max = Math.max(1,...departments.map(d => count(d.id)))
  const color = (id: string) => count(id) === 0 ? scale[0] : mode === 'presence' ? scale[3] : scale[Math.ceil(4*count(id)/max)]
  const local = byRegion.get(selected) ?? []
  const school = local.find(s => s.id === schoolId)
  const select = (id: string) => {setSelected(id);setSchoolId('')}
  const unit = (n:number) => mode === 'campuses' ? plural(n,'sede','sedes') : plural(n,'colegio','colegios')
  const mappedRegions = ranked.filter(id => id !== unknown).length
  return <section className="territory" aria-labelledby="territory-title">
    <div className="territory-heading"><div><h2 id="territory-title">Cobertura territorial</h2><p>{plural(schools.length,'colegio','colegios')} · {plural(mappedRegions,'departamento con presencia','departamentos con presencia')}</p></div>
      <label>Ver en el mapa<select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="presence">Presencia del programa</option><option value="schools">Número de colegios</option><option value="campuses">Número de sedes</option></select></label></div>
    <div className="territory-atlas"><div className="territory-chart">
      <svg viewBox="0 0 490 488" role="group" aria-label="Mapa interactivo de Colombia">
        <rect className="island-frame" x="12" y="11" width="92" height="110" rx="4"/><text className="inset-label" x="21" y="111">San Andrés y Prov.</text>
        <g className="map-labels" aria-hidden="true"><text x="155" y="45">Mar Caribe</text><text x="25" y="262">Océano Pacífico</text><text x="366" y="127">Venezuela</text><text x="80" y="376">Ecuador</text><text x="227" y="433">Perú</text><text x="392" y="387">Brasil</text></g>
        {departments.map(d => <path key={d.id} d={d.path} fill={color(d.id)} fillRule="evenodd" role="button" tabIndex={0} aria-pressed={d.id===selected} aria-label={d.name + ', ' + unit(count(d.id))}
          onClick={() => select(d.id)} onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover('')} onFocus={() => setHover(d.id)} onBlur={() => setHover('')}
          onKeyDown={e => {if(e.key==='Enter' || e.key===' '){e.preventDefault();select(d.id)}}}><title>{d.name} · {unit(count(d.id))}</title></path>)}
        {selected && <path className="map-selection" d={departments.find(d => d.id===selected)?.path}/>}
      </svg>
      {hover && <span className="map-hint">{regionName(hover)} · {unit(count(hover))}</span>}
      <div className="territory-legend">{mode==='presence' ? <><span><i style={{background:scale[3]}}/>Con colegios</span><span><i style={{background:scale[0]}}/>Sin colegios</span></> :
        <><span><i style={{background:scale[0]}}/>0</span>{scale.slice(1).map((c,i) => {
          const lo=Math.floor(i*max/4)+1, hi=Math.floor((i+1)*max/4)
          return hi>=lo && <span key={c}><i style={{background:c}}/>{lo===hi ? hi : lo+'–'+hi}</span>
        })}<span>{mode==='schools'?'colegios':'sedes'}</span></>}</div>
    </div><aside className="territory-directory" aria-label="Explorar comunidad por departamento">
      {selected && <button className="territory-back" onClick={() => school ? setSchoolId('') : select('')}>‹ {school ? regionName(selected) : 'Departamentos'}</button>}
      {school ? <SchoolDetails key={school.id} school={school}/> : selected ? <><h3>{regionName(selected)}</h3><p className="territory-note">{plural(local.length,'colegio','colegios')}</p>
        {local.length ? <ul>{local.map(s => <li key={s.id}><button className="territory-row" onClick={() => setSchoolId(s.id)}><span>{s.name}<small>{s.municipality}</small></span><b aria-hidden="true">›</b></button></li>)}</ul> : <p>Sin colegios registrados en este departamento.</p>}</> :
      <><h3>Departamentos</h3><p className="territory-note">Selecciona un departamento para ver sus colegios.</p>
        <ul>{ranked.map(id => <li key={id}><button className="territory-row" onClick={() => select(id)}><span>{regionName(id)}</span><span className="territory-count">{unit(count(id))}<b aria-hidden="true">›</b></span></button></li>)}</ul></>}
    </aside></div>
    <small className="territory-credit">Límites departamentales de <a href="https://www.geoboundaries.org/api/current/gbOpen/COL/ADM1/">geoBoundaries</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap y colaboradores (ODbL)</a>. Archipiélago en recuadro ampliado. <a href={import.meta.env.BASE_URL + 'colombia-boundaries.txt'}>Fuente y licencia</a>.</small>
  </section>
}
