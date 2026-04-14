import React from 'react'
import { existsSync } from 'node:fs'
import {
  Document,
  Font,
  Image,
  Line,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  type DocumentProps,
  type TextProps,
} from '@react-pdf/renderer'
import type { Invoice } from '@/lib/invoices/actions'

const SELLER = {
  name: 'SCC INFOTECH',
  addressLines: [
    '349-350, Vikas Shoppers, B/H Filter House Bhagvan Nagar',
    'Circle, near Sarthana Jakat Naka, Surat, Gujarat 395006',
  ],
  phone: '9974361416',
  email: 'sccinfotechllp@gmail.com',
  gstin: '24BTQPD0442K1ZR',
}

const BANK = {
  name: 'Kotak Mahindra Bank',
  accountNo: '9974361416',
  ifsc: 'KKBK0002862',
}

const LOGO_FS = `${process.cwd()}/public/scc_logo.png`

const PDF_FONT_CANDIDATES = [
  {
    regular: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    bold: '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  },
  {
    regular: '/System/Library/Fonts/Supplemental/Arial.ttf',
    bold: '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  },
  {
    regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  },
  {
    regular: '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    bold: '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
  },
  {
    regular: '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    bold: '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  },
]

const PDF_FONT_FILES =
  PDF_FONT_CANDIDATES.find((candidate) => existsSync(candidate.regular) && existsSync(candidate.bold)) ?? null

const PDF_FONT_FAMILY = PDF_FONT_FILES ? 'InvoiceSans' : 'Helvetica'
if (PDF_FONT_FILES) {
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: PDF_FONT_FILES.regular, fontWeight: 400 },
      { src: PDF_FONT_FILES.bold, fontWeight: 700 },
    ],
  })
}

const palette = {
  ink: '#0f172a',
  muted: '#475569',
  faint: '#e2e8f0',
  head: '#f1f5f9',
  accent: '#0369a1',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    color: palette.ink,
    fontSize: 9,
    fontFamily: PDF_FONT_FAMILY,
    lineHeight: 1.4,
  },
  sheet: {
    borderWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#ffffff',
  },
  splitSection: {
    paddingHorizontal: 12,
  },
  section: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#000000',
  },
  row: {
    flexDirection: 'row',
  },
  companyLeft: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
  },
  companyRight: {
    width: 215,
    paddingVertical: 10,
    paddingLeft: 12,
  },
  splitDivider: {
    width: 1,
    backgroundColor: '#000000',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logoWrap: {
    width: 66,
    paddingTop: 2,
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: 'contain',
  },
  companyCopy: {
    flex: 1,
    paddingLeft: 10,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: palette.ink,
    marginBottom: 10,
  },
  companyLine: {
    fontSize: 8.8,
    color: palette.muted,
    marginBottom: 2,
  },
  boxTitle: {
    fontSize: 8,
    fontWeight: 700,
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  boxTitleAccent: {
    color: palette.accent,
  },
  labelValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 5,
  },
  label: {
    width: 70,
    fontSize: 8,
    fontWeight: 700,
    color: palette.ink,
  },
  value: {
    flex: 1,
    fontSize: 8.5,
    color: palette.muted,
    lineHeight: 1.4,
  },
  detailLeft: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
  },
  detailRight: {
    width: 215,
    paddingVertical: 10,
    paddingLeft: 12,
  },
  billToName: {
    fontSize: 11,
    fontWeight: 700,
    color: palette.ink,
    marginBottom: 4,
  },
  billToCompany: {
    fontSize: 9,
    color: palette.ink,
    marginBottom: 4,
  },
  billToLine: {
    fontSize: 8.5,
    color: palette.muted,
    marginBottom: 3,
  },
  detailValueStrong: {
    fontSize: 8.6,
    fontWeight: 700,
    color: palette.ink,
    textAlign: 'right',
    flex: 1,
  },
  tableWrap: {
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: palette.head,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingHorizontal: 6,
    justifyContent: 'flex-start',
  },
  cellHead: {
    paddingVertical: 6,
  },
  cellBody: {
    paddingVertical: 7,
  },
  cellR: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  cellRight: {
    alignItems: 'flex-end',
  },
  idx: {
    width: '7%',
  },
  descGst: {
    width: '43%',
  },
  descNonGst: {
    width: '56%',
  },
  hsn: {
    width: '13%',
  },
  qty: {
    width: '9%',
    textAlign: 'right',
  },
  rate: {
    width: '13%',
    textAlign: 'right',
  },
  amount: {
    width: '15%',
    textAlign: 'right',
  },
  th: {
    fontSize: 7.6,
    fontWeight: 700,
    color: palette.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  td: {
    fontSize: 8.4,
    color: palette.ink,
  },
  tdStrong: {
    fontSize: 8.6,
    fontWeight: 700,
    color: palette.ink,
  },
  tdMuted: {
    fontSize: 7.8,
    color: palette.muted,
    marginTop: 2,
    lineHeight: 1.4,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  emptyText: {
    fontSize: 8.5,
    color: palette.muted,
  },
  bottomLeft: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
  },
  bottomRight: {
    width: 230,
    paddingVertical: 10,
    paddingLeft: 12,
  },
  bankBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bankInfo: {
    flex: 1,
    paddingRight: 10,
  },
  qrBox: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  qrImg: {
    width: 72,
    height: 72,
    objectFit: 'contain',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 8.5,
    color: palette.muted,
  },
  summaryValue: {
    fontSize: 8.6,
    fontWeight: 700,
    color: palette.ink,
  },
  currencyValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'flex-end',
  },
  currencyIcon: {
    marginRight: 2,
  },
  summaryBody: {
    paddingTop: 14,
  },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  grandLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: palette.accent,
  },
  grandValue: {
    fontSize: 10,
    fontWeight: 700,
    color: palette.accent,
  },
  wordsText: {
    fontSize: 9.4,
    fontWeight: 700,
    color: palette.ink,
  },
  termsText: {
    fontSize: 8.3,
    color: palette.muted,
    lineHeight: 1.5,
  },
  signatureSection: {
    paddingHorizontal: 12,
    paddingVertical: 20,
    alignItems: 'flex-end',
  },
  signatureLead: {
    fontSize: 8.5,
    color: palette.muted,
    marginBottom: 24,
  },
  signatureLine: {
    width: 180,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    paddingTop: 4,
    alignItems: 'center',
  },
  signatureText: {
    fontSize: 8.5,
    fontWeight: 700,
    color: palette.ink,
  },
})

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '0.00'
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return formatted
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'

  const plainDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (plainDateMatch) {
    const [, yearText, monthText, dayText] = plainDateMatch
    const year = Number(yearText)
    const month = Number(monthText)
    const day = Number(dayText)
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

function sanitizePdfText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[^\x00-\x7F\n]/g, (ch) => (ch === '₹' ? 'Rs.' : '-'))
}

