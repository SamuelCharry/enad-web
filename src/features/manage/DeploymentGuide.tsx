import { useState, type ReactNode } from 'react'
import { assumptions, deploymentBudget, deploymentModes, scenarios, type DeploymentMode, type Usage } from './deploymentCost'
import './deployment.css'

const prices = {
  firestore: 'https://cloud.google.com/firestore/pricing',
  vision: 'https://cloud.google.com/vision/pricing',
  firebase: 'https://firebase.google.com/pricing',
  railway: 'https://docs.railway.com/pricing/plans',
  github: 'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits',
  apple: 'https://developer.apple.com/programs/whats-included/',
  waiver: 'https://developer.apple.com/help/account/membership/fee-waivers/',
  play: 'https://support.google.com/googleplay/android-developer/answer/6112435',
}
const dollars = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="deployment-section"><h2>{title}</h2><div>{children}</div></section>
}

function ScopeMatrix() {
  const services = [
    { label: 'Guardar y consultar registros', cost: 'Firebase · según el uso', applies: () => true },
    { label: 'Leer listas desde una foto', cost: 'Vision · opcional, por imagen', applies: (mode: DeploymentMode) => mode.mobile },
    { label: 'Abrir el portal en un navegador', cost: 'Hosting · USD 0 dentro de la cuota', applies: (mode: DeploymentMode) => mode.web },
    { label: 'Distribuir en iPhone', cost: 'App Store · USD 99 al año', applies: (mode: DeploymentMode) => mode.mobile },
    { label: 'Distribuir en Android', cost: 'Google Play · USD 25 una vez', applies: (mode: DeploymentMode) => mode.mobile },
  ]
  return <section className="deployment-scope">
    <h2>Qué necesita cada modalidad</h2>
    <p>La app y el portal guardan los registros en una misma base de datos. Publicar el portal requiere alojamiento web. Distribuir la app requiere una cuenta por tienda.</p>
    <table><caption>✓ Aplica · ✕ No aplica</caption><thead><tr><th scope="col">Servicio</th>
      {deploymentModes.map(mode => <th scope="col" key={mode.id}>{mode.label}</th>)}</tr></thead>
      <tbody>{services.map(service => <tr key={service.label}><th scope="row">{service.label}<small>{service.cost}</small></th>
        {deploymentModes.map(mode => <td key={mode.id}><span aria-hidden="true">{service.applies(mode) ? '✓' : '✕'}</span><span className="deployment-sr">{service.applies(mode) ? 'Aplica' : 'No aplica'}</span></td>)}</tr>)}</tbody>
    </table></section>
}

function Calculator() {
  const [fields, setFields] = useState(() => Object.fromEntries(assumptions.map(a => [a.key, String(a.initial)])))
  const usage = {} as Usage
  for (const { key } of assumptions) usage[key] = Number(fields[key])
  const validField = (key: keyof Usage, max: number) => fields[key].trim() !== '' && Number.isInteger(usage[key]) && usage[key] >= 0 && usage[key] <= max
  const valid = assumptions.every(a => validField(a.key, a.max))
  const [mode, setMode] = useState<DeploymentMode>(deploymentModes[0])
  const results = scenarios.map(count => deploymentBudget(count, usage, mode))
  return <section className="deployment-calc" aria-labelledby="cost-title">
    <div className="deployment-calc-head"><h2 id="cost-title">Calcula un mes de clases</h2>
      <p>Elige cómo usarán ENAd los colegios. Cada columna muestra el presupuesto para ese número de docentes en total.</p></div>
    <fieldset className="deployment-modes"><legend>Modalidad de despliegue</legend>
      {deploymentModes.map(option => <label key={option.id}><input type="radio" name="deployment-mode" checked={mode.id === option.id}
        onChange={() => setMode(option)} />{option.label}</label>)}</fieldset>
    <details className="deployment-settings"><summary>Ajustar días de clase, registros y fotos</summary>
    <p>Indica la actividad de un docente. Consultar un registro cuenta como una lectura. Crearlo o modificarlo cuenta como una escritura.</p>
    <div className="deployment-fields">{assumptions.map(({ key, label, max }) => <label key={key}>{label}
      <input type="number" min="0" max={max} step="1" value={fields[key]} aria-invalid={!validField(key, max)}
        onChange={e => setFields({ ...fields, [key]: e.target.value })} />
      {!validField(key, max) && <small>Ingresa un entero entre 0 y {max.toLocaleString('es-CO')}.</small>}
    </label>)}</div></details>
    <table className="deployment-budget"><caption>{mode.label} · Presupuesto en USD</caption><thead><tr><th scope="col">Concepto</th>{scenarios.map(n => <th scope="col" key={n}>{n} <span>docentes</span></th>)}</tr></thead>
      <tbody>{([
        ['firestore', 'Base de datos / mes'],
        ...(mode.mobile ? [['photos', 'Lectura de fotos / mes'] as const] : []),
        ...(mode.web ? [['hosting', 'Alojamiento web / mes'] as const] : []),
        ['monthly', 'Total mensual estimado'],
        ...(mode.mobile ? [['annual', 'App Store / año'] as const, ['registration', 'Google Play / pago único'] as const] : []),
        ['firstYear', 'Total estimado del primer año'],
      ] as const).map(([key, label]) =>
        <tr key={key}><th scope="row">{label}</th>{results.map((r, i) => <td key={scenarios[i]}>{key === 'hosting' ? dollars.format(0)
          : valid || key === 'annual' || key === 'registration' ? dollars.format(r[key]) : '—'}</td>)}</tr>)}</tbody></table>
    <p>El primer año suma 12 meses de la actividad indicada y las tarifas de las tiendas elegidas por la modalidad. Para la app suponemos publicación en iPhone y Android. El alojamiento web se estima dentro de la cuota gratuita.</p>
    <p><strong>Pendiente de cotizar.</strong> Los totales excluyen funciones de servidor y compilaciones, almacenamiento de datos y copias, excedentes de alojamiento y tráfico, impuestos y soporte.</p>
    <details><summary>Cómo calculamos el consumo</summary>
      <p>Suponemos días con la misma actividad, una base con la cuota gratuita disponible y cero actividad adicional. Cada día descontamos 50.000 lecturas y 20.000 escrituras del conjunto de docentes. En São Paulo, la tarifa estándar por 100.000 operaciones adicionales es de USD 0,045 para lecturas y USD 0,135 para escrituras. Incluye en el campo de lecturas las consultas adicionales de informes, índices y sincronizaciones que observes. <a href={prices.firestore}>Precios de Firestore</a></p>
      <p>Una foto equivale a una imagen con una operación de reconocimiento de texto. Las primeras 1.000 unidades del mes son gratuitas. Las siguientes cuestan USD 1,50 por mil hasta cinco millones y USD 0,60 por mil en adelante. Para simular el registro manual, escribe 0 fotos. <a href={prices.vision}>Precios de Cloud Vision</a></p>
    </details>
  </section>
}

