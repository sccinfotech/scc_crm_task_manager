import { Header } from '@/app/components/dashboard/header'
import Link from 'next/link'

export default function ClientDetailLoading() {
  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href="/dashboard/clients"
        className="font-medium text-[#06B6D4] hover:text-[#0891b2] hover:underline transition-colors"
      >
        Clients
      </Link>
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
      <span className="h-5 w-36 animate-pulse rounded bg-gray-200" />
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      <Header pageTitle="Client Details" breadcrumb={breadcrumb} />
      <div className="flex-1 overflow-hidden px-2 sm:px-3 lg:px-4 pt-2 lg:pt-3 pb-2">
        <div className="flex h-full flex-col lg:flex-row gap-4">
          {/* Left column skeleton */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-gray-100 p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-5">
                    <div className="h-20 w-20 rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="flex flex-col gap-2.5 flex-1">
                      <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
                      <div className="h-6 w-20 rounded-full bg-gray-200 animate-pulse" />
                      <div className="flex gap-2">
                        <div className="h-6 w-24 rounded-full bg-gray-100 animate-pulse" />
                        <div className="h-6 w-28 rounded-full bg-gray-100 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50/30 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
                    <div className="h-12 w-12 rounded-xl bg-gray-200 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                      <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
                    <div className="h-12 w-12 rounded-xl bg-gray-200 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
                      <div className="h-5 w-40 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="h-4 w-32 rounded bg-gray-200 animate-pulse mb-6" />
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-slate-100">
                    <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-full rounded bg-gray-200 animate-pulse" />
                      <div className="h-3 w-3/4 rounded bg-gray-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Right column skeleton */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 flex-1">
              <div className="h-5 w-40 rounded bg-gray-200 animate-pulse mb-4" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