function safe(value: string | null | undefined): string {
  return sanitizePdfText(value).trim()
}

function toWords0to99(n: number): string {
  const ones = [
    'Zero',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  if (n < 20) return ones[n]!
  const t = Math.floor(n / 10)
  const r = n % 10
  return r ? `${tens[t]} ${ones[r]}` : tens[t]!
}

function toWordsIndian(n: number): string {
  const num = Math.floor(Math.abs(n))
  if (!Number.isFinite(num) || num === 0) return 'Zero'

  const parts: string[] = []
  const push = (value: number, label: string) => {
    if (value > 0) parts.push(`${toWordsIndian(value)} ${label}`.trim())
  }

  const crore = Math.floor(num / 10000000)
  const lakh = Math.floor((num % 10000000) / 100000)
  const thousand = Math.floor((num % 100000) / 1000)
  const hundred = Math.floor((num % 1000) / 100)
  const rest = num % 100

  push(crore, 'Crore')
  push(lakh, 'Lakh')
  push(thousand, 'Thousand')
  if (hundred) parts.push(`${toWords0to99(hundred)} Hundred`)
  if (rest) parts.push(toWords0to99(rest))

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function formatAmountInWords(amount: number): string {
  const rounded = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0
  let rupees = Math.floor(rounded)
  let paise = Math.round((rounded - rupees) * 100)

  if (paise === 100) {
    rupees += 1
    paise = 0
  }

  const rupeeWords = toWordsIndian(rupees)
  const paiseWords = paise > 0 ? ` and ${toWords0to99(paise)} Paise` : ''
  return sanitizePdfText(`Rupees ${rupeeWords}${paiseWords} Only`)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(n)
}

function getInvoiceHeading(): string {
  return 'Invoice detail'
}

function clientPrimaryName(invoice: Invoice): string {
  return safe(invoice.client?.name) || safe(invoice.client?.company_name) || 'Client'
}

function clientSecondaryName(invoice: Invoice): string {
  const name = safe(invoice.client?.name)
  const company = safe(invoice.client?.company_name)
  if (!company || company === name) return ''
  return company
}

export function getInvoicePdfFilename(invoice: Invoice): string {
  const clean = (value: string | null | undefined): string =>
    (value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^A-Za-z0-9()\-\ ]+/g, '_')

  const client = invoice.client?.company_name || invoice.client?.name || 'Client'
  const number = clean(invoice.invoice_number) || 'invoice'
  const kind = invoice.invoice_type === 'gst' ? 'GST' : 'NonGST'
  return `${clean(client)}_${number}_${kind}.pdf`
}

type InvoicePdfProps = {
  invoice: Invoice
  logoSrc?: string
  qrSrc?: string
}

type InvoiceLine = NonNullable<Invoice['items']>[number]

type LabelValueProps = {
  label: string
  value: string
  strongValue?: boolean
}

type SummaryRowProps = {
  label: string
  value: string
}

type CurrencyValueProps = {
  value: string
  textStyle: TextProps['style']
  color?: string
}

function LabelValue({ label, value, strongValue = false }: LabelValueProps) {
  return (
    <View style={styles.labelValueRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={strongValue ? styles.detailValueStrong : styles.value}>{value}</Text>
    </View>
  )
}

function SummaryLine({ label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <CurrencyValue value={value} textStyle={styles.summaryValue} />
    </View>
  )
}

function CurrencyValue({ value, textStyle, color = palette.ink }: CurrencyValueProps) {
  return (
    <View style={styles.currencyValueRow}>
      <Svg width={10} height={12} style={styles.currencyIcon} viewBox="0 0 10 12">
        <Line x1="1" y1="1.5" x2="9" y2="1.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        <Line x1="1" y1="4" x2="8" y2="4" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
        <Path
          d="M1 1.5H5C6.7 1.5 7 3.2 5.6 4.2C5 4.7 4.2 5 3.3 5H1"
          stroke={color}
          strokeWidth={1.2}
          strokeLinecap="round"
          fill="none"
        />
        <Line x1="3.2" y1="5.2" x2="8.4" y2="10.5" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
      <Text style={textStyle}>{value}</Text>
    </View>
  )
}

function particularsLabel(item: InvoiceLine): string {
  return safe(item.project_name) || 'Services'
}

export function InvoicePdfDocument({ invoice, logoSrc, qrSrc }: InvoicePdfProps): React.ReactElement<DocumentProps> {
  const isGst = invoice.invoice_type === 'gst'
  const logo = logoSrc ?? LOGO_FS
  const items = invoice.items ?? []
  const client = invoice.client
  const terms = sanitizePdfText(invoice.terms_and_conditions ?? '').trim()
  const amountWords = formatAmountInWords(Number(invoice.grand_total ?? 0))

  return (
    <Document title={`${invoice.invoice_number} Invoice`} author={SELLER.name} subject={getInvoiceHeading()}>
      <Page size="A4" style={styles.page}>
        <View style={styles.sheet}>
          <View style={[styles.splitSection, styles.row]}>
            <View style={styles.companyLeft}>
              <View style={styles.logoRow}>
                <View style={styles.logoWrap}>
                  <Image src={logo} style={styles.logo} />
                </View>

                <View style={styles.companyCopy}>
                  <Text style={styles.companyName}>{SELLER.name}</Text>
                  {SELLER.addressLines.map((line) => (
                    <Text key={line} style={styles.companyLine}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.splitDivider} />
            <View style={styles.companyRight}>
              <LabelValue label="Mob No." value={SELLER.phone} />
              <LabelValue label="Email" value={SELLER.email} />
              {isGst ? <LabelValue label="GSTIN" value={SELLER.gstin} /> : null}
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={[styles.splitSection, styles.row]}>
            <View style={styles.detailLeft}>
              <Text style={[styles.boxTitle, styles.boxTitleAccent]}>Bill to</Text>
              <Text style={styles.billToName}>{clientPrimaryName(invoice)}</Text>
              {clientSecondaryName(invoice) ? <Text style={styles.billToCompany}>{clientSecondaryName(invoice)}</Text> : null}
              {client?.phone?.trim() ? <Text style={styles.billToLine}>Mob No.: {safe(client.phone)}</Text> : null}
              {client?.email?.trim() ? <Text style={styles.billToLine}>Email: {safe(client.email)}</Text> : null}
              {isGst && client?.gst_number?.trim() ? (
                <Text style={styles.billToLine}>GSTIN: {safe(client.gst_number)}</Text>
              ) : null}
            </View>

            <View style={styles.splitDivider} />
            <View style={styles.detailRight}>
              <Text style={[styles.boxTitle, styles.boxTitleAccent]}>{getInvoiceHeading()}</Text>
              <LabelValue label="Invoice No." value={safe(invoice.invoice_number) || '-'} strongValue />
              <LabelValue label="Date" value={formatDate(invoice.invoice_date)} strongValue />
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              <View style={[styles.cell, styles.cellHead, styles.cellR, styles.idx]}>
                <Text style={styles.th}>Sl</Text>
              </View>
              <View style={[styles.cell, styles.cellHead, styles.cellR, isGst ? styles.descGst : styles.descNonGst]}>
                <Text style={styles.th}>Description</Text>
              </View>
              {isGst ? (
                <View style={[styles.cell, styles.cellHead, styles.cellR, styles.hsn]}>
                  <Text style={styles.th}>HSN/SAC</Text>
                </View>
              ) : null}
              <View style={[styles.cell, styles.cellHead, styles.cellR, styles.cellRight, styles.qty]}>
                <Text style={styles.th}>Qty</Text>
              </View>
              <View style={[styles.cell, styles.cellHead, styles.cellR, styles.cellRight, styles.rate]}>
                <Text style={styles.th}>Rate</Text>
              </View>
              <View style={[styles.cell, styles.cellHead, styles.cellRight, styles.amount]}>
                <Text style={styles.th}>Amount</Text>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No line items were added to this invoice.</Text>
              </View>
            ) : (
              items.map((item, index) => {
                const last = index === items.length - 1
                const narration = safe(item.narration)

                return (
                  <View key={item.id} style={last ? [styles.tableRow, styles.tableRowLast] : styles.tableRow}>
                    <View style={[styles.cell, styles.cellBody, styles.cellR, styles.idx]}>
                      <Text style={styles.tdStrong}>{index + 1}</Text>
                    </View>

                    <View style={[styles.cell, styles.cellBody, styles.cellR, isGst ? styles.descGst : styles.descNonGst]}>
                      <Text style={styles.tdStrong}>{particularsLabel(item)}</Text>
                      {narration ? <Text style={styles.tdMuted}>{narration}</Text> : null}
                    </View>

                    {isGst ? (
                      <View style={[styles.cell, styles.cellBody, styles.cellR, styles.hsn]}>
                        <Text style={styles.td}>{safe(item.hsn_code?.code) || '-'}</Text>
                      </View>
                    ) : null}

                    <View style={[styles.cell, styles.cellBody, styles.cellR, styles.cellRight, styles.qty]}>
                      <Text style={styles.tdStrong}>{formatNumber(item.quantity)}</Text>
                    </View>
                    <View style={[styles.cell, styles.cellBody, styles.cellR, styles.cellRight, styles.rate]}>
                      <CurrencyValue value={formatCurrency(item.rate)} textStyle={styles.tdStrong} />
                    </View>
                    <View style={[styles.cell, styles.cellBody, styles.cellRight, styles.amount]}>
                      <CurrencyValue value={formatCurrency(item.amount)} textStyle={styles.tdStrong} />
                    </View>
                  </View>
                )
              })
            )}
          </View>

          <View style={styles.sectionDivider} />

          <View style={[styles.splitSection, styles.row]} wrap={false}>
            <View style={styles.bottomLeft}>
              <Text style={[styles.boxTitle, styles.boxTitleAccent]}>Bank details</Text>

              <View style={styles.bankBody}>
                <View style={styles.bankInfo}>
                  <LabelValue label="Bank Name" value={BANK.name} />
                  <LabelValue label="A/c No." value={BANK.accountNo} />
                  <LabelValue label="IFSC" value={BANK.ifsc} />
                </View>

                {qrSrc ? (
                  <View style={styles.qrBox}>
                    <Image src={qrSrc} style={styles.qrImg} />
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.splitDivider} />
            <View style={styles.bottomRight}>
              <View style={styles.summaryBody}>
                <SummaryLine label="Subtotal" value={formatCurrency(invoice.subtotal)} />
                <SummaryLine label="Discount" value={formatCurrency(invoice.discount)} />
                {taxRows(invoice)}

                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>Grand Total</Text>
                  <CurrencyValue value={formatCurrency(invoice.grand_total)} textStyle={styles.grandValue} color={palette.accent} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <View style={styles.section} wrap={false}>
            <Text style={styles.boxTitle}>Amount in words</Text>
            <Text style={styles.wordsText}>{amountWords}</Text>
          </View>

          {terms ? (
            <>
              <View style={styles.sectionDivider} />
              <View style={styles.section} wrap={false}>
                <Text style={styles.boxTitle}>Terms & conditions</Text>
                <Text style={styles.termsText}>{terms}</Text>
              </View>
            </>
          ) : null}

          <View style={styles.sectionDivider} />

          <View style={styles.signatureSection} wrap={false}>
            <Text style={styles.signatureLead}>For {SELLER.name}</Text>
            <View style={styles.signatureLine}>
              <Text style={styles.signatureText}>Authorised Signatory</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function taxRows(invoice: Invoice): React.ReactNode {
  if (invoice.invoice_type !== 'gst' || invoice.gst_tax_type === 'none') {
    return null
  }

  if (invoice.gst_tax_type === 'cgst_sgst') {
    return (
      <>
        <SummaryLine label={`CGST (${invoice.cgst_rate}%)`} value={formatCurrency(invoice.cgst_amount)} />
        <SummaryLine label={`SGST (${invoice.sgst_rate}%)`} value={formatCurrency(invoice.sgst_amount)} />
      </>
    )
  }

  if (invoice.gst_tax_type === 'igst') {
    return <SummaryLine label={`IGST (${invoice.igst_rate}%)`} value={formatCurrency(invoice.igst_amount)} />
  }

  return null
}
