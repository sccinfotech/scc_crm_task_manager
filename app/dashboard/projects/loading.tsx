export default function ProjectsLoading() {
  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-8 w-28 animate-pulse rounded bg-gray-200" />
        <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
      </div>
      <div className="flex-1 overflow-hidden rounded-lg bg-white shadow-sm flex flex-col">
        <div className="border-b border-gray-200 bg-white px-4 py-2.5">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex min-w-max items-center gap-2">
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-12 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
              <div className="ml-3 h-8 w-48 animate-pulse rounded-md bg-gray-200" />
              <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
              <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
              <div className="h-8 w-8 animate-pulse rounded-md bg-gray-200" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Project</th>
                <th className="hidden sm:table-cell px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Client</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Status</th>
                <th className="hidden md:table-cell px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Client Deadline</th>
                <th className="hidden lg:table-cell px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Follow-up</th>
                <th className="hidden xl:table-cell px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Created</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Work</th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-36 rounded bg-gray-200" /></td>
                  <td className="hidden sm:table-cell whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-6 w-20 rounded-full bg-gray-200" /></td>
                  <td className="hidden md:table-cell whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="hidden lg:table-cell whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="hidden xl:table-cell whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4"><div className="h-8 w-20 rounded bg-gray-200" /></td>
                  <td className="whitespace-nowrap px-3 sm:px-4 py-4 text-right"><div className="ml-auto h-8 w-24 rounded bg-gray-200" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
