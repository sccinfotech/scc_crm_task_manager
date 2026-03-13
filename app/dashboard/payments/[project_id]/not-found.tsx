import Link from 'next/link'

export default function PaymentProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-4">
      <h1 className="text-xl font-semibold text-[#1E1B4B]">Project not found</h1>
      <p className="mt-2 text-sm text-slate-600">This project may not exist or does not have requirements.</p>
      <Link
        href="/dashboard/payments"
        className="mt-4 text-sm font-medium text-[#06B6D4] hover:underline"
      >
        Back to Payments
      </Link>
    </div>
  )
}
