import React from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from '@react-pdf/renderer'
import type { Quotation, QuotationRequirement } from '@/lib/quotations/actions'

// ─── Company Profile ─────────────────────────────────────────────────────────
const COMPANY = {
  name: 'SCC INFOTECH',
  addressLine1: '349-350, Vikas Shoppers, B/H Filter House Bhagvan Nagar Circle,',
  addressLine2: 'Near Sarthana Jakat Naka, Nana Varachha, Surat, Gujarat - 395006',
  phone: '+91 99743 61458',
  email: 'vipul@sccinfotech.com',
  website: 'www.sccinfotech.com',
}

const SCC_LOGO_PATH = `${process.cwd()}/public/scc_logo.png`

// ─── Styles — Black & White Document Format ───────────────────────────────────
const S = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 50,
    backgroundColor: '#FFFFFF',
    color: '#000000',
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.5,
  },

  // ── Letterhead ────────────────────────────────────────────────────────────
  letterhead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  letterheadLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  logo: {
    width: 54,
    height: 54,
    marginRight: 12,
  },
  companyName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
  },
  companyDetail: {
    fontSize: 8.5,
    color: '#333333',
    marginBottom: 1.5,
  },
  letterheadRight: {
    width: 220,
    alignItems: 'flex-end',
  },
  docLabel: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 3,
  },
  docRefLine: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 1.5,
    textAlign: 'right',
  },

  // ── Thick rule under letterhead ───────────────────────────────────────────
  ruleThick: {
    height: 2,
    backgroundColor: '#000000',
    marginTop: 8,
    marginBottom: 2,
  },
  ruleThin: {
    height: 0.5,
    backgroundColor: '#000000',
    marginBottom: 12,
  },

  // ── From / To Address Block ───────────────────────────────────────────────
  addressRow: {
    flexDirection: 'row',
    marginBottom: 20,
    marginTop: 10,
  },
  preparedForWrap: {
    backgroundColor: '#FAFAFA',
    borderLeftWidth: 2,
    borderLeftColor: '#000000',
    padding: 12,
    flex: 1,
  },
  addressSectionLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  addressName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  addressCompany: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#444444',
    marginBottom: 8,
  },
  addressContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  addressContactLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
    width: 35,
  },
  addressContactText: {
    fontSize: 8.5,
    color: '#000000',
  },
  addressLine: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 1.5,
  },

  // ── Subject line ──────────────────────────────────────────────────────────
  subjectRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  subjectLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginRight: 6,
  },
  subjectText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    flex: 1,
  },

  // ── Greeting ──────────────────────────────────────────────────────────────
  greeting: {
    fontSize: 10,
    color: '#000000',
    marginBottom: 6,
  },
  greetingBody: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.6,
    marginBottom: 14,
  },

  // ── Section Title ─────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 6,
    marginTop: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000',
    paddingBottom: 3,
  },

  // ── Scope of Work ────────────────────────────────────────────────────────
  scopeItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  scopeNumber: {
    width: 20,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  scopeContent: {
    flex: 1,
  },
  scopeItemTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  scopeItemDesc: {
    fontSize: 9.5,
    color: '#333333',
    lineHeight: 1.55,
  },

  // ── Pricing Table ─────────────────────────────────────────────────────────
  table: {
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    backgroundColor: '#F0F0F0',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#666666',
  },
  tableRowLast: {
    flexDirection: 'row',
  },

  // Column widths
  colSr: {
    width: 30,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 0.5,
    borderRightColor: '#666666',
    alignItems: 'center',
  },
  colWork: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRightWidth: 0.5,
    borderRightColor: '#666666',
  },
  colType: {
    width: 120,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 0.5,
    borderRightColor: '#666666',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  colAmt: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },

  thText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  tdSr: {
    fontSize: 9,
    color: '#333333',
    textAlign: 'center',
  },
  tdTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 2,
  },
  tdDesc: {
    fontSize: 9,
    color: '#333333',
    lineHeight: 1.5,
  },
  tdType: {
    fontSize: 9,
    color: '#333333',
    textAlign: 'center',
  },
  tdAmt: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'right',
  },
  tdAmtTbd: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'right',
  },
  tdAmtLabel: {
    fontSize: 7.5,
    color: '#555555',
    textAlign: 'right',
    marginBottom: 2,
  },
  tdRateAmt: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textAlign: 'right',
  },
  tdRateUnit: {
    fontSize: 8,
    color: '#333333',
    textAlign: 'right',
    marginTop: 1,
  },

  // ── Milestone nested table ────────────────────────────────────────────────
  msWrap: {
    marginTop: 5,
    borderWidth: 0.5,
    borderColor: '#999999',
  },
  msHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    backgroundColor: '#F8F8F8',
  },
  msRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#DDDDDD',
  },
  msRowLast: {
    flexDirection: 'row',
  },
  msCellNo: {
    width: 22,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#BBBBBB',
    alignItems: 'center',
  },
  msCellMile: {
    flex: 2,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#BBBBBB',
  },
  msCellDue: {
    width: 64,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRightWidth: 0.5,
    borderRightColor: '#BBBBBB',
  },
  msCellAmt: {
    width: 72,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  msTh: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  msTd: {
    fontSize: 8,
    color: '#000000',
  },
  msTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderTopWidth: 0.5,
    borderTopColor: '#999999',
    backgroundColor: '#F0F0F0',
  },
  msTotalLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  msTotalValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },

  // ── Summary rows ──────────────────────────────────────────────────────────
  summarySection: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  summaryTable: {
    width: 240,
    borderWidth: 1,
    borderColor: '#000000',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#666666',
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#000000',
  },
  summaryLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
  },
  summaryValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  summaryTotalLabel: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  summaryTotalValue: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  gstNote: {
    marginTop: 4,
  },
  gstNoteText: {
    fontSize: 8,
    color: '#555555',
  },

  // ── Terms / Support / Notes ───────────────────────────────────────────────
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  listIndex: {
    width: 20,
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  listText: {
    flex: 1,
    fontSize: 9.5,
    color: '#333333',
    lineHeight: 1.55,
  },

  // ── Closing ───────────────────────────────────────────────────────────────
  closingPara: {
    fontSize: 10,
    color: '#333333',
    lineHeight: 1.6,
    marginTop: 14,
    marginBottom: 14,
  },

  // ── Signature Block ───────────────────────────────────────────────────────
  signatureSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  signatureBlock: {
    flex: 1,
    marginRight: 30,
  },
  signatureBlockLast: {
    flex: 1,
  },
  signatureHeading: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 30,
  },
  signatureLine: {
    borderTopWidth: 0.5,
    borderTopColor: '#000000',
    paddingTop: 4,
  },
  signatureLineText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  signatureSubText: {
    fontSize: 8.5,
    color: '#333333',
    marginTop: 2,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 50,
    right: 50,
  },
  footerRule: {
    height: 0.5,
    backgroundColor: '#000000',
    marginBottom: 6,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerLeft: {
    fontSize: 8,
    color: '#333333',
  },
  footerCenter: {
    fontSize: 8,
    color: '#333333',
    textAlign: 'center',
  },
  footerRight: {
    fontSize: 8,
    color: '#333333',
    textAlign: 'right',
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'TBD'
  // Note: '₹' (U+20B9) is NOT in Helvetica's glyph set — react-pdf silently drops it.
  // We format the number in Indian style and prepend 'Rs.' which is ASCII-safe.
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `Rs. ${formatted}`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Note: Helvetica does not support many common UTF-8 symbols (bullets, checkmarks, etc.)
// which results in garbage characters like 'V', 'd', 'l' in the PDF output.
// This helper replaces them with safe ASCII-compatible symbols.
function sanitizeText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/[●•○■□▪▫‣◦]/g, '-') // Common bullets
    .replace(/[✔✅☑✓]/g, 'Y')      // Checkmarks
    .replace(/[➤►▶»›]/g, '>')      // Arrows
    .replace(/[✖✘✕×]/g, 'X')      // Crosses
    .replace(/[^\x00-\x7F\r\n]/g, '-') // Final catch-all for any other non-ASCII symbol
}

