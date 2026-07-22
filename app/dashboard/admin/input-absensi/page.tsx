'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Siswa = { id: string; nisn: string | null; nama: string }
type KelasOpt = { id: string; nama_rombel: string; tingkat: number }
type MapelOpt = { id: string; nama_mapel: string }

type StatusAbsen = 'H' | 'S' | 'I' | 'A' | 'T' | 'D'
type AbsensiMap = { [siswaId: string]: { status: StatusAbsen; keterangan: string } }

const STATUS_CONFIG: Record<StatusAbsen, { label: string; color: string }> = {
  H: { label: 'Hadir', color: 'bg-green-100 text-green-700 border-green-300' },
  S: { label: 'Sakit', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  I: { label: 'Izin', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  A: { label: 'Alpa', color: 'bg-red-100 text-red-700 border-red-300' },
  T: { label: 'Terlambat', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  D: { label: 'Dispensasi', color: 'bg-purple-100 text-purple-700 border-purple-300' },
}

export default function InputAbsensiAdminPage() {
  const [adminId, setAdminId] = useState('')
  const [kelasList, setKelasList] = useState<KelasOpt[]>([])
  const [mapelList, setMapelList] = useState<MapelOpt[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [absensiMap, setAbsensiMap] = useState<AbsensiMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [tanggal, setTanggal] = useState(() => new Date().toISOString().split('T')[0])
  const [kelasId, setKelasId] = useState('')
  const [jenis, setJenis] = useState<'Harian' | 'Mapel'>('Harian')
  const [mapelId, setMapelId] = useState('')
  const [pertemuanKe, setPertemuanKe] = useState(1)

  // Sesi admin (cookie ID httpOnly, diambil via endpoint server)
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.loggedIn && data.userId) setAdminId(data.userId)
    })
  }, [])

  // Daftar kelas 7-9 & mapel, sekali di awal
  useEffect(() => {
    supabase.from('kelas').select('id, nama_rombel, tingkat').in('tingkat', [7, 8, 9]).order('tingkat').order('nama_rombel')
      .then(({ data }) => {
        setKelasList(data || [])
        if (data && data[0]) setKelasId(data[0].id)
      })
    supabase.from('mata_pelajaran').select('id, nama_mapel').order('nama_mapel')
      .then(({ data }) => {
        setMapelList(data || [])
        if (data && data[0]) setMapelId(data[0].id)
      })
  }, [])

  const summary = (Object.keys(STATUS_CONFIG) as StatusAbsen[]).map(k => ({
    key: k, label: STATUS_CONFIG[k].label,
    value: Object.values(absensiMap).filter(a => a.status === k).length,
  }))

  const fetchSiswa = useCallback(async () => {
    if (!kelasId || (jenis === 'Mapel' && !mapelId)) return
    setLoading(true)

    const { data: sk } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, siswa:siswa_id(id, nama, nisn)')
      .eq('kelas_id', kelasId)
      .eq('tahun_ajaran', '2026/2027')
      .eq('status', 'aktif')

    const list = ((sk || []).map((r: any) => r.siswa).filter(Boolean) as Siswa[])
      .sort((a, b) => a.nama.localeCompare(b.nama))
    setSiswaList(list)

    let existing: any[] = []
    if (jenis === 'Harian') {
      const { data } = await supabase.from('absensi_harian')
        .select('siswa_id, status, keterangan')
        .eq('kelas_id', kelasId).eq('tanggal', tanggal)
      existing = data || []
    } else {
      const { data } = await supabase.from('absensi_mapel')
        .select('siswa_id, status, keterangan')
        .eq('kelas_id', kelasId).eq('mapel_id', mapelId).eq('tanggal', tanggal).eq('pertemuan_ke', pertemuanKe)
      existing = data || []
    }

    const initMap: AbsensiMap = {}
    list.forEach(s => { initMap[s.id] = { status: 'H', keterangan: '' } })
    existing.forEach(e => {
      if (initMap[e.siswa_id]) initMap[e.siswa_id] = { status: e.status, keterangan: e.keterangan || '' }
    })
    setAbsensiMap(initMap)
    setLoading(false)
  }, [kelasId, tanggal, jenis, mapelId, pertemuanKe])

  useEffect(() => { fetchSiswa() }, [fetchSiswa])

  const setStatus = (id: string, status: StatusAbsen) => {
    setAbsensiMap(prev => ({ ...prev, [id]: { ...prev[id], status } }))
    setSaved(false)
  }

  const handleSimpan = async () => {
    if (!adminId) { alert('Sesi login tidak ditemukan, silakan login ulang.'); return }
    setSaving(true)

    if (jenis === 'Harian') {
      const rows = siswaList.map(s => ({
        siswa_id: s.id, kelas_id: kelasId, tanggal,
        status: absensiMap[s.id]?.status || 'H',
        keterangan: absensiMap[s.id]?.keterangan || '',
        dicatat_oleh: adminId,
      }))
      const { error } = await supabase.from('absensi_harian')
        .upsert(rows, { onConflict: 'siswa_id,kelas_id,tanggal' })
      setSaving(false)
      if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
      else alert('Gagal menyimpan: ' + error.message)
    } else {
      const rows = siswaList.map(s => ({
        siswa_id: s.id, kelas_id: kelasId, mapel_id: mapelId, guru_id: adminId,
        tanggal, pertemuan_ke: pertemuanKe,
        status: absensiMap[s.id]?.status || 'H',
        keterangan: absensiMap[s.id]?.keterangan || '',
      }))
      const { error } = await supabase.from('absensi_mapel')
        .upsert(rows, { onConflict: 'siswa_id,kelas_id,mapel_id,tanggal,pertemuan_ke' })
      setSaving(false)
      if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
      else alert('Gagal menyimpan: ' + error.message)
    }
  }

  const tidakHadir = siswaList.filter(s => absensiMap[s.id]?.status !== 'H')
  const namaKelas = kelasList.find(k => k.id === kelasId)?.nama_rombel ?? ''

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Input Absensi</h1>
        <p className="text-gray-500 text-sm mt-1">Semua kelas 7, 8, dan 9 — tandai status yang berbeda dari Hadir</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Tanggal</label>
            <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
            <select value={kelasId} onChange={e => setKelasId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[7, 8, 9].map(t => (
                <optgroup key={t} label={`Kelas ${t}`}>
                  {kelasList.filter(k => k.tingkat === t).map(k => (
                    <option key={k.id} value={k.id}>{k.nama_rombel}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis Absensi</label>
            <div className="flex gap-2">
              {(['Harian', 'Mapel'] as const).map(j => (
                <button key={j} onClick={() => setJenis(j)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition
                    ${jenis === j ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {j === 'Harian' ? 'Harian' : 'Per Mapel'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
            <select value={mapelId} onChange={e => setMapelId(e.target.value)} disabled={jenis === 'Harian'}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400">
              {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Pertemuan Ke</label>
            <input type="number" min={1} value={pertemuanKe} disabled={jenis === 'Harian'}
              onChange={e => setPertemuanKe(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        {summary.map(s => (
          <div key={s.key} className="rounded-xl border p-3 text-center bg-gray-50 border-gray-200">
            <p className="text-2xl font-bold text-gray-700">{s.value}</p>
            <p className="text-xs font-medium mt-0.5 text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat data siswa...
        </div>
      ) : siswaList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Belum ada siswa terdaftar di kelas {namaKelas}.
        </div>
      ) : (
        <>
          {tidakHadir.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 mb-4 overflow-hidden">
              <div className="px-5 py-3 bg-red-50 border-b border-red-100">
                <p className="text-sm font-semibold text-red-700">⚠️ Tidak Hadir Penuh ({tidakHadir.length} siswa)</p>
              </div>
              <div className="divide-y divide-gray-50">
                {tidakHadir.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 flex-shrink-0">
                      {s.nama.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-700 flex-1">{s.nama}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${STATUS_CONFIG[absensiMap[s.id]?.status || 'H'].color}`}>
                      {STATUS_CONFIG[absensiMap[s.id]?.status || 'H'].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Daftar Siswa — {namaKelas} ({siswaList.length} siswa)</p>
              <button onClick={() => setAbsensiMap(prev => {
                const next = { ...prev }
                siswaList.forEach(s => { next[s.id] = { ...next[s.id], status: 'H' } })
                return next
              })} className="text-xs font-medium text-[#1a3a6b] hover:underline">Tandai semua Hadir</button>
            </div>
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {siswaList.map((s, i) => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.nama}</p>
                    <p className="text-xs text-gray-400">{s.nisn || '-'}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {(Object.keys(STATUS_CONFIG) as StatusAbsen[]).map(k => (
                      <button key={k} onClick={() => setStatus(s.id, k)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold border transition
                          ${absensiMap[s.id]?.status === k ? STATUS_CONFIG[k].color + ' ring-2 ring-offset-1' : 'bg-white text-gray-300 border-gray-200 hover:bg-gray-50'}`}>
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button onClick={handleSimpan} disabled={saving}
              className="px-6 py-2.5 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'Menyimpan...' : saved ? '✓ Tersimpan' : 'Simpan Absensi'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
