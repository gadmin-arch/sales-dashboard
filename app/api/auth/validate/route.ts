import { NextRequest, NextResponse } from 'next/server'
import { findAccessUserByEmail } from '@/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await findAccessUserByEmail(email)

    if (!user) {
      return NextResponse.json(
        { error: 'Access denied. This email is not authorized to access the dashboard.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      email: user.email,
      name: user.name,
      roles: {
        sales: user.sales,
        finance: user.finance,
        project: user.project,
        purchasing: user.purchasing,
        payroll: user.payroll,
      },
    })
  } catch (error) {
    console.error('Auth validation error:', error)
    return NextResponse.json(
      { error: 'Authentication failed. Please try again.' },
      { status: 500 }
    )
  }
}
