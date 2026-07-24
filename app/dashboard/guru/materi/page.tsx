'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Materi = {
  id: string
  judul: string
  mapel: string
  kelas: string
  pertemuan: number
  deskripsi: string
  file_nama: string | null
  created_at: string
}

export default function MateriPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [showForm, setShowForm]     = useState(false)
  const [materiList, setMateriList] = useState<Materi[]>([])
  const [kelasList, setKelasList]   = useState<any[]>([])
  const [mapelList, setMapelList]   = useState<any[]>([])
  const [saving, setSaving]         = useState(false)
  const [msg, setMsg]               = useState('')
  const [form, setForm] = useState({
    judul: '', mapel: '', kelas: '',
    pertemuan: 1, deskripsi: '',
    file: null as File | null,
  })

  useEffect(() => {
    async function fetchData() {
      let userId: string | undefined
      try {
        const res = await fetch('/api/auth/me')
        const meData = await res.json()
        if (meData.loggedIn) userId = meData.userId
      } catch (err) {
        console.error('[guru/materi] gagal ambil identitas:', err)
      }
      if (!userId) return

      const { data } = await supabase
        .from('guru_mapel')
        .select('mapel:mapel_id(id,nama:nama_mapel), kelas:kelas_id(id,nama_rombel)')
        .eq('guru_id', userId!)
        .eq('tahun_ajaran', '2026/2027')

      if (data) {
        const mapels = [...new Map(data.map((d: any) => [d.mapel?.id, d.mapel])).values()].filter(Boolean)
        const kelas  = [...new Map(data.map((d: any) => [d.kelas?.id, d.kelas])).values()].filter(Boolean)
        setMapelList(mapels)
        setKelasList(kelas)
        if (mapels.length > 0) setForm(f => ({ ...f, mapel: mapels[0].nama }))
        if (kelas.length > 0)  setForm(f => ({ ...f, kelas: kelas[0].nama_rombel }))
      }
    }
    fetchData()
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSimpan() {
    if (!form.judul || !form.mapel || !form.kelas) {
      setMsg('Judul, mapel, dan kelas wajib diisi')
      return
    }
    setSaving(true)
    setMsg('')
    await new Promise(r => setTimeout(r, 400))

    setMateriList(prev => [{
      id: Date.now().toString(),
      judul: form.judul,
      mapel: form.mapel,
      kelas: form.kelas,
      pertemuan: Number(form.pertemuan),
      deskripsi: form.deskripsi,
      file_nama: form.file?.name ?? null,
      created_at: new Date().toISOString(),
    }, ...prev])

    setForm(f => ({ ...f, judul: '', deskripsi: '', pertemuan: f.pertemuan + 1, file: null }))
    setShowForm(false)
    setSaving(false)
    setMsg('Materi berhasil ditambahkan!')
    setTimeout(() => setMsg(''), 3000)
  }

  const grouped = materiList.reduce((acc, m) => {
    const key = `${m.mapel} — Kelas ${m.kelas}`
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
              <select name="mapel" value={form.mapel} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500">
                {mapelList.map((m: any) => <option key={m.id}>{m.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Kelas</label>
              <select name="kelas" value={form.kelas} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500">
                {kelasList.map((k: any) => <option key={k.id}>{k.nama_rombel}</option>)}
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
      {materiList.length === 0 ? (
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
            {items.sort((a, b) => a.pertemuan - b.pertemuan).map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        Pertemuan {m.pertemuan}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">{m.judul}</h3>
                    {m.deskripsi && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.deskripsi}</p>
                    )}
                    {m.file_nama && (
                      <div className="mt-2 flex items-center gap-2">
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span className="text-xs text-gray-500">{m.file_nama}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