function splitLines(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function getSourceDetails(quotation: Quotation) {
  return {
    name:
      quotation.source_type === 'client'
        ? quotation.client?.name || quotation.client_snapshot_name || null
        : quotation.client_snapshot_name || quotation.lead?.name || null,
    company:
      quotation.source_type === 'client'
        ? quotation.client?.company_name || quotation.client_snapshot_company_name || null
        : quotation.client_snapshot_company_name || quotation.lead?.company_name || null,
    phone:
      quotation.source_type === 'client'
        ? quotation.client?.phone || quotation.client_snapshot_phone || null
        : quotation.client_snapshot_phone || quotation.lead?.phone || null,
    email: quotation.client_snapshot_email || null,
  }
}

function getPricingLabel(type: QuotationRequirement['pricing_type']): string {
  if (type === 'fixed') return 'Fixed'
  if (type === 'milestone') return 'Milestone'
  return 'Hourly'
}

function getRequirementAmount(req: QuotationRequirement): number | null {
  if (req.pricing_type === 'fixed') return req.amount
  if (req.pricing_type === 'milestone') {
    if (!req.milestones?.length) return null
    return req.milestones.reduce((sum, m) => sum + (m.amount ?? 0), 0)
  }
  if (req.hourly_rate != null && req.estimated_hours != null) {
    return req.hourly_rate * req.estimated_hours
  }
  return req.amount
}

// ─── Exports ─────────────────────────────────────────────────────────────────

// Note: Ensure Next.js dev server uses port 3001 if requested.
export function getQuotationPdfFilename(quotationNumber: string): string {
  return `${quotationNumber.replace(/[^A-Za-z0-9_-]+/g, '_')}.pdf`
}

type Props = {
  quotation: Quotation
  requirements: QuotationRequirement[]
  subtotal: number
  discount: number
  finalTotal: number
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function QuotationPdfDocument({
  quotation,
  requirements,
  subtotal,
  discount,
  finalTotal,
}: Props): React.ReactElement<DocumentProps> {
  const source = getSourceDetails(quotation)
  const termsItems = splitLines(quotation.terms)
  const supportItems = splitLines(quotation.support)
  const hasRequirements = requirements.length > 0
  const showPricing = hasRequirements || finalTotal > 0
  const showDiscount = discount > 0
  const recipientName = hasText(source.name) ? source.name! : 'Sir/Madam'

  // Subject: reference or auto-generated
  const subjectText = hasText(quotation.reference)
    ? quotation.reference!
    : 'Quotation for IT Services'

  return (
    <Document
      title={`${quotation.quotation_number} - Quotation`}
      author={COMPANY.name}
      subject={subjectText}
      creator={COMPANY.name}
      producer={COMPANY.name}
    >
      <Page size="A4" style={S.page}>

        {/* ── LETTERHEAD ─────────────────────────────────────────────────── */}
        <View style={S.letterhead}>

          {/* Left: Logo + Company */}
          <View style={S.letterheadLeft}>
            <Image src={SCC_LOGO_PATH} style={S.logo} />
            <View>
              <Text style={S.companyName}>{COMPANY.name}</Text>
              <Text style={S.companyDetail}>{COMPANY.addressLine1}</Text>
              <Text style={S.companyDetail}>{COMPANY.addressLine2}</Text>
              <Text style={S.companyDetail}>Tel: {COMPANY.phone}  |  {COMPANY.email}</Text>
              <Text style={S.companyDetail}>{COMPANY.website}</Text>
            </View>
          </View>

          {/* Right: Document type */}
          <View style={S.letterheadRight}>
            <Text style={S.docLabel}>QUOTATION</Text>
            <Text style={S.docRefLine}>Ref No: {quotation.quotation_number}</Text>
            <Text style={S.docRefLine}>Date: {formatDate(quotation.created_at)}</Text>
            {quotation.valid_till && (
              <Text style={S.docRefLine}>Valid Till: {formatDate(quotation.valid_till)}</Text>
            )}
          </View>

        </View>

        {/* ── DOUBLE RULE ────────────────────────────────────────────────── */}
        <View style={S.ruleThick} />
        <View style={S.ruleThin} />

        {/* ── FROM / TO ──────────────────────────────────────────────────── */}
        <View style={S.addressRow}>
          {/* To - Prepared For */}
          <View style={S.preparedForWrap}>
            <Text style={S.addressSectionLabel}>PREPARED FOR</Text>
            {hasText(source.name) && (
              <Text style={S.addressName}>{source.name}</Text>
            )}
            {hasText(source.company) && (
              <Text style={S.addressCompany}>{source.company}</Text>
            )}

            {(hasText(source.phone) || hasText(source.email)) && (
              <View style={{ marginTop: 4 }}>
                {hasText(source.phone) && (
                  <View style={S.addressContactRow}>
                    <Text style={S.addressContactLabel}>Tel:</Text>
                    <Text style={S.addressContactText}>{source.phone}</Text>
                  </View>
                )}
                {hasText(source.email) && (
                  <View style={S.addressContactRow}>
                    <Text style={S.addressContactLabel}>Email:</Text>
                    <Text style={S.addressContactText}>{source.email}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── SUBJECT ────────────────────────────────────────────────────── */}
        <View style={S.subjectRow}>
          <Text style={S.subjectLabel}>Subject:</Text>
          <Text style={S.subjectText}>{subjectText}</Text>
        </View>

        {/* ── GREETING ───────────────────────────────────────────────────── */}
        <Text style={S.greeting}>Dear {recipientName},</Text>
        <Text style={S.greetingBody}>
          Thank you for giving us the opportunity to submit this quotation. We are pleased to present
          our proposal for the above-mentioned subject. Please find below the detailed scope of work
          and commercial terms for your review.
        </Text>

        {/* ── SCOPE OF WORK ──────────────────────────────────────────────── */}
        {hasRequirements && (
          <View>
            <Text style={S.sectionTitle}>Scope of Work</Text>
            {requirements.map((req, idx) => {
              const descriptionLines = splitLines(req.description)
              return (
                <View key={req.id} style={S.scopeItem}>
                  <Text style={S.scopeNumber}>{idx + 1}.</Text>
                  <View style={S.scopeContent}>
                    <Text style={S.scopeItemTitle}>
                      {req.title?.trim() || `Requirement ${idx + 1}`}
                    </Text>
                    {descriptionLines.map((line, lIdx) => (
                      <Text key={lIdx} style={S.scopeItemDesc}>
                        {sanitizeText(line)}
                      </Text>
                    ))}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* ── PRICING TABLE ──────────────────────────────────────────────── */}
        {showPricing && (
          <View>
            <Text style={S.sectionTitle}>Pricing Details</Text>

            <View style={S.table}>

              {/* Header */}
              <View style={S.tableHeaderRow}>
                <View style={S.colSr}>
                  <Text style={S.thText}>Sr.</Text>
                </View>
                <View style={S.colType}>
                  <Text style={S.thText}>Type / Billing Model</Text>
                </View>
                <View style={S.colAmt}>
                  <Text style={[S.thText, { textAlign: 'right' }]}>Amount / Details</Text>
                </View>
              </View>

              {/* Rows */}
              {requirements.map((req, idx) => {
                const isLast = idx === requirements.length - 1
                const amount = getRequirementAmount(req)

                return (
                  <View
                    key={req.id}
                    style={isLast ? S.tableRowLast : S.tableRow}
                  >
                    {/* Sr# */}
                    <View style={S.colSr}>
                      <Text style={S.tdSr}>{idx + 1}</Text>
                    </View>

                    {/* Pricing Type */}
                    <View style={S.colType}>
                      <Text style={S.tdType}>{getPricingLabel(req.pricing_type)}</Text>
                    </View>

                    {/* Amount / Details — per pricing type */}
                    <View style={S.colAmt}>

                      {/* FIXED: Estimated amount */}
                      {req.pricing_type === 'fixed' && (
                        req.amount != null ? (
                          <View>
                            <Text style={S.tdAmtLabel}>Estimated</Text>
                            <Text style={S.tdAmt}>{formatCurrency(req.amount)}</Text>
                          </View>
                        ) : (
                          <Text style={S.tdAmtTbd}>TBD</Text>
                        )
                      )}

                      {/* HOURLY: Price per hour only */}
                      {req.pricing_type === 'hourly' && (
                        req.hourly_rate != null ? (
                          <View>
                            <Text style={S.tdRateAmt}>{formatCurrency(req.hourly_rate)}</Text>
                            <Text style={S.tdRateUnit}>per hour</Text>
                          </View>
                        ) : (
                          <Text style={S.tdAmtTbd}>TBD</Text>
                        )
                      )}

                      {/* MILESTONE: nested breakdown table */}
                      {req.pricing_type === 'milestone' && (
                        req.milestones != null && req.milestones.length > 0 ? (
                          <View style={S.msWrap}>
                            {/* Milestone table header */}
                            <View style={S.msHeaderRow}>
                              <View style={S.msCellNo}>
                                <Text style={S.msTh}>#</Text>
                              </View>
                              <View style={S.msCellMile}>
                                <Text style={S.msTh}>Milestone</Text>
                              </View>
                              <View style={S.msCellDue}>
                                <Text style={S.msTh}>Due Date</Text>
                              </View>
                              <View style={S.msCellAmt}>
                                <Text style={[S.msTh, { textAlign: 'right' }]}>Amt.</Text>
                              </View>
                            </View>

                            {/* Milestone rows — no description */}
                            {req.milestones.map((ms, mIdx) => {
                              const msLast = mIdx === req.milestones!.length - 1
                              return (
                                <View
                                  key={ms.id}
                                  style={msLast ? S.msRowLast : S.msRow}
                                >
                                  <View style={S.msCellNo}>
                                    <Text style={[S.msTd, { textAlign: 'center' }]}>{mIdx + 1}</Text>
                                  </View>
                                  <View style={S.msCellMile}>
                                    <Text style={S.msTd}>{sanitizeText(ms.title || '-')}</Text>
                                  </View>
                                  <View style={S.msCellDue}>
                                    <Text style={S.msTd}>{formatDate(ms.due_date)}</Text>
                                  </View>
                                  <View style={S.msCellAmt}>
                                    <Text style={[S.msTd, { textAlign: 'right' }]}>
                                      {formatCurrency(ms.amount)}
                                    </Text>
                                  </View>
                                </View>
                              )
                            })}

                            {/* Estimated total row */}
                            {amount != null && (
                              <View style={S.msTotalRow}>
                                <Text style={S.msTotalLabel}>Estimated Total</Text>
                                <Text style={S.msTotalValue}>{formatCurrency(amount)}</Text>
                              </View>
                            )}
                          </View>
                        ) : (
                          <Text style={S.tdAmtTbd}>TBD</Text>
                        )
                      )}

                    </View>

                  </View>
                )
              })}

            </View>

            {/* Summary */}
            <View style={S.summarySection}>
              <View style={S.summaryTable}>
                {showDiscount && (
                  <View style={S.summaryRow}>
                    <Text style={S.summaryLabel}>Subtotal</Text>
                    <Text style={S.summaryValue}>{formatCurrency(subtotal)}</Text>
                  </View>
                )}
                {showDiscount && (
                  <View style={S.summaryRow}>
                    <Text style={S.summaryLabel}>Discount</Text>
                    <Text style={S.summaryValue}>- {formatCurrency(discount)}</Text>
                  </View>
                )}
                <View style={S.summaryTotalRow}>
                  <Text style={S.summaryTotalLabel}>Total Estimated Value</Text>
                  <Text style={S.summaryTotalValue}>{formatCurrency(finalTotal)}</Text>
                </View>
              </View>
              <View style={S.gstNote}>
                <Text style={S.gstNoteText}>
                  * All amounts are exclusive of GST. Applicable GST will be charged extra as per government norms.
                </Text>
              </View>
            </View>

          </View>
        )}

        {/* ── SUPPORT & MAINTENANCE (only if available) ──────────────────── */}
        {supportItems.length > 0 && (
          <View>
            <Text style={S.sectionTitle}>Support &amp; Maintenance</Text>
            {supportItems.map((item, i) => (
              <View key={i} style={S.listItem}>
                <Text style={S.listIndex}>{i + 1}.</Text>
                <Text style={S.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── TERMS & CONDITIONS (only if available) ─────────────────────── */}
        {termsItems.length > 0 && (
          <View>
            <Text style={S.sectionTitle}>Terms &amp; Conditions</Text>
            {termsItems.map((item, i) => (
              <View key={i} style={S.listItem}>
                <Text style={S.listIndex}>{i + 1}.</Text>
                <Text style={S.listText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── CLOSING PARAGRAPH ──────────────────────────────────────────── */}
        <Text style={S.closingPara}>
          We hope the above proposal meets your requirements. Should you need any clarification or
          wish to discuss any aspect of this quotation, please feel free to contact us. We look
          forward to the opportunity of working with you.
        </Text>

        {/* ── SIGNATURE BLOCK ────────────────────────────────────────────── */}
        <View style={S.signatureSection}>

          {/* Authorized Signatory — company signs first (left side) */}
          <View style={S.signatureBlock}>
            <Text style={S.signatureHeading}>For {COMPANY.name}</Text>
            <View style={S.signatureLine}>
              <Text style={S.signatureLineText}>{COMPANY.name}</Text>
              <Text style={S.signatureSubText}>Authorized Signatory</Text>
            </View>
          </View>

          {/* Client Acceptance (right side) */}
          <View style={S.signatureBlockLast}>
            <Text style={S.signatureHeading}>Accepted By (Client)</Text>
            <View style={S.signatureLine}>
              <Text style={S.signatureLineText}>
                {hasText(source.name) ? source.name! : '___________________________'}
              </Text>
              {hasText(source.company) && (
                <Text style={S.signatureSubText}>{source.company}</Text>
              )}
              <Text style={S.signatureSubText}>Date: _________________________</Text>
            </View>
          </View>

        </View>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <View style={S.footerRule} />
          <View style={S.footerContent}>
            <Text style={S.footerLeft}>{COMPANY.name}  |  {COMPANY.email}</Text>
            <Text
              style={S.footerCenter}
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
            <Text style={S.footerRight}>{quotation.quotation_number}  |  Confidential</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
