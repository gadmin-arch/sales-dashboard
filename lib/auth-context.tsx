'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Roles } from '@/lib/nav'

interface UserInfo {
  email: string
  name: string
  picture?: string
  roles: Roles
}

interface AuthContextType {
  user: UserInfo | null
  isLoading: boolean
  /** True once roles have been confirmed against the server (or there's no session
   * to confirm). The dashboard waits for this before rendering role-gated pages so
   * stale cached roles can't briefly expose a forbidden page. */
  isValidated: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isValidated: false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [isValidated, setIsValidated] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('google_token')

    let cached: UserInfo | null = null
    if (storedUser && token) {
      try {
        const parsed = JSON.parse(storedUser)
        if (parsed.email && parsed.roles) {
          cached = parsed
        } else {
          localStorage.removeItem('user')
          localStorage.removeItem('google_token')
        }
      } catch (error) {
        console.error('Failed to parse user:', error)
        localStorage.removeItem('user')
        localStorage.removeItem('google_token')
      }
    }

    // Render with the cached roles immediately for a fast first paint…
    if (cached) setUser(cached)
    setIsLoading(false)
    setIsMounted(true)

    // …then re-validate against the users sheet so permission changes take effect
    // on the next refresh — no manual logout required. A 403 means access was
    // revoked, so we sign the user out; transient errors keep the cached copy.
    // isValidated flips true when this settles (immediately if there's no session).
    if (cached) {
      const prev = cached
      fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: prev.email }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then((fresh: { name?: string; roles: Roles }) => {
          const updated: UserInfo = { ...prev, name: fresh.name || prev.name, roles: fresh.roles }
          setUser(updated)
          localStorage.setItem('user', JSON.stringify(updated))
          setIsValidated(true)
        })
        .catch((status) => {
          if (status === 403) {
            localStorage.removeItem('user')
            localStorage.removeItem('google_token')
            setUser(null)
            window.location.href = '/login'
          } else {
            // transient error — keep the cached copy but unblock the UI
            setIsValidated(true)
          }
        })
    } else {
      setIsValidated(true)
    }
  }, [])

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('google_token')
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: isLoading || !isMounted, isValidated, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
