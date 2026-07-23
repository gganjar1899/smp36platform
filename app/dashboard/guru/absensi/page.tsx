'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface Kelas {
  id: string
  nama_rombel: string
  tingkat: number
}

interface Siswa {
  id: string
  nama: string
  nisn: string
}

interface AbsensiStatus {
  [siswaId: string]: 'H' | 'S' | 'I' | 'A' | 'T' | 'D'
}

interface RiwayatPertemuan {
  pertemuan_ke: number
  tanggal: string
}

const STATUS = [
  { kode: 'H', label: 'Hadir',      bg: 'bg-emerald-500', light: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { kode: 'S', label: 'Sakit',      bg: 'bg-blue-500',    light: 'bg-blue-50 text-blue-700 border-blue-200' },
  { kode: 'I', label: 'Izin',       bg: 'bg-amber-500',   light: 'bg-amber-50 text-amber-700 border-amber-200' },
  { kode: 'A', label: 'Alpa',       bg: 'bg-red-500',     light: 'bg-red-50 text-red-700 border-red-200' },
  { kode: 'T', label: 'Terlambat',  bg: 'bg-orange-500',  light: 'bg-orange-50 text-orange-700 border-orange-200' },
  { kode: 'D', label: 'Dispensasi', bg: 'bg-violet-500',  light: 'bg-violet-50 text-violet-700 border-violet-200' },
]

function formatTgl(tgl: string) {
  const d = new Date(tgl)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export default function AbsensiPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [kelasList, setKelasList]       = useState<Kelas[]>([])
  const [mapelList, setMapelList]       = useState<any[]>([])
  const [siswaList, setSiswaList]       = useState<Siswa[]>([])
  const [absensi, setAbsensi]           = useState<AbsensiStatus>({})
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedMapel, setSelectedMapel] = useState('')
  const [tanggal, setTanggal]           = useState(new Date().toISOString().split('T')[0])
  const [pertemuanKe, setPertemuanKe]   = useState(1)
  const [guruId, setGuruId]             = useState('')
  const [riwayat, setRiwayat]           = useState<RiwayatPertemuan[]>([])
  const [loading, setLoading]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [message, setMessage]           = useState<{type: 'success'|'error', text: string} | null>(null)

  // Ambil user login lewat /api/auth/me (cookie ID bersifat httpOnly, tidak bisa dibaca via document.cookie)
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.loggedIn && data.userId) setGuruId(data.userId)
      } catch (err) {
        console.error('[guru/absensi] gagal ambil identitas:', err)
      }
    }
    init()
  }, [])

  // Ambil kelas & mapel dari guru_mapel
  useEffect(() => {
    if (!guruId) return
    const fetch = async () => {
      const { data } = await supabase
        .from('guru_mapel')
        .select('kelas_id, kelas(id, nama_rombel, tingkat), mapel_id, mata_pelajaran(id, nama_mapel)')
        .eq('guru_id', guruId)
        .eq('tahun_ajaran', '2026/2027')

      if (data) {
        const kelas = Array.from(new Map(data.map((d: any) => [d.kelas_id, d.kelas])).values()) as Kelas[]
        const mapel = Array.from(new Map(data.map((d: any) => [d.mapel_id, d.mata_pelajaran])).values())
        setKelasList(kelas.filter(Boolean))
        setMapelList(mapel.filter(Boolean))
      }
    }
    fetch()
  }, [guruId])

  // Ambil siswa (lewat tabel penghubung siswa_kelas, karena users tidak punya kolom kelas_id)
  useEffect(() => {
    if (!selectedKelas) return
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('siswa_kelas')
        .select('users(id, nama, nisn)')
        .eq('kelas_id', selectedKelas)
        .eq('tahun_ajaran', '2026/2027')
        .eq('status', 'aktif')

      if (data) {
        const siswa = (data as any[])
          .map(d => d.users)
          .filter(Boolean)
          .sort((a: Siswa, b: Siswa) => a.nama.localeCompare(b.nama))
        setSiswaList(siswa)
        const def: AbsensiStatus = {}
        siswa.forEach((s: Siswa) => { def[s.id] = 'H' })
        setAbsensi(def)
      }
      setLoading(false)
    }
    fetch()
  }, [selectedKelas])

  const setStatus = (id: string, status: 'H'|'S'|'I'|'A'|'T'|'D') => {
    setAbsensi(p => ({ ...p, [id]: status }))
  }

  // Ambil riwayat pertemuan yang sudah pernah diinput untuk kelas & mapel ini,
  // supaya guru langsung lihat sudah sampai pertemuan berapa (seperti kolom di absensi kertas)
  // dan nomor pertemuan berikutnya otomatis tersaran.
  useEffect(() => {
    if (!selectedKelas || !selectedMapel) {
      setRiwayat([])
      return
    }
    const fetchRiwayat = async () => {
      const { data } = await supabase
        .from('absensi_mapel')
        .select('pertemuan_ke, tanggal')
        .eq('kelas_id', selectedKelas)
        .eq('mapel_id', selectedMapel)
        .eq('tahun_ajaran', '2026/2027')
        .order('pertemuan_ke', { ascending: true })

      if (data) {
        const unik = Array.from(
          new Map(data.map((d: any) => [d.pertemuan_ke, d])).values()
        ) as RiwayatPertemuan[]
        setRiwayat(unik)

        const maxPertemuan = unik.length ? Math.max(...unik.map(u => u.pertemuan_ke)) : 0
        setPertemuanKe(maxPertemuan + 1)
      }
    }
    fetchRiwayat()
  }, [selectedKelas, selectedMapel])

  // Klik salah satu chip pertemuan lama untuk membuka & mengedit ulang absen hari itu
  const bukaPertemuanLama = async (p: RiwayatPertemuan) => {
    setPertemuanKe(p.pertemuan_ke)
    setTanggal(p.tanggal)
    if (!siswaList.length) return
    const { data } = await supabase
      .from('absensi_mapel')
      .select('siswa_id, status')
      .eq('kelas_id', selectedKelas)
      .eq('mapel_id', selectedMapel)
      .eq('pertemuan_ke', p.pertemuan_ke)
      .eq('tahun_ajaran', '2026/2027')

    if (data) {
      setAbsensi(prev => {
        const next = { ...prev }
        data.forEach((row: any) => { next[row.siswa_id] = row.status })
        return next
      })
    }
  }

  const handleSimpan = async () => {
    if (!selectedKelas || !selectedMapel || !siswaList.length) {
      setMessage({ type: 'error', text: 'Lengkapi kelas dan mata pelajaran terlebih dahulu.' })
      return
    }
    setSaving(true)
    setMessage(null)

    const rows = siswaList.map(s => ({
      siswa_id: s.id,
      kelas_id: selectedKelas,
      mapel_id: selectedMapel,
      guru_id: guruId,
      tanggal,
      pertemuan_ke: pertemuanKe,
      status: absensi[s.id] || 'H',
    }))

    const { error } = await supabase
      .from('absensi_mapel')
      .upsert(rows, { onConflict: 'siswa_id,kelas_id,mapel_id,tanggal,pertemuan_ke' })

    setMessage(error
      ? { type: 'error',   text: `Gagal menyimpan: ${error.message}` }
      : { type: 'success', text: 'Absensi berhasil disimpan!' }
    )
    setSaving(false)
  }

  const rekap = STATUS.reduce((acc, s) => {
    acc[s.kode] = Object.values(absensi).filter(v => v === s.kode).length
    return acc
  }, {} as Record<string, number>)

  const namaKelas = kelasList.find(k => k.id === selectedKelas)?.nama_rombel ?? ''

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-800">Input Absensi Siswa</h1>
        <p className="text-sm text-gray-400 mt-0.5">Catat kehadiran siswa per mata pelajaran dan pertemuan</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Informasi Pertemuan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Pertemuan Ke</label>
            <input
              type="number"
              min={1}
              value={pertemuanKe}
              onChange={e => setPertemuanKe(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Kelas</label>
            <select
              value={selectedKelas}
              onChange={e => setSelectedKelas(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]"
            >
              <option value="">Pilih Kelas</option>
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_rombel}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1.5">Mata Pelajaran</label>
            <select
              value={selectedMapel}
              onChange={e => setSelectedMapel(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]"
            >
              <option value="">Pilih Mapel</option>
              {mapelList.map((m: any) => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Agenda Pertemuan -- grid penuh 1-24 mirip kolom di buku absensi kertas,
          supaya progress semester langsung kelihatan dan guru tidak lupa/dobel nomor */}
      {selectedKelas && selectedMapel && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Agenda Pertemuan Semester Ini</h2>
            <span className="text-xs text-gray-400">{riwayat.length} dari 24</span>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
            {Array.from({ length: 24 }, (_, i) => i + 1).map(no => {
              const tercatat = riwayat.find(p => p.pertemuan_ke === no)
              const isSekarang = no === pertemuanKe && !tercatat
              const bisaDiklik = !!tercatat
              return (
                <button
                  key={no}
                  type="button"
                  disabled={!bisaDiklik}
                  onClick={() => tercatat && bukaPertemuanLama(tercatat)}
                  title={tercatat ? `Buka ulang pertemuan ke-${no} · ${formatTgl(tercatat.tanggal)} (data tersimpan tidak akan hilang)` : isSekarang ? 'Pertemuan hari ini (belum disimpan)' : `Pertemuan ke-${no} belum diisi`}
                  className={`flex flex-col items-center justify-center gap-0.5 h-12 rounded-md text-xs font-medium transition-all ${
                    isSekarang
                      ? 'bg-[#eaf1fb] text-[#1a3a6b] border-[1.5px] border-dashed border-[#1a3a6b]/50'
                      : tercatat
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer'
                      : 'bg-gray-50 text-gray-300 border border-gray-100 cursor-default'
                  }`}
                >
                  <span className="font-bold leading-none">{no}</span>
                  <span className={`text-[9px] leading-none ${tercatat ? 'opacity-80' : 'opacity-0'}`}>
                    {tercatat ? formatTgl(tercatat.tanggal) : '-'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />Sudah diisi</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block" />Belum diisi</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border-[1.5px] border-dashed border-[#1a3a6b]/50 inline-block" />Hari ini</span>
          </div>
        </div>
      )}

      {/* Rekap Bar */}
      {siswaList.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Rekap Kehadiran</h2>
            <span className="text-xs text-gray-400">{siswaList.length} siswa · Kelas {namaKelas}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS.map(s => (
              <div key={s.kode} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${s.light}`}>
                <span className={`w-2 h-2 rounded-full ${s.bg}`}></span>
                {s.label}: <span className="font-bold">{rekap[s.kode] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabel */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-8 h-8 border-2 border-[#1a3a6b] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-400">Memuat data siswa...</p>
        </div>
      ) : siswaList.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Daftar Siswa</h2>
            <button
              onClick={() => {
                const all: AbsensiStatus = {}
                siswaList.forEach(s => { all[s.id] = 'H' })
                setAbsensi(all)
              }}
              className="text-xs text-[#1a3a6b] hover:underline font-medium"
            >
              Tandai semua Hadir
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 w-10">No</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">Nama Siswa</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 w-32">NISN</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500">Status Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {siswaList.map((siswa, idx) => (
                  <tr key={siswa.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1a3a6b]/10 flex items-center justify-center text-[#1a3a6b] text-xs font-bold flex-shrink-0">
                          {siswa.nama.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-800">{siswa.nama}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-xs font-mono">{siswa.nisn}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 justify-center">
                        {STATUS.map(opt => (
                          <button
                            key={opt.kode}
                            onClick={() => setStatus(siswa.id, opt.kode as any)}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                              absensi[siswa.id] === opt.kode
                                ? `${opt.bg} text-white border-transparent shadow-sm scale-110`
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                            }`}
                            title={opt.label}
                          >
                            {opt.kode}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              {message && (
                <p className={`text-sm font-medium ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {message.type === 'success' ? '✓' : '✕'} {message.text}
                </p>
              )}
            </div>
            <button
              onClick={handleSimpan}
              disabled={saving}
              className="flex items-center gap-2 bg-[#1a3a6b] hover:bg-[#142d54] text-white px-5 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-sm"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              )}
              {saving ? 'Menyimpan...' : 'Simpan Absensi'}
            </button>
          </div>
        </div>
      ) : selectedKelas ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">Tidak ada siswa di kelas ini</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <p className="text-gray-400 text-sm">Pilih kelas untuk memulai input absensi</p>
        </div>
      )}
    </div>
  )
}
