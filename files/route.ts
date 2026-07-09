import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Cari user berdasarkan username
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash, nama, role, aktif, harus_ganti_password')
      .eq('username', username.trim().toLowerCase())
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      )
    }

    if (!user.aktif) {
      return NextResponse.json(
        { error: 'Akun kamu tidak aktif. Hubungi admin.' },
        { status: 403 }
      )
    }

    // Verifikasi password
    const passwordValid = await bcrypt.compare(password, user.password_hash)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      )
    }

    // Tentukan redirect berdasarkan role
    const redirectMap: Record<string, string> = {
      siswa: '/siswa',
      guru:  '/guru',
      admin: '/admin',
    }

    const redirectTo = user.harus_ganti_password
      ? '/ganti-password'
      : (redirectMap[user.role] ?? '/login')

    // Set cookie session
    const response = NextResponse.json({
      success: true,
      user: {
        id:   user.id,
        nama: user.nama,
        role: user.role,
      },
      redirectTo,
    })

    response.cookies.set('smpn36_user_id', user.id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 8, // 8 jam
      path:     '/',
    })

    response.cookies.set('smpn36_user_role', user.role, {
      httpOnly: false, // bisa dibaca client untuk UI
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 8,
      path:     '/',
    })

    response.cookies.set('smpn36_user_nama', encodeURIComponent(user.nama), {
      httpOnly: false,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 8,
      path:     '/',
    })

    return response

  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server. Coba lagi.' },
      { status: 500 }
    )
  }
}
