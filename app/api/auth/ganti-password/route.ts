import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get('smpn36_user_id')?.value
    if (!userId) {
      return NextResponse.json({ error: 'Sesi tidak valid' }, { status: 401 })
    }

    const { passwordBaru } = await request.json()

    if (!passwordBaru || passwordBaru.length < 6) {
      return NextResponse.json(
        { error: 'Password minimal 6 karakter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const hash = await bcrypt.hash(passwordBaru, 12)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: user, error } = await (supabase as any)
      .from('users')
      .update({
        password_hash:        hash,
        harus_ganti_password: false,
        updated_at:           new Date().toISOString(),
      })
      .eq('id', userId)
      .select('role')
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Gagal memperbarui password' },
        { status: 500 }
      )
    }

    const redirectMap: Record<string, string> = {
      siswa: '/dashboard/siswa',
      guru:  '/dashboard/guru',
      admin: '/dashboard/admin',
    }

    return NextResponse.json({
      success:    true,
      redirectTo: redirectMap[user.role] ?? '/login',
    })

  } catch (err) {
    console.error('Ganti password error:', err)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
