import { useState, type ReactNode } from 'react'
import { assumptions, monthlyCost, scenarios, type Usage } from './deploymentCost'
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

function Calculator() {
  const [fields, setFields] = useState(() => Object.fromEntries(assumptions.map(a => [a.key, String(a.initial)])))
  const usage = {} as Usage
  for (const { key } of assumptions) usage[key] = Number(fields[key])
  const validField = (key: keyof Usage, max: number) => fields[key].trim() !== '' && Number.isInteger(usage[key]) && usage[key] >= 0 && usage[key] <= max
  const valid = assumptions.every(a => validField(a.key, a.max))
  const results = scenarios.map(count => monthlyCost(count, usage))
  return <section className="deployment-calc" aria-labelledby="cost-title">
    <div className="deployment-calc-head"><h2 id="cost-title">Calcula un mes de clases</h2>
      <p>Compara el costo mensual de la base de datos y la lectura de fotos para 20, 100 y 500 docentes.</p></div>
    <details className="deployment-settings"><summary>Ajustar días de clase, registros y fotos</summary>
    <p>Indica la actividad de un docente. Consultar un registro cuenta como una lectura. Crearlo o modificarlo cuenta como una escritura.</p>
    <div className="deployment-fields">{assumptions.map(({ key, label, max }) => <label key={key}>{label}
      <input type="number" min="0" max={max} step="1" value={fields[key]} aria-invalid={!validField(key, max)}
        onChange={e => setFields({ ...fields, [key]: e.target.value })} />
      {!validField(key, max) && <small>Ingresa un entero entre 0 y {max.toLocaleString('es-CO')}.</small>}
    </label>)}</div></details>
    <table><caption>Costos mensuales en USD por número de docentes</caption><thead><tr><th scope="col">Servicio</th>{scenarios.map(n => <th scope="col" key={n}>{n} <span>docentes</span></th>)}</tr></thead>
      <tbody>{([['firestore', 'Base de datos'], ['vision', 'Lectura de fotos'], ['subtotal', 'Subtotal mensual']] as const).map(([key, label]) =>
        <tr key={key}><th scope="row">{label}</th>{results.map((r, i) => <td key={scenarios[i]}>{valid ? dollars.format(r[key]) : '—'}</td>)}</tr>)}</tbody></table>
    <p>El subtotal cubre lecturas, escrituras y reconocimiento de texto móvil. Presupuesta aparte las funciones de servidor y su compilación, el almacenamiento, la transferencia de datos, las copias, los impuestos y el soporte.</p>
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
      <Calculator />
      <Section title="Dónde alojar ENAd">
        <h3>Firebase para los datos y las cuentas</h3><p>Recomendamos conservar Firebase. El móvil y el portal ya comparten cuentas, reglas de acceso y registros en Firestore. Los docentes pueden guardar sin señal y sincronizar al volver a conectarse. La demostración usa Spark y el registro manual. No tiene Blaze, funciones desplegadas ni reconocimiento de fotos de pago. <a href={prices.firebase}>Planes de Firebase</a></p>
        <h3>GitHub Pages para la demostración</h3><p>El sitio estático se publica desde el repositorio. Pages está incluido en GitHub Free para repositorios públicos. Para el portal de producción recomendamos Firebase Hosting, que admite dominio propio y HTTPS. Incluye 10 GB almacenados y 360 MB de transferencia al día. En Blaze, el excedente cuesta USD 0,026 por GB almacenado al mes y USD 0,15 por GB transferido. <a href={prices.github}>Límites de Pages</a> · <a href={prices.firebase}>Tarifas de Hosting</a></p>
        <h3>Cuándo considerar Railway</h3><p>Railway permite alojar un servidor propio. Hobby tiene un mínimo de USD 5 al mes, imputables al consumo de CPU, memoria, disco y tráfico. Si consumes USD 7, pagas USD 7. Para un equipo, Pro parte de USD 20. Sustituir Firebase exigiría implementar y mantener la autorización por rol, la sincronización y el almacenamiento. Conviene cotizar esa migración si la fundación necesita una API propia. <a href={prices.railway}>Planes y consumo de Railway</a></p>
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
