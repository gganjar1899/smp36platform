'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type RekapSiswa = {
  nis: string
  nama: string
  hadir: number
  sakit: number
  izin: number
  alfa: number
  total: number
  persen: number
}

const GURU_NAMA = 'Gina Ganjar Maulana, S.Pd'
const GURU_NIP = '199006252024211002'
const KEPSEK_NAMA = 'Elly Amalya, S.Pd., M.M.Pd.'
const KEPSEK_NIP = '197010131997022001'

const BULAN_OPTIONS = [
  { val: '01', label: 'Januari' }, { val: '02', label: 'Februari' },
  { val: '03', label: 'Maret' }, { val: '04', label: 'April' },
  { val: '05', label: 'Mei' }, { val: '06', label: 'Juni' },
  { val: '07', label: 'Juli' }, { val: '08', label: 'Agustus' },
  { val: '09', label: 'September' }, { val: '10', label: 'Oktober' },
  { val: '11', label: 'November' }, { val: '12', label: 'Desember' },
]

export default function RekapAbsensiPage() {
  const [rekap, setRekap] = useState<RekapSiswa[]>([])
  const [loading, setLoading] = useState(false)
  const [kelas, setKelas] = useState('IX-A')
  const [mode, setMode] = useState<'bulan' | 'semester'>('bulan')
  const [bulan, setBulan] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [tahun] = useState(new Date().getFullYear())
  const [semester, setSemester] = useState<'1' | '2'>('1')
  const [jenis, setJenis] = useState('Harian')

  const getNamaBulan = (val: string) => BULAN_OPTIONS.find(b => b.val === val)?.label || ''
  const getPeriodeLabel = () => mode === 'bulan'
    ? `${getNamaBulan(bulan)} ${tahun}`
    : `Semester ${semester} Tahun ${tahun}/${tahun + 1}`

  const fetchRekap = useCallback(async () => {
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

    const { data } = await supabase
      .from('absensi')
      .select('nis, nama_siswa, status, tanggal')
      .eq('kelas', kelas)
      .eq('jenis', jenis)
      .gte('tanggal', mulai)
      .lte('tanggal', selesai)
      .order('tanggal')

    if (!data || data.length === 0) { setRekap([]); setLoading(false); return }

    const map: Record<string, RekapSiswa> = {}
    data.forEach(d => {
      if (!map[d.nis]) map[d.nis] = { nis: d.nis, nama: d.nama_siswa, hadir: 0, sakit: 0, izin: 0, alfa: 0, total: 0, persen: 0 }
      map[d.nis].total++
      if (d.status === 'Hadir') map[d.nis].hadir++
      else if (d.status === 'Sakit') map[d.nis].sakit++
      else if (d.status === 'Izin') map[d.nis].izin++
      else if (d.status === 'Alfa') map[d.nis].alfa++
    })

    const result = Object.values(map).map(s => ({
      ...s, persen: s.total > 0 ? Math.round((s.hadir / s.total) * 100) : 0
    })).sort((a, b) => a.nama.localeCompare(b.nama))

    setRekap(result)
    setLoading(false)
  }, [kelas, mode, bulan, tahun, semester, jenis])

  useEffect(() => { fetchRekap() }, [fetchRekap])

  const totalHadir = rekap.reduce((a, r) => a + r.hadir, 0)
  const totalSakit = rekap.reduce((a, r) => a + r.sakit, 0)
  const totalIzin = rekap.reduce((a, r) => a + r.izin, 0)
  const totalAlfa = rekap.reduce((a, r) => a + r.alfa, 0)
  const rataKehadiran = rekap.length > 0 ? Math.round(rekap.reduce((a, r) => a + r.persen, 0) / rekap.length) : 0

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const periode = getPeriodeLabel()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const headerRows = [
      ['REKAP ABSENSI SISWA'],
      ['SMP NEGERI 36 BANDUNG'],
      ['Jl. Caringin Babakan Ciparay Bandung | Telp. (022) 6078507'],
      [''],
      ['Kelas', ':', kelas],
      ['Jenis Absensi', ':', jenis],
      ['Periode', ':', periode],
      ['Wali Kelas', ':', GURU_NAMA],
      [''],
    ]

    const tableHeader = ['No', 'NIS', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alfa', 'Total Pertemuan', '% Kehadiran', 'Keterangan']

    const tableData = rekap.map((r, i) => [
      i + 1,
      r.nis,
      r.nama,
      r.hadir,
      r.sakit,
      r.izin,
      r.alfa,
      r.total,
      r.persen + '%',
      r.persen >= 80 ? 'Baik' : r.persen >= 70 ? 'Cukup' : 'Kurang',
    ])

    const totalRow = ['', '', 'TOTAL', totalHadir, totalSakit, totalIzin, totalAlfa,
      totalHadir + totalSakit + totalIzin + totalAlfa, rataKehadiran + '%', '']

    const ttdRows = [
      [''],
      ['', '', '', '', '', '', '', 'Bandung, ' + today],
      ['', '', '', '', '', '', '', 'Mengetahui,', '', '', 'Wali Kelas,'],
      ['', '', '', '', '', '', '', 'Kepala Sekolah,'],
      [''], [''], [''],
      ['', '', '', '', '', '', '', KEPSEK_NAMA, '', '', GURU_NAMA],
      ['', '', '', '', '', '', '', 'NIP. ' + KEPSEK_NIP, '', '', 'NIP. ' + GURU_NIP],
    ]

    const allRows = [...headerRows, tableHeader, ...tableData, totalRow, ...ttdRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 30 }, { wch: 7 }, { wch: 7 },
      { wch: 7 }, { wch: 7 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi')
    XLSX.writeFile(wb, `Rekap-Absensi-${kelas}-${periode.replace(/ /g, '-')}.xlsx`)
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rekap Absensi</h1>
          <p className="text-gray-500 text-sm mt-1">Rekap kehadiran siswa per bulan & semester</p>
        </div>
        {rekap.length > 0 && (
          <button onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
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
            <select value={kelas} onChange={e => setKelas(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['IX-A','IX-B','IX-C','IX-D','IX-E','IX-F','IX-G','IX-H','IX-I','IX-J','IX-K',
                'VIII-A','VIII-B','VIII-C','VIII-D','VIII-E','VIII-F','VIII-G','VIII-H'].map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis</label>
            <select value={jenis} onChange={e => setJenis(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="Harian">Harian</option>
              <option value="Mapel">Per Mapel</option>
            </select>
          </div>
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
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Rata Kehadiran', value: rataKehadiran + '%', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Total Hadir', value: totalHadir, color: 'text-green-600 bg-green-50 border-green-200' },
          { label: 'Total Sakit', value: totalSakit, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
          { label: 'Total Izin', value: totalIzin, color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'Total Alfa', value: totalAlfa, color: 'text-red-600 bg-red-50 border-red-200' },
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
            <p className="font-medium">Belum ada data absensi</p>
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
                    <th className="px-4 py-3 text-left font-semibold text-xs">NIS</th>
                    <th className="px-4 py-3 text-center font-semibold">Hadir</th>
                    <th className="px-4 py-3 text-center font-semibold">Sakit</th>
                    <th className="px-4 py-3 text-center font-semibold">Izin</th>
                    <th className="px-4 py-3 text-center font-semibold">Alfa</th>
                    <th className="px-4 py-3 text-center font-semibold">Total</th>
                    <th className="px-4 py-3 text-center font-semibold">% Hadir</th>
                    <th className="px-4 py-3 text-center font-semibold">Ket.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rekap.map((r, i) => (
                    <tr key={r.nis} className={`hover:bg-gray-50/50 transition ${r.alfa >= 3 ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.nama}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.nis}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{r.hadir}</td>
                      <td className="px-4 py-3 text-center font-semibold text-yellow-600">{r.sakit || '-'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-blue-600">{r.izin || '-'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{r.alfa || '-'}</td>
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
                    <td className="px-4 py-3 text-center text-green-600">{totalHadir}</td>
                    <td className="px-4 py-3 text-center text-yellow-600">{totalSakit}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{totalIzin}</td>
                    <td className="px-4 py-3 text-center text-red-600">{totalAlfa}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{totalHadir+totalSakit+totalIzin+totalAlfa}</td>
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
                  <p className="text-sm font-semibold text-gray-800 underline">{GURU_NAMA}</p>
                  <p className="text-xs text-gray-500">NIP. {GURU_NIP}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}