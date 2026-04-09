function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function normalizeNumber(value?: number | string | null): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}

/** Line amount from quantity × rate (non-negative), 2 decimal places. */
export function invoiceLineAmount(quantity: number, rate: number): number {
  const q = Math.max(0, normalizeNumber(quantity))
  const r = Math.max(0, normalizeNumber(rate))
  return roundCurrency(q * r)
}
