export default function LogsLoading() {
  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
          <div className="h-7 w-36 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-10 w-36 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-3 sm:px-4 py-3 sm:py-3 lg:px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-3 sm:gap-4">
              <div className="h-20 w-28 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 w-28 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 w-40 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 w-36 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 w-40 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 w-28 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 w-44 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-20 min-w-[180px] flex-1 max-w-xs animate-pulse rounded-lg bg-gray-200" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-16 animate-pulse rounded-xl bg-gray-200" />
              <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">Date & Time</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">User Name</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">Action Type</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">Module Name</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">Description</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">Status</th>
                <th className="border-b border-slate-200 px-3 py-3 font-semibold text-slate-700 sm:px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="whitespace-nowrap px-3 py-3 sm:px-4"><div className="h-4 w-28 rounded bg-gray-200" /></td>
                  <td className="px-3 py-3 sm:px-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="px-3 py-3 sm:px-4"><div className="h-4 w-20 rounded bg-gray-200" /></td>
                  <td className="px-3 py-3 sm:px-4"><div className="h-4 w-28 rounded bg-gray-200" /></td>
                  <td className="max-w-[240px] px-3 py-3 sm:px-4"><div className="h-4 w-full rounded bg-gray-200" /></td>
                  <td className="px-3 sm:px-4 py-3"><div className="h-6 w-16 rounded-full bg-gray-200" /></td>
                  <td className="px-3 sm:px-4 py-3"><div className="h-4 w-20 rounded bg-gray-200" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-2">
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  )
}
