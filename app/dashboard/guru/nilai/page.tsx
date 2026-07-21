'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const KEPSEK_NAMA = 'Elly Amalya, S.Pd., M.M.Pd.'
const KEPSEK_NIP = '197010131997022001'
// Identitas guru & mapelSaya/KELAS_SAYA diambil dinamis (lihat useEffect init())

type Siswa = { id: string; nis: string; nama: string; jenis_kelamin: string }
type NilaiMap = { [nis: string]: { [key: string]: number | null } }

const KKM = 70
const getKualifikasi = (nilai: number | null) => {
  if (!nilai) return { label: '-', color: 'text-gray-400' }
  if (nilai >= 90) return { label: 'A', color: 'text-green-600' }
  if (nilai >= 80) return { label: 'B', color: 'text-blue-600' }
  if (nilai >= 70) return { label: 'C', color: 'text-yellow-600' }
  return { label: 'D', color: 'text-red-600' }
}

export default function NilaiLegerPage() {
  const [guruNip, setGuruNip] = useState('')
  const [guruNama, setGuruNama] = useState('Guru')
  const [mapelSaya, setMapelSaya] = useState<string[]>([])
  const [kelasSaya, setKelasSaya] = useState<string[]>([])
  const [authReady, setAuthReady] = useState(false)

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiMap, setNilaiMap] = useState<NilaiMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [kelas, setKelas] = useState('')
  const [mapel, setMapel] = useState('')
  const [semester, setSemester] = useState('1')
  const [tahunAjaran] = useState('2026/2027')
  const [jmlFormatif, setJmlFormatif] = useState(3)
  const [activeTab, setActiveTab] = useState<'leger' | 'cbt'>('leger')

  // Ambil identitas guru yang login + kelas/mapel yang benar-benar diajar (guru_mapel)
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data.loggedIn || data.role !== 'guru') { setAuthReady(true); return }

        setGuruNama(data.nama ?? 'Guru')

        const { data: userRow } = await supabase
          .from('users').select('nip').eq('id', data.userId).maybeSingle()
        if (userRow?.nip) setGuruNip(userRow.nip)

        const { data: mengajar } = await supabase
          .from('mapel_guru')
          .select('kelas:kelas_id(nama_rombel), mapel:mapel_id(nama)')
          .eq('guru_id', data.userId)
          .eq('tahun_ajaran', '2026/2027')

        if (mengajar) {
          const kelasList = [...new Set(mengajar.map((m: any) => m.kelas?.nama_rombel).filter(Boolean))] as string[]
          const mapelList = [...new Set(mengajar.map((m: any) => m.mapel?.nama).filter(Boolean))] as string[]
          setKelasSaya(kelasList)
          setMapelSaya(mapelList)
          setKelas(kelasList[0] ?? '')
          setMapel(mapelList[0] ?? '')
        }
      } catch (err) {
        console.error('[guru/nilai] gagal ambil identitas:', err)
      } finally {
        setAuthReady(true)
      }
    }
    init()
  }, [])


  const fetchData = useCallback(async () => {
    if (!kelas || !mapel) { setLoading(false); return }
    setLoading(true)
    const { data: siswa } = await supabase
      .from('siswa').select('id,nis,nama,jenis_kelamin')
      .eq('kelas', kelas).eq('status', 'Aktif').order('nama')

    const { data: nilaiData } = await supabase
      .from('nilai').select('*')
      .eq('kelas', kelas).eq('mata_pelajaran', mapel)
      .eq('semester', semester).eq('tahun_ajaran', tahunAjaran)

    const map: NilaiMap = {}
    siswa?.forEach(s => {
      map[s.nis] = { S1: null, F1: null, F2: null, F3: null, F4: null, F5: null, F6: null }
    })
    nilaiData?.forEach(n => {
      const key = n.jenis === 'Sumatif' ? 'S1' : `F${n.ke}`
      if (map[n.nis]) map[n.nis][key] = n.nilai
    })

    setSiswaList(siswa || [])
    setNilaiMap(map)
    setLoading(false)
  }, [kelas, mapel, semester, tahunAjaran])

  useEffect(() => { fetchData() }, [fetchData])

  const getRataFormatif = (nis: string) => {
    const vals = Array.from({ length: jmlFormatif }, (_, i) => nilaiMap[nis]?.[`F${i + 1}`]).filter(v => v !== null && v !== undefined) as number[]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  const getNilaiAkhir = (nis: string) => {
    const rtf = getRataFormatif(nis)
    const s = nilaiMap[nis]?.S1
    if (rtf === null && s === null) return null
    if (rtf === null) return s
    if (s === null) return rtf
    return Math.round((2 * rtf + s) / 3)
  }

  const setNilai = (nis: string, key: string, val: string) => {
    const num = val === '' ? null : parseFloat(val)
    setNilaiMap(prev => ({ ...prev, [nis]: { ...prev[nis], [key]: num } }))
    setSaved(false)
  }

  const handleSimpan = async () => {
    setSaving(true)
    const rows: any[] = []
    siswaList.forEach(s => {
      const siswa = siswaList.find(x => x.nis === s.nis)!
      // Formatif
      for (let i = 1; i <= jmlFormatif; i++) {
        const v = nilaiMap[s.nis]?.[`F${i}`]
        if (v !== null && v !== undefined) {
          rows.push({ nis: s.nis, nama_siswa: siswa.nama, kelas, mata_pelajaran: mapel, semester, tahun_ajaran: tahunAjaran, jenis: 'Formatif', ke: i, nilai: v, sumber: 'Manual' })
        }
      }
      // Sumatif
      const sv = nilaiMap[s.nis]?.S1
      if (sv !== null && sv !== undefined) {
        rows.push({ nis: s.nis, nama_siswa: siswa.nama, kelas, mata_pelajaran: mapel, semester, tahun_ajaran: tahunAjaran, jenis: 'Sumatif', ke: 1, nilai: sv, sumber: 'Manual' })
      }
    })

    if (rows.length > 0) {
      await supabase.from('nilai').upsert(rows, { onConflict: 'nis,mata_pelajaran,semester,tahun_ajaran,jenis,ke' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const headerRows = [
      [`DAFTAR NILAI SEMESTER ${semester === '1' ? 'GANJIL' : 'GENAP'} SISWA ${kelas}`],
      [`TAHUN PELAJARAN ${tahunAjaran}`],
      ['Mata Pelajaran : ' + mapel, '', '', '', '', '', '', '', '', '', '', `Semester   : ${semester === '1' ? 'Ganjil' : 'Genap'}`],
      ['Guru                 : ' + guruNama, '', '', '', '', '', '', '', '', '', '', `Wali Kelas   : ${guruNama}`],
      ['No.', 'No. Induk', 'NISN', 'Nama Siswa', 'L/P',
        ...Array.from({ length: jmlFormatif }, (_, i) => `F${i + 1}`),
        'RT (F)', 'Sumatif', 'Nilai Akhir', 'Kualifikasi', 'Ket'],
    ]
    const dataRows = siswaList.map((s, i) => {
      const rtf = getRataFormatif(s.nis)
      const na = getNilaiAkhir(s.nis)
      const kual = getKualifikasi(na)
      return [
        i + 1, s.nis, '', s.nama, s.jenis_kelamin === 'L' ? 'L' : 'P',
        ...Array.from({ length: jmlFormatif }, (_, j) => nilaiMap[s.nis]?.[`F${j + 1}`] ?? ''),
        rtf ?? '', nilaiMap[s.nis]?.S1 ?? '', na ?? '', kual.label,
        na !== null && na >= KKM ? 'Tuntas' : na !== null ? 'Belum Tuntas' : '',
      ]
    })
    const ttdRows = [
      [''], [''],
      ['', 'Mengetahui,', '', '', '', '', '', '', '', '', '', '', 'Bandung, ' + today],
      ['', 'Kepala Sekolah,', '', '', '', '', '', '', '', '', '', '', 'Guru Mata Pelajaran,'],
      [''], [''], [''],
      ['', KEPSEK_NAMA, '', '', '', '', '', '', '', '', '', '', guruNama],
      ['', 'NIP. ' + KEPSEK_NIP, '', '', '', '', '', '', '', '', '', '', 'NIP. ' + guruNip],
    ]
    const allRows = [...headerRows, ...dataRows, ...ttdRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 5 },
      ...Array.from({ length: jmlFormatif }, () => ({ wch: 6 })),
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Leger Nilai')
    XLSX.writeFile(wb, `Leger-${mapel}-${kelas}-Sem${semester}-${tahunAjaran.replace('/', '-')}.xlsx`)
  }

  const rataKelas = () => {
    const vals = siswaList.map(s => getNilaiAkhir(s.nis)).filter(v => v !== null) as number[]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }
  const tuntas = siswaList.filter(s => { const na = getNilaiAkhir(s.nis); return na !== null && na >= KKM }).length
  const belumTuntas = siswaList.filter(s => { const na = getNilaiAkhir(s.nis); return na !== null && na < KKM }).length

  if (authReady && !guruNip) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-700 font-medium">Data guru tidak terdeteksi</p>
          <p className="text-xs text-amber-500 mt-1">Silakan login ulang, atau hubungi admin kalau masih bermasalah.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nilai & Leger</h1>
          <p className="text-gray-500 text-sm mt-1">{guruNama} · {tahunAjaran}</p>
        </div>
        <div className="flex gap-2">
          {siswaList.length > 0 && (
            <button onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ key: 'leger', label: '📊 Leger Nilai' }, { key: 'cbt', label: '💻 Kelola CBT' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition
              ${activeTab === t.key ? 'bg-white text-[#1a3a6b] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'leger' && (
        <>
          {/* Filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
                <select value={kelas} onChange={e => setKelas(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {kelasSaya.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
                <select value={mapel} onChange={e => setMapel(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {mapelSaya.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Semester</label>
                <div className="flex gap-2">
                  {['1', '2'].map(s => (
                    <button key={s} onClick={() => setSemester(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                        ${semester === s ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                      Sem {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Jumlah Formatif</label>
                <select value={jmlFormatif} onChange={e => setJmlFormatif(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} kali</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Rata Kelas', value: rataKelas() || '-', color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { label: 'Tuntas', value: tuntas, color: 'text-green-600 bg-green-50 border-green-200' },
              { label: 'Belum Tuntas', value: belumTuntas, color: 'text-red-600 bg-red-50 border-red-200' },
              { label: 'KKM', value: KKM, color: 'text-gray-600 bg-gray-50 border-gray-200' },
            ].map(s => (
              <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tabel Leger */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-400">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Memuat data...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1a3a6b] text-white">
                        <th className="px-3 py-3 text-left font-semibold w-8">No</th>
                        <th className="px-3 py-3 text-left font-semibold">Nama Siswa</th>
                        <th className="px-3 py-3 text-center font-semibold text-xs">JK</th>
                        {Array.from({ length: jmlFormatif }, (_, i) => (
                          <th key={i} className="px-2 py-3 text-center font-semibold text-xs">F{i + 1}</th>
                        ))}
                        <th className="px-2 py-3 text-center font-semibold text-xs bg-blue-800">RT(F)</th>
                        <th className="px-2 py-3 text-center font-semibold text-xs">Sumatif</th>
                        <th className="px-2 py-3 text-center font-semibold text-xs bg-blue-800">NA</th>
                        <th className="px-2 py-3 text-center font-semibold text-xs">Kual.</th>
                        <th className="px-2 py-3 text-center font-semibold text-xs">Ket.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {siswaList.map((s, i) => {
                        const rtf = getRataFormatif(s.nis)
                        const na = getNilaiAkhir(s.nis)
                        const kual = getKualifikasi(na)
                        return (
                          <tr key={s.nis} className="hover:bg-blue-50/20 transition">
                            <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-gray-800 text-xs">{s.nama}</td>
                            <td className="px-3 py-2 text-center text-xs text-gray-500">{s.jenis_kelamin}</td>
                            {Array.from({ length: jmlFormatif }, (_, j) => (
                              <td key={j} className="px-1 py-1 text-center">
                                <input
                                  type="number" min="0" max="100"
                                  value={nilaiMap[s.nis]?.[`F${j + 1}`] ?? ''}
                                  onChange={e => setNilai(s.nis, `F${j + 1}`, e.target.value)}
                                  className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center font-semibold text-blue-700 text-xs bg-blue-50">{rtf ?? '-'}</td>
                            <td className="px-1 py-1 text-center">
                              <input
                                type="number" min="0" max="100"
                                value={nilaiMap[s.nis]?.S1 ?? ''}
                                onChange={e => setNilai(s.nis, 'S1', e.target.value)}
                                className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </td>
                            <td className={`px-2 py-2 text-center font-bold text-sm bg-blue-50
                              ${na !== null && na >= KKM ? 'text-green-700' : na !== null ? 'text-red-600' : 'text-gray-400'}`}>
                              {na ?? '-'}
                            </td>
                            <td className={`px-2 py-2 text-center font-bold text-sm ${kual.color}`}>{kual.label}</td>
                            <td className="px-2 py-2 text-center text-xs">
                              {na !== null ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium
                                  ${na >= KKM ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                  {na >= KKM ? 'Tuntas' : 'Remedial'}
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TTD */}
                <div className="border-t border-gray-100 px-6 py-6">
                  <div className="flex justify-between max-w-2xl ml-auto">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Mengetahui,</p>
                      <p className="text-sm text-gray-600">Kepala Sekolah,</p>
                      <div className="h-14 my-2" />
                      <p className="text-sm font-semibold text-gray-800 underline">{KEPSEK_NAMA}</p>
                      <p className="text-xs text-gray-500">NIP. {KEPSEK_NIP}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Bandung, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                      <p className="text-sm text-gray-600">Guru Mata Pelajaran,</p>
                      <div className="h-14 my-2" />
                      <p className="text-sm font-semibold text-gray-800 underline">{guruNama}</p>
                      <p className="text-xs text-gray-500">NIP. {guruNip}</p>
                    </div>
                  </div>
                </div>

                {/* Tombol Simpan */}
                <div className="px-6 pb-5 flex justify-end">
                  <button onClick={handleSimpan} disabled={saving}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition
                      ${saved ? 'bg-green-500 text-white' : saving ? 'bg-gray-100 text-gray-400' : 'bg-[#1a3a6b] hover:bg-[#15305a] text-white shadow-md shadow-blue-200'}`}>
                    {saved ? '✅ Tersimpan!' : saving ? 'Menyimpan...' : '💾 Simpan Nilai'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'cbt' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Modul CBT</h3>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Buat soal, atur ujian, dan nilai siswa otomatis masuk ke leger. Mendukung soal teks, gambar, dan pilihan ganda.
          </p>
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-6">
            {[
              { icon: '📝', label: 'Buat Soal', desc: 'Input soal pilihan ganda' },
              { icon: '⏱️', label: 'Atur Ujian', desc: 'Durasi, acak soal, kelas' },
              { icon: '📊', label: 'Hasil Otomatis', desc: 'Nilai langsung ke leger' },
            ].map(f => (
              <div key={f.label} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl mb-2">{f.icon}</p>
                <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
          <a href="/dashboard/admin/cbt"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl text-sm font-semibold transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            Buka Modul CBT
          </a>
        </div>
      )}
    </div>
  )
}
