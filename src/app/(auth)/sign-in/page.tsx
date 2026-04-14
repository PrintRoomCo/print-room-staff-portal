'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function SignInPage() {
  const router = useRouter()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error)
      setIsSubmitting(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Brand */}
      <LeftPanel />

      {/* Right Panel — Form */}
      <div className="flex-1 min-h-screen overflow-y-auto bg-gray-50">
        <div className="flex items-center justify-center p-6 lg:p-8 min-h-screen">
          <div className="w-full max-w-md py-8">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-8 text-center">
              <Image
                src="/print-room-logo.png"
                alt="The Print Room"
                width={128}
                height={32}
                style={{ width: 'auto', height: 'auto' }}
                className="h-8 w-auto mx-auto"
              />
            </div>

            {/* Title */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold text-gray-900">Sign In</h2>
              <p className="text-sm text-gray-500 mt-2">
                Sign in to the staff portal with your email and password
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200/50 shadow-[0_2px_8px_-2px_rgba(239,68,68,0.1)]">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="you@theprintroom.co.nz"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-glass"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-8 w-full py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-wide text-white bg-[rgb(var(--color-brand-blue))] hover:bg-[rgb(var(--color-brand-blue))]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[rgb(var(--color-brand-blue))]/30 hover:shadow-xl hover:shadow-[rgb(var(--color-brand-blue))]/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

              {/* Sign Up Link */}
              <p className="mt-6 text-center text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link
                  href="/sign-up"
                  className="text-[rgb(var(--color-brand-blue))] font-medium hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeftPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-pr-blue p-8 xl:p-12 flex-col justify-between h-screen sticky top-0 overflow-hidden">
      <div className="flex-shrink-0">
        <Image
          src="/print-room-logo.png"
          alt="The Print Room"
          width={192}
          height={48}
          style={{ width: 'auto', height: 'auto' }}
          className="h-10 xl:h-12 w-auto brightness-0 invert"
        />
      </div>

      <div className="space-y-4 xl:space-y-6 flex-1 flex flex-col justify-center py-6">
        <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
          Welcome Back
        </h1>
        <p className="text-white/80 text-base xl:text-lg max-w-md">
          Sign in to manage jobs, generate images, view reports, and keep The Print Room running smoothly.
        </p>

        <ul className="space-y-2 xl:space-y-3 mt-4 xl:mt-6">
          {[
            'Manage job tracking & orders',
            'Generate product images',
            'View reports & analytics',
            'Administer chatbot settings',
            'Build client presentations',
          ].map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 xl:gap-3 text-white/90 text-sm xl:text-base"
            >
              <svg
                className="w-4 h-4 xl:w-5 xl:h-5 text-white/60 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-white/50 text-xs xl:text-sm flex-shrink-0">
        &copy; {new Date().getFullYear()} The Print Room. All rights reserved.
      </div>
    </div>
  )
}
