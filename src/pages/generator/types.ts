/**
 * Shared types for the Billing Dashboard (Express Request + Bulk Request).
 */

/** One parsed row of raw bulk input, before validation. */
export interface BulkRowInput {
  /** Stable key for this row within the current parse/validate cycle (e.g. "row-0"). */
  id: string
  idUser: string
  amount: string
  asset: string
  note: string
}

export interface RowValidation {
  valid: boolean
  /** Human-readable validation messages, most important first. Empty when valid. */
  errors: string[]
}

/** A bulk row after validation, optionally carrying a generated payment link. */
export interface BulkRowResult extends BulkRowInput {
  validation: RowValidation
  /** Populated only after "Generate All Links" has run. */
  paymentLink?: string
}
