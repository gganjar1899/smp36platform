'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_LABEL: Record<string, string> = {
  H: 'Hadir', S: 'Sakit', I: 'Izin', A: 'Alpa', T: 'Terlambat', D: 'Dispensasi',
}

type RekapSiswa = {
  siswa_id: string
  nisn: string
  nama: string
  H: number
  S: number
  I: number
  A: number
  T: number
  D: number
  total: number
  persen: number
}

type Pertemuan = { pertemuan_ke: number; tanggal: string }
type MatrixRow = { siswa_id: string; nisn: string; nama: string; status: Record<number, string> }

type KelasOpt = { id: string; nama_rombel: string }
type MapelOpt = { id: string; nama_mapel: string }

const BULAN_OPTIONS = [
  { val: '01', label: 'Januari' }, { val: '02', label: 'Februari' },
  { val: '03', label: 'Maret' }, { val: '04', label: 'April' },
  { val: '05', label: 'Mei' }, { val: '06', label: 'Juni' },
  { val: '07', label: 'Juli' }, { val: '08', label: 'Agustus' },
  { val: '09', label: 'September' }, { val: '10', label: 'Oktober' },
  { val: '11', label: 'November' }, { val: '12', label: 'Desember' },
]

export default function RekapAbsensiGuruPage() {
  const [guruId, setGuruId] = useState('')
  const [guruNama, setGuruNama] = useState('')
  const [guruNip, setGuruNip] = useState('')

  const [kelasList, setKelasList] = useState<KelasOpt[]>([])
  const [mapelList, setMapelList] = useState<MapelOpt[]>([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedMapel, setSelectedMapel] = useState('')

  const [mode, setMode] = useState<'bulan' | 'semester'>('bulan')
  const [bulan, setBulan] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'))
  const [tahun] = useState(new Date().getFullYear())
  const [semester, setSemester] = useState<'1' | '2'>('1')

  const [rekap, setRekap] = useState<RekapSiswa[]>([])
  const [loading, setLoading] = useState(false)
  const [tampilan, setTampilan] = useState<'ringkasan' | 'matrix'>('ringkasan')
  const [pertemuanList, setPertemuanList] = useState<Pertemuan[]>([])
  const [matrix, setMatrix] = useState<MatrixRow[]>([])

  // Sesi guru lewat /api/auth/me (cookie ID httpOnly, tidak bisa dibaca via document.cookie)
  useEffect(() => {
    const nama = document.cookie.split('; ').find(r => r.startsWith('smpn36_user_nama='))?.split('=')[1]
    if (nama) setGuruNama(decodeURIComponent(nama))

    const init = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.loggedIn && data.userId) setGuruId(data.userId)
      } catch (err) {
        console.error('[guru/rekap-absensi] gagal ambil identitas:', err)
      }
    }
    init()
  }, [])

  // Ambil profil guru (untuk NIP di lembar tanda tangan)
  useEffect(() => {
    if (!guruId) return
    supabase.from('users').select('nip').eq('id', guruId).single()
      .then(({ data }) => { if (data?.nip) setGuruNip(data.nip) })
  }, [guruId])

  // Ambil kelas & mapel yang diampu guru ini
  useEffect(() => {
    if (!guruId) return
    supabase
      .from('guru_mapel')
      .select('kelas_id, kelas:kelas_id(id, nama_rombel), mapel_id, mata_pelajaran:mapel_id(id, nama_mapel)')
      .eq('guru_id', guruId)
      .eq('tahun_ajaran', '2026/2027')
      .then(({ data }) => {
        if (!data) return
        const kelas = Array.from(new Map(data.map((d: any) => [d.kelas_id, d.kelas])).values()).filter(Boolean) as KelasOpt[]
        const mapel = Array.from(new Map(data.map((d: any) => [d.mapel_id, d.mata_pelajaran])).values()).filter(Boolean) as MapelOpt[]
        setKelasList(kelas)
        setMapelList(mapel)
        if (kelas[0]) setSelectedKelas(kelas[0].id)
        if (mapel[0]) setSelectedMapel(mapel[0].id)
      })
  }, [guruId])

  const getNamaBulan = (val: string) => BULAN_OPTIONS.find(b => b.val === val)?.label || ''
  const getPeriodeLabel = () => mode === 'bulan'
    ? `${getNamaBulan(bulan)} ${tahun}`
    : `Semester ${semester} Tahun ${tahun}/${tahun + 1}`

  const fetchRekap = useCallback(async () => {
    if (!selectedKelas || !selectedMapel) { setRekap([]); return }
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

    const { data: siswaKelasData } = await supabase
      .from('siswa_kelas')
      .select('users(id, nama, nisn)')
      .eq('kelas_id', selectedKelas)
      .eq('tahun_ajaran', '2026/2027')
      .eq('status', 'aktif')

    const siswaData = (siswaKelasData || [])
      .map((d: any) => d.users)
      .filter(Boolean)
      .sort((a: any, b: any) => a.nama.localeCompare(b.nama))

    const { data: absenData } = await supabase
      .from('absensi_mapel')
      .select('siswa_id, status, tanggal')
      .eq('kelas_id', selectedKelas)
      .eq('mapel_id', selectedMapel)
      .gte('tanggal', mulai)
      .lte('tanggal', selesai)

    const map: Record<string, RekapSiswa> = {}
    ;(siswaData || []).forEach((s: any) => {
      map[s.id] = { siswa_id: s.id, nisn: s.nisn, nama: s.nama, H: 0, S: 0, I: 0, A: 0, T: 0, D: 0, total: 0, persen: 0 }
    })
    ;(absenData || []).forEach((a: any) => {
      if (!map[a.siswa_id]) return
      const kode = a.status as keyof typeof STATUS_LABEL
      if (map[a.siswa_id][kode] !== undefined) (map[a.siswa_id] as any)[kode]++
      map[a.siswa_id].total++
    })

    const result = Object.values(map).map(s => ({
      ...s, persen: s.total > 0 ? Math.round((s.H / s.total) * 100) : 0,
    })).sort((a, b) => a.nama.localeCompare(b.nama))

    setRekap(result)
    setLoading(false)
  }, [selectedKelas, selectedMapel, mode, bulan, tahun, semester])

  useEffect(() => { fetchRekap() }, [fetchRekap])

  const fetchMatrix = useCallback(async () => {
    if (!selectedKelas || !selectedMapel) { setMatrix([]); setPertemuanList([]); return }
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

    const { data: siswaKelasData } = await supabase
      .from('siswa_kelas')
      .select('users(id, nama, nisn)')
      .eq('kelas_id', selectedKelas)
      .eq('tahun_ajaran', '2026/2027')
      .eq('status', 'aktif')

    const siswaData = (siswaKelasData || [])
      .map((d: any) => d.users)
      .filter(Boolean)
      .sort((a: any, b: any) => a.nama.localeCompare(b.nama))

    const { data: absenData } = await supabase
      .from('absensi_mapel')
      .select('siswa_id, status, tanggal, pertemuan_ke')
      .eq('kelas_id', selectedKelas)
      .eq('mapel_id', selectedMapel)
      .gte('tanggal', mulai)
      .lte('tanggal', selesai)
      .order('pertemuan_ke')

    // Daftar pertemuan unik yang benar-benar ada datanya pada periode ini
    const pertemuanMap = new Map<number, string>()
    ;(absenData || []).forEach((a: any) => {
      if (!pertemuanMap.has(a.pertemuan_ke)) pertemuanMap.set(a.pertemuan_ke, a.tanggal)
    })
    const daftarPertemuan = Array.from(pertemuanMap.entries())
      .map(([pertemuan_ke, tanggal]) => ({ pertemuan_ke, tanggal }))
      .sort((a, b) => a.pertemuan_ke - b.pertemuan_ke)

    // Susun matrix siswa x pertemuan
    const rows: MatrixRow[] = (siswaData || []).map((s: any) => ({
      siswa_id: s.id, nisn: s.nisn, nama: s.nama, status: {},
    }))
    const rowById: Record<string, MatrixRow> = {}
    rows.forEach(r => { rowById[r.siswa_id] = r })
    ;(absenData || []).forEach((a: any) => {
      if (rowById[a.siswa_id]) rowById[a.siswa_id].status[a.pertemuan_ke] = a.status
    })

    setPertemuanList(daftarPertemuan)
    setMatrix(rows)
    setLoading(false)
  }, [selectedKelas, selectedMapel, mode, bulan, tahun, semester])

  useEffect(() => {
    if (tampilan === 'matrix') fetchMatrix()
  }, [tampilan, fetchMatrix])

  const formatTglSingkat = (tgl: string) => {
    const d = new Date(tgl + 'T00:00:00')
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
  }

  const totalH = rekap.reduce((a, r) => a + r.H, 0)
  const totalS = rekap.reduce((a, r) => a + r.S, 0)
  const totalI = rekap.reduce((a, r) => a + r.I, 0)
  const totalA = rekap.reduce((a, r) => a + r.A, 0)
  const rataKehadiran = rekap.length > 0 ? Math.round(rekap.reduce((a, r) => a + r.persen, 0) / rekap.length) : 0

  const namaKelas = kelasList.find(k => k.id === selectedKelas)?.nama_rombel ?? ''
  const namaMapel = mapelList.find(m => m.id === selectedMapel)?.nama_mapel ?? ''

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const periode = getPeriodeLabel()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const headerRows = [
      ['REKAP ABSENSI SISWA'],
      ['SMP NEGERI 36 BANDUNG'],
      [''],
      ['Kelas', ':', namaKelas],
      ['Mata Pelajaran', ':', namaMapel],
      ['Periode', ':', periode],
      ['Guru Mapel', ':', guruNama],
      [''],
    ]

    const tableHeader = ['No', 'NISN', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Terlambat', 'Dispensasi', 'Total', '% Kehadiran']

    const tableData = rekap.map((r, i) => [
      i + 1, r.nisn, r.nama, r.H, r.S, r.I, r.A, r.T, r.D, r.total, r.persen + '%',
    ])

    const totalRow = ['', '', 'TOTAL', totalH, totalS, totalI, totalA,
      rekap.reduce((a, r) => a + r.T, 0), rekap.reduce((a, r) => a + r.D, 0),
      rekap.reduce((a, r) => a + r.total, 0), rataKehadiran + '%']

    const ttdRows = [
      [''],
      ['', '', '', '', '', '', '', 'Bandung, ' + today],
      ['', '', '', '', '', '', '', 'Guru Mata Pelajaran,'],
      [''], [''], [''],
      ['', '', '', '', '', '', '', guruNama],
      ['', '', '', '', '', '', '', 'NIP. ' + guruNip],
    ]

    const allRows = [...headerRows, tableHeader, ...tableData, totalRow, ...ttdRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 14 }, { wch: 28 }, { wch: 7 }, { wch: 7 },
      { wch: 7 }, { wch: 7 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Absensi')
    XLSX.writeFile(wb, `Rekap-Absensi-${namaKelas}-${namaMapel}-${periode.replace(/ /g, '-')}.xlsx`)
  }

  const handleExportExcelMatrix = () => {
    const wb = XLSX.utils.book_new()
    const periode = getPeriodeLabel()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const headerRows = [
      ['REKAP ABSENSI SISWA PER PERTEMUAN'],
      ['SMP NEGERI 36 BANDUNG'],
      [''],
      ['Kelas', ':', namaKelas],
      ['Mata Pelajaran', ':', namaMapel],
      ['Periode', ':', periode],
      ['Guru Mapel', ':', guruNama],
      [''],
    ]

    const tableHeader = ['No', 'NISN', 'Nama Siswa', ...pertemuanList.map(p => `Ke-${p.pertemuan_ke} (${formatTglSingkat(p.tanggal)})`)]

    const tableData = matrix.map((r, i) => [
      i + 1, r.nisn, r.nama, ...pertemuanList.map(p => r.status[p.pertemuan_ke] ?? '-'),
    ])

    const ttdRows = [
      [''],
      ['', '', '', '', '', '', '', 'Bandung, ' + today],
      ['', '', '', '', '', '', '', 'Guru Mata Pelajaran,'],
      [''], [''], [''],
      ['', '', '', '', '', '', '', guruNama],
      ['', '', '', '', '', '', '', 'NIP. ' + guruNip],
    ]

    const allRows = [...headerRows, tableHeader, ...tableData, ...ttdRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 28 }, ...pertemuanList.map(() => ({ wch: 10 }))]

    XLSX.utils.book_append_sheet(wb, ws, 'Per Pertemuan')
    XLSX.writeFile(wb, `Absensi-PerPertemuan-${namaKelas}-${namaMapel}-${periode.replace(/ /g, '-')}.xlsx`)
  }

  // Cetak / PDF -- pakai print dialog browser (Simpan sebagai PDF), tanpa dependency tambahan
  const handleCetak = () => {
    const periode = getPeriodeLabel()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    let tableHtml = ''

    if (tampilan === 'ringkasan') {
      tableHtml = `
        <table>
          <thead><tr><th>No</th><th>NISN</th><th>Nama Siswa</th><th>Hadir</th><th>Sakit</th><th>Izin</th><th>Alpa</th><th>Total</th><th>% Hadir</th></tr></thead>
          <tbody>
            ${rekap.map((r, i) => `<tr><td>${i + 1}</td><td>${r.nisn}</td><td class="left">${r.nama}</td><td>${r.H}</td><td>${r.S || '-'}</td><td>${r.I || '-'}</td><td>${r.A || '-'}</td><td>${r.total}</td><td>${r.persen}%</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><td colSpan="3">TOTAL</td><td>${totalH}</td><td>${totalS}</td><td>${totalI}</td><td>${totalA}</td><td>${rekap.reduce((a, r) => a + r.total, 0)}</td><td>${rataKehadiran}%</td></tr></tfoot>
        </table>`
    } else {
      tableHtml = `
        <table>
          <thead><tr><th>No</th><th>Nama Siswa</th>${pertemuanList.map(p => `<th>Ke-${p.pertemuan_ke}<br/><small>${formatTglSingkat(p.tanggal)}</small></th>`).join('')}</tr></thead>
          <tbody>
            ${matrix.map((r, i) => `<tr><td>${i + 1}</td><td class="left">${r.nama}</td>${pertemuanList.map(p => `<td>${r.status[p.pertemuan_ke] ?? '-'}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>`
    }

    const html = `
      <html><head><title>Absensi ${namaKelas} - ${namaMapel}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 16px; margin: 0; }
        h2 { font-size: 13px; margin: 2px 0 14px; font-weight: normal; color: #555; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 5px 6px; text-align: center; }
        td.left, th.left { text-align: left; }
        thead { background: #1a3a6b; color: white; }
        tfoot { font-weight: bold; background: #f3f4f6; }
        .info { font-size: 12px; margin-bottom: 12px; }
        .info div { margin-bottom: 2px; }
        .ttd { margin-top: 40px; font-size: 12px; text-align: right; }
        @media print { body { padding: 8px; } }
      </style></head>
      <body>
        <h1>REKAP ABSENSI SISWA${tampilan === 'matrix' ? ' PER PERTEMUAN' : ''}</h1>
        <h2>SMP Negeri 36 Bandung</h2>
        <div class="info">
          <div><b>Kelas:</b> ${namaKelas}</div>
          <div><b>Mata Pelajaran:</b> ${namaMapel}</div>
          <div><b>Periode:</b> ${periode}</div>
        </div>
        ${tableHtml}
        <div class="ttd">
          Bandung, ${today}<br/>Guru Mata Pelajaran,<br/><br/><br/><br/>
          <b>${guruNama}</b><br/>NIP. ${guruNip}
        </div>
        <script>window.onload = () => window.print()</script>
      </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">Rekap Absensi</h1>
          <p className="text-sm text-gray-400 mt-0.5">Rekap kehadiran siswa per bulan & semester untuk kelas yang Anda ampu</p>
        </div>
        <div className="flex gap-2">
          {((tampilan === 'ringkasan' && rekap.length > 0) || (tampilan === 'matrix' && matrix.length > 0)) && (
            <>
              <button onClick={handleCetak}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4H8v4a1 1 0 001 1zm8-12V5a1 1 0 00-1-1H8a1 1 0 00-1 1v4h10z"/></svg>
                Cetak / PDF
              </button>
              <button onClick={tampilan === 'ringkasan' ? handleExportExcel : handleExportExcelMatrix}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H8a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Export Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
            <select value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]">
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_rombel}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
            <select value={selectedMapel} onChange={e => setSelectedMapel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]">
              {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama_mapel}</option>)}
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a6b]/20 focus:border-[#1a3a6b]">
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

      {/* Toggle Tampilan */}
      <div className="flex gap-2">
        {(['ringkasan', 'matrix'] as const).map(t => (
          <button key={t} onClick={() => setTampilan(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition
              ${tampilan === t ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
            {t === 'ringkasan' ? 'Ringkasan' : 'Tabel Per Pertemuan'}
          </button>
        ))}
      </div>

      {tampilan === 'ringkasan' ? (
      <>
      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
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

      {/* Tabel Ringkasan */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-[#1a3a6b] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat rekap...
          </div>
        ) : !selectedKelas || !selectedMapel ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Pilih kelas dan mata pelajaran untuk melihat rekap.
          </div>
        ) : rekap.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-medium text-sm">Belum ada data absensi pada periode ini</p>
            <p className="text-xs mt-1">Input absensi terlebih dahulu di menu Absensi</p>
          </div>
        ) : (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rekap.map((r, i) => (
                  <tr key={r.siswa_id} className={`hover:bg-gray-50/50 transition ${r.A >= 3 ? 'bg-red-50/40' : ''}`}>
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
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      </>
      ) : (
      /* Tabel Per Pertemuan -- baris siswa, kolom tiap pertemuan (nomor + tanggal di header),
         persis format absensi kertas: mudah dilihat progres kehadiran sepanjang periode */
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-[#1a3a6b] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat data...
          </div>
        ) : !selectedKelas || !selectedMapel ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Pilih kelas dan mata pelajaran untuk melihat tabel.
          </div>
        ) : pertemuanList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-medium text-sm">Belum ada pertemuan tercatat pada periode ini</p>
            <p className="text-xs mt-1">Input absensi terlebih dahulu di menu Absensi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a3a6b] text-white">
                  <th className="sticky left-0 bg-[#1a3a6b] px-4 py-3 text-left font-semibold w-8 z-10">No</th>
                  <th className="sticky left-8 bg-[#1a3a6b] px-4 py-3 text-left font-semibold min-w-[180px] z-10">Nama Siswa</th>
                  {pertemuanList.map(p => (
                    <th key={p.pertemuan_ke} className="px-2 py-2 text-center font-semibold border-l border-white/10 min-w-[52px]">
                      <div className="leading-tight">
                        <div>Ke-{p.pertemuan_ke}</div>
                        <div className="text-[10px] font-normal opacity-80">{formatTglSingkat(p.tanggal)}</div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {matrix.map((r, i) => (
                  <tr key={r.siswa_id} className="hover:bg-gray-50/50 transition">
                    <td className="sticky left-0 bg-white px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="sticky left-8 bg-white px-4 py-2.5 font-medium text-gray-800">{r.nama}</td>
                    {pertemuanList.map(p => {
                      const s = r.status[p.pertemuan_ke]
                      const warna: Record<string, string> = {
                        H: 'text-green-600', S: 'text-yellow-600', I: 'text-blue-600',
                        A: 'text-red-600 font-bold', T: 'text-orange-500', D: 'text-purple-500',
                      }
                      return (
                        <td key={p.pertemuan_ke} className={`px-2 py-2.5 text-center border-l border-gray-50 ${s ? warna[s] ?? '' : 'text-gray-300'}`}>
                          {s ?? '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
