import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getQuotation, getQuotationRequirements } from '@/lib/quotations/actions'
import { QuotationPdfDocument, getQuotationPdfFilename } from '@/lib/quotations/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ quotation_id: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  const { quotation_id } = await params

  // Build absolute origin so react-pdf can reliably fetch public assets on Vercel.
  const headers = request.headers
  const forwardedProto = headers.get('x-forwarded-proto')
  const forwardedHost = headers.get('x-forwarded-host')
  const host = forwardedHost ?? headers.get('host') ?? 'localhost:3000'
  const protocol = forwardedProto ?? 'https'
  const origin = `${protocol}://${host}`

  const [quotationResult, requirementsResult] = await Promise.all([
    getQuotation(quotation_id),
    getQuotationRequirements(quotation_id),
  ])

  if (quotationResult.error || !quotationResult.data) {
    return NextResponse.json(
      { error: quotationResult.error ?? 'Quotation not found' },
      { status: quotationResult.error === 'No permission' ? 403 : 404 }
    )
  }

  if (requirementsResult.error) {
    return NextResponse.json(
      { error: requirementsResult.error },
      { status: requirementsResult.error === 'No permission' ? 403 : 500 }
    )
  }

  const pdfBuffer = await renderToBuffer(
    QuotationPdfDocument({
      quotation: quotationResult.data,
      requirements: requirementsResult.data,
      subtotal: requirementsResult.subtotal,
      discount: requirementsResult.discount,
      finalTotal: requirementsResult.final_total,
      headerImageSrc: `${origin}/scc_header.png`,
      footerImageSrc: `${origin}/scc_footer.png`,
    })
  )

  const pdfBytes = new Uint8Array(pdfBuffer)

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${getQuotationPdfFilename(quotationResult.data)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}
