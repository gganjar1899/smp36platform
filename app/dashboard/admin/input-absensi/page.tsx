'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Siswa = {
  id: string
  nis: string
  nama: string
  jenis_kelamin: string
  kelas: string
}

type StatusAbsen = 'Hadir' | 'Sakit' | 'Izin' | 'Alfa'

type AbsensiMap = {
  [nis: string]: {
    status: StatusAbsen
    keterangan: string
  }
}

const MAPEL_OPTIONS = [
  'Informatika',
  'IPA',
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'IPS',
  'PKN',
  'Agama',
  'PJOK',
  'Seni Budaya',
  'Prakarya',
  'BK',
]

const STATUS_CONFIG = {
  Hadir: { color: 'bg-green-100 text-green-700 border-green-300', dot: 'bg-green-500' },
  Sakit: { color: 'bg-yellow-100 text-yellow-700 border-yellow-300', dot: 'bg-yellow-500' },
  Izin: { color: 'bg-blue-100 text-blue-700 border-blue-300', dot: 'bg-blue-500' },
  Alfa: { color: 'bg-red-100 text-red-700 border-red-300', dot: 'bg-red-500' },
}

export default function InputAbsensiPage() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [absensiMap, setAbsensiMap] = useState<AbsensiMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0])
  const [kelas, setKelas] = useState('IX-A')
  const [jenis, setJenis] = useState<'Harian' | 'Mapel'>('Harian')
  const [mapel, setMapel] = useState('Informatika')

  // Summary
  const hadir = Object.values(absensiMap).filter(a => a.status === 'Hadir').length
  const sakit = Object.values(absensiMap).filter(a => a.status === 'Sakit').length
  const izin = Object.values(absensiMap).filter(a => a.status === 'Izin').length
  const alfa = Object.values(absensiMap).filter(a => a.status === 'Alfa').length

  const fetchSiswa = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('siswa')
      .select('id, nis, nama, jenis_kelamin, kelas')
      .eq('kelas', kelas)
      .eq('status', 'Aktif')
      .order('nama')

    const list = data || []
    setSiswaList(list)

    // Cek absensi yang sudah ada
    const mapelQuery = jenis === 'Mapel' ? mapel : null
    const { data: existing } = await supabase
      .from('absensi')
      .select('nis, status, keterangan')
      .eq('kelas', kelas)
      .eq('tanggal', tanggal)
      .eq('jenis', jenis)
      .eq('mata_pelajaran', mapelQuery ?? '')

    // Init semua Hadir dulu
    const initMap: AbsensiMap = {}
    list.forEach(s => {
      initMap[s.nis] = { status: 'Hadir', keterangan: '' }
    })

    // Override dengan data yang sudah ada
    if (existing) {
      existing.forEach(e => {
        if (initMap[e.nis]) {
          initMap[e.nis] = { status: e.status as StatusAbsen, keterangan: e.keterangan || '' }
        }
      })
    }

    setAbsensiMap(initMap)
    setLoading(false)
  }, [kelas, tanggal, jenis, mapel])

  useEffect(() => { fetchSiswa() }, [fetchSiswa])

  const setStatus = (nis: string, status: StatusAbsen) => {
    setAbsensiMap(prev => ({
      ...prev,
      [nis]: { ...prev[nis], status }
    }))
    setSaved(false)
  }

  const setKeterangan = (nis: string, ket: string) => {
    setAbsensiMap(prev => ({
      ...prev,
      [nis]: { ...prev[nis], keterangan: ket }
    }))
    setSaved(false)
  }

  const handleSimpan = async () => {
    setSaving(true)
    const rows = siswaList.map(s => ({
      nis: s.nis,
      nama_siswa: s.nama,
      kelas: s.kelas,
      tanggal,
      status: absensiMap[s.nis]?.status || 'Hadir',
      jenis,
      mata_pelajaran: jenis === 'Mapel' ? mapel : null,
      guru_nip: '199006252024211002',
      guru_nama: 'Gina Ganjar Maulana, S.Pd',
      keterangan: absensiMap[s.nis]?.keterangan || '',
    }))

    const { error } = await supabase
      .from('absensi')
      .upsert(rows, { onConflict: 'nis,tanggal,jenis,mata_pelajaran' })

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  const tidakHadir = siswaList.filter(s => absensiMap[s.nis]?.status !== 'Hadir')
  const hadirList = siswaList.filter(s => absensiMap[s.nis]?.status === 'Hadir')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Input Absensi</h1>
        <p className="text-gray-500 text-sm mt-1">Tandai siswa yang tidak hadir — default semua siswa hadir</p>
      </div>

      {/* Form Pilihan */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Tanggal */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Tanggal</label>
            <input
              type="date"
              value={tanggal}
              onChange={e => setTanggal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Kelas */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
            <select
              value={kelas}
              onChange={e => setKelas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['IX-A','IX-B','IX-C','IX-D','IX-E','IX-F','IX-G','IX-H','IX-I','IX-J','IX-K',
                'VIII-A','VIII-B','VIII-C','VIII-D','VIII-E','VIII-F','VIII-G','VIII-H'].map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          {/* Jenis */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis Absensi</label>
            <div className="flex gap-2">
              {(['Harian', 'Mapel'] as const).map(j => (
                <button
                  key={j}
                  onClick={() => setJenis(j)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition
                    ${jenis === j ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                >
                  {j}
                </button>
              ))}
            </div>
          </div>
          {/* Mapel (hanya jika Mapel) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
            <select
              value={mapel}
              onChange={e => setMapel(e.target.value)}
              disabled={jenis === 'Harian'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {MAPEL_OPTIONS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Hadir', value: hadir, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Sakit', value: sakit, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
          { label: 'Izin', value: izin, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Alfa', value: alfa, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat data siswa...
        </div>
      ) : (
        <>
          {/* Siswa Tidak Hadir */}
          {tidakHadir.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 mb-4 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <p className="text-sm font-semibold text-red-700">⚠️ Tidak Hadir ({tidakHadir.length} siswa)</p>
              </div>
              <div className="divide-y divide-gray-50">
                {tidakHadir.map(s => (
                  <div key={s.nis} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                      {s.nama.charAt(0)}
                    </div>
                    <p className="font-medium text-gray-800 flex-1 text-sm">{s.nama}</p>
                    {/* Status buttons */}
                    <div className="flex gap-1.5">
                      {(['Hadir', 'Sakit', 'Izin', 'Alfa'] as StatusAbsen[]).map(st => (
                        <button
                          key={st}
                          onClick={() => setStatus(s.nis, st)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition
                            ${absensiMap[s.nis]?.status === st
                              ? STATUS_CONFIG[st].color + ' border'
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                    {/* Keterangan */}
                    {absensiMap[s.nis]?.status !== 'Hadir' && (
                      <input
                        type="text"
                        placeholder="Keterangan..."
                        value={absensiMap[s.nis]?.keterangan || ''}
                        onChange={e => setKeterangan(s.nis, e.target.value)}
                        className="w-36 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Semua Siswa */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                Daftar Siswa — {kelas} ({siswaList.length} siswa)
              </p>
              <p className="text-xs text-gray-400">
                {jenis === 'Mapel' ? `📚 ${mapel}` : '🏫 Absensi Harian'}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {siswaList.map((s, i) => {
                const status = absensiMap[s.nis]?.status || 'Hadir'
                return (
                  <div key={s.nis} className={`px-5 py-3 flex items-center gap-3 transition
                    ${status !== 'Hadir' ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}`}>
                    <span className="text-xs text-gray-300 w-5">{i + 1}</span>
                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs font-semibold text-blue-600 flex-shrink-0">
                      {s.nama.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{s.nama}</p>
                      <p className="text-xs text-gray-400">{s.nis} · {s.jenis_kelamin === 'L' ? 'L' : 'P'}</p>
                    </div>
                    {/* Status buttons */}
                    <div className="flex gap-1.5">
                      {(['Hadir', 'Sakit', 'Izin', 'Alfa'] as StatusAbsen[]).map(st => (
                        <button
                          key={st}
                          onClick={() => setStatus(s.nis, st)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition
                            ${status === st
                              ? STATUS_CONFIG[st].color + ' border'
                              : 'bg-white text-gray-300 border-gray-100 hover:border-gray-300 hover:text-gray-500'}`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Tombol Simpan */}
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {siswaList.length} siswa · {hadir} hadir · {sakit + izin + alfa} tidak hadir
        </p>
        <button
          onClick={handleSimpan}
          disabled={saving || siswaList.length === 0}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition
            ${saved ? 'bg-green-500 text-white' :
              saving ? 'bg-gray-100 text-gray-400' :
              'bg-[#1a3a6b] hover:bg-[#15305a] text-white shadow-md shadow-blue-200'}`}
        >
          {saved ? (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Tersimpan!</>
          ) : saving ? (
            <><div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> Menyimpan...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg> Simpan Absensi</>
          )}
        </button>
      </div>
    </div>
  )
}
