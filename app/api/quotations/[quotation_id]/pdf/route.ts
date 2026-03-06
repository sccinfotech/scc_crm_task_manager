import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getQuotation, getQuotationRequirements } from '@/lib/quotations/actions'
import { QuotationPdfDocument, getQuotationPdfFilename } from '@/lib/quotations/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ quotation_id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { quotation_id } = await params

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
    })
  )

  const pdfBytes = new Uint8Array(pdfBuffer)

  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${getQuotationPdfFilename(quotationResult.data.quotation_number)}"`,
      'Cache-Control': 'private, no-store, max-age=0',
    },
  })
}