export default function DeploymentGuide() {
  return <article className="deployment">
      <header className="deployment-intro"><h2>Guía de despliegue</h2>
        <p>Cómo pasar de la demostración de ENAd a un programa en colegios y cuánto presupuestar según el número de docentes.</p>
        <small>Tarifas en USD · Consultadas el 24 de noviembre de 2026</small></header>
      <ScopeMatrix />
      <Calculator />
      <Section title="Dónde alojar ENAd">
        <h3>Las cuentas y los datos viven en Firebase</h3><p>Firebase identifica a cada persona y controla qué registros puede ver. Firestore guarda la asistencia y las evaluaciones. La demostración usa el plan gratuito Spark y el registro manual. Leer fotos en producción requiere activar el plan Blaze en el proyecto institucional. <a href={prices.firebase}>Planes de Firebase</a></p>
        <h3>El sitio web necesita una dirección pública</h3><p>La demostración se publica gratis en GitHub Pages desde un repositorio público. Para producción, Firebase Hosting sirve el portal con HTTPS. Incluye 10 GB de almacenamiento y 360 MB de transferencia al día. En Blaze, el excedente cuesta USD 0,026 por GB almacenado al mes y USD 0,15 por GB transferido. <a href={prices.github}>GitHub Pages</a> · <a href={prices.firebase}>Precios de Hosting</a></p>
        <details><summary>¿Cuándo tendría sentido Railway?</summary><p>Railway aloja servidores propios. Sustituir Firebase requeriría desarrollar y mantener las cuentas, los permisos y la sincronización. Esa migración necesita un presupuesto independiente. <a href={prices.railway}>Planes de Railway</a></p></details>
      </Section>
      <Section title="Publicar la aplicación">
        <h3>iPhone · USD 99 al año</h3><p>La membresía de Apple permite distribuir ENAd en el App Store. Una fundación sin ánimo de lucro puede solicitar la exención si cumple los requisitos. Presupuesta la membresía hasta que Apple confirme la aprobación. <a href={prices.apple}>Apple Developer Program</a> · <a href={prices.waiver}>Solicitud de exención</a></p>
        <h3>Android · USD 25 por única vez</h3><p>La tarifa cubre el registro de la cuenta de desarrollador en Google Play. Registra la cuenta a nombre de la organización y completa la verificación antes de enviar la aplicación a revisión. <a href={prices.play}>Registro en Play Console</a></p>
      </Section>
      <Section title="Del piloto a producción"><ol>
        <li><strong>Preparar el entorno.</strong> Crea un proyecto institucional separado de la demostración. Configura las cuentas, las reglas y los índices. Prueba con datos ficticios el acceso de cada rol y el envío de una asistencia guardada sin señal.</li>
        <li><strong>Publicar el portal.</strong> Compila la web con la configuración del nuevo proyecto, publica en Hosting, autoriza el dominio de acceso y verifica el inicio de sesión en un teléfono y un computador.</li>
        <li><strong>Decidir sobre las fotos.</strong> Si se aprueba el presupuesto, vincula la facturación, habilita Vision y despliega la función que procesa las fotos del móvil. Comprueba el resultado con una lista ficticia antes de abrir el piloto.</li>
        <li><strong>Abrir el piloto.</strong> Firma y distribuye las versiones móviles de prueba. Pide a un grupo docente que registre una semana de clases y contrasta las operaciones reales con esta calculadora antes de ampliar la cobertura.</li>
      </ol></Section>
      <Section title="Mantener el servicio"><p>Asigna responsables de las cuentas, las tiendas y la facturación. Revisa mensualmente las alertas de gasto, los errores de sincronización y las cuotas. Las alertas avisan cuando se alcanza un umbral y el consumo puede continuar. Antes de cada actualización, verifica permisos y registros pendientes. Programa copias de seguridad y ensaya la restauración en un entorno separado.</p></Section>
    </article>
}
