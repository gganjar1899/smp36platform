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

type Siswa = { nis: string; nisn: string | null; nama: string }
type NilaiMap = { [nis: string]: { [key: string]: number | null } }
type KelasOpt = { id: string; nama_rombel: string; tingkat: number }
type MapelOpt = { id: string; nama_mapel: string }
type RekapKelasNilai = {
  namaKelas: string
  jumlahSiswa: number
  rata: number
  tuntas: number
  belumTuntas: number
  belumDinilai: number
}

const KKM = 75
const getKualifikasi = (nilai: number | null) => {
  if (nilai === null) return { label: '-', color: 'text-gray-400' }
  if (nilai >= 90) return { label: 'A', color: 'text-green-600' }
  if (nilai >= 80) return { label: 'B', color: 'text-blue-600' }
  if (nilai >= 75) return { label: 'C', color: 'text-yellow-600' }
  return { label: 'D', color: 'text-red-600' }
}

export default function NilaiLegerAdminPage() {
  const [kelasList, setKelasList] = useState<KelasOpt[]>([])
  const [mapelList, setMapelList] = useState<MapelOpt[]>([])
  const [kelasId, setKelasId] = useState('semua')
  const [mapelId, setMapelId] = useState('')
  const [guruNama, setGuruNama] = useState('(belum ditentukan)')
  const [guruNip, setGuruNip] = useState('-')

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiMap, setNilaiMap] = useState<NilaiMap>({})
  const [rekapKelas, setRekapKelas] = useState<RekapKelasNilai[]>([])
  const [loading, setLoading] = useState(true)
  const [semester, setSemester] = useState('1')
  const [tahunAjaran] = useState('2026/2027')
  const [jmlFormatif, setJmlFormatif] = useState(3)

  useEffect(() => {
    supabase.from('kelas').select('id, nama_rombel, tingkat').in('tingkat', [7, 8, 9]).order('tingkat').order('nama_rombel')
      .then(({ data }) => setKelasList(data || []))
    supabase.from('mata_pelajaran').select('id, nama_mapel').order('nama_mapel')
      .then(({ data }) => {
        setMapelList(data || [])
        if (data && data[0]) setMapelId(data[0].id)
      })
  }, [])

  const namaKelas = kelasList.find(k => k.id === kelasId)?.nama_rombel ?? ''
  const namaMapel = mapelList.find(m => m.id === mapelId)?.nama_mapel ?? ''

  // Guru pengampu kelas+mapel yang sedang dipilih (untuk tanda tangan leger) — cuma relevan
  // kalau lagi lihat 1 kelas spesifik, bukan mode ringkasan Semua Kelas
  useEffect(() => {
    if (kelasId === 'semua' || !kelasId || !mapelId) { setGuruNama('(belum ditentukan)'); setGuruNip('-'); return }
    supabase.from('guru_mapel')
      .select('guru:guru_id(nama, nip)')
      .eq('kelas_id', kelasId).eq('mapel_id', mapelId).eq('tahun_ajaran', tahunAjaran)
      .maybeSingle()
      .then(({ data }: any) => {
        setGuruNama(data?.guru?.nama ?? '(belum ditentukan)')
        setGuruNip(data?.guru?.nip ?? '-')
      })
  }, [kelasId, mapelId, tahunAjaran])

  const getRataFormatifDari = (map: NilaiMap, nis: string) => {
    const vals = Array.from({ length: jmlFormatif }, (_, i) => map[nis]?.[`F${i + 1}`]).filter(v => v !== null && v !== undefined) as number[]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }
  const getNilaiAkhirDari = (map: NilaiMap, nis: string) => {
    const rtf = getRataFormatifDari(map, nis)
    const s = map[nis]?.S1 ?? null
    if (rtf === null && s === null) return null
    if (rtf === null) return s
    if (s === null) return rtf
    return Math.round((2 * rtf + s) / 3)
  }

  const fetchData = useCallback(async () => {
    if (!mapelId) { setLoading(false); return }
    setLoading(true)

    // Tabel "nilai" berbasis teks (kelas & mata_pelajaran nama_rombel/nama_mapel, bukan UUID) —
    // ini yang beneran diisi guru dari tab Leger, jadi harus dicocokkan pakai teks juga, bukan ID.
    if (kelasId === 'semua') {
      const { data: nilaiData } = await supabase
        .from('nilai').select('kelas, nis, jenis, ke, nilai')
        .eq('mata_pelajaran', namaMapel).eq('semester', semester).eq('tahun_ajaran', tahunAjaran)

      const hasil: RekapKelasNilai[] = []
      for (const k of kelasList) {
        const { count } = await supabase.from('siswa').select('nis', { count: 'exact', head: true })
          .eq('kelas', k.nama_rombel).eq('status', 'Aktif')

        const map: NilaiMap = {}
        ;(nilaiData || []).filter(n => n.kelas === k.nama_rombel).forEach(n => {
          if (!map[n.nis]) map[n.nis] = { S1: null, F1: null, F2: null, F3: null, F4: null, F5: null, F6: null }
          const key = n.jenis === 'Sumatif' ? 'S1' : `F${n.ke}`
          map[n.nis][key] = n.nilai
        })
        const nisTerdaftar = Object.keys(map)
        const nilaiAkhirSemua = nisTerdaftar.map(nis => getNilaiAkhirDari(map, nis)).filter(v => v !== null) as number[]
        const jumlahSiswa = count ?? 0
        const tuntas = nilaiAkhirSemua.filter(v => v >= KKM).length
        const belumTuntas = nilaiAkhirSemua.filter(v => v < KKM).length

        hasil.push({
          namaKelas: k.nama_rombel,
          jumlahSiswa,
          rata: nilaiAkhirSemua.length > 0 ? Math.round(nilaiAkhirSemua.reduce((a, b) => a + b, 0) / nilaiAkhirSemua.length) : 0,
          tuntas, belumTuntas,
          belumDinilai: Math.max(0, jumlahSiswa - tuntas - belumTuntas),
        })
      }
      setRekapKelas(hasil)
      setSiswaList([])
      setNilaiMap({})
      setLoading(false)
      return
    }

    if (!namaKelas) { setLoading(false); return }

    const { data: siswa } = await supabase
      .from('siswa').select('nis, nisn, nama')
      .eq('kelas', namaKelas).eq('status', 'Aktif').order('nama')

    const { data: nilaiData } = await supabase
      .from('nilai').select('*')
      .eq('kelas', namaKelas).eq('mata_pelajaran', namaMapel)
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
    setRekapKelas([])
    setLoading(false)
  }, [kelasId, namaKelas, namaMapel, mapelId, semester, tahunAjaran, kelasList, jmlFormatif])

  useEffect(() => { fetchData() }, [fetchData])

  const getRataFormatif = (nis: string) => getRataFormatifDari(nilaiMap, nis)
  const getNilaiAkhir = (nis: string) => getNilaiAkhirDari(nilaiMap, nis)

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    if (kelasId === 'semua') {
      const headerRows = [
        [`REKAP NILAI — RINGKASAN SEMUA KELAS`],
        [`Mata Pelajaran: ${namaMapel} — Semester ${semester === '1' ? 'Ganjil' : 'Genap'} ${tahunAjaran}`],
        [''],
      ]
      const tableHeader = ['No', 'Kelas', 'Jml Siswa', 'Rata Kelas', 'Tuntas', 'Belum Tuntas', 'Belum Dinilai']
      const tableData = rekapKelas.map((r, i) => [i + 1, r.namaKelas, r.jumlahSiswa, r.rata || '-', r.tuntas, r.belumTuntas, r.belumDinilai])
      const allRows = [...headerRows, tableHeader, ...tableData]
      const ws = XLSX.utils.aoa_to_sheet(allRows)
      ws['!cols'] = [{ wch: 4 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Semua Kelas')
      XLSX.writeFile(wb, `Rekap-Nilai-SemuaKelas-${namaMapel}-Sem${semester}-${tahunAjaran.replace('/', '-')}.xlsx`)
      return
    }

    const headerRows = [
      [`DAFTAR NILAI SEMESTER ${semester === '1' ? 'GANJIL' : 'GENAP'} SISWA ${namaKelas}`],
      [`TAHUN PELAJARAN ${tahunAjaran}`],
      ['Mata Pelajaran : ' + namaMapel, '', '', '', '', '', '', '', '', '', '', `Semester   : ${semester === '1' ? 'Ganjil' : 'Genap'}`],
      ['Guru                 : ' + guruNama],
      ['No.', 'NISN', 'Nama Siswa',
        ...Array.from({ length: jmlFormatif }, (_, i) => `F${i + 1}`),
        'RT (F)', 'Sumatif', 'Nilai Akhir', 'Kualifikasi', 'Ket'],
    ]
    const dataRows = siswaList.map((s, i) => {
      const rtf = getRataFormatif(s.nis)
      const na = getNilaiAkhir(s.nis)
      const kual = getKualifikasi(na)
      return [
        i + 1, s.nisn || '-', s.nama,
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
    ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 30 },
      ...Array.from({ length: jmlFormatif }, () => ({ wch: 6 })),
      { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Leger Nilai')
    XLSX.writeFile(wb, `Leger-${namaMapel}-${namaKelas}-Sem${semester}-${tahunAjaran.replace('/', '-')}.xlsx`)
  }

  const rataKelas = () => {
    const vals = siswaList.map(s => getNilaiAkhir(s.nis)).filter(v => v !== null) as number[]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }
  const tuntas = siswaList.filter(s => { const na = getNilaiAkhir(s.nis); return na !== null && na >= KKM }).length
  const belumTuntas = siswaList.filter(s => { const na = getNilaiAkhir(s.nis); return na !== null && na < KKM }).length
  const belumDinilai = siswaList.filter(s => getNilaiAkhir(s.nis) === null).length

  const rataSekolah = rekapKelas.length > 0 ? Math.round(rekapKelas.reduce((a, r) => a + r.rata, 0) / rekapKelas.length) : 0
  const tuntasSekolah = rekapKelas.reduce((a, r) => a + r.tuntas, 0)
  const belumTuntasSekolah = rekapKelas.reduce((a, r) => a + r.belumTuntas, 0)
  const belumDinilaiSekolah = rekapKelas.reduce((a, r) => a + r.belumDinilai, 0)

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Nilai & Leger</h1>
          <p className="text-gray-500 text-sm mt-1">Semua kelas 7, 8, dan 9 · {tahunAjaran}</p>
        </div>
        {(siswaList.length > 0 || rekapKelas.length > 0) && (
          <button onClick={handleExportExcel}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition w-full sm:w-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Excel
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
            <select value={kelasId} onChange={e => setKelasId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="semua">🏫 Semua Kelas (ringkasan)</option>
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
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
            <select value={mapelId} onChange={e => setMapelId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
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
          {kelasId !== 'semua' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jumlah Formatif</label>
              <select value={jmlFormatif} onChange={e => setJmlFormatif(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} kali</option>)}
              </select>
            </div>
          )}
        </div>
        {kelasId !== 'semua' && (
          <p className="text-xs text-gray-400 mt-3">Guru pengampu: <span className="font-medium text-gray-600">{guruNama}</span></p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {(kelasId === 'semua' ? [
          { label: 'Rata Sekolah', value: rataSekolah || '-', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Tuntas', value: tuntasSekolah, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Belum Tuntas', value: belumTuntasSekolah, color: 'text-red-600 bg-red-50 border-red-200' },
          { label: 'Belum Dinilai', value: belumDinilaiSekolah, color: 'text-gray-600 bg-gray-50 border-gray-200' },
          { label: 'KKM', value: KKM, color: 'text-gray-600 bg-gray-50 border-gray-200' },
        ] : [
          { label: 'Rata Kelas', value: rataKelas() || '-', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Tuntas', value: tuntas, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Belum Tuntas', value: belumTuntas, color: 'text-red-600 bg-red-50 border-red-200' },
          { label: 'Belum Dinilai', value: belumDinilai, color: 'text-gray-600 bg-gray-50 border-gray-200' },
          { label: 'KKM', value: KKM, color: 'text-gray-600 bg-gray-50 border-gray-200' },
        ]).map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabel (read-only, admin memantau — input tetap lewat guru) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat data...
          </div>
        ) : kelasId === 'semua' ? (
          rekapKelas.length === 0 ? (
            <div className="p-12 text-center text-gray-400">Belum ada data nilai buat mapel ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a3a6b] text-white">
                    <th className="px-4 py-3 text-left font-semibold w-8">No</th>
                    <th className="px-4 py-3 text-left font-semibold">Kelas</th>
                    <th className="px-4 py-3 text-center font-semibold">Jml Siswa</th>
                    <th className="px-4 py-3 text-center font-semibold">Rata Kelas</th>
                    <th className="px-4 py-3 text-center font-semibold">Tuntas</th>
                    <th className="px-4 py-3 text-center font-semibold">Belum Tuntas</th>
                    <th className="px-4 py-3 text-center font-semibold">Belum Dinilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rekapKelas.map((r, i) => (
                    <tr key={r.namaKelas} className="hover:bg-gray-50/50 transition cursor-pointer"
                      onClick={() => { const k = kelasList.find(k => k.nama_rombel === r.namaKelas); if (k) setKelasId(k.id) }}
                      title="Klik buat lihat leger lengkap kelas ini">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.namaKelas}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{r.jumlahSiswa}</td>
                      <td className={`px-4 py-3 text-center font-bold ${r.rata >= KKM ? 'text-green-700' : r.rata > 0 ? 'text-red-600' : 'text-gray-400'}`}>{r.rata || '-'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{r.tuntas}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{r.belumTuntas || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{r.belumDinilai || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 px-4 py-2 bg-gray-50 border-t border-gray-100">Klik salah satu baris kelas buat lihat leger lengkap per siswa.</p>
            </div>
          )
        ) : siswaList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Belum ada siswa terdaftar di kelas {namaKelas}.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a3a6b] text-white">
                    <th className="px-3 py-3 text-left font-semibold w-8">No</th>
                    <th className="px-3 py-3 text-left font-semibold">Nama Siswa</th>
                    <th className="px-3 py-3 text-left font-semibold text-xs">NISN</th>
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
                        <td className="px-3 py-2 text-gray-400 text-xs">{s.nisn || '-'}</td>
                        {Array.from({ length: jmlFormatif }, (_, j) => (
                          <td key={j} className="px-2 py-2 text-center text-xs text-gray-600">{nilaiMap[s.nis]?.[`F${j + 1}`] ?? '-'}</td>
                        ))}
                        <td className="px-2 py-2 text-center font-semibold text-blue-700 text-xs bg-blue-50">{rtf ?? '-'}</td>
                        <td className="px-2 py-2 text-center text-xs text-gray-600">{nilaiMap[s.nis]?.S1 ?? '-'}</td>
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
          </>
        )}
      </div>
    </div>
  )
}
