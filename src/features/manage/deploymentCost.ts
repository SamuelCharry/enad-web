export const scenarios = [20, 100, 500] as const

export const assumptions = [
  { key: 'days', label: 'Días de clase al mes', initial: 20, max: 31 },
  { key: 'reads', label: 'Lecturas por docente al día', initial: 200, max: 1000000 },
  { key: 'writes', label: 'Escrituras por docente al día', initial: 60, max: 1000000 },
  { key: 'photos', label: 'Fotos por docente al día', initial: 1, max: 1000 },
] as const

export type Usage = Record<typeof assumptions[number]['key'], number>

export function monthlyCost(teachers: number, usage: Usage) {
  const { days, reads, writes, photos } = usage
  const billedReads = Math.max(0, teachers * reads - 50000) * days
  const billedWrites = Math.max(0, teachers * writes - 20000) * days
  const firestore = (billedReads * 0.045 + billedWrites * 0.135) / 100000
  const images = teachers * days * photos
  const vision = (Math.max(0, Math.min(images, 5000000) - 1000) * 1.5
    + Math.max(0, images - 5000000) * 0.6) / 1000
  return { firestore, vision, subtotal: firestore + vision }
}

export const deploymentModes = [
  { id: 'mobile', label: 'Solo app', mobile: true, web: false },
  { id: 'web', label: 'Solo web', mobile: false, web: true },
  { id: 'both', label: 'App y web', mobile: true, web: true },
] as const

export type DeploymentMode = typeof deploymentModes[number]

export function deploymentBudget(teachers: number, usage: Usage, mode: DeploymentMode) {
  const { firestore, vision } = monthlyCost(teachers, usage)
  const photos = mode.mobile ? vision : 0
  const monthly = firestore + photos
  const annual = mode.mobile ? 99 : 0
  const registration = mode.mobile ? 25 : 0
  return { firestore, photos, monthly, annual, registration, firstYear: monthly * 12 + annual + registration }
}
