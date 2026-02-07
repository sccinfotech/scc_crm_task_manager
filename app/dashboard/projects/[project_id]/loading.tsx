export default function ProjectDetailLoading() {
  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
              <div className="border-b border-gray-100 p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-5">
                    <div className="h-20 w-20 rounded-2xl bg-gray-200 animate-pulse" />
                    <div className="flex flex-col gap-2.5 flex-1">
                      <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
                      <div className="h-6 w-24 rounded-full bg-gray-200 animate-pulse" />
                      <div className="flex gap-2">
                        <div className="h-6 w-24 rounded-full bg-gray-100 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50/30 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
                      <div className="h-12 w-12 rounded-xl bg-gray-200 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                        <div className="h-5 w-32 rounded bg-gray-200 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="h-4 w-40 rounded bg-gray-200 animate-pulse mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
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
