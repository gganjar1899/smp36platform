'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Jurnal = {
  id: string
  tanggal: string
  kelas: string
  mata_pelajaran: string
  jam_ke: string
  materi: string
  kegiatan: string
  media: string
  metode: string
  catatan: string
}

const PERIODE = ['1','2','3','4','5','6','7','8','9','10']
const METODE = ['Ceramah','Diskusi','Praktik','Project Based','Problem Based','Discovery Learning','Cooperative Learning','Demonstrasi']
const MEDIA = ['Buku Teks','PPT/Slide','Video','Laptop/Komputer','Lembar Kerja','Alat Peraga','Internet','Papan Tulis']
const KEPSEK_NAMA = 'Elly Amalya, S.Pd., M.M.Pd.'
const KEPSEK_NIP = '197010131997022001'

const BULAN_OPTIONS = [
  { val: '', label: 'Semua Bulan' },
  { val: '01', label: 'Januari' }, { val: '02', label: 'Februari' },
  { val: '03', label: 'Maret' }, { val: '04', label: 'April' },
  { val: '05', label: 'Mei' }, { val: '06', label: 'Juni' },
  { val: '07', label: 'Juli' }, { val: '08', label: 'Agustus' },
  { val: '09', label: 'September' }, { val: '10', label: 'Oktober' },
  { val: '11', label: 'November' }, { val: '12', label: 'Desember' },
]

const formatTanggal = (tgl: string) =>
  new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const getNamaBulan = (val: string) => BULAN_OPTIONS.find(b => b.val === val)?.label || 'Semua Bulan'

