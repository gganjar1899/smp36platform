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

type Siswa = { id: string; nisn: string | null; nama: string }
type NilaiMap = { [siswaId: string]: { [key: string]: number | null } }
type KelasOpt = { id: string; nama_rombel: string }
type MapelOpt = { id: string; nama_mapel: string }

const KKM = 70
const getKualifikasi = (nilai: number | null) => {
  if (nilai === null) return { label: '-', color: 'text-gray-400' }
  if (nilai >= 90) return { label: 'A', color: 'text-green-600' }
  if (nilai >= 80) return { label: 'B', color: 'text-blue-600' }
  if (nilai >= 70) return { label: 'C', color: 'text-yellow-600' }
  return { label: 'D', color: 'text-red-600' }
}

export default function NilaiLegerGuruPage() {
  const [guruId, setGuruId] = useState('')
  const [guruNip, setGuruNip] = useState('')
  const [guruNama, setGuruNama] = useState('Guru')
  const [authReady, setAuthReady] = useState(false)

  const [kelasList, setKelasList] = useState<KelasOpt[]>([])
  const [mapelList, setMapelList] = useState<MapelOpt[]>([])
  const [kelasId, setKelasId] = useState('')
  const [mapelId, setMapelId] = useState('')

  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [nilaiMap, setNilaiMap] = useState<NilaiMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [semester, setSemester] = useState('1')
  const [tahunAjaran] = useState('2026/2027')
  const [jmlFormatif, setJmlFormatif] = useState(3)

  // Sesi guru + kelas/mapel yang benar-benar diajar (guru_mapel)
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data.loggedIn || data.role !== 'guru') { setAuthReady(true); return }

        setGuruId(data.userId)
        setGuruNama(data.nama ?? 'Guru')

        const { data: userRow } = await supabase.from('users').select('nip').eq('id', data.userId).maybeSingle()
        if (userRow?.nip) setGuruNip(userRow.nip)

        const { data: mengajar } = await supabase
          .from('guru_mapel')
          .select('kelas:kelas_id(id, nama_rombel), mapel:mapel_id(id, nama_mapel)')
          .eq('guru_id', data.userId)
          .eq('tahun_ajaran', '2026/2027')

        if (mengajar) {
          const kelas = Array.from(new Map(mengajar.map((m: any) => [m.kelas?.id, m.kelas])).values()).filter(Boolean) as KelasOpt[]
          const mapel = Array.from(new Map(mengajar.map((m: any) => [m.mapel?.id, m.mapel])).values()).filter(Boolean) as MapelOpt[]
          setKelasList(kelas)
          setMapelList(mapel)
          if (kelas[0]) setKelasId(kelas[0].id)
          if (mapel[0]) setMapelId(mapel[0].id)
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
    if (!kelasId || !mapelId) { setLoading(false); return }
    setLoading(true)

    const { data: sk } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, siswa:siswa_id(id, nama, nisn)')
      .eq('kelas_id', kelasId).eq('tahun_ajaran', tahunAjaran).eq('status', 'aktif')

    const siswa = ((sk || []).map((r: any) => r.siswa).filter(Boolean) as Siswa[])
      .sort((a, b) => a.nama.localeCompare(b.nama))

    const { data: formatifData } = await supabase
      .from('nilai_formatif').select('siswa_id, pertemuan_ke, nilai')
      .eq('kelas_id', kelasId).eq('mapel_id', mapelId).eq('semester', semester).eq('tahun_ajaran', tahunAjaran)

    const { data: sumatifData } = await supabase
      .from('nilai_sumatif').select('siswa_id, nilai')
      .eq('kelas_id', kelasId).eq('mapel_id', mapelId).eq('jenis', 'Sumatif')
      .eq('semester', semester).eq('tahun_ajaran', tahunAjaran)

    const map: NilaiMap = {}
    siswa.forEach(s => {
      map[s.id] = { S1: null, F1: null, F2: null, F3: null, F4: null, F5: null, F6: null }
    })
    formatifData?.forEach(n => {
      if (map[n.siswa_id]) map[n.siswa_id][`F${n.pertemuan_ke}`] = n.nilai
    })
    sumatifData?.forEach(n => {
      if (map[n.siswa_id]) map[n.siswa_id].S1 = n.nilai
    })

    setSiswaList(siswa)
    setNilaiMap(map)
    setLoading(false)
  }, [kelasId, mapelId, semester, tahunAjaran])

  useEffect(() => { fetchData() }, [fetchData])

  const getRataFormatif = (id: string) => {
    const vals = Array.from({ length: jmlFormatif }, (_, i) => nilaiMap[id]?.[`F${i + 1}`]).filter(v => v !== null && v !== undefined) as number[]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  const getNilaiAkhir = (id: string) => {
    const rtf = getRataFormatif(id)
    const s = nilaiMap[id]?.S1 ?? null
    if (rtf === null && s === null) return null
    if (rtf === null) return s
    if (s === null) return rtf
    return Math.round((2 * rtf + s) / 3)
  }

  const setNilai = (id: string, key: string, val: string) => {
    const num = val === '' ? null : parseFloat(val)
    setNilaiMap(prev => ({ ...prev, [id]: { ...prev[id], [key]: num } }))
    setSaved(false)
  }

  const handleSimpan = async () => {
    if (!guruId) { alert('Sesi login tidak ditemukan, silakan login ulang.'); return }
    setSaving(true)

    const formatifRows: any[] = []
    const sumatifRows: any[] = []
    siswaList.forEach(s => {
      for (let i = 1; i <= jmlFormatif; i++) {
        const v = nilaiMap[s.id]?.[`F${i}`]
        if (v !== null && v !== undefined) {
          formatifRows.push({
            siswa_id: s.id, kelas_id: kelasId, mapel_id: mapelId, guru_id: guruId,
            jenis: 'Formatif', pertemuan_ke: i, nilai: v, semester: parseInt(semester), tahun_ajaran: tahunAjaran, sumber: 'Manual',
          })
        }
      }
      const sv = nilaiMap[s.id]?.S1
      if (sv !== null && sv !== undefined) {
        sumatifRows.push({
          siswa_id: s.id, kelas_id: kelasId, mapel_id: mapelId, guru_id: guruId,
          jenis: 'Sumatif', nilai: sv, semester: parseInt(semester), tahun_ajaran: tahunAjaran, sumber: 'Manual',
        })
      }
    })

    let err = null
    if (formatifRows.length > 0) {
      const { error } = await supabase.from('nilai_formatif')
        .upsert(formatifRows, { onConflict: 'siswa_id,mapel_id,kelas_id,semester,tahun_ajaran,pertemuan_ke' })
      if (error) err = error
    }
    if (sumatifRows.length > 0) {
      const { error } = await supabase.from('nilai_sumatif')
        .upsert(sumatifRows, { onConflict: 'siswa_id,mapel_id,kelas_id,jenis,semester,tahun_ajaran' })
      if (error) err = error
    }

    setSaving(false)
    if (!err) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else alert('Gagal menyimpan: ' + err.message)
  }

  const namaKelas = kelasList.find(k => k.id === kelasId)?.nama_rombel ?? ''
  const namaMapel = mapelList.find(m => m.id === mapelId)?.nama_mapel ?? ''

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
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
      const rtf = getRataFormatif(s.id)
      const na = getNilaiAkhir(s.id)
      const kual = getKualifikasi(na)
      return [
        i + 1, s.nisn || '-', s.nama,
        ...Array.from({ length: jmlFormatif }, (_, j) => nilaiMap[s.id]?.[`F${j + 1}`] ?? ''),
        rtf ?? '', nilaiMap[s.id]?.S1 ?? '', na ?? '', kual.label,
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
    const vals = siswaList.map(s => getNilaiAkhir(s.id)).filter(v => v !== null) as number[]
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }
  const tuntas = siswaList.filter(s => { const na = getNilaiAkhir(s.id); return na !== null && na >= KKM }).length
  const belumTuntas = siswaList.filter(s => { const na = getNilaiAkhir(s.id); return na !== null && na < KKM }).length

  if (!authReady) {
    return <div className="p-6 text-center text-gray-400">Memuat sesi...</div>
  }

  if (kelasList.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          Belum ada kelas/mapel yang ditugaskan untuk Anda tahun ajaran ini.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nilai & Leger</h1>
          <p className="text-gray-500 text-sm mt-1">{guruNama} · {tahunAjaran}</p>
        </div>
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

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
            <select value={kelasId} onChange={e => setKelasId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_rombel}</option>)}
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
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Jumlah Formatif</label>
            <select value={jmlFormatif} onChange={e => setJmlFormatif(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} kali</option>)}
            </select>
          </div>
        </div>
      </div>

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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Memuat data...
          </div>
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
                    const rtf = getRataFormatif(s.id)
                    const na = getNilaiAkhir(s.id)
                    const kual = getKualifikasi(na)
                    return (
                      <tr key={s.id} className="hover:bg-blue-50/20 transition">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 text-xs">{s.nama}</td>
                        {Array.from({ length: jmlFormatif }, (_, j) => (
                          <td key={j} className="px-1 py-1 text-center">
                            <input type="number" min="0" max="100"
                              value={nilaiMap[s.id]?.[`F${j + 1}`] ?? ''}
                              onChange={e => setNilai(s.id, `F${j + 1}`, e.target.value)}
                              className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-center font-semibold text-blue-700 text-xs bg-blue-50">{rtf ?? '-'}</td>
                        <td className="px-1 py-1 text-center">
                          <input type="number" min="0" max="100"
                            value={nilaiMap[s.id]?.S1 ?? ''}
                            onChange={e => setNilai(s.id, 'S1', e.target.value)}
                            className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
    </div>
  )
}
