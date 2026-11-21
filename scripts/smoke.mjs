import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const base = new URL(process.argv[2] ?? 'http://localhost:4173/')
base.hash = '/'
const { ENAD_USER: username, ENAD_PASS: password } = process.env
if (Boolean(username) !== Boolean(password)) {
  throw new Error('Para probar el ingreso, define ENAD_USER y ENAD_PASS juntos.')
}

const shots = new URL('../shots/', import.meta.url)
await mkdir(shots, { recursive: true })
const browser = await chromium.launch()
try {
  const context = await browser.newContext({ serviceWorkers: 'block' })
  if (!username) {
    await context.route('**/*', route =>
      new URL(route.request().url()).origin === base.origin
        ? route.continue()
        : route.abort(),
    )
  }

  const page = await context.newPage()
  page.setDefaultTimeout(10_000)
  async function capture(name, controls) {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
      for (const control of controls) {
        await control.waitFor({ state: 'visible' })
      }
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
    await page.waitForURL(url => url.hash === '#/portal')
    const entries = ['Recolección de datos', 'Visualización de datos'].map(name =>
      page.getByRole('link', { name }).or(page.getByRole('button', { name })),
    )
    await capture('portal', entries)
  }

  console.log('Prueba completada. Las capturas están en shots/.')
} finally {
  await browser.close()
}
