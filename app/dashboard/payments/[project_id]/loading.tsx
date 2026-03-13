import Link from 'next/link'

export default function PaymentDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex h-full items-center px-4 lg:px-6">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard/payments"
              className="font-medium text-[#06B6D4] hover:underline transition-colors"
            >
              Payments
            </Link>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="h-5 w-36 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden px-2.5 pt-2 pb-2 sm:px-3 lg:px-4">
        <div className="flex h-full flex-col gap-6 animate-pulse">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-12 w-12 rounded-xl bg-gray-200" />
            <div className="space-y-2">
              <div className="h-6 w-48 rounded bg-gray-200" />
              <div className="h-4 w-32 rounded bg-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="h-3 w-24 rounded bg-gray-100 mb-2" />
                <div className="h-7 w-20 rounded bg-gray-200" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex-1 min-h-0">
            <div className="h-4 w-28 rounded bg-gray-200 mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
