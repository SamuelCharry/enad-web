import * as XLSX from 'xlsx'

/** Writes bold header rows using the ZIP support bundled with SheetJS Community Edition. */
export function workbookBlob(book: XLSX.WorkBook, headingRows: number[][]): Blob {
  const bytes = new Uint8Array(XLSX.write(book, { bookType: 'xlsx', type: 'array' }))
  const zip = XLSX.CFB.read(bytes, { type: 'buffer' })
  function update(path: string, transform: (xml: string) => string) {
    const file = XLSX.CFB.find(zip, path)
    const xml = new TextDecoder().decode(file.content)
    XLSX.CFB.utils.cfb_add(zip, path, new TextEncoder().encode(transform(xml)))
  }
  let style = 0
  update('/xl/styles.xml', xml => {
    let font = 0
    return xml.replace(/<fonts count="(\d+)">/, (_, count: string) => {
      font = Number(count)
      return '<fonts count="' + (font + 1) + '">'
    }).replace('</fonts>', '<font><b/><sz val="12"/><name val="Calibri"/></font></fonts>')
      .replace(/<cellXfs count="(\d+)">/, (_, count: string) => {
        style = Number(count)
        return '<cellXfs count="' + (style + 1) + '">'
      }).replace('</cellXfs>', '<xf numFmtId="0" fontId="' + font + '" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>')
  })
  headingRows.forEach((numbers, i) => {
    const header = new Set(numbers)
    update('/xl/worksheets/sheet' + (i + 1) + '.xml', xml => xml.replace(/<c r="([A-Z]+)(\d+)"([^>]*)>/g, (tag, col: string, row: string, attrs: string) =>
      header.has(Number(row)) ? '<c r="' + col + row + '" s="' + style + '"' + attrs.replace(/ s="\d+"/, '') + '>' : tag))
  })
  const output = new Uint8Array(XLSX.CFB.write(zip, { type: 'buffer', fileType: 'zip', compression: true }))
  return new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
