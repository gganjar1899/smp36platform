'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Hasil = {
  id: string; status: string; nilai_akhir: number | null; waktu_selesai: string | null
  ujian?: { judul: string; jenis_ujian: string; mapel?: { nama_mapel: string } }
}

const JENIS_LABEL: Record<string, string> = {
  ulangan_harian: 'Ulangan Harian', pts: 'PTS', pas: 'PAS', asat: 'ASAT', tugas: 'Tugas',
}

export default function HasilUjianSiswaPage() {
  const [hasilList, setHasilList] = useState<Hasil[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (!data.loggedIn || data.role !== 'siswa') { setLoading(false); return }

      const { data: hasil } = await supabase
        .from('sesi_siswa')
        .select('id, status, nilai_akhir, waktu_selesai, ujian:ujian_id(judul, jenis_ujian, mapel:mapel_id(nama_mapel))')
        .eq('siswa_id', data.userId)
        .in('status', ['selesai', 'diskualifikasi'])
        .order('waktu_selesai', { ascending: false })

      setHasilList((hasil as any[]) || [])
      setLoading(false)
    }
    init()
  }, [])

  const rataRata = hasilList.filter(h => h.nilai_akhir !== null).length > 0
    ? Math.round(hasilList.filter(h => h.nilai_akhir !== null).reduce((a, h) => a + (h.nilai_akhir || 0), 0) / hasilList.filter(h => h.nilai_akhir !== null).length)
    : 0

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Hasil Ujian</h1>
        <p className="text-gray-500 text-sm mt-1">Riwayat ujian yang sudah kamu kerjakan</p>
      </div>

      {!loading && hasilList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">{rataRata}</div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Rata-rata nilai</p>
            <p className="text-xs text-gray-400">Dari {hasilList.filter(h => h.nilai_akhir !== null).length} ujian yang sudah dinilai</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Memuat...</div>
      ) : hasilList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="font-medium text-sm">Belum ada ujian yang selesai dikerjakan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {hasilList.map(h => (
            <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{h.ujian?.judul}</p>
                <p className="text-xs text-gray-400">{h.ujian?.mapel?.nama_mapel} · {JENIS_LABEL[h.ujian?.jenis_ujian || '']}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {h.status === 'diskualifikasi' ? (
                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-semibold">Diskualifikasi</span>
                ) : h.nilai_akhir !== null ? (
                  <span className={`text-lg font-bold ${h.nilai_akhir >= 70 ? 'text-green-600' : 'text-red-500'}`}>{h.nilai_akhir}</span>
                ) : (
                  <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-xs font-medium">Menunggu koreksi</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
