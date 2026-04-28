import React from 'react'
import { existsSync } from 'node:fs'
import {
  Defs,
  Document,
  Font,
  Image,
  Line,
  LinearGradient,
  Page,
  Path,
  Rect,
  StyleSheet,
  Stop,
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

type PdfFontCandidate = {
  regular: string
  bold: string
}

const PDF_FONT_CANDIDATES: PdfFontCandidate[] = [
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

function registerPdfFont(family: string, fallbackFamily: string, candidates: PdfFontCandidate[]): string {
  const files = candidates.find((candidate) => existsSync(candidate.regular) && existsSync(candidate.bold))
  if (!files) return fallbackFamily

  Font.register({
    family,
    fonts: [
      { src: files.regular, fontWeight: 400 },
      { src: files.bold, fontWeight: 700 },
    ],
  })

  return family
}

const PDF_FONT_FAMILY = registerPdfFont('InvoiceArial', 'Helvetica', PDF_FONT_CANDIDATES)

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
  gstPage: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    color: palette.ink,
    fontSize: 9,
    fontFamily: PDF_FONT_FAMILY,
    lineHeight: 1.4,
  },
  simplePage: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 12,
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
  gstSheet: {
    borderWidth: 1,
    borderColor: '#dddddd',
    backgroundColor: '#ffffff',
    flexGrow: 1,
  },
  gstTopStrip: {
    height: 6,
    width: '100%',
  },
  gstHeader: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  gstLogo: {
    width: 50,
    height: 50,
    objectFit: 'contain',
    marginRight: 10,
  },
  gstCompanyBlock: {
    flex: 1,
  },
  gstCompanyName: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f4c81',
    marginBottom: 6,
  },
  gstCompanyLine: {
    fontSize: 12,
    color: palette.ink,
    lineHeight: 1.4,
  },
  gstCompanyLineStrong: {
    fontWeight: 700,
  },
  gstSection: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  gstTopDivider: {
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  gstSectionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  gstFlex: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gstHalf: {
    flex: 1,
    fontSize: 12,
  },
  gstTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: '#0f4c81',
    marginBottom: 4,
  },
  gstBillName: {
    fontSize: 12,
    fontWeight: 700,
    color: palette.ink,
    marginBottom: 2,
  },
  gstBillLine: {
    fontSize: 12,
    color: palette.ink,
    lineHeight: 1.5,
  },
  gstBillLineStrong: {
    fontWeight: 700,
  },
  gstVDivider: {
    width: 1,
    backgroundColor: '#cccccc',
    marginHorizontal: 10,
  },
  gstVDividerFull: {
    width: 1,
    backgroundColor: '#cccccc',
    marginHorizontal: 10,
    marginVertical: -10,
    alignSelf: 'stretch',
  },
  gstTableHead: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gstTableHeadCell: {
    backgroundColor: '#0f4c81',
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRightWidth: 1,
    borderRightColor: '#dbeafe',
    justifyContent: 'center',
  },
  gstTableHeadCellLast: {
    borderRightWidth: 0,
  },
  gstTableHeadText: {
    fontSize: 11.2,
    fontWeight: 700,
    color: '#ffffff',
  },
  gstTableHeadTextRight: {
    textAlign: 'right',
  },
  gstTableHeadTextCenter: {
    textAlign: 'center',
  },
  gstTableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  gstTableRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  gstTableCell: {
    paddingVertical: 7,
    paddingHorizontal: 7,
    borderRightWidth: 1,
    borderRightColor: '#dddddd',
  },
  gstTableCellLast: {
    borderRightWidth: 0,
  },
  gstTableFill: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  gstTableFillCell: {
    borderRightWidth: 1,
    borderRightColor: '#dddddd',
  },
  gstTableFillCellLast: {
    borderRightWidth: 0,
  },
  gstColSl: {
    width: '6%',
  },
  gstColDescription: {
    width: '45%',
  },
  gstColHsn: {
    width: '12%',
  },
  gstColQty: {
    width: '9%',
  },
  gstColRate: {
    width: '13%',
  },
  gstColAmount: {
    width: '15%',
  },
  gstCellCenter: {
    alignItems: 'center',
  },
  gstCellRight: {
    alignItems: 'flex-end',
  },
  gstBodyStrong: {
    fontSize: 12,
    fontWeight: 700,
    color: palette.ink,
  },
  gstBodyText: {
    fontSize: 12,
    color: palette.ink,
  },
  gstBodyMuted: {
    fontSize: 10.5,
    color: palette.muted,
    marginTop: 2,
  },
  gstAmountLine: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#aaaaaa',
    borderTopStyle: 'dashed',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  gstAmountLineLabel: {
    fontSize: 12,
    color: palette.ink,
  },
  gstAmountLineValue: {
    fontSize: 12,
    fontWeight: 700,
    color: palette.ink,
  },
  gstBottom: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gstBankPane: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gstBankCopy: {
    flex: 1,
    paddingRight: 10,
  },
  gstBankLine: {
    fontSize: 12,
    color: palette.ink,
    lineHeight: 1.5,
  },
  gstBankLineStrong: {
    fontWeight: 700,
  },
  gstQr: {
    width: 72,
    height: 72,
    objectFit: 'contain',
  },
  gstSummaryPane: {
    width: '42%',
  },
  gstSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  gstSummaryLabel: {
    fontSize: 12,
    color: palette.ink,
  },
  gstSummaryValue: {
    fontSize: 12,
    color: palette.ink,
    textAlign: 'right',
  },
  gstSummaryValueBold: {
    fontSize: 12,
    fontWeight: 700,
    color: palette.ink,
    textAlign: 'right',
  },
  gstGrandLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f4c81',
  },
  gstGrandValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f4c81',
    textAlign: 'right',
  },
  gstFooter: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  gstFooterLeft: {
    flex: 1,
    paddingRight: 12,
  },
  gstFooterRight: {
    width: '42%',
    alignItems: 'flex-end',
  },
  gstTermsText: {
    fontSize: 12,
    color: palette.ink,
    lineHeight: 1.5,
  },
  gstFooterLead: {
    fontSize: 12,
    color: palette.ink,
    marginBottom: 18,
  },
  gstFooterSign: {
    fontSize: 12,
    fontWeight: 700,
    color: palette.ink,
  },
  simpleSheet: {
    backgroundColor: '#ffffff',
    padding: 6,
    flexGrow: 1,
    width: '100%',
  },
  simpleHeaderBlock: {
    borderWidth: 1,
    borderColor: '#000000',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  simpleHeaderName: {
    fontSize: 15,
    fontWeight: 700,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 7,
  },
  simpleHeaderText: {
    fontSize: 8.2,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 2,
  },
  simpleInfoRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
  },
  simpleInfoCell: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  simpleInfoLeft: {
    flex: 1,
  },
  simpleInfoRight: {
    width: 170,
  },
  simpleInfoBorder: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  simpleInfoLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: palette.ink,
    marginBottom: 3,
  },
  simpleInfoValue: {
    fontSize: 9,
    color: palette.ink,
    lineHeight: 1.4,
  },
  simpleInfoValueStrong: {
    fontSize: 9,
    fontWeight: 700,
    color: palette.ink,
    lineHeight: 1.4,
  },
  simpleInfoPair: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  simpleInfoPairLabel: {
    width: 52,
    fontSize: 8,
    fontWeight: 700,
    color: palette.ink,
  },
  simpleInfoPairValue: {
    flex: 1,
    fontSize: 8.6,
    color: palette.ink,
  },
  simpleTableBox: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopWidth: 0,
    borderColor: '#000000',
    flexGrow: 1,
  },
  simpleTableBody: {
    flexGrow: 1,
  },
  simpleTableFill: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  simpleTableFillCell: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  simpleTableFillCellLast: {
    borderRightWidth: 0,
  },
  simpleTableHead: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  simpleTableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  simpleTableRowLast: {
    borderBottomWidth: 0,
  },
  simpleTableCell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    justifyContent: 'flex-start',
  },
  simpleTableCellRight: {
    alignItems: 'flex-end',
  },
  simpleTableCellBorder: {
    borderRightWidth: 1,
    borderRightColor: '#000000',
  },
  simpleTableIndex: {
    width: '10%',
  },
  simpleTableItem: {
    width: '46%',
  },
  simpleTableQty: {
    width: '12%',
  },
  simpleTableRate: {
    width: '16%',
  },
  simpleTableAmount: {
    width: '16%',
  },
  simpleTableHeadText: {
    fontSize: 7.8,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: palette.ink,
  },
  simpleTableText: {
    fontSize: 8.5,
    color: palette.ink,
  },
  simpleTableStrong: {
    fontSize: 8.7,
    fontWeight: 700,
    color: palette.ink,
  },
  simpleTableMuted: {
    fontSize: 7.7,
    color: palette.ink,
    marginTop: 2,
    lineHeight: 1.4,
  },
  simpleFooterLabel: {
    fontSize: 8.6,
    fontWeight: 700,
    color: palette.ink,
  },
  simpleFooterValue: {
    fontSize: 8.6,
    color: palette.ink,
  },
  simpleTableTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
  simpleSignRow: {
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#000000',
    borderTopWidth: 0,
    minHeight: 50,
  },
  simpleSignTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  simpleSignTopText: {
    fontSize: 8.6,
    fontWeight: 700,
    color: palette.ink,
  },
  simpleSignBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  simpleSignReceived: {
    fontSize: 8.6,
    color: palette.ink,
  },
  simpleSignText: {
    fontSize: 8.4,
    color: palette.ink,
    textAlign: 'right',
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

function getInvoiceHeading(invoiceType: Invoice['invoice_type']): string {
  return invoiceType === 'gst' ? 'Invoice detail' : 'Bill'
}

function getInvoiceDocumentTitle(invoice: Invoice): string {
  const suffix = invoice.invoice_type === 'gst' ? 'Invoice' : 'Bill'
  return `${invoice.invoice_number} ${suffix}`
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

function clientBillingName(invoice: Invoice): string {
  return safe(invoice.client?.company_name) || safe(invoice.client?.name) || 'Client'
}

export function getInvoicePdfFilename(invoice: Invoice): string {
  const clean = (value: string | null | undefined): string =>
    (value ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^A-Za-z0-9()\-\ ]+/g, '_')

  const client = invoice.client?.company_name || invoice.client?.name || 'Client'
  const number = clean(invoice.invoice_number) || 'invoice'
  const kind = invoice.invoice_type === 'gst' ? 'GST' : 'Bill'
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
  return safe(item.project_name) || safe(item.narration) || 'Services'
}

export function InvoicePdfDocument({ invoice, logoSrc, qrSrc }: InvoicePdfProps): React.ReactElement<DocumentProps> {
  if (invoice.invoice_type === 'non_gst') {
    return <NonGstInvoicePdfDocument invoice={invoice} />
  }

  return <GstInvoicePdfDocument invoice={invoice} logoSrc={logoSrc} qrSrc={qrSrc} />
}

function GstInvoicePdfDocument({ invoice, logoSrc, qrSrc }: InvoicePdfProps): React.ReactElement<DocumentProps> {
  const logo = logoSrc ?? LOGO_FS
  const items = invoice.items ?? []
  const client = invoice.client
  const terms = sanitizePdfText(invoice.terms_and_conditions ?? '').trim()
  const amountWords = formatAmountInWords(Number(invoice.grand_total ?? 0))
  const stripGradientId = `topStrip-${safe(invoice.id)}`

  return (
    <Document title={getInvoiceDocumentTitle(invoice)} author={SELLER.name} subject={getInvoiceHeading(invoice.invoice_type)}>
      <Page size="A4" style={styles.gstPage}>
        <View style={styles.gstSheet}>
          <View style={styles.gstTopStrip}>
            <Svg width="100%" height="6" viewBox="0 0 100 6" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={stripGradientId} x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
                  <Stop offset="0%" stopColor="#0f4c81" />
                  <Stop offset="100%" stopColor="#2aa9e0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100" height="6" fill={`url(#${stripGradientId})`} />
            </Svg>
          </View>

          <View style={styles.gstHeader}>
            <Image src={logo} style={styles.gstLogo} />
            <View style={styles.gstCompanyBlock}>
              <Text style={styles.gstCompanyName}>{SELLER.name}</Text>
              {SELLER.addressLines.map((line) => (
                <Text key={line} style={styles.gstCompanyLine}>
                  {line}
                </Text>
              ))}
              <Text style={styles.gstCompanyLine}>
                <Text style={styles.gstCompanyLineStrong}>Mob:</Text> {SELLER.phone}
              </Text>
              <Text style={styles.gstCompanyLine}>
                <Text style={styles.gstCompanyLineStrong}>GSTIN:</Text> {SELLER.gstin}
              </Text>
            </View>
          </View>

          <View style={[styles.gstSection, styles.gstSectionDivider, styles.gstFlex]}>
            <View style={styles.gstHalf}>
              <Text style={styles.gstTitle}>Bill To</Text>
              <Text style={styles.gstBillName}>{clientPrimaryName(invoice)}</Text>
              {clientSecondaryName(invoice) ? <Text style={styles.gstBillLine}>{clientSecondaryName(invoice)}</Text> : null}
              {client?.phone?.trim() ? (
                <Text style={styles.gstBillLine}>
                  <Text style={styles.gstBillLineStrong}>Mob:</Text> {safe(client.phone)}
                </Text>
              ) : null}
              {client?.gst_number?.trim() ? (
                <Text style={styles.gstBillLine}>
                  <Text style={styles.gstBillLineStrong}>GSTIN:</Text> {safe(client.gst_number)}
                </Text>
              ) : null}
            </View>

            <View style={styles.gstVDividerFull} />

            <View style={styles.gstHalf}>
              <Text style={styles.gstTitle}>Invoice</Text>
              <Text style={styles.gstBillLine}>
                <Text style={styles.gstBillLineStrong}>Invoice No:</Text> {safe(invoice.invoice_number) || '-'}
              </Text>
              <Text style={styles.gstBillLine}>
                <Text style={styles.gstBillLineStrong}>Date:</Text> {formatDate(invoice.invoice_date)}
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.gstTableHead}>
              <View style={[styles.gstTableHeadCell, styles.gstColSl]}>
                <Text style={[styles.gstTableHeadText, styles.gstTableHeadTextCenter]}>SL</Text>
              </View>
              <View style={[styles.gstTableHeadCell, styles.gstColDescription]}>
                <Text style={styles.gstTableHeadText}>Description</Text>
              </View>
              <View style={[styles.gstTableHeadCell, styles.gstColHsn]}>
                <Text style={[styles.gstTableHeadText, styles.gstTableHeadTextCenter]}>HSN</Text>
              </View>
              <View style={[styles.gstTableHeadCell, styles.gstColQty]}>
                <Text style={[styles.gstTableHeadText, styles.gstTableHeadTextCenter]}>Qty</Text>
              </View>
              <View style={[styles.gstTableHeadCell, styles.gstColRate]}>
                <Text style={[styles.gstTableHeadText, styles.gstTableHeadTextRight]}>Rate</Text>
              </View>
              <View style={[styles.gstTableHeadCell, styles.gstTableHeadCellLast, styles.gstColAmount]}>
                <Text style={[styles.gstTableHeadText, styles.gstTableHeadTextRight]}>Amount</Text>
              </View>
            </View>

            {items.length === 0 ? (
              <View style={[styles.emptyState, styles.gstSectionDivider]}>
                <Text style={styles.emptyText}>No line items were added to this invoice.</Text>
              </View>
            ) : (
              items.map((item, index) => {
                const title = particularsLabel(item)
                const narration = safe(item.narration)
                const detailNarration = narration && narration !== title ? narration : ''

                return (
                  <View key={item.id} style={styles.gstTableRow}>
                    <View style={[styles.gstTableCell, styles.gstColSl, styles.gstCellCenter]}>
                      <Text style={styles.gstBodyStrong}>{index + 1}</Text>
                    </View>
                    <View style={[styles.gstTableCell, styles.gstColDescription]}>
                      <Text style={styles.gstBodyStrong}>{title}</Text>
                      {detailNarration ? <Text style={styles.gstBodyMuted}>{detailNarration}</Text> : null}
                    </View>
                    <View style={[styles.gstTableCell, styles.gstColHsn, styles.gstCellCenter]}>
                      <Text style={styles.gstBodyText}>{safe(item.hsn_code?.code) || '-'}</Text>
                    </View>
                    <View style={[styles.gstTableCell, styles.gstColQty, styles.gstCellCenter]}>
                      <Text style={styles.gstBodyText}>{formatNumber(item.quantity)}</Text>
                    </View>
                    <View style={[styles.gstTableCell, styles.gstColRate, styles.gstCellRight]}>
                      <Text style={styles.gstBodyText}>{formatCurrency(item.rate)}</Text>
                    </View>
                    <View style={[styles.gstTableCell, styles.gstTableCellLast, styles.gstColAmount, styles.gstCellRight]}>
                      <Text style={styles.gstBodyText}>{formatCurrency(item.amount)}</Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>

          {/* Keep table column separators continuing through adjustable space */}
          <View style={styles.gstTableFill}>
            <View style={[styles.gstColSl, styles.gstTableFillCell]} />
            <View style={[styles.gstColDescription, styles.gstTableFillCell]} />
            <View style={[styles.gstColHsn, styles.gstTableFillCell]} />
            <View style={[styles.gstColQty, styles.gstTableFillCell]} />
            <View style={[styles.gstColRate, styles.gstTableFillCell]} />
            <View style={[styles.gstColAmount, styles.gstTableFillCellLast]} />
          </View>

          <View style={[styles.gstSection, styles.gstTopDivider, styles.gstBottom]} wrap={false}>
            <View style={styles.gstBankPane}>
              <View style={styles.gstBankCopy}>
                <Text style={styles.gstTitle}>Bank Details</Text>
                <Text style={styles.gstBankLine}>{BANK.name}</Text>
                <Text style={styles.gstBankLine}>
                  <Text style={styles.gstBankLineStrong}>A/c:</Text> {BANK.accountNo}
                </Text>
                <Text style={styles.gstBankLine}>
                  <Text style={styles.gstBankLineStrong}>IFSC:</Text> {BANK.ifsc}
                </Text>
              </View>

              {qrSrc ? <Image src={qrSrc} style={styles.gstQr} /> : null}
            </View>

            <View style={styles.gstVDivider} />

            <View style={styles.gstSummaryPane}>
              <GstSummaryRows invoice={invoice} />
            </View>
          </View>

          <View style={styles.gstAmountLine} wrap={false}>
            <Text style={styles.gstAmountLineLabel}>
              Amount in Words: <Text style={styles.gstAmountLineValue}>{amountWords}</Text>
            </Text>
          </View>

          <View style={styles.gstFooter} wrap={false}>
            <View style={styles.gstFooterLeft}>
              {terms ? (
                <>
                  <Text style={styles.gstTitle}>Terms & Conditions</Text>
                  <Text style={styles.gstTermsText}>{terms}</Text>
                </>
              ) : null}
            </View>

            <View style={styles.gstFooterRight}>
              <Text style={styles.gstFooterLead}>For {SELLER.name}</Text>
              <Text style={styles.gstFooterSign}>Authorised Signatory</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function NonGstInvoicePdfDocument({ invoice }: Pick<InvoicePdfProps, 'invoice'>): React.ReactElement<DocumentProps> {
  const items = invoice.items ?? []
  const billDate = formatDate(invoice.invoice_date || invoice.created_at)
  const clientName = clientBillingName(invoice)
  const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  const hasDiscount = Number(invoice.discount ?? 0) > 0

  return (
    <Document title={getInvoiceDocumentTitle(invoice)} author={SELLER.name} subject={getInvoiceHeading(invoice.invoice_type)}>
      <Page size="A4" style={styles.simplePage}>
        <View style={styles.simpleSheet}>
          <View style={styles.simpleHeaderBlock}>
            <Text style={styles.simpleHeaderName}>{SELLER.name}</Text>
            {SELLER.addressLines.map((line) => (
              <Text key={line} style={styles.simpleHeaderText}>
                {line}
              </Text>
            ))}
            <Text style={styles.simpleHeaderText}>Contact: {SELLER.phone}</Text>
          </View>

          <View style={styles.simpleInfoRow}>
            <View style={[styles.simpleInfoCell, styles.simpleInfoLeft, styles.simpleInfoBorder]}>
              <Text style={styles.simpleInfoLabel}>To:</Text>
              <Text style={styles.simpleInfoValueStrong}>{clientName}</Text>
            </View>

            <View style={[styles.simpleInfoCell, styles.simpleInfoRight]}>
              <View style={styles.simpleInfoPair}>
                <Text style={styles.simpleInfoPairLabel}>Bill No.</Text>
                <Text style={styles.simpleInfoPairValue}>{safe(invoice.invoice_number) || '-'}</Text>
              </View>
              <View style={[styles.simpleInfoPair, { marginBottom: 0 }]}>
                <Text style={styles.simpleInfoPairLabel}>Date</Text>
                <Text style={styles.simpleInfoPairValue}>{billDate}</Text>
              </View>
            </View>
          </View>

          <View style={styles.simpleTableBox}>
            <View style={styles.simpleTableHead}>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableIndex]}>
                <Text style={styles.simpleTableHeadText}>Sr. No.</Text>
              </View>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableItem]}>
                <Text style={styles.simpleTableHeadText}>Particulars</Text>
              </View>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableQty]}>
                <Text style={styles.simpleTableHeadText}>Qty</Text>
              </View>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableRate]}>
                <Text style={styles.simpleTableHeadText}>Rate</Text>
              </View>
              <View style={[styles.simpleTableCell, styles.simpleTableCellRight, styles.simpleTableAmount]}>
                <Text style={styles.simpleTableHeadText}>Amount</Text>
              </View>
            </View>

            <View style={styles.simpleTableBody}>
              {items.length === 0 ? (
                <View style={[styles.emptyState, styles.simpleTableRowLast]}>
                  <Text style={styles.emptyText}>No line items were added to this bill.</Text>
                </View>
              ) : (
                items.map((item, index) => {
                  const title = safe(item.project_name) || safe(item.narration) || 'Item'
                  const narration = safe(item.narration)
                  const detailNarration = narration && narration !== title ? narration : ''

                  return (
                    <View key={item.id} style={styles.simpleTableRow}>
                      <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableIndex]}>
                        <Text style={styles.simpleTableStrong}>{index + 1}</Text>
                      </View>
                      <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableItem]}>
                        <Text style={styles.simpleTableStrong}>{title}</Text>
                        {detailNarration ? <Text style={styles.simpleTableMuted}>{detailNarration}</Text> : null}
                      </View>
                      <View
                        style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableQty]}
                      >
                        <Text style={styles.simpleTableText}>{formatNumber(item.quantity)}</Text>
                      </View>
                      <View
                        style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableRate]}
                      >
                        <Text style={styles.simpleTableText}>{formatCurrency(item.rate)}</Text>
                      </View>
                      <View style={[styles.simpleTableCell, styles.simpleTableCellRight, styles.simpleTableAmount]}>
                        <Text style={styles.simpleTableText}>{formatCurrency(item.amount)}</Text>
                      </View>
                    </View>
                  )
                })
              )}

              {/* Keep column separators continuing through adjustable space */}
              <View style={styles.simpleTableFill}>
                <View style={[styles.simpleTableIndex, styles.simpleTableFillCell]} />
                <View style={[styles.simpleTableItem, styles.simpleTableFillCell]} />
                <View style={[styles.simpleTableQty, styles.simpleTableFillCell]} />
                <View style={[styles.simpleTableRate, styles.simpleTableFillCell]} />
                <View style={[styles.simpleTableAmount, styles.simpleTableFillCellLast]} />
              </View>
            </View>

            {hasDiscount ? (
              <View style={styles.simpleTableRow}>
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableIndex]} />
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableItem]}>
                  <Text style={styles.simpleFooterLabel}>Subtotal</Text>
                </View>
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableQty]} />
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableRate]} />
                <View style={[styles.simpleTableCell, styles.simpleTableCellRight, styles.simpleTableAmount]}>
                  <Text style={styles.simpleFooterValue}>{formatCurrency(invoice.subtotal)}</Text>
                </View>
              </View>
            ) : null}

            {hasDiscount ? (
              <View style={styles.simpleTableRow}>
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableIndex]} />
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableItem]}>
                  <Text style={styles.simpleFooterLabel}>Discount</Text>
                </View>
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableQty]} />
                <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableRate]} />
                <View style={[styles.simpleTableCell, styles.simpleTableCellRight, styles.simpleTableAmount]}>
                  <Text style={styles.simpleFooterValue}>{formatCurrency(invoice.discount)}</Text>
                </View>
              </View>
            ) : null}

            <View style={[styles.simpleTableRow, styles.simpleTableTotalRow, styles.simpleTableRowLast]}>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableIndex]} />
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableItem]}>
                <Text style={styles.simpleFooterLabel}>{hasDiscount ? 'Grand Total' : 'Total'}</Text>
              </View>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableQty]}>
                <Text style={styles.simpleFooterValue}>{formatNumber(totalQty)}</Text>
              </View>
              <View style={[styles.simpleTableCell, styles.simpleTableCellBorder, styles.simpleTableCellRight, styles.simpleTableRate]} />
              <View style={[styles.simpleTableCell, styles.simpleTableCellRight, styles.simpleTableAmount]}>
                <Text style={styles.simpleFooterValue}>{formatCurrency(invoice.grand_total)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.simpleSignRow}>
            <View style={styles.simpleSignTopRow}>
              <Text style={styles.simpleSignTopText}>for, {SELLER.name}</Text>
            </View>
            <View style={styles.simpleSignBottomRow}>
              <Text style={styles.simpleSignReceived}>Received by :</Text>
              <Text style={styles.simpleSignText}>Authorised Signatory</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function GstSummaryRows({ invoice }: { invoice: Invoice }) {
  const rows: Array<{ label: string; value: string; grand?: boolean; emphasizeValue?: boolean }> = [
    { label: 'Subtotal', value: formatCurrency(invoice.subtotal), emphasizeValue: true },
  ]

  if (Number(invoice.discount ?? 0) > 0) {
    rows.push({ label: 'Discount', value: formatCurrency(invoice.discount) })
  }

  if (invoice.gst_tax_type === 'cgst_sgst') {
    rows.push({ label: `CGST (${invoice.cgst_rate}%)`, value: formatCurrency(invoice.cgst_amount), emphasizeValue: true })
    rows.push({ label: `SGST (${invoice.sgst_rate}%)`, value: formatCurrency(invoice.sgst_amount), emphasizeValue: true })
  } else if (invoice.gst_tax_type === 'igst') {
    rows.push({ label: `IGST (${invoice.igst_rate}%)`, value: formatCurrency(invoice.igst_amount), emphasizeValue: true })
  }

  rows.push({ label: 'Grand Total', value: formatCurrency(invoice.grand_total), grand: true })

  return (
    <View>
      {rows.map((row) => (
        <View key={row.label} style={styles.gstSummaryRow}>
          <Text style={row.grand ? styles.gstGrandLabel : styles.gstSummaryLabel}>{row.label}</Text>
          <Text
            style={
              row.grand
                ? styles.gstGrandValue
                : row.emphasizeValue
                  ? styles.gstSummaryValueBold
                  : styles.gstSummaryValue
            }
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
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
