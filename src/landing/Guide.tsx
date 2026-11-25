import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Field, Segmented, Select } from '../ui/components'
import { Icon } from '../ui/Icon'
import { PublicHeader } from './PublicHeader'
import { guideRoleFromParam, guideRoles, stepsByRole, type GuideRole } from './guideContent'
import './landing.css'
import './guide.css'

function Walkthrough({ role }: { role: GuideRole }) {
  const steps = stepsByRole[role]
  const [index, setIndex] = useState(0)
  const step = steps[index]
  const heading = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [index])

  function selectStep(next: number) {
    moved.current = true
    setIndex(next)
  }

  return <div className="guide-reader">
    <nav className="guide-contents" aria-label="Pasos de la guía">
      <h2>En esta guía</h2>
      <ol>{steps.map((item, i) => <li key={item.title}>
        <button type="button" onClick={() => selectStep(i)} aria-current={index === i ? 'step' : undefined}>
          <span aria-hidden="true">{i + 1}</span>{item.title}
        </button>
      </li>)}</ol>
    </nav>
    <div className="guide-picker">
      <Field label="Ir al paso"><Select value={index} onChange={event => selectStep(Number(event.target.value))}>
        {steps.map((item, i) => <option key={item.title} value={i}>{i + 1}. {item.title}</option>)}
      </Select></Field>
    </div>
    <article className="guide-step" aria-labelledby="step-title">
      <div className="guide-instructions">
        <p className="guide-progress">Paso {index + 1} de {steps.length}</p>
        <h2 id="step-title" ref={heading} tabIndex={-1}>{step.title}</h2>
        <ol>{step.actions.map(action => <li key={action}>{action}</li>)}</ol>
        <div className="guide-pager">
          {index > 0 && <Button onClick={() => selectStep(index - 1)}><Icon name="back" size={16} />Anterior</Button>}
          {index < steps.length - 1 && <Button onClick={() => selectStep(index + 1)}>Siguiente<Icon name="arrow" size={16} /></Button>}
        </div>
      </div>
      <figure className="app-sample guide-image">
        <img src={import.meta.env.BASE_URL + 'guia/' + role + '-' + step.image.file + '.webp'} width="414" height="900" alt={step.image.alt} />
        <figcaption>ENAd Móvil · {guideRoles.find(item => item.value === role)?.label}</figcaption>
      </figure>
    </article>
  </div>
}

export default function Guide() {
  const [params, setParams] = useSearchParams()
  const role = guideRoleFromParam(params.get('rol'))
  const title = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const previous = document.title
    document.title = 'Guía de uso · ENAd'
    window.scrollTo(0, 0)
    return () => { document.title = previous }
  }, [])
  return <div className="usage-guide">
    <a className="skip-link" href="#/guia" onClick={e => { e.preventDefault(); title.current?.focus() }}>Saltar al contenido</a>
    <PublicHeader guide />
    <main className="shell-width">
      <header className="guide-intro">
        <h1 tabIndex={-1} ref={title}>Guía de uso</h1>
        <p>Elige tu rol para seguir los pasos en ENAd Móvil.</p>
        <Segmented label="Guía por rol" options={guideRoles} value={role}
          onChange={next => setParams(next === 'docente' ? {} : { rol: next })} />
      </header>
      <Walkthrough key={role} role={role} />
      <section className="guide-reference" aria-labelledby="faq-title">
        <h2 id="faq-title">Preguntas frecuentes</h2>
        <div className="guide-questions">
          <details><summary>Olvidé mi contraseña</summary><p>Comunícate con quien administra ENAd en tu institución. Indica tu usuario o correo para que puedan ayudarte a recuperar el acceso.</p></details>
          {role === 'docente' && <>
            <details><summary>No veo mi grupo</summary><p>En Grupos, comprueba la institución, la sede y la materia. Para tomar asistencia, el grupo debe estar asignado a tu cuenta. Pide a coordinación que revise la asignación.</p></details>
            <details><summary>¿Cómo sé si se envió mi registro?</summary><p>Abre Mis datos y toca Pendientes. Allí aparecen los registros guardados en el celular que esperan conexión. Cuando recuperes la señal, puedes tocar Reintentar envío.</p></details>
          </>}
        </div>
      </section>
    </main>
    <footer className="guide-footer"><div className="shell-width">
      <Link className="back-link" to="/#guia"><Icon name="back" size={18} />Volver a la portada</Link>
      <span>Fundación Aprender a Quererte</span>
    </div></footer>
  </div>
}
