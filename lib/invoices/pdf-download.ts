function getFilenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback
  const match = disposition.match(/filename="?([^"]+)"?/)
  return match?.[1] || fallback
}

export async function downloadInvoicePdf(invoiceId: string, fallbackFilename = 'invoice.pdf') {
  if (typeof window === 'undefined') return

  const response = await fetch(`/api/invoices/${invoiceId}/pdf`, {
    method: 'GET',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error('Failed to download invoice PDF')
  }

  const blob = await response.blob()
  const filename = getFilenameFromDisposition(response.headers.get('content-disposition'), fallbackFilename)
  const objectUrl = URL.createObjectURL(blob)

  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
