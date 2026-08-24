import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',    // ← tambah ini! biar bisa dicall dari client
  '/cbt',
  '/belajar',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Semua route API ngurus autentikasi & otorisasinya sendiri (baca cookie, cek role,
  // balikin 401/403 dalam bentuk JSON) — jangan di-redirect di sini. Kalau di-redirect,
  // fetch() dari browser ngikutin redirect itu dan berakhir di halaman dashboard biasa
  // (yang nolak POST dengan 405), bukan JSON yang diharapkan sama kode di sisi client.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const userId = request.cookies.get('smpn36_user_id')?.value
  const role   = request.cookies.get('smpn36_user_role')?.value

  if (!userId || !role) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const roleAccess: Record<string, string[]> = {
    siswa: ['/dashboard/siswa', '/ujian'],
    guru:  ['/dashboard/guru'],
    admin: ['/dashboard/admin', '/dashboard/guru', '/dashboard/siswa', '/ujian'],
  }

  const allowed = roleAccess[role] ?? []
  const hasAccess = allowed.some(p => pathname.startsWith(p))

  if (!hasAccess) {
    const map: Record<string, string> = {
      siswa: '/dashboard/siswa',
      guru:  '/dashboard/guru',
      admin: '/dashboard/admin',
    }
    return NextResponse.redirect(new URL(map[role] ?? '/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
