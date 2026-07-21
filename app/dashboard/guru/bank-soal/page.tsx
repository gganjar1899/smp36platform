'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Identitas guru & daftar kelas/mapel diambil dinamis (lihat useEffect init() di komponen)

type Soal = {
  id: string
  judul: string
  mata_pelajaran: string
  kelas: string
  durasi_menit: number
  jumlah_soal: number
  status: string
  jenis_nilai: string
  nilai_ke: number
  semester: string
  acak_soal: boolean
  created_at: string
}

type Pertanyaan = {
  id?: string
  nomor: number
  pertanyaan: string
  gambar_url?: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  pilihan_e: string
  kunci_jawaban: string
  bobot: number
}

type HasilSiswa = {
  nis: string
  nama_siswa: string
  nilai: number | null
  benar: number
  salah: number
  status: string
}

const emptyPertanyaan = (nomor: number): Pertanyaan => ({
  nomor, pertanyaan: '', gambar_url: '',
  pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', pilihan_e: '',
  kunci_jawaban: 'A', bobot: 1
})

const renderTeks = (teks: string) => teks
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/_(.*?)_/g, '<em>$1</em>')
  .replace(/\^(\w+)/g, '<sup>$1</sup>')
  .replace(/~(\w+)/g, '<sub>$1</sub>')

