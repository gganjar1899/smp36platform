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

type Siswa = { id: string; nis: string; nisn: string; nama: string; jenis_kelamin: string }
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
  const [activeTab, setActiveTab] = useState<'leger' | 'harian' | 'cbt'>('leger')

  // ==== Nilai Harian (Tugas + Ulangan Harian, terpisah dari PTS/PAS/ASAT) ====
  const [loadingHarian, setLoadingHarian] = useState(false)
  const [tugasKolom, setTugasKolom] = useState<{ id: string; judul: string }[]>([])
  const [uhKolom, setUhKolom] = useState<{ id: string; judul: string }[]>([])
  const [nilaiTugasMap, setNilaiTugasMap] = useState<Record<string, Record<string, number | null>>>({})
  const [nilaiUhMap, setNilaiUhMap] = useState<Record<string, Record<string, number | null>>>({})
  const [kolomManual, setKolomManual] = useState<{ id: string; label: string }[]>([])
  const [nilaiManualMap, setNilaiManualMap] = useState<Record<string, Record<string, number | null>>>({}) // kolomId -> siswaId(uuid) -> nilai
  const [tambahKolomOpen, setTambahKolomOpen] = useState(false)
  const [labelKolomBaru, setLabelKolomBaru] = useState('')
  const [targetFormatif, setTargetFormatif] = useState(1)
  const [terapkanMsg, setTerapkanMsg] = useState('')
  const [guruId, setGuruId] = useState('')

  // Ambil identitas guru yang login + kelas/mapel yang benar-benar diajar (guru_mapel)
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data.loggedIn || data.role !== 'guru') { setAuthReady(true); return }

        setGuruNama(data.nama ?? 'Guru')
        setGuruId(data.userId)

        const { data: userRow } = await supabase
          .from('users').select('nip').eq('id', data.userId).maybeSingle()
        if (userRow?.nip) setGuruNip(userRow.nip)

        const { data: mengajar } = await supabase
          .from('guru_mapel')
          .select('kelas:kelas_id(nama_rombel), mapel:mapel_id(nama:nama_mapel)')
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
      .from('siswa').select('id,nis,nisn,nama,jenis_kelamin')
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

  const [userIdByNisn, setUserIdByNisn] = useState<Record<string, string>>({})

  // Ambil data Tugas (nilai dari pengumpulan_tugas) + Ulangan Harian (nilai_akhir dari sesi_siswa)
  // + kolom manual bebas yang sudah dibuat guru. Sengaja TIDAK menarik PTS/PAS/ASAT.
  const fetchNilaiHarian = useCallback(async () => {
    if (!kelas || !mapel || siswaList.length === 0) { setLoadingHarian(false); return }
    setLoadingHarian(true)

    const { data: kelasRow } = await supabase.from('kelas').select('id, tingkat').eq('nama_rombel', kelas).maybeSingle()
    if (!kelasRow) { setLoadingHarian(false); return }

    const [{ data: mapelPerTingkat }, { data: mataPelajaran }, { data: usersRows }] = await Promise.all([
      supabase.from('mapel').select('id').eq('nama', mapel).eq('tingkat', kelasRow.tingkat).maybeSingle(),
      supabase.from('mata_pelajaran').select('id').eq('nama_mapel', mapel).maybeSingle(),
      supabase.from('users').select('id, nisn').in('nisn', siswaList.map(s => s.nisn).filter(Boolean)),
    ])

    const nisnToId: Record<string, string> = {}
    ;(usersRows || []).forEach((u: any) => { if (u.nisn) nisnToId[u.nisn] = u.id })
    setUserIdByNisn(nisnToId)

    // Tugas untuk kelas + mapel ini
    let tugasRows: any[] = []
    if (mapelPerTingkat) {
      const { data } = await supabase.from('tugas').select('id, judul')
        .eq('kelas_id', kelasRow.id).eq('mapel_id', mapelPerTingkat.id).order('deadline')
      tugasRows = data || []
    }
    setTugasKolom(tugasRows.map(t => ({ id: t.id, judul: t.judul })))

    const tMap: Record<string, Record<string, number | null>> = {}
    if (tugasRows.length > 0) {
      const { data: pengumpulan } = await supabase
        .from('pengumpulan_tugas')
        .select('tugas_id, nilai, siswa:siswa_id(nisn)')
        .in('tugas_id', tugasRows.map(t => t.id))
      ;(pengumpulan || []).forEach((p: any) => {
        const nisn = p.siswa?.nisn
        if (!nisn) return
        if (!tMap[nisn]) tMap[nisn] = {}
        tMap[nisn][p.tugas_id] = p.nilai
      })
    }
    setNilaiTugasMap(tMap)

    // Ulangan Harian untuk kelas + mapel ini
    let uhRows: any[] = []
    if (mataPelajaran) {
      const { data } = await supabase.from('ujian').select('id, judul')
        .eq('kelas_id', kelasRow.id).eq('mapel_id', mataPelajaran.id).eq('jenis_ujian', 'ulangan_harian')
        .order('created_at')
      uhRows = data || []
    }
    setUhKolom(uhRows.map(u => ({ id: u.id, judul: u.judul })))

    const uMap: Record<string, Record<string, number | null>> = {}
    if (uhRows.length > 0) {
      const { data: sesi } = await supabase
        .from('sesi_siswa')
        .select('ujian_id, nilai_akhir, siswa:siswa_id(nisn)')
        .in('ujian_id', uhRows.map(u => u.id))
      ;(sesi || []).forEach((s: any) => {
        const nisn = s.siswa?.nisn
        if (!nisn) return
        if (!uMap[nisn]) uMap[nisn] = {}
        uMap[nisn][s.ujian_id] = s.nilai_akhir
      })
    }
    setNilaiUhMap(uMap)

    // Kolom manual bebas (dibuat guru sendiri, mis. "Tugas 1", "Kuis Bab 2")
    if (mapelPerTingkat) {
      const { data: kolomRows } = await supabase
        .from('nilai_harian_kolom')
        .select('id, label')
        .eq('guru_id', guruId).eq('kelas_id', kelasRow.id).eq('mapel_id', mapelPerTingkat.id)
        .eq('tahun_ajaran', '2026/2027')
        .order('urutan')
      const kolom = kolomRows || []
      setKolomManual(kolom.map((k: any) => ({ id: k.id, label: k.label })))

      if (kolom.length > 0) {
        const { data: nilaiRows } = await supabase
          .from('nilai_harian_nilai')
          .select('kolom_id, siswa_id, nilai')
          .in('kolom_id', kolom.map((k: any) => k.id))
        const mMap: Record<string, Record<string, number | null>> = {}
        ;(nilaiRows || []).forEach((n: any) => {
          if (!mMap[n.kolom_id]) mMap[n.kolom_id] = {}
          mMap[n.kolom_id][n.siswa_id] = n.nilai
        })
        setNilaiManualMap(mMap)
      } else {
        setNilaiManualMap({})
      }
    }

    setLoadingHarian(false)
  }, [kelas, mapel, siswaList, guruId])

  useEffect(() => { if (activeTab === 'harian') fetchNilaiHarian() }, [activeTab, fetchNilaiHarian])

  const handleTambahKolom = async () => {
    if (!labelKolomBaru.trim()) return
    const kelasRow = await supabase.from('kelas').select('id, tingkat').eq('nama_rombel', kelas).maybeSingle()
    if (!kelasRow.data) return
    const mapelRow = await supabase.from('mapel').select('id').eq('nama', mapel).eq('tingkat', kelasRow.data.tingkat).maybeSingle()
    if (!mapelRow.data) { alert('Mapel tidak ditemukan untuk tingkat kelas ini.'); return }

    const { data, error } = await supabase.from('nilai_harian_kolom').insert({
      guru_id: guruId, kelas_id: kelasRow.data.id, mapel_id: mapelRow.data.id,
      label: labelKolomBaru, urutan: kolomManual.length, tahun_ajaran: '2026/2027', semester: '1',
    }).select().single()

    if (error) { alert('Gagal menambah kolom: ' + error.message); return }
    setKolomManual(prev => [...prev, { id: data.id, label: data.label }])
    setLabelKolomBaru('')
    setTambahKolomOpen(false)
  }

  const handleHapusKolom = async (kolomId: string) => {
    if (!confirm('Hapus kolom ini beserta semua nilainya?')) return
    await supabase.from('nilai_harian_kolom').delete().eq('id', kolomId)
    setKolomManual(prev => prev.filter(k => k.id !== kolomId))
    setNilaiManualMap(prev => { const next = { ...prev }; delete next[kolomId]; return next })
  }

  const handleSimpanNilaiManual = async (kolomId: string, siswaNisn: string, nilai: number | null) => {
    const siswaId = userIdByNisn[siswaNisn]
    if (!siswaId) return
    setNilaiManualMap(prev => ({ ...prev, [kolomId]: { ...prev[kolomId], [siswaId]: nilai } }))
    await supabase.from('nilai_harian_nilai').upsert(
      { kolom_id: kolomId, siswa_id: siswaId, nilai, updated_at: new Date().toISOString() },
      { onConflict: 'kolom_id,siswa_id' }
    )
  }

  const rataHarian = (nisn: string): number | null => {
    const nilaiTugas = Object.values(nilaiTugasMap[nisn] ?? {}).filter((v): v is number => v !== null && v !== undefined)
    const nilaiUh = Object.values(nilaiUhMap[nisn] ?? {}).filter((v): v is number => v !== null && v !== undefined)
    const siswaId = userIdByNisn[nisn]
    const nilaiManual = kolomManual
      .map(k => siswaId ? nilaiManualMap[k.id]?.[siswaId] : null)
      .filter((v): v is number => v !== null && v !== undefined)
    const semua = [...nilaiTugas, ...nilaiUh, ...nilaiManual]
    if (semua.length === 0) return null
    return Math.round((semua.reduce((a, b) => a + b, 0) / semua.length) * 100) / 100
  }

  const handleTerapkanKeFormatif = () => {
    setNilaiMap(prev => {
      const next = { ...prev }
      siswaList.forEach(s => {
        const rata = rataHarian(s.nisn)
        if (rata === null) return
        next[s.nis] = { ...next[s.nis], [`F${targetFormatif}`]: rata }
      })
      return next
    })
    setTerapkanMsg(`Rata-rata Nilai Harian diisikan ke kolom F${targetFormatif} di tab Leger Nilai. Cek & klik "Simpan Nilai" di tab Leger untuk menyimpan permanen.`)
    setActiveTab('leger')
  }

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
        {[{ key: 'leger', label: '📊 Leger Nilai' }, { key: 'harian', label: '📝 Nilai Harian' }, { key: 'cbt', label: '💻 Kelola CBT' }].map(t => (
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

      {activeTab === 'harian' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
                <select value={kelas} onChange={e => setKelas(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {kelasSaya.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
                <select value={mapel} onChange={e => setMapel(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {mapelSaya.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                Menarik nilai dari <span className="font-semibold text-gray-500">Tugas</span> yang sudah dinilai dan <span className="font-semibold text-gray-500">Ulangan Harian</span> (CBT). PTS/PAS/ASAT tidak ikut — tetap dihitung terpisah sebagai Sumatif.
              </p>
            </div>
          </div>

          {loadingHarian ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">Memuat nilai harian...</div>
          ) : siswaList.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400">Pilih kelas & mapel dulu.</div>
          ) : (
            <>
              {/* Ringkasan */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Siswa', value: siswaList.length, color: 'text-gray-600 bg-gray-50 border-gray-200' },
                  { label: 'Komponen Tugas', value: tugasKolom.length, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                  { label: 'Ulangan Harian', value: uhKolom.length, color: 'text-purple-600 bg-purple-50 border-purple-200' },
                  { label: 'Kolom Manual', value: kolomManual.length, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3.5 text-center ${s.color}`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 py-3.5 text-left font-semibold text-gray-600 text-sm">Nama Siswa</th>
                        {tugasKolom.map(t => (
                          <th key={t.id} className="px-3 py-3.5 text-center min-w-[110px]">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold">
                              📝 {t.judul.length > 14 ? t.judul.slice(0, 14) + '…' : t.judul}
                            </span>
                          </th>
                        ))}
                        {uhKolom.map(u => (
                          <th key={u.id} className="px-3 py-3.5 text-center min-w-[110px]">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold">
                              💻 {u.judul.length > 14 ? u.judul.slice(0, 14) + '…' : u.judul}
                            </span>
                          </th>
                        ))}
                        {kolomManual.map(k => (
                          <th key={k.id} className="px-3 py-3.5 text-center min-w-[120px]">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">
                              ✏️ {k.label}
                              <button onClick={() => handleHapusKolom(k.id)} className="text-amber-400 hover:text-red-500 font-bold leading-none" title="Hapus kolom">×</button>
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-3.5 text-center min-w-[130px]">
                          {tambahKolomOpen ? (
                            <div className="flex items-center gap-1.5 justify-center">
                              <input autoFocus value={labelKolomBaru} onChange={e => setLabelKolomBaru(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleTambahKolom()}
                                placeholder="Nama kolom" className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              <button onClick={handleTambahKolom} className="w-6 h-6 flex items-center justify-center rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-xs font-bold">✓</button>
                              <button onClick={() => { setTambahKolomOpen(false); setLabelKolomBaru('') }} className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 text-xs">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setTambahKolomOpen(true)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1a3a6b] text-white text-xs font-semibold hover:bg-[#15305a] transition">
                              + Tambah Kolom
                            </button>
                          )}
                        </th>
                        <th className="px-4 py-3.5 text-center font-semibold text-gray-600 text-sm min-w-[90px]">Rata-rata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {siswaList.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-3 font-medium text-gray-700 text-sm">{s.nama}</td>
                          {tugasKolom.map(t => (
                            <td key={t.id} className="px-3 py-3 text-center text-sm text-gray-600">
                              {nilaiTugasMap[s.nisn]?.[t.id] ?? <span className="text-gray-300">-</span>}
                            </td>
                          ))}
                          {uhKolom.map(u => (
                            <td key={u.id} className="px-3 py-3 text-center text-sm text-gray-600">
                              {nilaiUhMap[s.nisn]?.[u.id] ?? <span className="text-gray-300">-</span>}
                            </td>
                          ))}
                          {kolomManual.map(k => {
                            const siswaId = userIdByNisn[s.nisn]
                            const val = siswaId ? nilaiManualMap[k.id]?.[siswaId] : null
                            return (
                              <td key={k.id} className="px-3 py-2.5 text-center">
                                <input type="number" min={0} max={100}
                                  defaultValue={val ?? ''}
                                  onBlur={e => handleSimpanNilaiManual(k.id, s.nisn, e.target.value === '' ? null : Number(e.target.value))}
                                  placeholder="-"
                                  className="w-16 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </td>
                            )
                          })}
                          <td className="px-3 py-3" />
                          <td className="px-4 py-3 text-center">
                            {rataHarian(s.nisn) !== null ? (
                              <span className="inline-block px-2.5 py-1 rounded-lg bg-[#1a3a6b]/10 text-[#1a3a6b] text-sm font-bold">
                                {rataHarian(s.nisn)}
                              </span>
                            ) : (
                              <span className="text-gray-300 text-sm">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {tugasKolom.length === 0 && uhKolom.length === 0 && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 leading-relaxed">
                  💡 Belum ada Tugas atau Ulangan Harian untuk kelas & mapel ini. Kamu masih bisa klik <span className="font-semibold">&quot;+ Tambah Kolom&quot;</span> di tabel di atas untuk input nilai manual.
                </p>
              )}

              <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 shadow-sm">
                <label className="text-sm text-gray-600">Terapkan rata-rata ini ke kolom</label>
                <select value={targetFormatif} onChange={e => setTargetFormatif(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {Array.from({ length: jmlFormatif }, (_, i) => i + 1).map(n => <option key={n} value={n}>F{n}</option>)}
                </select>
                <label className="text-sm text-gray-600">di Leger Nilai</label>
                <button onClick={handleTerapkanKeFormatif}
                  className="ml-auto px-5 py-2.5 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold transition">
                  Terapkan ke Leger →
                </button>
              </div>
              {terapkanMsg && (
                <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mt-3 leading-relaxed">✓ {terapkanMsg}</p>
              )}
            </>
          )}
        </div>
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
