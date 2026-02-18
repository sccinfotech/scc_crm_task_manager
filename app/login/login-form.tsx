'use client'

import { useActionState } from 'react'
import { login } from '@/lib/auth/actions'
import { EMAIL_INPUT_PATTERN, EMAIL_VALIDATION_MESSAGE } from '@/lib/validation/email'

export function LoginForm({ error: initialError }: { error?: string }) {
  const [state, formAction] = useActionState(login, { error: initialError || null })

  return (
    <form action={formAction} className="space-y-5">
      {/* Error Message */}
      {state?.error && (
        <div className="rounded-xl bg-red-50 border border-red-200/60 p-4 shadow-sm animate-fade-in-stagger" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-start">
            <svg
              className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-red-800 leading-relaxed">{state.error}</p>
          </div>
        </div>
      )}

      {/* Email Input */}
      <div className="animate-fade-in-stagger-delay" style={{ animationDelay: '0.6s' }}>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-[#1E1B4B] mb-2.5"
        >
          Email address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400 transition-colors duration-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <input
            id="email"
            name="email"
            type="email"
            pattern={EMAIL_INPUT_PATTERN}
            title={EMAIL_VALIDATION_MESSAGE}
            autoComplete="email"
            required
            className="block w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 py-3.5 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 focus:shadow-[0_0_0_4px_rgba(6,182,212,0.1)] sm:text-sm"
            placeholder="Enter your email"
          />
        </div>
      </div>

      {/* Password Input */}
      <div className="animate-fade-in-stagger-delay" style={{ animationDelay: '0.7s' }}>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-[#1E1B4B] mb-2.5"
        >
          Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400 transition-colors duration-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="block w-full rounded-xl border border-gray-200 bg-white pl-12 pr-4 py-3.5 text-[#1E1B4B] placeholder-gray-400 shadow-sm transition-all duration-200 focus:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-opacity-20 focus:shadow-[0_0_0_4px_rgba(6,182,212,0.1)] sm:text-sm"
            placeholder="Enter your password"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2 animate-fade-in-stagger-delay" style={{ animationDelay: '0.8s' }}>
        <button
          type="submit"
          className="btn-gradient-smooth w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#06B6D4]/25 transition-all duration-200 hover:shadow-xl hover:shadow-[#06B6D4]/30 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 active:translate-y-0 active:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          Sign In
        </button>
      </div>
    </form>
  )
}
