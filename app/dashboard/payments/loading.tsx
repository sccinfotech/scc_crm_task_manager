export default function PaymentsLoading() {
  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Project</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Client</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Total Amount</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Pending</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Received</th>
              <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-36 rounded bg-gray-200" /></td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right"><div className="ml-auto h-4 w-20 rounded bg-gray-200 inline-block" /></td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right"><div className="ml-auto h-4 w-16 rounded bg-gray-200 inline-block" /></td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right"><div className="ml-auto h-4 w-16 rounded bg-gray-200 inline-block" /></td>
                <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right"><div className="ml-auto h-9 w-9 rounded-lg bg-gray-200 inline-block" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
