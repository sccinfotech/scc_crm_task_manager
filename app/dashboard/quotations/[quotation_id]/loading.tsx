import Link from 'next/link'

/** Lightweight skeleton—no client components (Header/NotificationsBell) for instant paint. */
export default function QuotationDetailLoading() {
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex h-full items-center px-4 lg:px-6">
          <div className="flex items-center gap-2 text-sm">
            <Link
              href="/dashboard/quotations"
              className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
            >
              Quotations
            </Link>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="h-5 w-28 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden px-2 sm:px-3 lg:px-4 pt-2 lg:pt-3 pb-2">
        <div className="flex flex-col h-full rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-7 w-16 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-16 rounded-lg bg-gray-200 animate-pulse" />
              <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
            </div>
          </div>
          <div className="border-b border-slate-200 flex">
            <div className="h-12 w-24 rounded-t-lg bg-gray-100 animate-pulse mx-2 mt-2" />
            <div className="h-12 w-28 rounded-t-lg bg-gray-200 animate-pulse mx-2 mt-2" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="h-14 rounded-xl bg-gray-50 animate-pulse" />
                <div className="h-14 rounded-xl bg-gray-50 animate-pulse" />
                <div className="h-14 rounded-xl bg-gray-50 animate-pulse" />
              </div>
              <div className="h-20 rounded-xl border border-slate-100 bg-slate-50/50 animate-pulse" />
              <div className="h-32 rounded-xl border border-slate-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
