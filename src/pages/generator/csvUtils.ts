import { COIN_IDS } from '../../config/coins'
import type { BulkRowInput, BulkRowResult, RowValidation } from './types'

export const CSV_TEMPLATE_HEADERS = ['ID User', 'Amount', 'Asset', 'Note']

/** First-column values we treat as "this is a header row", not data (case-insensitive). */
const HEADER_ALIASES = new Set(['id user', 'iduser', 'user id', 'recipient'])

const VALID_ASSETS = new Set(COIN_IDS.map((id) => id.toUpperCase()))

/**
 * Split a single pasted line into columns.
 * Native Excel / Google Sheets pastes are TAB-separated, so TAB always wins
 * when present. Otherwise falls back to a quote-aware comma split, which
 * handles both plain "a,b,c" typing and quoted CSV exports (e.g. a note
 * containing a comma, wrapped in double quotes).
 */
function splitColumns(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((cell) => cell.trim())
  }
  return splitCsvLine(line).map((cell) => cell.trim())
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current)
  return cells
}

/**
 * Parse raw pasted/typed text into row objects.
 * - Rows are split on newlines (\n), tolerating trailing \r (Windows pastes).
 * - Columns are split on TAB (preferred, native spreadsheet paste) or comma.
 * - Blank lines are ignored.
 * - A leading header row ("ID User,Amount,Asset,Note" or similar) is
 *   detected and skipped automatically, so pasting the downloaded template
 *   with its header intact still works.
 */
export function parseBulkInput(raw: string): BulkRowInput[] {
  const lines = raw
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) return []

  const firstCols = splitColumns(lines[0])
  const looksLikeHeader = HEADER_ALIASES.has((firstCols[0] ?? '').trim().toLowerCase())
  const dataLines = looksLikeHeader ? lines.slice(1) : lines

  return dataLines.map((line, index) => {
    const cols = splitColumns(line)
    return {
      id: `row-${index}`,
      idUser: (cols[0] ?? '').trim(),
      amount: (cols[1] ?? '').trim(),
      asset: (cols[2] ?? '').trim(),
      note: (cols[3] ?? '').trim(),
    }
  })
}

/** Validate a single row against the 4-column billing schema. */
export function validateRow(row: BulkRowInput): RowValidation {
  const errors: string[] = []

  if (!row.idUser.trim()) {
    errors.push('⚠️ ID User is required')
  }

  const amountValue = Number(row.amount)
  if (!row.amount.trim() || Number.isNaN(amountValue)) {
    errors.push('⚠️ Amount is required and must be a number')
  } else if (amountValue <= 0) {
    errors.push('⚠️ Amount must be greater than 0')
  }

  if (!row.asset.trim()) {
    errors.push('⚠️ Asset is required')
  } else if (!VALID_ASSETS.has(row.asset.trim().toUpperCase())) {
    errors.push(`⚠️ Invalid Asset name (use ${COIN_IDS.join(', ')})`)
  }

  return { valid: errors.length === 0, errors }
}

/** Build the shareable payment link for one row, matching the Express Request URL schema. */
export function generatePaymentLink(row: BulkRowInput): string {
  const params = new URLSearchParams({
    to: row.idUser.trim(),
    amount: row.amount.trim(),
    coin: row.asset.trim().toUpperCase(),
  })
  if (row.note.trim()) {
    params.set('note', row.note.trim())
  }
  return `${window.location.origin}/pay?${params.toString()}`
}

function escapeCsvField(field: string): string {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

function triggerCsvDownload(content: string, filename: string) {
  // Leading BOM so Excel opens UTF-8 (e.g. accented / Indonesian) text correctly.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Trigger a download of a blank CSV template with the required 4 headers. */
export function downloadCsvTemplate() {
  const content = CSV_TEMPLATE_HEADERS.join(',') + '\n'
  triggerCsvDownload(content, 'unicity-pay-link-template.csv')
}

/** Trigger a download of the original rows plus a new "Link Pembayaran" column. */
export function downloadResultCsv(rows: BulkRowResult[]) {
  const headers = [...CSV_TEMPLATE_HEADERS, 'Link Pembayaran']
  const lines = [headers.join(',')]
  for (const row of rows) {
    const fields = [row.idUser, row.amount, row.asset, row.note, row.paymentLink ?? ''].map(escapeCsvField)
    lines.push(fields.join(','))
  }
  triggerCsvDownload(lines.join('\n'), `unicity-pay-links-${Date.now()}.csv`)
}
