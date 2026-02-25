export default function SettingsLoading() {
  return (
    <div className="flex h-full flex-col p-2 sm:p-3 lg:p-4">
      <section className="flex-1 flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded bg-gray-200" />
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" />
            <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-xl bg-transparent flex flex-col">
          <div className="h-full w-full overflow-y-auto p-2 sm:p-3 lg:p-4 bg-slate-50/20">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl border border-white/40 bg-white/70 px-5 py-3 shadow-sm"
                >
                  <div className="flex-1 pr-3">
                    <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                    <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-200" />
                    <div className="h-8 w-8 animate-pulse rounded-xl bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
