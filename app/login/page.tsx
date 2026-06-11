'use client'

import { useGoogleLogin } from '@react-oauth/google'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogIn } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const login = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        setIsLoading(true)
        setError(null)

        const token = codeResponse.access_token

        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!userInfoResponse.ok) {
          throw new Error('Failed to get user info')
        }

        const userData = await userInfoResponse.json()

        const validateResponse = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: userData.email }),
        })

        if (!validateResponse.ok) {
          const data = await validateResponse.json()
          setError(data.error || 'Access denied.')
          setIsLoading(false)
          return
        }

        const validatedUser = await validateResponse.json()

        localStorage.setItem(
          'user',
          JSON.stringify({
            email: userData.email,
            name: userData.name,
            picture: userData.picture,
            roles: validatedUser.roles,
          })
        )
        localStorage.setItem('google_token', token)

        router.push('/dashboard/sales')
      } catch (err) {
        console.error('Login error:', err)
        setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
        setIsLoading(false)
      }
    },
    onError: () => {
      setError('Login failed. Please try again.')
      setIsLoading(false)
    },
    flow: 'implicit',
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-lg bg-blue-100 p-3">
              <LogIn className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your sales and invoice management dashboard
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={() => login()}
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="mt-6 text-center text-xs text-gray-500">
          Only authorized users can access this dashboard
        </p>
      </div>
    </div>
  )
}
