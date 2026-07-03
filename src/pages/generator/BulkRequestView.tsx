import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Copy, Download, FileSpreadsheet } from 'lucide-react'
import type { BulkRowResult } from './types'
import {
  downloadCsvTemplate,
  downloadResultCsv,
  generatePaymentLink,
  parseBulkInput,
  validateRow,
} from './csvUtils'
import { useQuestsContext } from '../../context/QuestsContext'

/** Bulk Master unlocks once a single generated batch reaches this many valid links. */
const BULK_MASTER_THRESHOLD = 10

interface BulkRequestViewProps {
  onBack: () => void
}

const PLACEHOLDER = 'mike.tyson\t150000\tUCT\tInvoice #1023\nmark.zuckerberg\t2.5\tUSDC\t\nelon.musk,75,SOL,Refund Juni'

export default function BulkRequestView({ onBack }: BulkRequestViewProps) {
  const [rawInput, setRawInput] = useState('')
  const [rows, setRows] = useState<BulkRowResult[] | null>(null)
  const [linksGenerated, setLinksGenerated] = useState(false)
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null)
  const { completeQuest, recordAssetUsed } = useQuestsContext()

  const validCount = useMemo(() => rows?.filter((r) => r.validation.valid).length ?? 0, [rows])
  const invalidCount = (rows?.length ?? 0) - validCount
  const canGenerate = !!rows && rows.length > 0 && invalidCount === 0

  const handleValidate = () => {
    const parsed = parseBulkInput(rawInput)
    const withValidation: BulkRowResult[] = parsed.map((row) => ({
      ...row,
      validation: validateRow(row),
    }))
    setRows(withValidation)
    setLinksGenerated(false)
    setCopiedRowId(null)
  }

  const handleGenerateAll = () => {
    if (!rows) return
    const withLinks = rows.map((row) => ({
      ...row,
      paymentLink: generatePaymentLink(row),
    }))
    setRows(withLinks)
    setLinksGenerated(true)

    const validRows = withLinks.filter((row) => row.validation.valid)
    if (validRows.length > 0) {
      completeQuest('bulk_starter')
    }
    if (validRows.length >= BULK_MASTER_THRESHOLD) {
      completeQuest('bulk_master')
    }
    for (const row of validRows) {
      recordAssetUsed(row.asset)
    }
  }

  const handleCopyRow = async (id: string, link: string) => {
    await navigator.clipboard.writeText(link)
    setCopiedRowId(id)
    setTimeout(() => setCopiedRowId((current) => (current === id ? null : current)), 2000)
    completeQuest('copy_cat')
  }

  const handleDownloadResult = () => {
    if (!rows) return
    downloadResultCsv(rows)
  }

  return (
    <>
      <div className="dashboard-topbar">
        <button type="button" className="btn-back" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Menu
        </button>
      </div>

      <div className="bulk-container">
        <h1 className="form-title" style={{ marginBottom: '0.4rem' }}>
          Bulk Request
        </h1>
        <p className="form-hint" style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Generate dozens to thousands of payment links at once from a spreadsheet paste or CSV template.
        </p>

        {/* Step 1: input */}
        <div className="bulk-card">
          <div className="bulk-toolbar">
            <div>
              <h2 className="bulk-step-title">Step 1 — Prepare your data</h2>
              <p className="form-hint" style={{ marginTop: '0.35rem' }}>
                Download the template, fill it in Excel or Google Sheets, then paste the rows below — or
                type them directly. Both TAB (spreadsheet paste) and comma separators are supported.
              </p>
            </div>
            <button type="button" className="btn btn-secondary bulk-template-btn" onClick={downloadCsvTemplate}>
              <FileSpreadsheet size={16} /> Download CSV Template
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">ID User, Amount, Asset, Note</label>
            <textarea
              className="form-textarea bulk-textarea"
              placeholder={PLACEHOLDER}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={10}
              spellCheck={false}
            />
            <p className="form-hint">
              Asset must be one of UCT, USDU, USDC, SOL, ETH, BTC (case-insensitive). Note is optional.
            </p>
          </div>

          <div className="bulk-actions-row">
            <button
              type="button"
              className="btn btn-primary bulk-btn"
              onClick={handleValidate}
              disabled={!rawInput.trim()}
            >
              1. Check Row Data
            </button>
          </div>
        </div>

        {/* Step 2 & 3: preview, validate, generate, download */}
        {rows && (
          <div className="bulk-card">
            {rows.length === 0 ? (
              <div className="alert alert-warning">
                No rows detected. Paste at least one row of data above, then try again.
              </div>
            ) : (
              <>
                <div className="bulk-summary-bar">
                  <span className="bulk-summary-item bulk-summary-valid">✓ {validCount} Valid</span>
                  {invalidCount > 0 && (
                    <span className="bulk-summary-item bulk-summary-invalid">⚠ {invalidCount} Invalid</span>
                  )}
                  <span className="bulk-summary-total">
                    {rows.length} row{rows.length === 1 ? '' : 's'} total
                  </span>
                </div>

                <div className="bulk-table-wrap">
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th>ID User</th>
                        <th>Amount</th>
                        <th>Asset</th>
                        <th>Note</th>
                        <th>Status</th>
                        {linksGenerated && <th>Payment Link</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id} className={row.validation.valid ? '' : 'row-invalid'}>
                          <td>{row.idUser || <span className="cell-empty">—</span>}</td>
                          <td>{row.amount || <span className="cell-empty">—</span>}</td>
                          <td>{row.asset || <span className="cell-empty">—</span>}</td>
                          <td>{row.note || <span className="cell-empty">—</span>}</td>
                          <td>
                            {row.validation.valid ? (
                              <span className="status-badge status-valid">✓ Valid &amp; Ready</span>
                            ) : (
                              <span
                                className="status-badge status-invalid"
                                title={row.validation.errors.join('; ')}
                              >
                                {row.validation.errors[0]}
                              </span>
                            )}
                          </td>
                          {linksGenerated && (
                            <td>
                              {row.paymentLink && (
                                <div className="link-cell">
                                  <input
                                    readOnly
                                    className="link-input"
                                    value={row.paymentLink}
                                    onFocus={(e) => e.currentTarget.select()}
                                  />
                                  <button
                                    type="button"
                                    className="link-copy-btn"
                                    onClick={() => handleCopyRow(row.id, row.paymentLink as string)}
                                    title="Copy link"
                                  >
                                    {copiedRowId === row.id ? <Check size={14} /> : <Copy size={14} />}
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invalidCount > 0 && (
                  <div className="alert alert-warning bulk-block-notice">
                    Fix {invalidCount} invalid row{invalidCount === 1 ? '' : 's'} above before generating links.
                  </div>
                )}

                <div className="bulk-actions-row">
                  <button
                    type="button"
                    className="btn btn-primary bulk-btn"
                    onClick={handleGenerateAll}
                    disabled={!canGenerate}
                  >
                    2. Generate All Billing Links
                  </button>
                  {linksGenerated && (
                    <button type="button" className="btn btn-success bulk-btn" onClick={handleDownloadResult}>
                      <Download size={16} /> 3. Download Final Result (.csv)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