export default function CBTGuruPage() {
  const [guruNip, setGuruNip] = useState('')
  const [guruNama, setGuruNama] = useState('Guru')
  const [mapelSaya, setMapelSaya] = useState<string[]>([])
  const [kelasSaya, setKelasSaya] = useState<string[]>([])
  const [authReady, setAuthReady] = useState(false)

  const [soalList, setSoalList] = useState<Soal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'list' | 'buat' | 'soal' | 'hasil'>('list')
  const [selectedSoal, setSelectedSoal] = useState<Soal | null>(null)
  const [pertanyaanList, setPertanyaanList] = useState<Pertanyaan[]>([emptyPertanyaan(1)])
  const [hasilList, setHasilList] = useState<HasilSiswa[]>([])
  const [saving, setSaving] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [preview, setPreview] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const [formSoal, setFormSoal] = useState({
    judul: '', mata_pelajaran: '', kelas: '',
    durasi_menit: 60, acak_soal: true,
    jenis_nilai: 'Formatif', nilai_ke: 1, semester: '1', deskripsi: ''
  })

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
          setFormSoal(f => ({ ...f, kelas: kelasList[0] ?? '', mata_pelajaran: mapelList[0] ?? '' }))
        }
      } catch (err) {
        console.error('[guru/bank-soal] gagal ambil identitas:', err)
      } finally {
        setAuthReady(true)
      }
    }
    init()
  }, [])

  const fetchSoal = useCallback(async () => {
    if (!guruNip) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('soal_cbt').select('*')
      .eq('guru_nip', guruNip).order('created_at', { ascending: false })
    setSoalList(data || [])
    setLoading(false)
  }, [guruNip])

  useEffect(() => { if (authReady) fetchSoal() }, [authReady, fetchSoal])

  // ============================================================
  // DOWNLOAD TEMPLATE EXCEL
  // ============================================================
  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new()

    const headerRows = [
      ['TEMPLATE IMPORT SOAL CBT - SMP NEGERI 36 BANDUNG'],
      ['Petunjuk: Isi kolom sesuai format. Pilihan E opsional. Kunci diisi A/B/C/D/E. Bobot default 1.'],
      ['No', 'Pertanyaan', 'Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D', 'Pilihan E (opsional)', 'Kunci Jawaban', 'Bobot'],
      [1, 'Apa yang dimaksud dengan algoritma?', 'Kumpulan data', 'Urutan langkah logis', 'Bahasa pemrograman', 'Perangkat keras', '', 'B', 1],
      [2, 'Organel khas sel tumbuhan adalah...', 'Mitokondria', 'Ribosom', 'Kloroplas dan dinding sel', 'Nukleus', 'Vakuola', 'C', 1],
      [3, 'Rumus kimia air adalah...', 'CO2', 'H2O', 'O2', 'NaCl', 'CH4', 'B', 1],
    ]

    const ws = XLSX.utils.aoa_to_sheet(headerRows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 50 }, { wch: 20 }, { wch: 20 },
      { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 8 }
    ]

    // Sheet petunjuk
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['PETUNJUK PENGISIAN TEMPLATE SOAL CBT'],
      [''],
      ['Kolom', 'Penjelasan'],
      ['No', 'Nomor urut soal (1, 2, 3, dst) - wajib berurutan'],
      ['Pertanyaan', 'Teks soal lengkap. Untuk rumus tulis teks biasa misal "x kuadrat" atau "H2O"'],
      ['Pilihan A-D', 'WAJIB diisi semua 4 pilihan'],
      ['Pilihan E', 'OPSIONAL. Kosongkan jika hanya 4 pilihan'],
      ['Kunci Jawaban', 'Huruf kapital: A, B, C, D, atau E sesuai jawaban benar'],
      ['Bobot', 'Angka 1-10. Default 1. Soal sulit bisa diberi bobot lebih besar'],
      ['Gambar', 'Upload gambar terpisah langsung di aplikasi setelah import'],
      [''],
      ['TIPS:', 'Buat soal di Word dulu, lalu copy-paste ke kolom Pertanyaan di Excel ini'],
      ['FORMAT:', 'Simpan sebagai .xlsx (Excel Workbook) sebelum diupload'],
      ['BATAS:', 'Maksimal 100 soal per file'],
    ])
    ws2['!cols'] = [{ wch: 18 }, { wch: 70 }]

    XLSX.utils.book_append_sheet(wb, ws, 'Template Soal')
    XLSX.utils.book_append_sheet(wb, ws2, 'Petunjuk')
    XLSX.writeFile(wb, 'Template_Soal_CBT_SMPN36.xlsx')
  }

  // ============================================================
  // IMPORT SOAL DARI EXCEL
  // ============================================================
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedSoal) return
    setImporting(true)
    setImportMsg('Memproses file Excel...')

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Filter baris yang valid (kolom pertama adalah angka)
      const validRows = rows.filter(row => typeof row[0] === 'number' && row[0] > 0)

      if (validRows.length === 0) {
        setImportMsg('❌ Tidak ada soal valid. Gunakan template yang disediakan.')
        setImporting(false)
        return
      }

      const newPertanyaan: Pertanyaan[] = validRows.map(row => {
        const kunci = String(row[7] || 'A').trim().toUpperCase()
        return {
          nomor: parseInt(row[0]) || 0,
          pertanyaan: String(row[1] || '').trim(),
          pilihan_a: String(row[2] || '').trim(),
          pilihan_b: String(row[3] || '').trim(),
          pilihan_c: String(row[4] || '').trim(),
          pilihan_d: String(row[5] || '').trim(),
          pilihan_e: String(row[6] || '').trim(),
          kunci_jawaban: ['A','B','C','D','E'].includes(kunci) ? kunci : 'A',
          bobot: parseInt(row[8]) || 1,
          gambar_url: '',
        }
      }).filter(p => p.pertanyaan && p.pilihan_a && p.pilihan_b)

      if (newPertanyaan.length === 0) {
        setImportMsg('❌ Tidak ada soal valid. Pastikan Pertanyaan, Pilihan A & B terisi.')
        setImporting(false)
        return
      }

      // Simpan langsung ke Supabase
      await supabase.from('pertanyaan_cbt').delete().eq('soal_id', selectedSoal.id)
      const rows2insert = newPertanyaan.map(p => ({ ...p, soal_id: selectedSoal.id }))
      const { error } = await supabase.from('pertanyaan_cbt').insert(rows2insert)

      if (error) throw error

      await supabase.from('soal_cbt').update({ jumlah_soal: newPertanyaan.length }).eq('id', selectedSoal.id)

      setPertanyaanList(newPertanyaan)
      setActiveIdx(0)
      setImportMsg(`✅ ${newPertanyaan.length} soal berhasil diimport!`)
      fetchSoal()
    } catch (err: any) {
      setImportMsg('❌ Error: ' + err.message)
    }

    setImporting(false)
    e.target.value = ''
    setTimeout(() => setImportMsg(''), 5000)
  }

  const handleBuatSoal = async () => {
    if (!formSoal.judul) { alert('Judul ujian wajib diisi!'); return }
    setSaving(true)
    const { data, error } = await supabase.from('soal_cbt').insert({
      ...formSoal, guru_nip: guruNip, guru_nama: guruNama,
      status: 'Draft', tahun_ajaran: '2026/2027'
    }).select().single()
    if (error) { alert('Error: ' + error.message); setSaving(false); return }
    if (data) {
      setSelectedSoal(data)
      setPertanyaanList([emptyPertanyaan(1)])
      setActiveIdx(0)
      setActiveView('soal')
      fetchSoal()
    }
    setSaving(false)
  }

  const handleSimpanPertanyaan = async () => {
    if (!selectedSoal) return
    const invalid = pertanyaanList.find(p => !p.pertanyaan || !p.pilihan_a || !p.pilihan_b)
    if (invalid) { alert(`Soal no ${invalid.nomor}: pertanyaan dan pilihan A & B wajib diisi!`); return }
    setSaving(true)
    await supabase.from('pertanyaan_cbt').delete().eq('soal_id', selectedSoal.id)
    const { error } = await supabase.from('pertanyaan_cbt').insert(
      pertanyaanList.map(p => ({ ...p, soal_id: selectedSoal.id }))
    )
    await supabase.from('soal_cbt').update({ jumlah_soal: pertanyaanList.length }).eq('id', selectedSoal.id)
    if (error) alert('Error: ' + error.message)
    else alert(`✅ ${pertanyaanList.length} soal berhasil disimpan!`)
    setSaving(false)
    fetchSoal()
  }

  const handleUploadGambar = async (idx: number, file: File) => {
    setUploadingImg(true)
    const reader = new FileReader()
    reader.onload = () => {
      updatePertanyaan(idx, 'gambar_url', reader.result as string)
      setUploadingImg(false)
    }
    reader.readAsDataURL(file)
  }

  const handleAktifkan = async (id: string, status: string) => {
    await supabase.from('soal_cbt').update({ status: status === 'Aktif' ? 'Draft' : 'Aktif' }).eq('id', id)
    fetchSoal()
  }

  const handleSelesai = async (id: string) => {
    if (!confirm('Tandai ujian selesai? Siswa tidak bisa lagi mengerjakan.')) return
    await supabase.from('soal_cbt').update({ status: 'Selesai' }).eq('id', id)
    fetchSoal()
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus paket soal ini?')) return
    await supabase.from('soal_cbt').delete().eq('id', id)
    fetchSoal()
  }

  const handleLihatHasil = async (soal: Soal) => {
    setSelectedSoal(soal)
    const { data } = await supabase.from('hasil_cbt').select('*')
      .eq('soal_id', soal.id).order('nilai', { ascending: false })
    setHasilList(data || [])
    setActiveView('hasil')
  }

  const handleInputSoal = async (soal: Soal) => {
    setSelectedSoal(soal)
    const { data } = await supabase.from('pertanyaan_cbt').select('*')
      .eq('soal_id', soal.id).order('nomor')
    setPertanyaanList(data && data.length > 0 ? data : [emptyPertanyaan(1)])
    setActiveIdx(0)
    setActiveView('soal')
  }

  const handleRekapNilai = async (soal: Soal) => {
    if (!confirm(`Rekap nilai "${soal.judul}" ke leger?`)) return
    const { data: hasil } = await supabase.from('hasil_cbt').select('*')
      .eq('soal_id', soal.id).eq('status', 'Selesai')
    if (!hasil || hasil.length === 0) { alert('Belum ada siswa yang menyelesaikan ujian'); return }
    const rows = hasil.map((h: any) => ({
      nis: h.nis, nama_siswa: h.nama_siswa, kelas: soal.kelas,
      mata_pelajaran: soal.mata_pelajaran, semester: soal.semester,
      tahun_ajaran: '2026/2027', jenis: soal.jenis_nilai,
      ke: soal.nilai_ke, nilai: h.nilai, sumber: 'CBT'
    }))
    await supabase.from('nilai').upsert(rows, { onConflict: 'nis,mata_pelajaran,semester,tahun_ajaran,jenis,ke' })
    alert(`✅ ${rows.length} nilai berhasil direkap ke leger!`)
  }

  const addPertanyaan = () => {
    const n = pertanyaanList.length + 1
    setPertanyaanList(prev => [...prev, emptyPertanyaan(n)])
    setActiveIdx(pertanyaanList.length)
  }

  const removePertanyaan = (idx: number) => {
    if (pertanyaanList.length === 1) return
    setPertanyaanList(prev => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, nomor: i + 1 })))
    setActiveIdx(Math.max(0, idx - 1))
  }

  const updatePertanyaan = (idx: number, field: string, val: string | number) => {
    setPertanyaanList(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }

  const statusColor = (s: string) =>
    s === 'Aktif' ? 'bg-green-50 text-green-700 border-green-200' :
    s === 'Selesai' ? 'bg-gray-50 text-gray-500 border-gray-200' :
    'bg-yellow-50 text-yellow-700 border-yellow-200'

  const p = pertanyaanList[activeIdx]

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

  // ====== LIST ======
  if (activeView === 'list') return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Modul CBT</h1>
          <p className="text-gray-500 text-sm mt-1">{guruNama}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Template Excel
          </button>
          <button onClick={() => setActiveView('buat')}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Buat Paket Soal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        </div>
      ) : soalList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400">
          <div className="text-5xl mb-4">💻</div>
          <p className="font-semibold text-gray-600 mb-1">Belum ada paket soal</p>
          <p className="text-sm">Klik "Buat Paket Soal" untuk mulai, atau download template Excel dulu</p>
        </div>
      ) : (
        <div className="space-y-3">
          {soalList.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${statusColor(s.status)}`}>{s.status}</span>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs">{s.kelas}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs ${s.mata_pelajaran === 'Informatika' ? 'bg-purple-50 text-purple-700' : 'bg-teal-50 text-teal-700'}`}>{s.mata_pelajaran}</span>
                    <span className="text-xs text-gray-400">{s.jenis_nilai} ke-{s.nilai_ke} · Sem {s.semester}</span>
                  </div>
                  <h3 className="font-semibold text-gray-800">{s.judul}</h3>
                  <p className="text-xs text-gray-500 mt-1">⏱️ {s.durasi_menit} menit · 📝 {s.jumlah_soal} soal · {s.acak_soal ? '🔀 Acak' : '📋 Urut'}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  <button onClick={() => handleInputSoal(s)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition">✏️ Edit Soal</button>
                  <button onClick={() => handleAktifkan(s.id, s.status)} disabled={s.status === 'Selesai'}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40
                      ${s.status === 'Aktif' ? 'bg-orange-50 text-orange-700 hover:bg-orange-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                    {s.status === 'Aktif' ? '⏸️ Nonaktif' : '▶️ Aktifkan'}
                  </button>
                  {s.status === 'Aktif' && (
                    <button onClick={() => handleSelesai(s.id)}
                      className="px-3 py-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition">⏹️ Selesai</button>
                  )}
                  <button onClick={() => handleLihatHasil(s)}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-medium transition">📊 Hasil</button>
                  {s.status === 'Selesai' && (
                    <button onClick={() => handleRekapNilai(s)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium transition">📥 → Leger</button>
                  )}
                  <button onClick={() => handleHapus(s.id)}
                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ====== BUAT SOAL ======
  if (activeView === 'buat') return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setActiveView('list')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold text-gray-800">Buat Paket Soal</h1>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Judul Ujian *</label>
          <input type="text" value={formSoal.judul} onChange={e => setFormSoal(f => ({ ...f, judul: e.target.value }))}
            placeholder="Contoh: Ulangan Harian 1 - Algoritma dan Pemrograman"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Deskripsi / Petunjuk</label>
          <textarea value={formSoal.deskripsi} onChange={e => setFormSoal(f => ({ ...f, deskripsi: e.target.value }))}
            placeholder="Petunjuk ujian untuk siswa (opsional)" rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Mata Pelajaran', field: 'mata_pelajaran', opts: mapelSaya },
            { label: 'Kelas', field: 'kelas', opts: kelasSaya },
          ].map(f => (
            <div key={f.field}>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">{f.label}</label>
              <select value={(formSoal as any)[f.field]} onChange={e => setFormSoal(prev => ({ ...prev, [f.field]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Durasi (menit)</label>
            <input type="number" value={formSoal.durasi_menit} min={5} max={180}
              onChange={e => setFormSoal(f => ({ ...f, durasi_menit: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis Nilai</label>
            <select value={formSoal.jenis_nilai} onChange={e => setFormSoal(f => ({ ...f, jenis_nilai: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="Formatif">Formatif</option>
              <option value="Sumatif">Sumatif</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Penilaian Ke-</label>
            <select value={formSoal.nilai_ke} onChange={e => setFormSoal(f => ({ ...f, nilai_ke: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Semester</label>
            <select value={formSoal.semester} onChange={e => setFormSoal(f => ({ ...f, semester: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={formSoal.acak_soal} onChange={e => setFormSoal(f => ({ ...f, acak_soal: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          <span className="text-sm text-gray-700">🔀 Acak urutan soal (setiap siswa berbeda)</span>
        </label>
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <button onClick={() => setActiveView('list')} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onClick={handleBuatSoal} disabled={saving || !formSoal.judul}
            className="px-6 py-2 bg-[#1a3a6b] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#15305a] transition">
            {saving ? 'Menyimpan...' : 'Lanjut Input Soal →'}
          </button>
        </div>
      </div>
    </div>
  )

  // ====== INPUT SOAL ======
  if (activeView === 'soal') return (
    <div className="p-6 flex gap-4">
      {/* Navigator */}
      <div className="w-52 flex-shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 p-3 sticky top-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">DAFTAR SOAL ({pertanyaanList.length})</p>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {pertanyaanList.map((q, i) => (
                <button key={i} onClick={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition text-left
                    ${activeIdx === i ? 'bg-[#1a3a6b] text-white' :
                      q.pertanyaan ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                      'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0
                    ${activeIdx === i ? 'bg-white/20' : q.pertanyaan ? 'bg-green-200' : 'bg-gray-200'}`}>{i + 1}</span>
                  <span className="truncate">{q.pertanyaan ? q.pertanyaan.substring(0, 18) + '...' : 'Kosong'}</span>
                </button>
              ))}
            </div>
            <button onClick={addPertanyaan}
              className="w-full mt-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition">
              + Tambah Soal
            </button>
          </div>

          {/* Import Excel di navigator */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">IMPORT SOAL</p>
            <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />
            <button onClick={() => importRef.current?.click()} disabled={importing}
              className="w-full py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1">
              {importing ? '⏳ Mengimport...' : '📂 Import Excel'}
            </button>
            <button onClick={handleDownloadTemplate}
              className="w-full mt-1 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1">
              ⬇️ Download Template
            </button>
            {importMsg && (
              <p className={`text-xs mt-2 text-center font-medium ${importMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
                {importMsg}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveView('list')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h2 className="font-bold text-gray-800">{selectedSoal?.judul}</h2>
              <p className="text-xs text-gray-500">{selectedSoal?.kelas} · {selectedSoal?.mata_pelajaran} · {pertanyaanList.length} soal</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPreview(!preview)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition
                ${preview ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
              {preview ? '✏️ Edit' : '👁️ Preview'}
            </button>
            <button onClick={handleSimpanPertanyaan} disabled={saving}
              className="px-4 py-1.5 bg-[#1a3a6b] text-white rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-[#15305a] transition">
              {saving ? 'Menyimpan...' : '💾 Simpan Semua'}
            </button>
          </div>
        </div>

        {p && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 bg-[#1a3a6b] text-white rounded-full flex items-center justify-center text-sm font-bold">{activeIdx + 1}</span>
                <span className="text-sm font-semibold text-gray-600">Soal {activeIdx + 1} / {pertanyaanList.length}</span>
              </div>
              {pertanyaanList.length > 1 && (
                <button onClick={() => removePertanyaan(activeIdx)}
                  className="text-red-400 hover:text-red-600 text-xs px-2 py-1 hover:bg-red-50 rounded transition">🗑️ Hapus</button>
              )}
            </div>

            {preview ? (
              <div className="space-y-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderTeks(p.pertanyaan) }} />
                  {p.gambar_url && <img src={p.gambar_url} alt="Gambar soal" className="mt-3 max-h-48 rounded-lg object-contain" />}
                </div>
                <div className="space-y-2">
                  {['a','b','c','d','e'].map(opt => {
                    const val = (p as any)[`pilihan_${opt}`]
                    if (!val) return null
                    return (
                      <div key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2
                        ${p.kunci_jawaban === opt.toUpperCase() ? 'border-green-400 bg-green-50' : 'border-gray-100'}`}>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                          ${p.kunci_jawaban === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {opt.toUpperCase()}
                        </span>
                        <span className="text-sm" dangerouslySetInnerHTML={{ __html: renderTeks(val) }} />
                        {p.kunci_jawaban === opt.toUpperCase() && <span className="ml-auto text-green-600 text-xs font-semibold">✅ Kunci</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">
                    Pertanyaan *
                    <span className="font-normal text-gray-400 ml-2">(**tebal**, _miring_, x^2 superscript, x~2 subscript)</span>
                  </label>
                  <textarea value={p.pertanyaan} onChange={e => updatePertanyaan(activeIdx, 'pertanyaan', e.target.value)}
                    rows={3} placeholder="Tulis pertanyaan di sini..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Gambar Soal (opsional)</label>
                  <div className="flex items-center gap-3">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleUploadGambar(activeIdx, e.target.files[0]) }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingImg}
                      className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg text-xs text-gray-500 hover:text-blue-600 transition disabled:opacity-50">
                      🖼️ {uploadingImg ? 'Mengupload...' : 'Upload Gambar'}
                    </button>
                    {p.gambar_url && (
                      <div className="flex items-center gap-2">
                        <img src={p.gambar_url} alt="" className="h-12 w-16 object-cover rounded border" />
                        <button onClick={() => updatePertanyaan(activeIdx, 'gambar_url', '')} className="text-red-400 text-xs">Hapus</button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">JPG/PNG. Cocok untuk soal dengan tabel, grafik, atau gambar.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-2 block">
                    Pilihan Jawaban * <span className="font-normal text-gray-400">(klik huruf untuk set kunci)</span>
                  </label>
                  <div className="space-y-2">
                    {['a','b','c','d','e'].map(opt => (
                      <div key={opt} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition
                        ${p.kunci_jawaban === opt.toUpperCase() ? 'border-green-400 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
                        <button onClick={() => updatePertanyaan(activeIdx, 'kunci_jawaban', opt.toUpperCase())}
                          className={`w-8 h-8 rounded-full text-xs font-bold flex-shrink-0 transition
                            ${p.kunci_jawaban === opt.toUpperCase() ? 'bg-green-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {opt.toUpperCase()}
                        </button>
                        <input type="text" value={(p as any)[`pilihan_${opt}`]}
                          onChange={e => updatePertanyaan(activeIdx, `pilihan_${opt}`, e.target.value)}
                          placeholder={`Pilihan ${opt.toUpperCase()}${opt === 'e' ? ' (opsional)' : ' *'}`}
                          className="flex-1 text-sm bg-transparent focus:outline-none py-0.5" />
                        {p.kunci_jawaban === opt.toUpperCase() && <span className="text-green-600 text-xs font-semibold flex-shrink-0">✅ Kunci</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                  <label className="text-xs text-gray-500 font-semibold">Bobot:</label>
                  <input type="number" value={p.bobot} min={1} max={10}
                    onChange={e => updatePertanyaan(activeIdx, 'bobot', parseInt(e.target.value))}
                    className="w-16 text-center text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <span className="text-xs text-gray-400">poin</span>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
                ← Sebelumnya
              </button>
              {activeIdx < pertanyaanList.length - 1 ? (
                <button onClick={() => setActiveIdx(i => i + 1)}
                  className="px-4 py-2 bg-[#1a3a6b] text-white rounded-lg text-sm font-medium hover:bg-[#15305a] transition">
                  Berikutnya →
                </button>
              ) : (
                <button onClick={addPertanyaan}
                  className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition">
                  + Tambah Soal Baru
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ====== HASIL ======
  if (activeView === 'hasil') return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setActiveView('list')} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Hasil: {selectedSoal?.judul}</h1>
          <p className="text-xs text-gray-500">{selectedSoal?.kelas} · {hasilList.length} siswa</p>
        </div>
      </div>

      {hasilList.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Rata-rata', value: Math.round(hasilList.filter(h=>h.nilai!==null).reduce((a,h)=>a+(h.nilai||0),0)/Math.max(hasilList.filter(h=>h.nilai!==null).length,1)), color: 'text-blue-600' },
            { label: 'Tertinggi', value: Math.max(...hasilList.map(h=>h.nilai||0)), color: 'text-green-600' },
            { label: 'Terendah', value: Math.min(...hasilList.filter(h=>h.nilai!==null).map(h=>h.nilai||0)), color: 'text-red-600' },
            { label: 'Selesai', value: hasilList.filter(h=>h.status==='Selesai').length, color: 'text-gray-700' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {hasilList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">Belum ada siswa yang mengerjakan</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1a3a6b] text-white">
                <th className="px-4 py-3 text-left">No</th>
                <th className="px-4 py-3 text-left">Nama Siswa</th>
                <th className="px-4 py-3 text-center">Benar</th>
                <th className="px-4 py-3 text-center">Salah</th>
                <th className="px-4 py-3 text-center">Nilai</th>
                <th className="px-4 py-3 text-center">Kualifikasi</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hasilList.map((h, i) => {
                const kual = h.nilai !== null ? (h.nilai>=90?'A':h.nilai>=80?'B':h.nilai>=70?'C':'D') : '-'
                const kualLabel = kual==='A'?'Sangat Baik':kual==='B'?'Baik':kual==='C'?'Cukup':kual==='D'?'Perlu Perbaikan':'-'
                const kualColor = kual==='A'?'text-green-600':kual==='B'?'text-blue-600':kual==='C'?'text-yellow-600':'text-red-600'
                return (
                  <tr key={h.nis} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-400">{i+1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{h.nama_siswa}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-semibold">{h.benar}</td>
                    <td className="px-4 py-3 text-center text-red-500 font-semibold">{h.salah}</td>
                    <td className="px-4 py-3 text-center font-bold text-xl text-gray-800">{h.nilai??'-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${kualColor}`}>{kual}</span>
                      <span className="text-xs text-gray-400 ml-1">({kualLabel})</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium
                        ${h.status==='Selesai'?'bg-green-50 text-green-700':'bg-yellow-50 text-yellow-700'}`}>
                        {h.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return null
}
