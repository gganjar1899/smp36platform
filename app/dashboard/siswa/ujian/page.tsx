'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Ujian = {
  id: string; judul: string; jenis_ujian: string; durasi_menit: number
  mapel?: { nama_mapel: string }
}
type SesiRingkas = { ujian_id: string; status: string }

const JENIS_LABEL: Record<string, string> = {
  ulangan_harian: 'Ulangan Harian', pts: 'PTS', pas: 'PAS', asat: 'ASAT', tugas: 'Tugas',
}

export default function DaftarUjianSiswaPage() {
  const router = useRouter()
  const [siswaId, setSiswaId] = useState('')
  const [kelasId, setKelasId] = useState('')
  const [ujianList, setUjianList] = useState<Ujian[]>([])
  const [sesiSaya, setSesiSaya] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (!data.loggedIn || data.role !== 'siswa' || !data.siswa?.kelasId) { setLoading(false); return }
      setSiswaId(data.userId)
      setKelasId(data.siswa.kelasId)
    }
    init()
  }, [])

  const fetchUjian = useCallback(async () => {
    if (!kelasId || !siswaId) { setLoading(false); return }
    setLoading(true)

    const { data: ujian } = await supabase
      .from('ujian')
      .select('id, judul, jenis_ujian, durasi_menit, mapel:mapel_id(nama_mapel)')
      .eq('kelas_id', kelasId).eq('status', 'aktif')
      .order('created_at', { ascending: false })

    const { data: sesi } = await supabase
      .from('sesi_siswa')
      .select('ujian_id, status')
      .eq('siswa_id', siswaId)

    const map: Record<string, string> = {}
    ;(sesi as SesiRingkas[] || []).forEach(s => { map[s.ujian_id] = s.status })

    setUjianList((ujian as any[]) || [])
    setSesiSaya(map)
    setLoading(false)
  }, [kelasId, siswaId])

  useEffect(() => { fetchUjian() }, [fetchUjian])

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Ujian</h1>
        <p className="text-gray-500 text-sm mt-1">Daftar ujian yang sedang aktif untuk kelasmu</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Memuat...</div>
      ) : ujianList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium text-sm">Belum ada ujian aktif saat ini</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ujianList.map(u => {
            const status = sesiSaya[u.id]
            return (
              <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="font-semibold text-gray-800 text-sm mb-1">{u.judul}</p>
                <p className="text-xs text-gray-500 mb-3">{u.mapel?.nama_mapel} · {JENIS_LABEL[u.jenis_ujian]} · ⏱ {u.durasi_menit} menit</p>
                {status === 'selesai' ? (
                  <span className="inline-block px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium">✓ Sudah selesai dikerjakan</span>
                ) : status === 'diskualifikasi' ? (
                  <span className="inline-block px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium">Didiskualifikasi</span>
                ) : status === 'sedang_ujian' ? (
                  <button onClick={() => router.push(`/ujian/${u.id}`)}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition">
                    Lanjutkan Mengerjakan →
                  </button>
                ) : (
                  <button onClick={() => router.push(`/ujian/${u.id}`)}
                    className="px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition">
                    Mulai Ujian
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
