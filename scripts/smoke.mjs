import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:4173/')
base.hash = '/'
const { ENAD_USER: username, ENAD_PASS: password } = process.env
if (Boolean(username) !== Boolean(password)) {
  throw new Error('Para probar el ingreso, define ENAD_USER y ENAD_PASS juntos.')
}

if (username && !['localhost','127.0.0.1','[::1]'].includes(base.hostname)) {
  throw new Error('Prueba el ingreso en una vista previa local conectada a los emuladores.')
}

const shots = new URL('../shots/', import.meta.url)
await mkdir(shots, { recursive: true })
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  {
    await context.route('**/*', route =>
      (new URL(route.request().url()).origin === base.origin || (username && ['localhost','127.0.0.1','[::1]'].includes(new URL(route.request().url()).hostname)))
        ? route.continue()
        : route.abort(),
    )
  }

  const page = await context.newPage()
  page.setDefaultTimeout(10_000)
  async function capture(name, controls) {
    for (const width of [375, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
      for (const control of controls) {
        await control.waitFor({ state: 'visible' })
      }
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(name+' se desborda a '+width+' px.')
      await page.screenshot({
        path: fileURLToPath(new URL(`${name}-${width}.png`, shots)),
        animations: 'disabled',
        fullPage: true,
      })
    }
  }

  await page.goto(base.href)
  await capture('inicio', [page.getByRole('heading', { level: 1 }).first()])

  base.hash = '/login'
  await page.goto(base.href)
  const form = page.locator('form').filter({ has: page.locator('input[type="password"]') })
  const userField = form.locator('input[autocomplete="username"]')
  const passwordField = form.locator('input[type="password"]')
  const submit = form.locator('button[type="submit"], button:not([type]), input[type="submit"]')
  await capture('ingreso', [userField, passwordField, submit])

  if (username && password) {
    await userField.fill(username)
    await passwordField.fill(password)
    await submit.click()
    await page.waitForURL(url => ['#/portal/hoy','#/portal/inicio'].includes(url.hash))
    const teacher = new URL(page.url()).hash === '#/portal/hoy'
    const homeContent = teacher ? page.getByRole('navigation',{name:'Registro de clase'})
      : page.getByRole('group',{name:'Mapa interactivo de Colombia'})
    await capture('portal', teacher ? [homeContent] : [homeContent, page.getByRole('heading',{name:'Esta semana',exact:true})])
    for (const width of [375,768]) {
      await page.setViewportSize({width,height:812})
      const toggle = page.getByRole('button',{name:'Abrir menú'})
      await toggle.click()
      const drawer = page.getByRole('dialog',{name:'Menú de navegación'})
      await drawer.waitFor({state:'visible'})
      for (let i=0;i<16;i++) {
        await page.keyboard.press('Tab')
        if (!await drawer.evaluate(el => el.contains(document.activeElement))) throw new Error('El foco salió del menú.')
      }
      await page.keyboard.press('Escape')
      await toggle.waitFor({state:'visible'})
    }
    await page.setViewportSize({width:1440,height:900})
    await page.getByRole('button',{name:'Contraer barra lateral'}).click()
    await page.getByRole('button',{name:'Ampliar barra lateral'}).click()
    const primary = page.getByRole('navigation',{name:'Menú principal'})
    if (!teacher) await primary.getByRole('link',{name:'Colegios y personas'}).click()
    const directory = teacher ? primary : page.getByRole('navigation',{name:'Colegios y personas'})
    await directory.getByRole('link',{name:'Grupos',exact:true}).click()
    await page.getByRole('heading',{name:'Grupos',level:1}).waitFor()
    if (!teacher) {
      await primary.getByRole('link',{name:'Reportes y alertas'}).click()
      await capture('informes',[page.locator('.rep-metrics'),page.getByRole('button',{name:'Descargar informe filtrado en Excel'})])
      await page.setViewportSize({width:1440,height:900})
      await primary.getByRole('link',{name:'Actividades de clase'}).click()
      await capture('actividades',[page.locator('.activity-row').first().or(page.getByText('Todavía no hay actividades disponibles.'))])
    }
  }

  console.log('Prueba completada. Las capturas están en shots/.')
} finally {
  await browser.close()
}
