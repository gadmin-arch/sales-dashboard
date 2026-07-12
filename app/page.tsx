'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to login on page load
    const user = localStorage.getItem('user')
    if (user) {
      router.push('/dashboard/sales')
    } else {
      router.push('/login')
    }
  }, [router])

  return <div className="min-h-screen bg-background" />
}
