import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const userId = request.cookies.get('smpn36_user_id')?.value

  if (!userId) {
    return NextResponse.json({ loggedIn: false })
  }

  const supabase = await createClient()
  const { data: user } = await supabase
    .from('users')
    .select('id, nama, role, aktif')
    .eq('id', userId)
    .single()

  if (!user || !user.aktif) {
    return NextResponse.json({ loggedIn: false })
  }

  return NextResponse.json({
    loggedIn: true,
    userId:   user.id,
    nama:     user.nama,
    role:     user.role,
  })
}
