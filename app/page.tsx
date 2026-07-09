import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function RootPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('smpn36_user_id')?.value
  const role   = cookieStore.get('smpn36_user_role')?.value

  if (!userId || !role) {
    redirect('/login')
  }

  const dashboardMap: Record<string, string> = {
    siswa: '/siswa',
    guru:  '/guru',
    admin: '/admin',
  }

  redirect(dashboardMap[role] ?? '/login')
}
