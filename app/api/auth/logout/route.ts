import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Hapus semua cookie session
  response.cookies.delete('smpn36_user_id')
  response.cookies.delete('smpn36_user_role')
  response.cookies.delete('smpn36_user_nama')

  return response
}

export async function GET() {
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000')
  )

  response.cookies.delete('smpn36_user_id')
  response.cookies.delete('smpn36_user_role')
  response.cookies.delete('smpn36_user_nama')

  return response
}
