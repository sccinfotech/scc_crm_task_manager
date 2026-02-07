export default function ProjectsLoading() {
  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
      </div>
      <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-10 flex-1 max-w-xs animate-pulse rounded-lg bg-gray-200" />
            <div className="h-10 w-52 animate-pulse rounded-lg bg-gray-200" />
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Project</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Client</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Status</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Start</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Expected End</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[...Array(20)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="whitespace-nowrap px-4 sm:px-6 py-4"><div className="h-4 w-32 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-4 sm:px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-4 sm:px-6 py-4"><div className="h-6 w-20 rounded-full bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-4 sm:px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-4 sm:px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-4 sm:px-6 py-4 text-right"><div className="ml-auto h-8 w-24 rounded bg-gray-200" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
