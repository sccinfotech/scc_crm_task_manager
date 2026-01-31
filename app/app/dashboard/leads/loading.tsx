export default function LeadsLoading() {
  return (
    <>
      {/* Page Header Skeleton */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200"></div>
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-200"></div>
        </div>
        <div className="mt-4 sm:mt-0"></div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                  Lead Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#1E1B4B]">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="h-4 w-32 rounded bg-gray-200"></div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="h-4 w-24 rounded bg-gray-200"></div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="h-4 w-28 rounded bg-gray-200"></div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="h-4 w-40 rounded bg-gray-200"></div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="h-6 w-20 rounded-full bg-gray-200"></div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4">
                    <div className="h-4 w-24 rounded bg-gray-200"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

