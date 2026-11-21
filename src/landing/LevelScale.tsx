import { useState, type CSSProperties } from 'react'
import type { Subject } from '../domain/types'
import { Segmented } from '../ui/components'
import { levelScale } from '../ui/levels'

const subjects = [{ value: 'lectura', label: 'Lectura' }, { value: 'matematicas', label: 'Matemáticas' }] as const

export function LevelScale() {
  const [subject, setSubject] = useState<Subject>('lectura')
  return <figure className="level-exhibit" aria-labelledby="scale-caption">
    <figcaption id="scale-caption">Escala de aprendizaje</figcaption>
    <ol className="book-stack" key={subject} aria-label={'Niveles de ' + (subject === 'lectura' ? 'lectura' : 'matemáticas')}>
      {levelScale[subject].map(([key, label], i) => <li key={key} data-level={i + 1} style={{ '--i': i } as CSSProperties}>
        <span className="book-index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
        <span className="book-title">{label}</span><span className="book-binding" aria-hidden="true" />
      </li>)}
    </ol>
    <Segmented label="Área de la escala de aprendizaje" value={subject} options={subjects} onChange={setSubject} />
  </figure>
}
