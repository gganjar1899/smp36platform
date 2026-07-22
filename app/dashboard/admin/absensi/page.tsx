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

type RekapSiswa = {
  nisn: string
  nama: string
  H: number; S: number; I: number; A: number; T: number; D: number
  total: number
  persen: number
}
type KelasOpt = { id: string; nama_rombel: string; tingkat: number; wali_nama: string | null; wali_nip: string | null }
type MapelOpt = { id: string; nama_mapel: string }

const BULAN_OPTIONS = [
  { val: '01', label: 'Januari' }, { val: '02', label: 'Februari' },
  { val: '03', label: 'Maret' }, { val: '04', label: 'April' },
  { val: '05', label: 'Mei' }, { val: '06', label: 'Juni' },
  { val: '07', label: 'Juli' }, { val: '08', label: 'Agustus' },
  { val: '09', label: 'September' }, { val: '10', label: 'Oktober' },
  { val: '11', label: 'November' }, { val: '12', label: 'Desember' },
]

export default function RekapAbsensiAdminPage() {
  const [kelasList, setKelasList] = useState<KelasOpt[]>([])
  const [mapelList, setMapelList] = useState<MapelOpt[]>([])
  const [kelasId, setKelasId] = useState('')
  const [jenis, setJenis] = useState<'Harian' | 'Mapel'>('Harian')
  const [mapelId, setMapelId] = useState('')
  const [mode, setMode] = useState<'bulan' | 'semester'>('bulan')
  const [bulan, setBulan] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [tahun] = useState(new Date().getFullYear())
  const [semester, setSemester] = useState<'1' | '2'>('1')

  const [rekap, setRekap] = useState<RekapSiswa[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('kelas')
      .select('id, nama_rombel, tingkat, wali:wali_kelas_id(nama, nip)')
      .in('tingkat', [7, 8, 9]).order('tingkat').order('nama_rombel')
      .then(({ data }) => {
        const list = (data || []).map((k: any) => ({
          id: k.id, nama_rombel: k.nama_rombel, tingkat: k.tingkat,
          wali_nama: k.wali?.nama ?? null, wali_nip: k.wali?.nip ?? null,
        }))
        setKelasList(list)
        if (list[0]) setKelasId(list[0].id)
      })
    supabase.from('mata_pelajaran').select('id, nama_mapel').order('nama_mapel')
      .then(({ data }) => {
        setMapelList(data || [])
        if (data && data[0]) setMapelId(data[0].id)
      })
  }, [])

  const getNamaBulan = (val: string) => BULAN_OPTIONS.find(b => b.val === val)?.label || ''
  const getPeriodeLabel = () => mode === 'bulan'
    ? `${getNamaBulan(bulan)} ${tahun}`
    : `Semester ${semester} Tahun ${tahun}/${tahun + 1}`

  const fetchRekap = useCallback(async () => {
    if (!kelasId || (jenis === 'Mapel' && !mapelId)) return
    setLoading(true)

    let mulai = '', selesai = ''
    if (mode === 'bulan') {
      mulai = `${tahun}-${bulan}-01`
      const lastDay = new Date(tahun, parseInt(bulan), 0).getDate()
      selesai = `${tahun}-${bulan}-${String(lastDay).padStart(2, '0')}`
    } else {
      if (semester === '1') { mulai = `${tahun}-07-01`; selesai = `${tahun}-12-31` }
      else { mulai = `${tahun + 1}-01-01`; selesai = `${tahun + 1}-06-30` }
    }

    const { data: sk } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, siswa:siswa_id(id, nama, nisn)')
      .eq('kelas_id', kelasId).eq('tahun_ajaran', '2026/2027').eq('status', 'aktif')

    let absenData: any[] = []
    if (jenis === 'Harian') {
      const { data } = await supabase.from('absensi_harian')
        .select('siswa_id, status, tanggal')
        .eq('kelas_id', kelasId).gte('tanggal', mulai).lte('tanggal', selesai)
      absenData = data || []
    } else {
      const { data } = await supabase.from('absensi_mapel')
        .select('siswa_id, status, tanggal')
        .eq('kelas_id', kelasId).eq('mapel_id', mapelId).gte('tanggal', mulai).lte('tanggal', selesai)
      absenData = data || []
    }

    const map: Record<string, RekapSiswa> = {}
    ;((sk || []) as any[]).forEach(r => {
      if (!r.siswa) return
      map[r.siswa.id] = { nisn: r.siswa.nisn || '-', nama: r.siswa.nama, H: 0, S: 0, I: 0, A: 0, T: 0, D: 0, total: 0, persen: 0 }
    })
    absenData.forEach(a => {
      if (!map[a.siswa_id]) return
      const kode = a.status as 'H' | 'S' | 'I' | 'A' | 'T' | 'D'
      if (map[a.siswa_id][kode] !== undefined) (map[a.siswa_id] as any)[kode]++
      map[a.siswa_id].total++
    })

    const result = Object.values(map).map(s => ({
      ...s, persen: s.total > 0 ? Math.round((s.H / s.total) * 100) : 0,
    })).sort((a, b) => a.nama.localeCompare(b.nama))

    setRekap(result)
    setLoading(false)
  }, [kelasId, jenis, mapelId, mode, bulan, tahun, semester])

  useEffect(() => { fetchRekap() }, [fetchRekap])

  const totalH = rekap.reduce((a, r) => a + r.H, 0)
  const totalS = rekap.reduce((a, r) => a + r.S, 0)
  const totalI = rekap.reduce((a, r) => a + r.I, 0)
  const totalA = rekap.reduce((a, r) => a + r.A, 0)
  const rataKehadiran = rekap.length > 0 ? Math.round(rekap.reduce((a, r) => a + r.persen, 0) / rekap.length) : 0

  const kelasAktif = kelasList.find(k => k.id === kelasId)
  const namaKelas = kelasAktif?.nama_rombel ?? ''
  const waliNama = kelasAktif?.wali_nama ?? '(belum ditentukan)'
  const waliNip = kelasAktif?.wali_nip ?? '-'
  const namaMapel = mapelList.find(m => m.id === mapelId)?.nama_mapel ?? ''

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const periode = getPeriodeLabel()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const headerRows = [
      ['REKAP ABSENSI SISWA'],
      ['SMP NEGERI 36 BANDUNG'],
      ['Jl. Caringin Babakan Ciparay Bandung | Telp. (022) 6078507'],
      [''],
      ['Kelas', ':', namaKelas],
      ['Jenis Absensi', ':', jenis === 'Harian' ? 'Harian' : `Per Mapel (${namaMapel})`],
      ['Periode', ':', periode],
      ['Wali Kelas', ':', waliNama],
      [''],
    ]

    const tableHeader = ['No', 'NISN', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Terlambat', 'Dispensasi', 'Total', '% Kehadiran', 'Ket.']

    const tableData = rekap.map((r, i) => [
      i + 1, r.nisn, r.nama, r.H, r.S, r.I, r.A, r.T, r.D, r.total, r.persen + '%',
      r.persen >= 80 ? 'Baik' : r.persen >= 70 ? 'Cukup' : 'Kurang',
    ])

    const totalRow = ['', '', 'TOTAL', totalH, totalS, totalI, totalA,
      rekap.reduce((a, r) => a + r.T, 0), rekap.reduce((a, r) => a + r.D, 0),
      rekap.reduce((a, r) => a + r.total, 0), rataKehadiran + '%', '']

    const ttdRows = [
      [''],
      ['', '', '', '', '', '', '', 'Bandung, ' + today],
      ['', '', '', '', '', '', '', 'Mengetahui,', '', '', 'Wali Kelas,'],
      ['', '', '', '', '', '', '', 'Kepala Sekolah,'],
      [''], [''], [''],
      ['', '', '', '', '', '', '', KEPSEK_NAMA, '', '', waliNama],
      ['', '', '', '', '', '', '', 'NIP. ' + KEPSEK_NIP, '', '', 'NIP. ' + waliNip],
    ]

    const allRows = [...headerRows, tableHeader, ...tableData, totalRow, ...ttdRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 14 }, { wch: 28 }, { wch: 7 }, { wch: 7 },
      { wch: 7 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi')
    XLSX.writeFile(wb, `Rekap-Absensi-${namaKelas}-${periode.replace(/ /g, '-')}.xlsx`)
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Rekap Absensi</h1>
          <p className="text-gray-500 text-sm mt-1">Rekap kehadiran siswa semua kelas 7, 8, dan 9 — per bulan & semester</p>
        </div>
        {rekap.length > 0 && (
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
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
            <select value={kelasId} onChange={e => setKelasId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
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
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis</label>
            <select value={jenis} onChange={e => setJenis(e.target.value as 'Harian' | 'Mapel')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="Harian">Harian</option>
              <option value="Mapel">Per Mapel</option>
            </select>
          </div>
          {jenis === 'Mapel' && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
              <select value={mapelId} onChange={e => setMapelId(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Periode</label>
            <div className="flex gap-2">
              {(['bulan', 'semester'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition
                    ${mode === m ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {m === 'bulan' ? 'Per Bulan' : 'Per Semester'}
                </button>
              ))}
            </div>
          </div>
          {mode === 'bulan' ? (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Bulan</label>
              <select value={bulan} onChange={e => setBulan(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {BULAN_OPTIONS.map(b => <option key={b.val} value={b.val}>{b.label}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Semester</label>
              <div className="flex gap-2">
                {(['1', '2'] as const).map(s => (
                  <button key={s} onClick={() => setSemester(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                      ${semester === s ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    Semester {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {jenis === 'Harian' && (
          <p className="text-xs text-gray-400 mt-3">Wali kelas: <span className="font-medium text-gray-600">{waliNama}</span></p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Rata Kehadiran', value: rataKehadiran + '%', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Total Hadir', value: totalH, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Total Sakit', value: totalS, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
          { label: 'Total Izin', value: totalI, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Total Alpa', value: totalA, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat rekap...
          </div>
        ) : rekap.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="font-medium">Belum ada data absensi pada periode ini</p>
            <p className="text-xs mt-1">Input absensi terlebih dahulu</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a3a6b] text-white">
                    <th className="px-4 py-3 text-left font-semibold w-8">No</th>
                    <th className="px-4 py-3 text-left font-semibold">Nama Siswa</th>
                    <th className="px-4 py-3 text-left font-semibold text-xs">NISN</th>
                    <th className="px-4 py-3 text-center font-semibold">Hadir</th>
                    <th className="px-4 py-3 text-center font-semibold">Sakit</th>
                    <th className="px-4 py-3 text-center font-semibold">Izin</th>
                    <th className="px-4 py-3 text-center font-semibold">Alpa</th>
                    <th className="px-4 py-3 text-center font-semibold">Total</th>
                    <th className="px-4 py-3 text-center font-semibold">% Hadir</th>
                    <th className="px-4 py-3 text-center font-semibold">Ket.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rekap.map((r, i) => (
                    <tr key={r.nisn + i} className={`hover:bg-gray-50/50 transition ${r.A >= 3 ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.nama}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.nisn}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{r.H}</td>
                      <td className="px-4 py-3 text-center font-semibold text-yellow-600">{r.S || '-'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-600">{r.I || '-'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{r.A || '-'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{r.total}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-14 bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${r.persen >= 80 ? 'bg-green-500' : r.persen >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${r.persen}%` }} />
                          </div>
                          <span className={`text-xs font-semibold ${r.persen >= 80 ? 'text-green-600' : r.persen >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {r.persen}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded
                          ${r.persen >= 80 ? 'bg-green-50 text-green-700' : r.persen >= 70 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                          {r.persen >= 80 ? 'Baik' : r.persen >= 70 ? 'Cukup' : 'Kurang'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-gray-700">TOTAL</td>
                    <td className="px-4 py-3 text-center text-green-600">{totalH}</td>
                    <td className="px-4 py-3 text-center text-yellow-600">{totalS}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{totalI}</td>
                    <td className="px-4 py-3 text-center text-red-600">{totalA}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{rekap.reduce((a, r) => a + r.total, 0)}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{rataKehadiran}%</td>
                    <td />
                  </tr>
                </tfoot>
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
                  <p className="text-sm text-gray-600">Wali Kelas,</p>
                  <div className="h-14 my-2" />
                  <p className="text-sm font-semibold text-gray-800 underline">{waliNama}</p>
                  <p className="text-xs text-gray-500">NIP. {waliNip}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
