import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { getInvoice } from '@/lib/invoices/actions'
import { InvoicePdfDocument, getInvoicePdfFilename } from '@/lib/invoices/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ invoice_id: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { invoice_id } = await params

  const headers = request.headers
  const forwardedProto = headers.get('x-forwarded-proto')
  const forwardedHost = headers.get('x-forwarded-host')
  const host = forwardedHost ?? headers.get('host') ?? 'localhost:3000'
  const protocol = forwardedProto ?? 'https'
  const origin = `${protocol}://${host}`

  const invoiceResult = await getInvoice(invoice_id)

  if (invoiceResult.error || !invoiceResult.data) {
    return NextResponse.json(
      { error: invoiceResult.error ?? 'Invoice not found' },
      { status: invoiceResult.error === 'You do not have permission to view invoices' ? 403 : 404 }
    )
  }

  let qrPngDataUrl: string | undefined
  if (invoiceResult.data.invoice_type === 'gst') {
    const amount = Number(invoiceResult.data.grand_total ?? 0)
    const am = Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
    const upi = `upi://pay?pa=scc.infotech86@kotak&pn=SCC%20INFOTECH&mc=0000&mode=02&purpose=00&am=${encodeURIComponent(am)}&cu=INR&orgId=400043`
    qrPngDataUrl = await QRCode.toDataURL(upi, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 180,
      type: 'image/png',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
  }

  const pdfBuffer = await renderToBuffer(
    InvoicePdfDocument({
      invoice: invoiceResult.data,
      logoSrc: `${origin}/scc_logo.png`,
      qrSrc: qrPngDataUrl,
    })
  )

  const pdfBytes = new Uint8Array(pdfBuffer)

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${getInvoicePdfFilename(invoiceResult.data)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}
