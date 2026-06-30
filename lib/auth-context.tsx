'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface UserRoles {
  sales: boolean
  finance: boolean
  project: boolean
  purchasing: boolean
}

interface UserInfo {
  email: string
  name: string
  picture?: string
  roles: UserRoles
}

interface AuthContextType {
  user: UserInfo | null
  isLoading: boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const token = localStorage.getItem('google_token')

    if (storedUser && token) {
      try {
        const parsed = JSON.parse(storedUser)
        if (parsed.email && parsed.roles) {
          setUser(parsed)
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
    setIsLoading(false)
    setIsMounted(true)
  }, [])

  const logout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('google_token')
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: isLoading || !isMounted, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
