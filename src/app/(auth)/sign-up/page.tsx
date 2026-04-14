'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export default function SignUpPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setIsSubmitting(true)

    const supabase = getSupabaseBrowser()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
        },
      },
    })

    if (error) {
      setError(error.message)
      setIsSubmitting(false)
      return
    }

    setSuccess(true)
    setIsSubmitting(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex">
        <LeftPanel />
        <div className="flex-1 min-h-screen overflow-y-auto bg-gray-50">
          <div className="flex items-center justify-center p-6 lg:p-8 min-h-screen">
            <div className="w-full max-w-md text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[rgb(var(--color-brand-blue))] flex items-center justify-center shadow-lg shadow-[rgb(var(--color-brand-blue))]/30">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h1>
              <p className="text-gray-600 mb-8">
                We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account, then sign in.
              </p>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center py-3 px-6 rounded-full text-sm font-semibold text-white bg-[rgb(var(--color-brand-blue))] hover:bg-[rgb(var(--color-brand-blue))]/90 transition-all duration-300 shadow-lg shadow-[rgb(var(--color-brand-blue))]/30"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      <LeftPanel />

      <div className="flex-1 min-h-screen overflow-y-auto bg-gray-50">
        <div className="flex items-center justify-center p-6 lg:p-8">
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
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900">Create Staff Account</h2>
              <p className="text-sm text-gray-500 mt-2">
                Sign up for a staff portal account. An admin will grant your permissions after registration.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200/50 shadow-[0_2px_8px_-2px_rgba(239,68,68,0.1)]">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-glass"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-glass"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@theprintroom.co.nz"
                  autoComplete="email"
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
                  required
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-glass"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-glass"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-6 rounded-full text-sm font-semibold uppercase tracking-wide text-white bg-[rgb(var(--color-brand-blue))] hover:bg-[rgb(var(--color-brand-blue))]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-[rgb(var(--color-brand-blue))]/30 hover:shadow-xl hover:shadow-[rgb(var(--color-brand-blue))]/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md"
              >
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-gray-600">
                Already have an account?{' '}
                <Link
                  href="/sign-in"
                  className="text-[rgb(var(--color-brand-blue))] font-medium hover:underline"
                >
                  Sign in
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
          Join the Team
        </h1>
        <p className="text-white/80 text-base xl:text-lg max-w-md">
          Create your staff account to access The Print Room&apos;s internal tools and start managing orders, images, and reports.
        </p>
      </div>

      <div className="text-white/50 text-xs xl:text-sm flex-shrink-0">
        &copy; {new Date().getFullYear()} The Print Room. All rights reserved.
      </div>
    </div>
  )
}
