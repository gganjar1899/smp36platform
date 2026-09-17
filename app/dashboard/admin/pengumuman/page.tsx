'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

type Kelas = { id: string; nama_rombel: string; tingkat: number }
type Pengumuman = {
  id: string; judul: string; isi: string; kategori: string
  target_role: string; target_kelas_id: string | null; aktif: boolean; created_at: string
  kelas?: { nama_rombel: string }
}

const KATEGORI_OPT = [
  { v: 'penting', label: '🔴 Penting' }, { v: 'akademik', label: '📘 Akademik' }, { v: 'umum', label: '📢 Umum' },
]
const emptyForm = { judul: '', isi: '', kategori: 'umum', targetRole: 'semua', targetKelasId: '' }

export default function KelolaPengumumanPage() {
  const [list, setList] = useState<Pengumuman[]>([])
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/pengumuman/list?semua=true')
    const hasil = await res.json()
    setList(hasil.pengumuman ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchList()
    supabase.from('kelas').select('id, nama_rombel, tingkat').in('tingkat', [7, 8, 9]).order('tingkat').order('nama_rombel')
      .then(({ data }) => setKelasList(data || []))
  }, [fetchList])

  const bukaEdit = (p: Pengumuman) => {
    setEditId(p.id)
    setForm({ judul: p.judul, isi: p.isi, kategori: p.kategori, targetRole: p.target_role, targetKelasId: p.target_kelas_id || '' })
    setShowForm(true)
  }

  const handleSimpan = async () => {
    if (!form.judul || !form.isi) { alert('Judul dan isi wajib diisi!'); return }
    setSaving(true)
    const payload = { ...form, targetKelasId: form.targetKelasId || null }
    const res = editId
      ? await fetch('/api/pengumuman/kelola', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'edit', pengumumanId: editId, ...payload }) })
      : await fetch('/api/pengumuman/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const hasil = await res.json()
    if (!res.ok) { alert(hasil?.error ?? 'Gagal menyimpan.'); setSaving(false); return }
    if (!editId) alert(`Pengumuman diterbitkan, ${hasil.jumlahDinotifikasi} orang dinotifikasi.`)
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    setEditId(null)
    fetchList()
  }

  const handleToggle = async (id: string) => {
    await fetch('/api/pengumuman/kelola', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle-aktif', pengumumanId: id }) })
    fetchList()
  }
  const handleHapus = async (id: string) => {
    if (!confirm('Hapus pengumuman ini?')) return
    await fetch('/api/pengumuman/kelola', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'hapus', pengumumanId: id }) })
    fetchList()
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Pengumuman</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola pengumuman untuk siswa & guru</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(emptyForm) }}
          className="px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium w-full sm:w-auto">
          + Buat Pengumuman
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 space-y-4">
          <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))} placeholder="Judul pengumuman"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <textarea value={form.isi} onChange={e => setForm(f => ({ ...f, isi: e.target.value }))} rows={4} placeholder="Isi pengumuman"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={form.kategori} onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              {KATEGORI_OPT.map(k => <option key={k.v} value={k.v}>{k.label}</option>)}
            </select>
            <select value={form.targetRole} onChange={e => setForm(f => ({ ...f, targetRole: e.target.value, targetKelasId: '' }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="semua">Semua (siswa & guru)</option>
              <option value="siswa">Siswa saja</option>
              <option value="guru">Guru saja</option>
            </select>
            {form.targetRole === 'siswa' && (
              <select value={form.targetKelasId} onChange={e => setForm(f => ({ ...f, targetKelasId: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Semua kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_rombel}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSimpan} disabled={saving} className="px-6 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Terbitkan'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm) }} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">Batal</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Memuat...</div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">Belum ada pengumuman.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map(p => (
              <div key={p.id} className={`p-4 flex items-start justify-between gap-3 ${!p.aktif ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs">{KATEGORI_OPT.find(k => k.v === p.kategori)?.label ?? p.kategori}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                      {p.target_role === 'semua' ? 'Semua' : p.target_role === 'guru' ? 'Guru' : p.kelas?.nama_rombel ? `Siswa ${p.kelas.nama_rombel}` : 'Semua siswa'}
                    </span>
                    {!p.aktif && <span className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-500">Nonaktif</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{p.judul}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.isi}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                  <button onClick={() => bukaEdit(p)} className="text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleToggle(p.id)} className="text-gray-500 hover:underline">{p.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button onClick={() => handleHapus(p.id)} className="text-red-500 hover:underline">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
