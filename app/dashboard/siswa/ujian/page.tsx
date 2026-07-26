'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Ujian = {
  id: string
  judul: string
  jenis_ujian: string
  durasi_menit: number
  status: 'draft' | 'aktif' | 'selesai' | 'dibatalkan'
  created_at: string
  mapel?: { nama_mapel: string }
}

type Sesi = {
  id: string
  ujian_id: string
  status: 'belum_mulai' | 'sedang_ujian' | 'selesai' | 'diskualifikasi'
  nilai_akhir: number | null
}

const JENIS_LABEL: Record<string, string> = {
  ulangan_harian: 'Ulangan Harian',
  pts: 'PTS',
  pas: 'PAS',
  asat: 'ASAT',
  tugas: 'Tugas',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  belum_mulai: { label: 'Belum Dikerjakan', cls: 'bg-gray-100 text-gray-600' },
  sedang_ujian: { label: 'Sedang Berlangsung', cls: 'bg-green-50 text-green-700' },
  selesai: { label: 'Selesai', cls: 'bg-blue-50 text-blue-700' },
  diskualifikasi: { label: 'Didiskualifikasi', cls: 'bg-red-50 text-red-700' },
}

export default function UjianSiswaPage() {
  const router = useRouter()

  const [ujianList, setUjianList] = useState<Ujian[]>([])
  const [sesiMap, setSesiMap] = useState<Record<string, Sesi>>({})
  const [jumlahSoalMap, setJumlahSoalMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/auth/me')
      const me = await res.json()
      const kelasId: string | null = me?.siswa?.kelasId ?? null
      const userId: string | null = me?.siswa?.id ?? null

      if (!kelasId || !userId) {
        setErrorMsg('Kelas kamu belum terdaftar. Hubungi wali kelas atau admin.')
        setLoading(false)
        return
      }

      const { data: ujianRows, error: ujianErr } = await supabase
        .from('ujian')
        .select('id, judul, jenis_ujian, durasi_menit, status, created_at, mapel:mapel_id(nama_mapel)')
        .eq('kelas_id', kelasId)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false })

      if (ujianErr) {
        setErrorMsg('Belum bisa memuat daftar ujian. Coba lagi nanti.')
        setLoading(false)
        return
      }

      const list = (ujianRows ?? []) as unknown as Ujian[]
      setUjianList(list)

      if (list.length > 0) {
        const ujianIds = list.map((u) => u.id)

        const [{ data: sesiRows }, { data: soalRows }] = await Promise.all([
          supabase
            .from('sesi_siswa')
            .select('id, ujian_id, status, nilai_akhir')
            .eq('siswa_id', userId)
            .in('ujian_id', ujianIds),
          supabase.from('ujian_soal').select('ujian_id').in('ujian_id', ujianIds),
        ])

        setSesiMap(Object.fromEntries((sesiRows ?? []).map((s: Sesi) => [s.ujian_id, s])))

        const counts: Record<string, number> = {}
        for (const r of (soalRows ?? []) as { ujian_id: string }[]) {
          counts[r.ujian_id] = (counts[r.ujian_id] ?? 0) + 1
        }
        setJumlahSoalMap(counts)
      }
    } catch {
      setErrorMsg('Belum bisa memuat daftar ujian. Coba lagi nanti.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Ujian</h1>
        <p className="text-sm text-gray-400 mt-0.5">Daftar ujian aktif untuk kelasmu</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Memuat ujian...</p>
      ) : errorMsg ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg p-3">{errorMsg}</div>
      ) : ujianList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-gray-400">Belum ada ujian aktif untuk kelasmu saat ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ujianList.map((u) => (
            <UjianCard
              key={u.id}
              ujian={u}
              sesi={sesiMap[u.id]}
              jumlahSoal={jumlahSoalMap[u.id] ?? 0}
              onMulai={() => router.push(`/ujian/${u.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function UjianCard({
  ujian,
  sesi,
  jumlahSoal,
  onMulai,
}: {
  ujian: Ujian
  sesi?: Sesi
  jumlahSoal: number
  onMulai: () => void
}) {
  const status = sesi?.status ?? 'belum_mulai'
  const badge = STATUS_BADGE[status]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
        <span className="text-[11px] text-gray-400 whitespace-nowrap">
          {JENIS_LABEL[ujian.jenis_ujian] ?? ujian.jenis_ujian}
        </span>
      </div>

      <h4 className="text-sm font-semibold text-gray-800">{ujian.judul}</h4>
      <p className="text-xs text-gray-500 mt-1">
        {ujian.mapel?.nama_mapel ?? 'Mapel'} · {jumlahSoal} soal · ⏱ {ujian.durasi_menit} menit
      </p>

      {status === 'selesai' ? (
        <p className="mt-3 text-sm font-bold text-[#1a3a6b]">
          {sesi?.nilai_akhir !== null && sesi?.nilai_akhir !== undefined
            ? `Nilai: ${sesi.nilai_akhir}`
            : 'Menunggu penilaian guru'}
        </p>
      ) : status === 'diskualifikasi' ? (
        <p className="mt-3 text-xs text-red-500">Ujian dihentikan karena pelanggaran tata tertib.</p>
      ) : (
        <button
          onClick={onMulai}
          className="mt-3 w-full py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition"
        >
          {status === 'sedang_ujian' ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
        </button>
      )}
    </div>
  )
}