export default function JurnalGuruPage() {
  // Identitas guru yang login (dari /api/auth/me, bukan hardcode)
  const [guruNip, setGuruNip] = useState('')
  const [guruNama, setGuruNama] = useState('Guru')
  const [kelasSaya, setKelasSaya] = useState<string[]>([])
  const [mapelSaya, setMapelSaya] = useState<string[]>([])
  const [authReady, setAuthReady] = useState(false)

  const [jurnal, setJurnal] = useState<Jurnal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterBulan, setFilterBulan] = useState('')
  const [filterMapel, setFilterMapel] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [tahun] = useState(new Date().getFullYear())

  const emptyForm = {
    tanggal: new Date().toISOString().split('T')[0],
    kelas: '',
    mata_pelajaran: '',
    jam_ke: '1-2',
    materi: '',
    kegiatan: '',
    media: 'PPT/Slide',
    metode: 'Discovery Learning',
    catatan: '',
  }
  const [form, setForm] = useState(emptyForm)

  // 1) Ambil identitas guru yang login + kelas/mapel yang benar-benar diajar (dari guru_mapel)
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data.loggedIn || data.role !== 'guru') { setAuthReady(true); return }

        setGuruNama(data.nama ?? 'Guru')

        const { data: userRow } = await supabase
          .from('users')
          .select('nip')
          .eq('id', data.userId)
          .maybeSingle()
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
          setForm(f => ({ ...f, kelas: kelasList[0] ?? '', mata_pelajaran: mapelList[0] ?? '' }))
        }
      } catch (err) {
        console.error('[guru/jurnal] gagal ambil identitas:', err)
      } finally {
        setAuthReady(true)
      }
    }
    init()
  }, [])

  // 2) Ambil data jurnal punya guru ini
  const fetchJurnal = useCallback(async () => {
    if (!guruNip) { setLoading(false); return }
    setLoading(true)
    let query = supabase
      .from('jurnal_mengajar')
      .select('*')
      .eq('guru_nip', guruNip)
      .order('tanggal', { ascending: false })

    if (filterMapel) query = query.eq('mata_pelajaran', filterMapel)

    const { data, error } = await query
    if (error) console.error('[guru/jurnal] error fetch:', error)
    let result = data || []

    if (filterBulan) {
      result = result.filter(j => j.tanggal.substring(5, 7) === filterBulan)
    }

    setJurnal(result)
    setLoading(false)
  }, [filterBulan, filterMapel, guruNip])

  useEffect(() => { if (authReady) fetchJurnal() }, [authReady, fetchJurnal])

  const handleSimpan = async () => {
    if (!form.materi || !form.kegiatan) { alert('Materi dan kegiatan wajib diisi!'); return }
    if (!form.kelas || !form.mata_pelajaran) { alert('Kelas dan mata pelajaran wajib diisi!'); return }
    setSaving(true)
    const payload = { ...form, guru_nip: guruNip, guru_nama: guruNama }
    if (editId) {
      await supabase.from('jurnal_mengajar').update(payload).eq('id', editId)
    } else {
      await supabase.from('jurnal_mengajar').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setForm(f => ({ ...emptyForm, kelas: kelasSaya[0] ?? '', mata_pelajaran: mapelSaya[0] ?? '' }))
    setEditId(null)
    fetchJurnal()
  }

  const handleEdit = (j: Jurnal) => {
    setForm({ tanggal: j.tanggal, kelas: j.kelas, mata_pelajaran: j.mata_pelajaran, jam_ke: j.jam_ke, materi: j.materi, kegiatan: j.kegiatan, media: j.media || '', metode: j.metode || '', catatan: j.catatan || '' })
    setEditId(j.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus jurnal ini?')) return
    await supabase.from('jurnal_mengajar').delete().eq('id', id)
    fetchJurnal()
  }

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new()
    const namaBulan = getNamaBulan(filterBulan)
    const namaMapel = filterMapel || 'Semua Mapel'

    const headerRows = [
      ['JURNAL MENGAJAR'],
      ['SMP NEGERI 36 BANDUNG'],
      ['Jl. Caringin Babakan Ciparay Bandung | Telp. (022) 6078507'],
      [''],
      ['Guru', ':', guruNama],
      ['NIP', ':', guruNip],
      ['Mata Pelajaran', ':', namaMapel],
      ['Periode', ':', namaBulan + ' ' + tahun],
      [''],
    ]

    const tableHeader = ['No', 'Tanggal', 'Kelas', 'Mata Pelajaran', 'Jam Ke', 'Materi / Topik', 'Kegiatan Pembelajaran', 'Metode', 'Media', 'Catatan']

    const tableData = jurnal.map((j, i) => [
      i + 1,
      formatTanggal(j.tanggal),
      j.kelas,
      j.mata_pelajaran,
      'Jam ke-' + j.jam_ke,
      j.materi,
      j.kegiatan,
      j.metode || '-',
      j.media || '-',
      j.catatan || '-',
    ])

    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    const ttdRows = [
      [''],
      ['', '', '', '', '', '', '', '', 'Bandung, ' + today],
      ['', '', '', '', '', '', '', '', 'Mengetahui,', '', 'Guru Mata Pelajaran,'],
      ['', '', '', '', '', '', '', '', 'Kepala Sekolah,', '', ''],
      [''], [''], [''],
      ['', '', '', '', '', '', '', '', KEPSEK_NAMA, '', guruNama],
      ['', '', '', '', '', '', '', '', 'NIP. ' + KEPSEK_NIP, '', 'NIP. ' + guruNip],
    ]

    const allRows = [...headerRows, tableHeader, ...tableData, ...ttdRows]
    const ws = XLSX.utils.aoa_to_sheet(allRows)
    ws['!cols'] = [
      { wch: 4 }, { wch: 25 }, { wch: 8 }, { wch: 14 }, { wch: 8 },
      { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 20 },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Jurnal Mengajar')
    XLSX.writeFile(wb, `Jurnal-Mengajar-${guruNip}-${namaBulan}-${tahun}.xlsx`)
  }

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
    <div className="p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Jurnal Mengajar</h1>
          <p className="text-gray-500 text-sm mt-1">{guruNama}{mapelSaya.length > 0 ? ` · ${mapelSaya.join(' & ')}` : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {jurnal.length > 0 && (
            <button onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Excel
            </button>
          )}
          <button onClick={() => { setShowForm(!showForm); setForm(f => ({ ...emptyForm, kelas: kelasSaya[0] ?? '', mata_pelajaran: mapelSaya[0] ?? '' })); setEditId(null) }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a6b3a] hover:bg-[#155a30] text-white rounded-lg text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
            </svg>
            {showForm ? 'Tutup' : 'Tambah Jurnal'}
          </button>
        </div>
      </div>

      {/* Form Input */}
      {showForm && (
        <div className="bg-white rounded-xl border border-green-100 shadow-sm p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">{editId ? '✏️ Edit Jurnal' : '📝 Input Jurnal Mengajar'}</h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Tanggal *</label>
              <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jam Ke *</label>
              <div className="flex items-center gap-2">
                <select
                  value={form.jam_ke.split('-')[0] || '1'}
                  onChange={e => {
                    const dari = e.target.value
                    const sampaiLama = form.jam_ke.includes('-') ? form.jam_ke.split('-')[1] : form.jam_ke.split('-')[0]
                    const sampai = parseInt(sampaiLama) < parseInt(dari) ? dari : sampaiLama
                    setForm(f => ({ ...f, jam_ke: dari === sampai ? dari : `${dari}-${sampai}` }))
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {PERIODE.map(p => <option key={p} value={p}>Jam ke-{p}</option>)}
                </select>
                <span className="text-gray-400 text-sm flex-shrink-0">–</span>
                <select
                  value={form.jam_ke.includes('-') ? form.jam_ke.split('-')[1] : form.jam_ke.split('-')[0]}
                  onChange={e => {
                    const sampai = e.target.value
                    const dari = form.jam_ke.split('-')[0]
                    setForm(f => ({ ...f, jam_ke: dari === sampai ? sampai : `${dari}-${sampai}` }))
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                  {PERIODE.filter(p => parseInt(p) >= parseInt(form.jam_ke.split('-')[0] || '1')).map(p => <option key={p} value={p}>Jam ke-{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas *</label>
              <select value={form.kelas} onChange={e => setForm(f => ({ ...f, kelas: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Pilih kelas</option>
                {kelasSaya.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran *</label>
              <select value={form.mata_pelajaran} onChange={e => setForm(f => ({ ...f, mata_pelajaran: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">Pilih mapel</option>
                {mapelSaya.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Metode Pembelajaran</label>
              <select value={form.metode} onChange={e => setForm(f => ({ ...f, metode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {METODE.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Media Pembelajaran</label>
              <select value={form.media} onChange={e => setForm(f => ({ ...f, media: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {MEDIA.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Materi / Topik *</label>
            <input type="text" value={form.materi} onChange={e => setForm(f => ({ ...f, materi: e.target.value }))}
              placeholder="Contoh: Struktur Kontrol - Percabangan If-Else"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Kegiatan Pembelajaran *</label>
            <textarea value={form.kegiatan} onChange={e => setForm(f => ({ ...f, kegiatan: e.target.value }))}
              rows={3} placeholder="Pendahuluan: apersepsi 10 menit. Inti: penjelasan + praktik 60 menit. Penutup: refleksi 10 menit."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          <div className="mb-5">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Catatan / Kendala</label>
            <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
              rows={2} placeholder="Opsional: catatan khusus, kendala, siswa yang perlu perhatian, dll."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Batal</button>
            <button onClick={handleSimpan} disabled={saving}
              className="px-6 py-2 bg-[#1a6b3a] hover:bg-[#155a30] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'Menyimpan...' : editId ? 'Update Jurnal' : 'Simpan Jurnal'}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3 flex-wrap items-center">
        <select value={filterMapel} onChange={e => setFilterMapel(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Semua Mapel</option>
          {mapelSaya.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          {BULAN_OPTIONS.map(b => <option key={b.val} value={b.val}>{b.label}</option>)}
        </select>
        <span className="ml-auto text-sm text-gray-500 font-medium">{jurnal.length} entri jurnal</span>
      </div>

      {/* Tabel Jurnal */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat jurnal...
        </div>
      ) : jurnal.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="font-medium">Belum ada jurnal</p>
          <p className="text-xs mt-1">Klik "Tambah Jurnal" untuk mulai mencatat</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-[#1a6b3a] text-white">
                  <th className="px-3 py-3 text-left font-semibold w-8">No</th>
                  <th className="px-3 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-3 py-3 text-left font-semibold">Kelas</th>
                  <th className="px-3 py-3 text-left font-semibold">Mapel</th>
                  <th className="px-3 py-3 text-left font-semibold">Jam</th>
                  <th className="px-3 py-3 text-left font-semibold">Materi</th>
                  <th className="px-3 py-3 text-left font-semibold">Kegiatan</th>
                  <th className="px-3 py-3 text-left font-semibold">Metode</th>
                  <th className="px-3 py-3 text-left font-semibold">Media</th>
                  <th className="px-3 py-3 text-left font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jurnal.map((j, i) => (
                  <tr key={j.id} className="hover:bg-green-50/30 transition">
                    <td className="px-3 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {new Date(j.tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">{j.kelas}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">{j.mata_pelajaran}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.jam_ke}</td>
                    <td className="px-3 py-3 font-medium text-gray-800 max-w-[180px]">
                      <p className="truncate">{j.materi}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs max-w-[220px]">
                      <p className="line-clamp-2">{j.kegiatan}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.metode || '-'}</td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{j.media || '-'}</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(j)} className="text-green-700 hover:text-green-900 text-xs font-medium">Edit</button>
                        <button onClick={() => handleHapus(j.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TTD Section */}
          <div className="border-t border-gray-100 px-4 md:px-6 py-6">
            <div className="flex flex-col md:flex-row justify-between gap-6 max-w-2xl md:ml-auto">
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
        </div>
      )}
    </div>
  )
}
