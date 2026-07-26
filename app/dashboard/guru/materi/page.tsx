'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Materi = {
  id: string
  judul: string
  deskripsi: string | null
  file_url: string | null
  created_at: string
  mapel_id: string
  kelas_id: string
  mapel_nama?: string
  kelas_nama?: string
}

type Opsi = { id: string; nama: string }

export default function MateriPage() {
  const [guruId, setGuruId] = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [materiList, setMateriList] = useState<Materi[]>([])
  const [kelasList, setKelasList]   = useState<Opsi[]>([])
  const [mapelList, setMapelList]   = useState<Opsi[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [form, setForm] = useState({
    judul: '', mapelId: '', kelasId: '',
    pertemuan: 1, deskripsi: '',
    file: null as File | null,
  })

  // Ambil identitas guru + kelas/mapel yang diajar
  useEffect(() => {
    async function initIdentitas() {
      try {
        const res = await fetch('/api/auth/me')
        const meData = await res.json()
        if (!meData.loggedIn) return
        setGuruId(meData.userId)

        const { data } = await supabase
          .from('guru_mapel')
          .select('mapel:mapel_id(id,nama:nama_mapel), kelas:kelas_id(id,nama_rombel)')
          .eq('guru_id', meData.userId)
          .eq('tahun_ajaran', '2026/2027')

        if (data) {
          const mapels = [...new Map(data.map((d: any) => [d.mapel?.id, { id: d.mapel?.id, nama: d.mapel?.nama }])).values()].filter(m => m.id)
          const kelas  = [...new Map(data.map((d: any) => [d.kelas?.id, { id: d.kelas?.id, nama: d.kelas?.nama_rombel }])).values()].filter(k => k.id)
          setMapelList(mapels as Opsi[])
          setKelasList(kelas as Opsi[])
          setForm(f => ({ ...f, mapelId: mapels[0]?.id ?? '', kelasId: kelas[0]?.id ?? '' }))
        }
      } catch (err) {
        console.error('[guru/materi] gagal ambil identitas:', err)
      }
    }
    initIdentitas()
  }, [])

  // Ambil daftar materi yang sudah pernah disimpan guru ini
  const fetchMateri = useCallback(async () => {
    if (!guruId) return
    setLoading(true)
    const { data } = await supabase
      .from('materi_belajar')
      .select('id, judul, deskripsi, file_url, created_at, mapel_id, kelas_id, mapel:mapel_id(nama:nama_mapel), kelas:kelas_id(nama_rombel)')
      .eq('guru_id', guruId)
      .eq('tahun_ajaran', '2026/2027')
      .order('created_at', { ascending: false })

    if (data) {
      setMateriList(data.map((d: any) => ({
        ...d, mapel_nama: d.mapel?.nama, kelas_nama: d.kelas?.nama_rombel,
      })))
    }
    setLoading(false)
  }, [guruId])

  useEffect(() => { fetchMateri() }, [fetchMateri])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSimpan() {
    if (!form.judul || !form.mapelId || !form.kelasId) {
      setMsg('Judul, mapel, dan kelas wajib diisi')
      return
    }
    setSaving(true)
    setMsg('')

    try {
      let fileUrl: string | null = null

      // Upload file ke Supabase Storage kalau ada
      if (form.file) {
        const path = `materi/${guruId}/${Date.now()}-${form.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('dokumen-ajar')
          .upload(path, form.file, { upsert: false })

        if (uploadError) throw new Error('Gagal upload file: ' + uploadError.message)

        const { data: urlData } = supabase.storage.from('dokumen-ajar').getPublicUrl(path)
        fileUrl = urlData.publicUrl
      }

      // Nomor pertemuan digabung ke judul karena tabel materi_belajar tidak punya kolom pertemuan tersendiri
      const judulFinal = `Pertemuan ${form.pertemuan} — ${form.judul}`

      const { error: insertError } = await supabase.from('materi_belajar').insert({
        guru_id: guruId,
        mapel_id: form.mapelId,
        kelas_id: form.kelasId,
        jenis: 'materi',
        judul: judulFinal,
        deskripsi: form.deskripsi || null,
        file_url: fileUrl,
        tahun_ajaran: '2026/2027',
        semester: 1,
        is_published: true,
      })

      if (insertError) throw new Error(insertError.message)

      setForm(f => ({ ...f, judul: '', deskripsi: '', pertemuan: f.pertemuan + 1, file: null }))
      setShowForm(false)
      setMsg('Materi berhasil ditambahkan!')
      fetchMateri()
    } catch (err: any) {
      setMsg('Gagal menyimpan: ' + err.message)
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 4000)
    }
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus materi ini?')) return
    await supabase.from('materi_belajar').delete().eq('id', id)
    fetchMateri()
  }

  const grouped = materiList.reduce((acc, m) => {
    const key = `${m.mapel_nama ?? '-'} — Kelas ${m.kelas_nama ?? '-'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {} as Record<string, Materi[]>)

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Materi Ajar</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kelola materi dan bahan ajar per pertemuan</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#1a6b3a] text-white text-sm font-semibold rounded-lg hover:bg-[#155730] transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
          </svg>
          Tambah Materi
        </button>
      </div>

      {/* Notif */}
      {msg && (
        <div className={`p-3 rounded-lg text-sm font-medium border ${
          msg.includes('berhasil')
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg}
        </div>
      )}

      {/* Form tambah */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Tambah Materi Baru</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mata Pelajaran</label>
              <select name="mapelId" value={form.mapelId} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500">
                {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Kelas</label>
              <select name="kelasId" value={form.kelasId} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500">
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Judul Materi</label>
            <input name="judul" value={form.judul} onChange={handleChange}
              placeholder="Contoh: Pengantar Computational Thinking"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Pertemuan ke-</label>
            <input type="number" name="pertemuan" value={form.pertemuan} min={1} max={50}
              onChange={handleChange}
              className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"/>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Deskripsi / Tujuan Pembelajaran</label>
            <textarea name="deskripsi" value={form.deskripsi} onChange={handleChange} rows={3}
              placeholder="Tuliskan materi yang akan dibahas atau tujuan pembelajaran..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500 resize-none"/>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Upload File (PDF / Word / PPT)</label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-green-400 transition-colors">
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" className="hidden" id="file-materi"
                onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}/>
              <label htmlFor="file-materi" className="cursor-pointer">
                {form.file ? (
                  <p className="text-sm text-green-600 font-medium">{form.file.name}</p>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <p className="text-sm text-gray-400">Klik untuk upload file</p>
                    <p className="text-xs text-gray-300 mt-1">PDF, Word, PowerPoint (maks 10MB)</p>
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={handleSimpan} disabled={saving || !form.judul}
              className="px-5 py-2 bg-[#1a6b3a] text-white text-sm font-semibold rounded-lg hover:bg-[#155730] disabled:opacity-50 transition-all">
              {saving ? 'Menyimpan...' : 'Simpan Materi'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-5 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-200 transition-all">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* List materi */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-[#1a6b3a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat materi...
        </div>
      ) : materiList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
          <p className="text-sm text-gray-400">Belum ada materi. Klik "Tambah Materi" untuk mulai.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1">{group}</h3>
            {items.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800">{m.judul}</h3>
                    {m.deskripsi && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.deskripsi}</p>
                    )}
                    {m.file_url && (
                      <a href={m.file_url} target="_blank" rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-2 w-fit hover:underline">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span className="text-xs text-blue-500">Lihat / Unduh file</span>
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString('id-ID')}
                    </span>
                    <button onClick={() => handleHapus(m.id)} className="text-[11px] text-red-400 hover:text-red-600">
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
