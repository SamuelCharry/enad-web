import type { Group } from '../../domain/types'

export function collectLink(section: string, fields: Record<string, string> = {}) {
  const search = new URLSearchParams(fields).toString()
  return '/recoleccion/' + section + (search ? '?' + search : '')
}

export function groupLink(section: string, group: Group, fields: Record<string, string> = {}) {
  return collectLink(section, { school: group.schoolId, campus: group.campus, group: group.id, subject: group.subject, ...fields })
}
