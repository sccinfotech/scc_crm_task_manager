"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoicePdfFilename = getInvoicePdfFilename;
exports.InvoicePdfDocument = InvoicePdfDocument;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importDefault(require("react"));
const renderer_1 = require("@react-pdf/renderer");
const SELLER = {
    name: 'SCC INFOTECH',
    addressLines: [
        '349-350, Vikas Shoppers, B/H Filter House Bhagvan Nagar',
        'Circle, near Sarthana Jakat Naka, Surat, Gujarat 395006',
    ],
    phone: '9974361416',
    email: 'sccinfotechllp@gmail.com',
    gstin: '24BTQPD0442K1ZR',
};
const BANK = {
    name: 'Kotak Mahindra Bank',
    accountNo: '9974361416',
    ifsc: 'KKBK0002862',
};
const LOGO_FS = `${process.cwd()}/public/scc_logo.png`;
const palette = {
    ink: '#0f172a',
    muted: '#475569',
    faint: '#e2e8f0',
    head: '#f1f5f9',
    accent: '#0369a1',
};
const styles = renderer_1.StyleSheet.create({
    page: {
        paddingTop: 24,
        paddingBottom: 24,
        paddingHorizontal: 24,
        backgroundColor: '#ffffff',
        color: palette.ink,
        fontSize: 9,
        fontFamily: 'Helvetica',
        lineHeight: 1.4,
    },
    sheet: {
        borderWidth: 1,
        borderColor: '#000000',
        backgroundColor: '#ffffff',
    },
    section: {
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    sectionDivider: {
        borderTopWidth: 1,
        borderTopColor: '#000000',
    },
    row: {
        flexDirection: 'row',
    },
    companyLeft: {
        flex: 1,
        paddingRight: 12,
    },
    companyRight: {
        width: 215,
        borderLeftWidth: 1,
        borderLeftColor: '#000000',
        paddingLeft: 12,
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
        fontFamily: 'Helvetica-Bold',
        color: palette.ink,
        marginBottom: 6,
    },
    companyLine: {
        fontSize: 8.8,
        color: palette.muted,
        marginBottom: 2,
    },
    boxTitle: {
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
        color: palette.ink,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 6,
    },
    labelValueRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    label: {
        width: 70,
        fontSize: 8,
        fontFamily: 'Helvetica-Bold',
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
        paddingRight: 12,
    },
    detailRight: {
        width: 215,
        borderLeftWidth: 1,
        borderLeftColor: '#000000',
        paddingLeft: 12,
    },
    billToName: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
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
        fontFamily: 'Helvetica-Bold',
        color: palette.ink,
        textAlign: 'right',
        flex: 1,
    },
    tableWrap: {
        overflow: 'hidden',
    },
    tableHead: {
        flexDirection: 'row',
        backgroundColor: palette.head,
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingVertical: 6,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#000000',
        paddingVertical: 7,
        alignItems: 'flex-start',
    },
    tableRowLast: {
        borderBottomWidth: 0,
    },
    cell: {
        paddingHorizontal: 6,
    },
    cellR: {
        borderRightWidth: 1,
        borderRightColor: '#000000',
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
        fontFamily: 'Helvetica-Bold',
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
        fontFamily: 'Helvetica-Bold',
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
        paddingRight: 12,
    },
    bottomRight: {
        width: 230,
        borderLeftWidth: 1,
        borderLeftColor: '#000000',
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
        borderWidth: 1,
        borderColor: '#000000',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    qrLabel: {
        fontSize: 7.2,
        color: palette.muted,
        marginBottom: 4,
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
        fontFamily: 'Helvetica-Bold',
        color: palette.ink,
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
        fontFamily: 'Helvetica-Bold',
        color: palette.accent,
    },
    grandValue: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: palette.accent,
    },
    wordsText: {
        fontSize: 9.4,
        fontFamily: 'Helvetica-Bold',
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
        fontFamily: 'Helvetica-Bold',
        color: palette.ink,
    },
});
function formatCurrency(value) {
    if (value == null || Number.isNaN(value))
        return 'Rs. 0.00';
    const formatted = new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
    return `Rs. ${formatted}`;
}
function formatDate(value) {
    if (!value)
        return '-';
    const plainDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (plainDateMatch) {
        const [, yearText, monthText, dayText] = plainDateMatch;
        const year = Number(yearText);
        const month = Number(monthText);
        const day = Number(dayText);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString('en-IN', {
            timeZone: 'UTC',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
        });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '-';
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    });
}
function sanitizePdfText(text) {
    if (!text)
        return '';
    return text
        .replace(/\r\n?/g, '\n')
        .replace(/[^\x00-\x7F\n]/g, (ch) => (ch === '₹' ? 'Rs.' : '-'));
}
function safe(value) {
    return sanitizePdfText(value).trim();
}
function toWords0to99(n) {
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
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (n < 20)
        return ones[n];
    const t = Math.floor(n / 10);
    const r = n % 10;
    return r ? `${tens[t]} ${ones[r]}` : tens[t];
}
function toWordsIndian(n) {
    const num = Math.floor(Math.abs(n));
    if (!Number.isFinite(num) || num === 0)
        return 'Zero';
    const parts = [];
    const push = (value, label) => {
        if (value > 0)
            parts.push(`${toWordsIndian(value)} ${label}`.trim());
    };
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const hundred = Math.floor((num % 1000) / 100);
    const rest = num % 100;
    push(crore, 'Crore');
    push(lakh, 'Lakh');
    push(thousand, 'Thousand');
    if (hundred)
        parts.push(`${toWords0to99(hundred)} Hundred`);
    if (rest)
        parts.push(toWords0to99(rest));
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}
function formatAmountInWords(amount) {
    const rounded = Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
    let rupees = Math.floor(rounded);
    let paise = Math.round((rounded - rupees) * 100);
    if (paise === 100) {
        rupees += 1;
        paise = 0;
    }
    const rupeeWords = toWordsIndian(rupees);
    const paiseWords = paise > 0 ? ` and ${toWords0to99(paise)} Paise` : '';
    return sanitizePdfText(`Rupees ${rupeeWords}${paiseWords} Only`);
}
function formatNumber(n) {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(n);
}
function getInvoiceHeading() {
    return 'Invoice detail';
}
function clientPrimaryName(invoice) {
    return safe(invoice.client?.name) || safe(invoice.client?.company_name) || 'Client';
}
function clientSecondaryName(invoice) {
    const name = safe(invoice.client?.name);
    const company = safe(invoice.client?.company_name);
    if (!company || company === name)
        return '';
    return company;
}
function getInvoicePdfFilename(invoice) {
    const clean = (value) => (value ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^A-Za-z0-9()\-\ ]+/g, '_');
    const client = invoice.client?.company_name || invoice.client?.name || 'Client';
    const number = clean(invoice.invoice_number) || 'invoice';
    const kind = invoice.invoice_type === 'gst' ? 'GST' : 'NonGST';
    return `${clean(client)}_${number}_${kind}.pdf`;
}
function LabelValue({ label, value, strongValue = false }) {
    return ((0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.labelValueRow, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.label, children: label }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: strongValue ? styles.detailValueStrong : styles.value, children: value })] }));
}
function SummaryLine({ label, value }) {
    return ((0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.summaryRow, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.summaryLabel, children: label }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.summaryValue, children: value })] }));
}
function particularsLabel(item) {
    return safe(item.project_name) || 'Services';
}
function InvoicePdfDocument({ invoice, logoSrc, qrSrc }) {
    const isGst = invoice.invoice_type === 'gst';
    const logo = logoSrc ?? LOGO_FS;
    const items = invoice.items ?? [];
    const client = invoice.client;
    const terms = sanitizePdfText(invoice.terms_and_conditions ?? '').trim();
    const amountWords = formatAmountInWords(Number(invoice.grand_total ?? 0));
    return ((0, jsx_runtime_1.jsx)(renderer_1.Document, { title: `${invoice.invoice_number} Invoice`, author: SELLER.name, subject: getInvoiceHeading(), children: (0, jsx_runtime_1.jsx)(renderer_1.Page, { size: "A4", style: styles.page, children: (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.sheet, children: [(0, jsx_runtime_1.jsxs)(renderer_1.View, { style: [styles.section, styles.row], children: [(0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.companyLeft, children: (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.logoRow, children: [(0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.logoWrap, children: (0, jsx_runtime_1.jsx)(renderer_1.Image, { src: logo, style: styles.logo }) }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.companyCopy, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.companyName, children: SELLER.name }), SELLER.addressLines.map((line) => ((0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.companyLine, children: line }, line)))] })] }) }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.companyRight, children: [(0, jsx_runtime_1.jsx)(LabelValue, { label: "Mob No.", value: SELLER.phone }), (0, jsx_runtime_1.jsx)(LabelValue, { label: "Email", value: SELLER.email }), isGst ? (0, jsx_runtime_1.jsx)(LabelValue, { label: "GSTIN", value: SELLER.gstin }) : null] })] }), (0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.sectionDivider }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: [styles.section, styles.row], children: [(0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.detailLeft, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.boxTitle, children: "Bill to" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.billToName, children: clientPrimaryName(invoice) }), clientSecondaryName(invoice) ? (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.billToCompany, children: clientSecondaryName(invoice) }) : null, client?.phone?.trim() ? (0, jsx_runtime_1.jsxs)(renderer_1.Text, { style: styles.billToLine, children: ["Mob No.: ", safe(client.phone)] }) : null, client?.email?.trim() ? (0, jsx_runtime_1.jsxs)(renderer_1.Text, { style: styles.billToLine, children: ["Email: ", safe(client.email)] }) : null, isGst && client?.gst_number?.trim() ? ((0, jsx_runtime_1.jsxs)(renderer_1.Text, { style: styles.billToLine, children: ["GSTIN: ", safe(client.gst_number)] })) : null] }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.detailRight, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.boxTitle, children: getInvoiceHeading() }), (0, jsx_runtime_1.jsx)(LabelValue, { label: "Invoice No.", value: safe(invoice.invoice_number) || '-', strongValue: true }), (0, jsx_runtime_1.jsx)(LabelValue, { label: "Date", value: formatDate(invoice.invoice_date), strongValue: true })] })] }), (0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.sectionDivider }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.tableWrap, children: [(0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.tableHead, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.th, styles.cell, styles.cellR, styles.idx], children: "Sl" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.th, styles.cell, styles.cellR, isGst ? styles.descGst : styles.descNonGst], children: "Description" }), isGst ? (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.th, styles.cell, styles.cellR, styles.hsn], children: "HSN/SAC" }) : null, (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.th, styles.cell, styles.cellR, styles.qty], children: "Qty" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.th, styles.cell, styles.cellR, styles.rate], children: "Rate" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.th, styles.cell, styles.amount], children: "Amount" })] }), items.length === 0 ? ((0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.emptyState, children: (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.emptyText, children: "No line items were added to this invoice." }) })) : (items.map((item, index) => {
                                const last = index === items.length - 1;
                                const narration = safe(item.narration);
                                return ((0, jsx_runtime_1.jsxs)(renderer_1.View, { style: last ? [styles.tableRow, styles.tableRowLast] : styles.tableRow, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.tdStrong, styles.cell, styles.cellR, styles.idx], children: index + 1 }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: [styles.cell, styles.cellR, isGst ? styles.descGst : styles.descNonGst], children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.tdStrong, children: particularsLabel(item) }), narration ? (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.tdMuted, children: narration }) : null] }), isGst ? ((0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.td, styles.cell, styles.cellR, styles.hsn], children: safe(item.hsn_code?.code) || '-' })) : null, (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.tdStrong, styles.cell, styles.cellR, styles.qty], children: formatNumber(item.quantity) }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.tdStrong, styles.cell, styles.cellR, styles.rate], children: formatCurrency(item.rate) }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: [styles.tdStrong, styles.cell, styles.amount], children: formatCurrency(item.amount) })] }, item.id));
                            }))] }), (0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.sectionDivider }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: [styles.section, styles.row], wrap: false, children: [(0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.bottomLeft, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.boxTitle, children: "Bank details" }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.bankBody, children: [(0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.bankInfo, children: [(0, jsx_runtime_1.jsx)(LabelValue, { label: "Bank Name", value: BANK.name }), (0, jsx_runtime_1.jsx)(LabelValue, { label: "A/c No.", value: BANK.accountNo }), (0, jsx_runtime_1.jsx)(LabelValue, { label: "IFSC", value: BANK.ifsc })] }), qrSrc ? ((0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.qrBox, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.qrLabel, children: "Scan to pay" }), (0, jsx_runtime_1.jsx)(renderer_1.Image, { src: qrSrc, style: styles.qrImg })] })) : null] })] }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.bottomRight, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.boxTitle, children: "Bill summary" }), (0, jsx_runtime_1.jsx)(SummaryLine, { label: "Subtotal", value: formatCurrency(invoice.subtotal) }), (0, jsx_runtime_1.jsx)(SummaryLine, { label: "Discount", value: formatCurrency(invoice.discount) }), taxRows(invoice), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.grandRow, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.grandLabel, children: "Grand Total" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.grandValue, children: formatCurrency(invoice.grand_total) })] })] })] }), (0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.sectionDivider }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.section, wrap: false, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.boxTitle, children: "Amount in words" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.wordsText, children: amountWords })] }), terms ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.sectionDivider }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.section, wrap: false, children: [(0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.boxTitle, children: "Terms & conditions" }), (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.termsText, children: terms })] })] })) : null, (0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.sectionDivider }), (0, jsx_runtime_1.jsxs)(renderer_1.View, { style: styles.signatureSection, wrap: false, children: [(0, jsx_runtime_1.jsxs)(renderer_1.Text, { style: styles.signatureLead, children: ["For ", SELLER.name] }), (0, jsx_runtime_1.jsx)(renderer_1.View, { style: styles.signatureLine, children: (0, jsx_runtime_1.jsx)(renderer_1.Text, { style: styles.signatureText, children: "Authorised Signatory" }) })] })] }) }) }));
}
function taxRows(invoice) {
    if (invoice.invoice_type !== 'gst' || invoice.gst_tax_type === 'none') {
        return null;
    }
    if (invoice.gst_tax_type === 'cgst_sgst') {
        return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(SummaryLine, { label: `CGST (${invoice.cgst_rate}%)`, value: formatCurrency(invoice.cgst_amount) }), (0, jsx_runtime_1.jsx)(SummaryLine, { label: `SGST (${invoice.sgst_rate}%)`, value: formatCurrency(invoice.sgst_amount) })] }));
    }
    if (invoice.gst_tax_type === 'igst') {
        return (0, jsx_runtime_1.jsx)(SummaryLine, { label: `IGST (${invoice.igst_rate}%)`, value: formatCurrency(invoice.igst_amount) });
    }
    return null;
}
