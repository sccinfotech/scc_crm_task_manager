/** Lightweight skeleton shown while dashboard layout/children load. Kept minimal for instant paint. */
export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  )
}
