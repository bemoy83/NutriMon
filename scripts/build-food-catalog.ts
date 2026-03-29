import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeFoodCatalogRows, type SpreadsheetFoodRow } from '../src/lib/foodCatalog.ts'

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function readZipEntry(archivePath: string, entryPath: string): string {
  return execFileSync('unzip', ['-p', archivePath, entryPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

function columnToIndex(column: string): number {
  let result = 0
  for (const char of column) {
    result = result * 26 + (char.charCodeAt(0) - 64)
  }
  return result - 1
}

function getCellValue(cellXml: string, cellType: string | undefined, sharedStrings: string[]): string {
  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/)
  const inlineMatch = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/)
  const rawValue = valueMatch?.[1] ?? inlineMatch?.[1] ?? ''

  if (cellType === 's') {
    return sharedStrings[Number(rawValue)] ?? ''
  }

  return decodeXml(rawValue)
}

function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g)).map((match) => {
    const itemXml = match[0]
    return Array.from(itemXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXml(textMatch[1]))
      .join('')
  })
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  return Array.from(xml.matchAll(/<row\b[\s\S]*?<\/row>/g)).map((rowMatch) => {
    const rowXml = rowMatch[0]
    const values: string[] = []

    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1]
      const cellXml = cellMatch[2]
      const refMatch = attributes.match(/\br="([A-Z]+)\d+"/)
      if (!refMatch) continue
      const typeMatch = attributes.match(/\bt="([^"]+)"/)
      const columnIndex = columnToIndex(refMatch[1])
      values[columnIndex] = getCellValue(cellXml, typeMatch?.[1], sharedStrings)
    }

    return values
  })
}

function parseWorkbookSheets(workbookXml: string, relsXml: string): Record<string, string> {
  const relMap = new Map<string, string>()
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap.set(match[1], match[2])
  }

  const result: Record<string, string> = {}
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const sheetName = decodeXml(match[1])
    const relId = match[2]
    const target = relMap.get(relId)
    if (!target) continue
    result[sheetName] = target.startsWith('xl/') ? target : `xl/${target}`
  }

  return result
}

function rowsToSpreadsheetFoods(rows: string[][]): SpreadsheetFoodRow[] {
  const headers = rows[0] ?? []
  const headerIndex = new Map(headers.map((header, index) => [header, index]))

  function getValue(row: string[], header: string): string {
    const index = headerIndex.get(header)
    return index === undefined ? '' : (row[index] ?? '')
  }

  return rows.slice(1).map((row) => ({
    sourceItemId: getValue(row, 'Matvare ID'),
    name: getValue(row, 'Matvare'),
    ediblePortionPercent: getValue(row, 'Spiselig del (%)'),
    calories: getValue(row, 'Kilokalorier (kcal)'),
    fatG: getValue(row, 'Fett (g)'),
    carbsG: getValue(row, 'Karbohydrat (g)'),
    proteinG: getValue(row, 'Protein (g)'),
  }))
}

function main() {
  const inputPath = process.argv[2] ?? path.join(os.homedir(), 'Downloads', 'alle-matvarer.xlsx')
  const outputPath = process.argv[3] ?? path.join(process.cwd(), 'data', 'food_catalog_items.matvaretabellen_2026.json')

  const sharedStringsXml = readZipEntry(inputPath, 'xl/sharedStrings.xml')
  const workbookXml = readZipEntry(inputPath, 'xl/workbook.xml')
  const relsXml = readZipEntry(inputPath, 'xl/_rels/workbook.xml.rels')
  const sharedStrings = parseSharedStrings(sharedStringsXml)
  const sheets = parseWorkbookSheets(workbookXml, relsXml)
  const matvarerPath = sheets.Matvarer

  if (!matvarerPath) {
    throw new Error('Could not find "Matvarer" sheet in workbook')
  }

  const matvarerXml = readZipEntry(inputPath, matvarerPath)
  const rows = parseSheetRows(matvarerXml, sharedStrings)
  const normalized = normalizeFoodCatalogRows(rowsToSpreadsheetFoods(rows))

  mkdirSync(path.dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(normalized, null, 2)}\n`)

  console.log(`Wrote ${normalized.length} catalog items to ${outputPath}`)
}

main()
