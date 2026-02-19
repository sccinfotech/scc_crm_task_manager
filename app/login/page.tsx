import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>
}) {
  const params = await searchParams
  
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Background Abstract Shapes - Cyan and Light Purple Mix */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Highlighted circle - centered behind login card */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[#06B6D4] opacity-[0.15] md:h-[700px] md:w-[700px] md:opacity-[0.12]" />

        {/* Large circles - random positions */}
        <div className="absolute left-[10%] top-[15%] h-[450px] w-[450px] rounded-full bg-[#06B6D4] opacity-[0.08] md:h-[550px] md:w-[550px] md:opacity-[0.06]" />
        <div className="absolute right-[8%] bottom-[20%] h-[400px] w-[400px] rounded-full bg-[#A78BFA] opacity-[0.1] md:h-[500px] md:w-[500px] md:opacity-[0.08]" />

        {/* Medium circles - random positions */}
        <div className="absolute right-[25%] top-[30%] h-[300px] w-[300px] rounded-full bg-[#A78BFA] opacity-[0.1] md:h-[380px] md:w-[380px] md:opacity-[0.08]" />
        <div className="absolute left-[20%] bottom-[25%] h-[280px] w-[280px] rounded-full bg-[#22D3EE] opacity-[0.08] md:h-[350px] md:w-[350px] md:opacity-[0.06]" />

        {/* Small circles - random positions */}
        <div className="absolute left-[65%] top-[20%] h-[180px] w-[180px] rounded-full bg-[#C4B5FD] opacity-[0.1] md:h-[220px] md:w-[220px] md:opacity-[0.08]" />
        <div className="absolute right-[15%] top-[70%] h-[160px] w-[160px] rounded-full bg-[#0891b2] opacity-[0.09] md:h-[200px] md:w-[200px] md:opacity-[0.07]" />

        {/* Left side light purple circles */}
        <div className="absolute left-[5%] top-[40%] h-[200px] w-[200px] rounded-full bg-[#C4B5FD] opacity-[0.1] md:h-[240px] md:w-[240px] md:opacity-[0.08]" />
        <div className="absolute left-[8%] top-[60%] h-[140px] w-[140px] rounded-full bg-[#A78BFA] opacity-[0.11] md:h-[170px] md:w-[170px] md:opacity-[0.09]" />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] animate-slide-up-fade">
        <div className="rounded-2xl bg-white border border-purple-50/50 p-8 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(167,139,250,0.05)] sm:p-10 md:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.1),0_0_0_1px_rgba(167,139,250,0.08)]">
          {/* Header Section */}
          <div className="mb-10 text-center">
            {/* Logo/Icon Placeholder */}
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#7C3AED] shadow-lg shadow-[#06B6D4]/20 animate-logo-scale">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>

            {/* App Name */}
            <h1 className="mb-3 text-3xl font-bold text-[#1E1B4B] tracking-tight animate-fade-in-stagger-delay" style={{ animationDelay: '0.3s' }}>
              CRM Pro
            </h1>

            {/* Title */}
            <h2 className="mb-2 text-xl font-semibold tracking-tight text-[#1E1B4B] animate-fade-in-stagger-delay" style={{ animationDelay: '0.4s' }}>
              Welcome Back
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-gray-500 leading-relaxed animate-fade-in-stagger-delay" style={{ animationDelay: '0.5s' }}>
              Sign in to continue to your dashboard
            </p>
          </div>

          {/* Login Form */}
          <LoginForm error={params.error} />
        </div>
      </div>
    </div>
  )
}

