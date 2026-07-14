import { NextRequest, NextResponse } from 'next/server'
import { getAllAccessUsers, findAccessUserByEmail, saveAccessUser } from '@/database'

export async function GET(request: NextRequest) {
  try {
    const userEmail = request.headers.get('x-user-email')
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const requester = await findAccessUserByEmail(userEmail)
    if (!requester || !requester.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await getAllAccessUsers()
    return NextResponse.json({ success: true, users })
  } catch (error: any) {
    console.error('[admin-users-get] Error:', error)
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = request.headers.get('x-user-email')
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const requester = await findAccessUserByEmail(userEmail)
    if (!requester || !requester.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, roles } = body

    if (!email || !name || !roles) {
      return NextResponse.json({ error: 'Missing required fields (email, name, roles)' }, { status: 400 })
    }

    await saveAccessUser(email, name, roles)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[admin-users-post] Error:', error)
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 })
  }
}
