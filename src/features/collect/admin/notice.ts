export function savedNotice(result: { syncState?: string }) {
  return result.syncState === 'pending' ? 'Guardado en este dispositivo · Pendiente de envío' : 'Cambios guardados.'
}
