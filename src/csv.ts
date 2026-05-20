export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      field += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some((cell) => cell.trim() !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  row.push(field)
  if (row.some((cell) => cell.trim() !== '')) rows.push(row)
  if (rows.length === 0) return []

  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((cells) => {
    const output: Record<string, string> = {}
    headers.forEach((header, index) => {
      output[header] = (cells[index] ?? '').trim()
    })
    return output
  })
}

export function readColumn(row: Record<string, string>, names: string[]): string {
  const lowerMap = new Map(
    Object.entries(row).map(([key, value]) => [key.toLocaleLowerCase(), value]),
  )
  for (const name of names) {
    const value = row[name] ?? lowerMap.get(name.toLocaleLowerCase())
    if (value?.trim()) return value.trim()
  }
  return ''
}

export function parseList(value?: string): string[] {
  return (value ?? '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function stableId(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseNumber(value?: string): number | undefined {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
