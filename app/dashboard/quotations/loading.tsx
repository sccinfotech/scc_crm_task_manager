export default function QuotationsLoading() {
  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
        <div className="border-b border-gray-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="h-10 flex-1 max-w-xs animate-pulse rounded-lg bg-gray-200" />
            <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
            <div className="flex gap-2">
              <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
              <div className="h-10 w-28 animate-pulse rounded-lg bg-gray-200" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Quotation #</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Source</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Lead / Client</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Technology & Tools</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Estimated Total</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Status</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Valid Till</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Created</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-16 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-28 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-32 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-20 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-6 w-20 rounded-full bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right"><div className="ml-auto h-8 w-16 rounded bg-gray-200" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
