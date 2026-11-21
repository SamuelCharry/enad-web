import * as XLSX from 'xlsx'
import { workbookBlob } from '../export/workbook'
import { importColumns, type ImportKind } from './schema'
/** Creates a downloadable Plantilla workbook for the selected import. */
export function buildImportTemplate(kind: ImportKind): Blob {
  const labels = importColumns[kind].map(c => c.label)
  const sheet = XLSX.utils.aoa_to_sheet([labels]), book = XLSX.utils.book_new()
  sheet['!cols'] = labels.map(label => ({ wch: Math.min(40, Math.max(18, label.length + 6)) }))
  XLSX.utils.book_append_sheet(book, sheet, 'Plantilla')
  return workbookBlob(book, [[1]])
}
