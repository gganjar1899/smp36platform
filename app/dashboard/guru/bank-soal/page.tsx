'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Opsi = { id: string; nama: string }
type Soal = {
  id: string
  jenis: 'pilihan_ganda' | 'esai' | 'upload_file'
  pertanyaan: string
  pilihan_a: string | null
  pilihan_b: string | null
  pilihan_c: string | null
  pilihan_d: string | null
  pilihan_e: string | null
  jawaban_benar: string | null
  bobot_nilai: number
  tingkat_kesulitan: 'mudah' | 'sedang' | 'sulit'
  aktif: boolean
}

const emptyForm = {
  jenis: 'pilihan_ganda' as Soal['jenis'],
  pertanyaan: '',
  pilihan_a: '', pilihan_b: '', pilihan_c: '', pilihan_d: '', pilihan_e: '',
  jawaban_benar: 'A',
  bobot_nilai: 10,
  tingkat_kesulitan: 'sedang' as Soal['tingkat_kesulitan'],
}

export default function BankSoalGuruPage() {
  const [guruId, setGuruId] = useState('')
  const [mapelList, setMapelList] = useState<Opsi[]>([])
  const [mapelId, setMapelId] = useState('')

  const [soalList, setSoalList] = useState<Soal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [filterJenis, setFilterJenis] = useState('')
  const [filterKesulitan, setFilterKesulitan] = useState('')

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (!data.loggedIn || data.role !== 'guru') return
      setGuruId(data.userId)

      const { data: mengajar } = await supabase
        .from('guru_mapel')
        .select('mapel:mapel_id(id, nama_mapel)')
        .eq('guru_id', data.userId).eq('tahun_ajaran', '2026/2027')

      if (mengajar) {
        const mapel = Array.from(new Map(mengajar.map((m: any) => [m.mapel?.id, { id: m.mapel?.id, nama: m.mapel?.nama_mapel }])).values()).filter(m => m.id) as Opsi[]
        setMapelList(mapel)
        if (mapel[0]) setMapelId(mapel[0].id)
      }
    }
    init()
  }, [])

  const fetchSoal = useCallback(async () => {
    if (!guruId || !mapelId) { setLoading(false); return }
    setLoading(true)
    let query = supabase.from('bank_soal').select('*')
      .eq('dibuat_oleh', guruId).eq('mapel_id', mapelId)
      .order('created_at', { ascending: false })
    if (filterJenis) query = query.eq('jenis', filterJenis)
    if (filterKesulitan) query = query.eq('tingkat_kesulitan', filterKesulitan)

    const { data } = await query
    setSoalList(data || [])
    setLoading(false)
  }, [guruId, mapelId, filterJenis, filterKesulitan])

  useEffect(() => { fetchSoal() }, [fetchSoal])

  const handleSimpan = async () => {
    if (!form.pertanyaan.trim()) { alert('Pertanyaan wajib diisi!'); return }
    if (form.jenis === 'pilihan_ganda' && (!form.pilihan_a || !form.pilihan_b)) {
      alert('Minimal pilihan A dan B wajib diisi untuk soal pilihan ganda!'); return
    }
    setSaving(true)

    const payload: any = {
      mapel_id: mapelId, dibuat_oleh: guruId, jenis: form.jenis,
      pertanyaan: form.pertanyaan, bobot_nilai: form.bobot_nilai,
      tingkat_kesulitan: form.tingkat_kesulitan, aktif: true,
    }
    if (form.jenis === 'pilihan_ganda') {
      payload.pilihan_a = form.pilihan_a
      payload.pilihan_b = form.pilihan_b
      payload.pilihan_c = form.pilihan_c || null
      payload.pilihan_d = form.pilihan_d || null
      payload.pilihan_e = form.pilihan_e || null
      payload.jawaban_benar = form.jawaban_benar
    }

    if (editId) await supabase.from('bank_soal').update(payload).eq('id', editId)
    else await supabase.from('bank_soal').insert(payload)

    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    setEditId(null)
    fetchSoal()
  }

  const handleEdit = (s: Soal) => {
    setForm({
      jenis: s.jenis, pertanyaan: s.pertanyaan,
      pilihan_a: s.pilihan_a || '', pilihan_b: s.pilihan_b || '', pilihan_c: s.pilihan_c || '',
      pilihan_d: s.pilihan_d || '', pilihan_e: s.pilihan_e || '',
      jawaban_benar: s.jawaban_benar || 'A', bobot_nilai: s.bobot_nilai,
      tingkat_kesulitan: s.tingkat_kesulitan,
    })
    setEditId(s.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus soal ini? Soal yang sudah dipakai di ujian sebaiknya dinonaktifkan saja, bukan dihapus.')) return
    await supabase.from('bank_soal').delete().eq('id', id)
    fetchSoal()
  }

  const handleToggleAktif = async (s: Soal) => {
    await supabase.from('bank_soal').update({ aktif: !s.aktif }).eq('id', s.id)
    fetchSoal()
  }

  const namaMapel = mapelList.find(m => m.id === mapelId)?.nama ?? ''
  const JENIS_LABEL: Record<string, string> = { pilihan_ganda: 'Pilihan Ganda', esai: 'Esai', upload_file: 'Upload File' }
  const KESULITAN_WARNA: Record<string, string> = { mudah: 'bg-green-50 text-green-700', sedang: 'bg-yellow-50 text-yellow-700', sulit: 'bg-red-50 text-red-700' }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Bank Soal</h1>
          <p className="text-gray-500 text-sm mt-1">Kumpulan soal per mata pelajaran — bisa dipakai berulang untuk ujian apa saja</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(emptyForm); setEditId(null) }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition w-full md:w-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
          {showForm ? 'Tutup' : 'Tambah Soal'}
        </button>
      </div>

      {/* Filter mapel */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3 flex-wrap items-center">
        <select value={mapelId} onChange={e => setMapelId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
        <select value={filterJenis} onChange={e => setFilterJenis(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Semua Jenis</option>
          <option value="pilihan_ganda">Pilihan Ganda</option>
          <option value="esai">Esai</option>
          <option value="upload_file">Upload File</option>
        </select>
        <select value={filterKesulitan} onChange={e => setFilterKesulitan(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Semua Tingkat</option>
          <option value="mudah">Mudah</option>
          <option value="sedang">Sedang</option>
          <option value="sulit">Sulit</option>
        </select>
        <span className="ml-auto text-sm text-gray-500 font-medium">{soalList.length} soal</span>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">{editId ? '✏️ Edit Soal' : '📝 Tambah Soal Baru'} — {namaMapel}</h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis Soal</label>
              <select value={form.jenis} onChange={e => setForm(f => ({ ...f, jenis: e.target.value as Soal['jenis'] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="pilihan_ganda">Pilihan Ganda</option>
                <option value="esai">Esai</option>
                <option value="upload_file">Upload File</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Tingkat Kesulitan</label>
              <select value={form.tingkat_kesulitan} onChange={e => setForm(f => ({ ...f, tingkat_kesulitan: e.target.value as Soal['tingkat_kesulitan'] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="mudah">Mudah</option>
                <option value="sedang">Sedang</option>
                <option value="sulit">Sulit</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Bobot Nilai</label>
              <input type="number" min={1} value={form.bobot_nilai}
                onChange={e => setForm(f => ({ ...f, bobot_nilai: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Pertanyaan *</label>
            <textarea value={form.pertanyaan} onChange={e => setForm(f => ({ ...f, pertanyaan: e.target.value }))}
              rows={3} placeholder="Tulis soal di sini..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {form.jenis === 'pilihan_ganda' && (
            <div className="space-y-2 mb-4">
              {(['a', 'b', 'c', 'd', 'e'] as const).map(huruf => (
                <div key={huruf} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{huruf.toUpperCase()}</span>
                  <input type="text" value={(form as any)[`pilihan_${huruf}`]}
                    onChange={e => setForm(f => ({ ...f, [`pilihan_${huruf}`]: e.target.value }))}
                    placeholder={`Pilihan ${huruf.toUpperCase()}${huruf === 'a' || huruf === 'b' ? ' *' : ' (opsional)'}`}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, jawaban_benar: huruf.toUpperCase() }))}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition flex-shrink-0
                      ${form.jawaban_benar === huruf.toUpperCase() ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    {form.jawaban_benar === huruf.toUpperCase() ? '✓ Kunci' : 'Jadikan kunci'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {form.jenis === 'esai' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Jawaban esai akan dikoreksi manual oleh guru setelah siswa mengerjakan.
            </p>
          )}
          {form.jenis === 'upload_file' && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Siswa akan diminta mengunggah file jawaban, dikoreksi manual oleh guru.
            </p>
          )}

          <div className="flex gap-3 justify-end">
            <button onClick={() => { setShowForm(false); setEditId(null) }}
              className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Batal</button>
            <button onClick={handleSimpan} disabled={saving}
              className="px-6 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'Menyimpan...' : editId ? 'Update Soal' : 'Simpan Soal'}
            </button>
          </div>
        </div>
      )}

      {/* Daftar Soal */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat soal...
        </div>
      ) : soalList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="font-medium text-sm">Belum ada soal untuk {namaMapel}</p>
          <p className="text-xs mt-1">Klik &quot;Tambah Soal&quot; untuk mulai mengisi bank soal</p>
        </div>
      ) : (
        <div className="space-y-3">
          {soalList.map((s, i) => (
            <div key={s.id} className={`bg-white rounded-xl border p-4 transition ${s.aktif ? 'border-gray-200' : 'border-gray-100 opacity-50'}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs text-gray-400">#{i + 1}</span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{JENIS_LABEL[s.jenis]}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${KESULITAN_WARNA[s.tingkat_kesulitan]}`}>{s.tingkat_kesulitan}</span>
                <span className="px-2 py-0.5 bg-gray-50 text-gray-600 rounded text-xs font-medium">Bobot {s.bobot_nilai}</span>
                {!s.aktif && <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-xs font-medium">Nonaktif</span>}
                <div className="ml-auto flex gap-3">
                  <button onClick={() => handleToggleAktif(s)} className="text-gray-400 hover:text-gray-700 text-xs font-medium">
                    {s.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                  <button onClick={() => handleEdit(s)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                  <button onClick={() => handleHapus(s.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
                </div>
              </div>
              <p className="text-sm text-gray-800 mb-2">{s.pertanyaan}</p>
              {s.jenis === 'pilihan_ganda' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  {(['a', 'b', 'c', 'd', 'e'] as const).map(huruf => {
                    const val = (s as any)[`pilihan_${huruf}`]
                    if (!val) return null
                    const isBenar = s.jawaban_benar === huruf.toUpperCase()
                    return (
                      <div key={huruf} className={`px-2 py-1 rounded ${isBenar ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                        {huruf.toUpperCase()}. {val} {isBenar && '✓'}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
