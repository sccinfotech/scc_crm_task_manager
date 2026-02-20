'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/toast-context'

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  inactive: 'Your account is inactive. Please contact Admin or HR Team to access your account.',
  deleted: 'Your account has been deleted. Please contact Admin or HR Team.',
  not_allowed: 'Only pre-added company users can access this system.',
  oauth_failed: 'Google sign-in failed. Please try again.',
  callback_error: 'Login verification failed. Please try again.',
}

type LoginFormProps = {
  errorCode?: string
  redirectPath?: string
}

export function LoginForm({ errorCode, redirectPath }: LoginFormProps) {
  const supabase = createClient()
  const { error: showErrorToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showInactivePopup, setShowInactivePopup] = useState(errorCode === 'inactive')
  const lastToastErrorRef = useRef<string | null>(null)

  const message = useMemo(() => {
    if (localError) return localError
    if (!errorCode) return null
    return LOGIN_ERROR_MESSAGES[errorCode] || 'Unable to log in. Please try again.'
  }, [errorCode, localError])

  useEffect(() => {
    if (errorCode !== 'inactive' && errorCode !== 'deleted') {
      lastToastErrorRef.current = null
      return
    }

    if (lastToastErrorRef.current === errorCode) return
    const toastMessage = LOGIN_ERROR_MESSAGES[errorCode]
    if (toastMessage) {
      showErrorToast('Session Ended', toastMessage)
      lastToastErrorRef.current = errorCode
    }
  }, [errorCode, showErrorToast])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setLocalError(null)

    const safeRedirect =
      redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
        ? redirectPath
        : '/dashboard'

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(safeRedirect)}`,
      },
    })

    if (error) {
      setLocalError(error.message)
      setIsLoading(false)
    }
  }

  return (
    <>
      {showInactivePopup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <h3 className="text-lg font-bold text-[#1E1B4B]">Account Inactive</h3>
            <p className="mt-3 text-sm text-slate-600">
              Your account is inactive. Please contact Admin or HR Team to access your account.
            </p>
            <button
              type="button"
              onClick={() => setShowInactivePopup(false)}
              className="mt-6 w-full rounded-xl bg-[#06B6D4] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0891b2]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {message && (
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
              <p className="text-sm font-medium text-red-800 leading-relaxed">{message}</p>
            </div>
          </div>
        )}

        <div className="animate-fade-in-stagger-delay" style={{ animationDelay: '0.7s' }}>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#dadce0] bg-white px-4 py-3 text-sm font-medium text-[#3c4043] shadow-sm transition-colors duration-200 hover:bg-[#f8f9fa] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-5 w-5" viewBox="0 0 533.5 544.3" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M533.5 278.4c0-17.4-1.4-34-4.1-50.1H272v95h147.2c-6.4 34.4-25.8 63.5-54.9 83v68h88.7c51.9-47.8 80.5-118.3 80.5-195.9z"
              />
              <path
                fill="#34A853"
                d="M272 544.3c73.8 0 135.7-24.4 181-66l-88.7-68c-24.6 16.5-56.1 26.2-92.3 26.2-70.9 0-130.9-47.9-152.4-112.3H28v70.5c45 89.3 137.4 149.6 244 149.6z"
              />
              <path
                fill="#FBBC04"
                d="M119.6 324.2c-5.4-16.5-8.5-34.1-8.5-52.2s3.1-35.7 8.5-52.2V149.3H28c-18.4 36.7-28 77.8-28 122.7s9.6 86 28 122.7l91.6-70.5z"
              />
              <path
                fill="#EA4335"
                d="M272 107.5c39.9 0 75.7 13.7 103.9 40.5l77.9-77.9C407.6 24.3 345.7 0 272 0 165.4 0 73 60.3 28 149.3l91.6 70.5C141.1 155.4 201.1 107.5 272 107.5z"
              />
            </svg>
            {isLoading ? 'Redirecting...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    </>
  )
}
