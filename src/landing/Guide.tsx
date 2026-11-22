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
        {step.portal && <aside className="guide-portal-note" aria-label="En el portal">
          <h3>En el portal</h3><p>{step.portal}</p>
        </aside>}
        <div className="guide-pager">
          {index > 0 && <Button onClick={() => selectStep(index - 1)}><Icon name="back" size={16} />Anterior</Button>}
          {index < steps.length - 1 && <Button onClick={() => selectStep(index + 1)}>Siguiente<Icon name="arrow" size={16} /></Button>}
        </div>
      </div>
      {step.image && <figure className="app-sample guide-image">
        <img src={import.meta.env.BASE_URL + 'guia/' + step.image.file + '.webp'} width="414" height="900" alt={step.image.alt} />
        <figcaption>ENAd Móvil · {guideRoles.find(item => item.value === role)?.label}</figcaption>
      </figure>}
    </article>
  </div>
}

function PhoneAccess() {
  return <section className="guide-reference" aria-labelledby="phone-title">
    <h2 id="phone-title">El portal en tu celular</h2>
    <div>
      <p>Puedes registrar tu clase desde el navegador con la misma cuenta de ENAd Móvil. Para abrir el portal desde la pantalla de inicio, guarda un acceso en tu celular.</p>
      <dl className="guide-devices">
        <div><dt>iPhone con Safari</dt><dd>Abre el portal, toca Compartir y elige Agregar a inicio. Confirma con Agregar.</dd></div>
        <div><dt>Android con Chrome</dt><dd>Abre el menú de Chrome. Si aparece Instalar app, tócala y confirma. Si ves Agregar a la pantalla principal, usa esa opción para crear el acceso.</dd></div>
      </dl>
    </div>
  </section>
}

function Questions() {
  return <section className="guide-reference" aria-labelledby="faq-title">
    <h2 id="faq-title">Preguntas frecuentes</h2>
    <div className="guide-questions">
      <details><summary>Olvidé mi contraseña</summary>
        <p>Comunícate con quien administra ENAd en tu institución. Indícale tu usuario o correo para que te ayude a recuperar el acceso.</p></details>
      <details><summary>No veo mi grupo</summary>
        <p>En Grupos, revisa la institución, la sede y la materia seleccionadas. En la app puedes tocar Actualizar grupos. Para tomar asistencia, el grupo debe estar asignado a tu cuenta. Si sigue sin aparecer, pídele a administración que revise la asignación.</p></details>
      <details><summary>¿Se pierde lo que registro sin señal?</summary>
        <p>Primero toca Guardar. Si ves Pendiente de envío, el registro quedó en ese dispositivo y se enviará cuando vuelva la conexión. Conserva los datos de la app o del navegador hasta ver Guardado. Si todavía dice Sin guardar o aparece un error, revisa el formulario y vuelve a guardar.</p></details>
    </div>
  </section>
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
        <p>Elige tu rol para seguir los pasos en ENAd Móvil y en el portal.</p>
        <Segmented label="Guía por rol" options={guideRoles} value={role}
          onChange={next => setParams(next === 'docente' ? {} : { rol: next })} />
      </header>
      <Walkthrough key={role} role={role} />
      {role === 'docente' && <PhoneAccess />}
      <Questions />
    </main>
    <footer className="guide-footer"><div className="shell-width">
      <Link className="back-link" to="/#guia"><Icon name="back" size={18} />Volver a la portada</Link>
      <span>Fundación Aprender a Quererte</span>
    </div></footer>
  </div>
}
