export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

function escapeCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''

  const text = String(value)

  // Guard against spreadsheet formula injection on fields that start with an
  // operator: Excel and Sheets evaluate those on open.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text

  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const header = columns.map((column) => escapeCell(column.header)).join(',')
  const body = rows.map((row) =>
    columns.map((column) => escapeCell(column.value(row))).join(','),
  )

  return [header, ...body].join('\r\n')
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
) {
  // Excel needs the BOM to read UTF-8 correctly.
  const blob = new Blob([`\ufeff${toCsv(rows, columns)}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return { filename: link.download, rowCount: rows.length }
}

export function timestampedFilename(prefix: string) {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`
}
