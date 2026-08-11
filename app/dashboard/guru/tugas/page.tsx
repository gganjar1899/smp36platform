'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Opsi = { id: string; nama: string }
type Tugas = {
  id: string; judul: string; deskripsi: string | null; deadline: string
  poin: number; kelas_id: string; mapel_id: string
  kelas_nama?: string; mapel_nama?: string
  file_lampiran: { nama: string; url: string }[]
}
type Pengumpulan = {
  id: string; siswa_id: string; status: string | null; nilai: number | null
  catatan_guru: string | null; catatan_siswa: string | null
  dikumpulkan_at: string | null; file_jawaban: { nama: string; url: string }[]
  siswa_nama?: string
}

export default function KelolaTugasPage() {
  const [guruId, setGuruId] = useState('')
  const [kelasList, setKelasList] = useState<Opsi[]>([])
  const [mapelList, setMapelList] = useState<Opsi[]>([])
  const [tugasList, setTugasList] = useState<Tugas[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    judul: '', deskripsi: '', kelasId: '', mapelId: '', deadline: '', poin: 100, file: null as File | null,
  })

  // Detail pengumpulan
  const [selectedTugas, setSelectedTugas] = useState<Tugas | null>(null)
  const [pengumpulanList, setPengumpulanList] = useState<Pengumpulan[]>([])
  const [totalSiswaKelas, setTotalSiswaKelas] = useState(0)
  const [belumList, setBelumList] = useState<Opsi[]>([])
  const [activeTab, setActiveTab] = useState<'sudah' | 'belum'>('sudah')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editNilai, setEditNilai] = useState<Record<string, { nilai: string; catatan: string }>>({})
  const [editPoin, setEditPoin] = useState<string>('')

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const me = await res.json()
        if (!me.loggedIn) return
        setGuruId(me.userId)

        const { data } = await supabase
          .from('guru_mapel')
          .select('mapel:mapel_id(id,nama:nama_mapel), kelas:kelas_id(id,nama_rombel)')
          .eq('guru_id', me.userId)
          .eq('tahun_ajaran', '2026/2027')

        if (data) {
          const mapels = [...new Map(data.map((d: any) => [d.mapel?.id, { id: d.mapel?.id, nama: d.mapel?.nama }])).values()].filter(m => m.id)
          const kelas = [...new Map(data.map((d: any) => [d.kelas?.id, { id: d.kelas?.id, nama: d.kelas?.nama_rombel }])).values()].filter(k => k.id)
          setMapelList(mapels as Opsi[])
          setKelasList(kelas as Opsi[])
          setForm(f => ({ ...f, kelasId: kelas[0]?.id ?? '', mapelId: mapels[0]?.id ?? '' }))
        }
      } catch (err) {
        console.error('[guru/tugas] gagal ambil identitas:', err)
      }
    }
    init()
  }, [])

  const fetchTugas = useCallback(async () => {
    if (!guruId) return
    setLoading(true)
    const { data } = await supabase
      .from('tugas')
      .select('id, judul, deskripsi, deadline, poin, kelas_id, mapel_id, file_lampiran, kelas:kelas_id(nama_rombel), mapel:mapel_id(nama:nama_mapel)')
      .eq('dibuat_oleh', guruId)
      .order('deadline', { ascending: false })

    if (data) {
      setTugasList(data.map((d: any) => ({ ...d, kelas_nama: d.kelas?.nama_rombel, mapel_nama: d.mapel?.nama })))
    }
    setLoading(false)
  }, [guruId])

  useEffect(() => { fetchTugas() }, [fetchTugas])

  async function handleSimpan() {
    if (!form.judul || !form.kelasId || !form.mapelId || !form.deadline) {
      setMsg('Judul, kelas, mapel, dan deadline wajib diisi')
      return
    }
    setSaving(true)
    setMsg('')
    try {
      let fileLampiran: { nama: string; url: string }[] = []
      if (form.file) {
        const path = `tugas/${guruId}/${Date.now()}-${form.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('dokumen-ajar').upload(path, form.file)
        if (upErr) throw new Error('Gagal upload lampiran: ' + upErr.message)
        const { data: urlData } = supabase.storage.from('dokumen-ajar').getPublicUrl(path)
        fileLampiran = [{ nama: form.file.name, url: urlData.publicUrl }]
      }

      const { data: tugasBaru, error: insertErr } = await supabase.from('tugas').insert({
        judul: form.judul, deskripsi: form.deskripsi || null,
        kelas_id: form.kelasId, mapel_id: form.mapelId,
        deadline: new Date(form.deadline).toISOString(),
        poin: form.poin, dibuat_oleh: guruId,
        file_lampiran: fileLampiran,
      }).select().single()
      if (insertErr) throw new Error(insertErr.message)

      // Kirim notifikasi ke semua siswa di kelas tersebut
      const { data: siswaKelas } = await supabase
        .from('siswa_kelas').select('siswa_id')
        .eq('kelas_id', form.kelasId).eq('tahun_ajaran', '2026/2027').eq('status', 'aktif')
      if (siswaKelas && siswaKelas.length > 0) {
        await supabase.from('notifikasi').insert(siswaKelas.map((s: any) => ({
          user_id: s.siswa_id,
          judul: 'Tugas baru',
          pesan: `Ada tugas baru: "${form.judul}"`,
          link: '/dashboard/siswa/tugas',
        })))
      }

      setForm(f => ({ ...f, judul: '', deskripsi: '', file: null }))
      setShowForm(false)
      setMsg('Tugas berhasil dibuat!')
      fetchTugas()
    } catch (err: any) {
      setMsg('Gagal menyimpan: ' + err.message)
    } finally {
      setSaving(false)
      setTimeout(() => setMsg(''), 4000)
    }
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus tugas ini? Semua data pengumpulan siswa akan ikut terhapus.')) return
    await supabase.from('tugas').delete().eq('id', id)
    fetchTugas()
  }

  async function bukaDetail(t: Tugas) {
    setSelectedTugas(t)
    setEditPoin(String(t.poin))
    setActiveTab('sudah')
    setLoadingDetail(true)
    const { data: roster } = await supabase
      .from('siswa_kelas')
      .select('siswa_id, siswa:siswa_id(nama)')
      .eq('kelas_id', t.kelas_id).eq('tahun_ajaran', '2026/2027').eq('status', 'aktif')
    const rosterList = (roster ?? []).map((r: any) => ({ id: r.siswa_id, nama: r.siswa?.nama ?? '—' }))
    setTotalSiswaKelas(rosterList.length)

    const { data } = await supabase
      .from('pengumpulan_tugas')
      .select('*, siswa:siswa_id(nama)')
      .eq('tugas_id', t.id)
      .order('dikumpulkan_at', { ascending: true })

    const list = (data ?? []).map((d: any) => ({ ...d, siswa_nama: d.siswa?.nama }))
    setPengumpulanList(list)
    setBelumList(rosterList.filter(r => !list.some(p => p.siswa_id === r.id)))
    const em: Record<string, { nilai: string; catatan: string }> = {}
    list.forEach((p: Pengumpulan) => { em[p.id] = { nilai: p.nilai?.toString() ?? '', catatan: p.catatan_guru ?? '' } })
    setEditNilai(em)
    setLoadingDetail(false)
  }

  async function handleSimpanNilai(pengumpulanId: string) {
    const e = editNilai[pengumpulanId]
    if (!e) return
    const res = await fetch('/api/tugas/nilai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pengumpulanId, nilai: e.nilai || null, catatan: e.catatan || null }),
    })
    const hasil = await res.json()
    if (!res.ok) {
      alert(hasil?.error ?? 'Gagal menyimpan nilai.')
      return
    }
    if (hasil.pengumpulan) {
      setPengumpulanList(prev => prev.map(p => p.id === pengumpulanId ? { ...p, ...hasil.pengumpulan } : p))
    }
    if (selectedTugas) bukaDetail(selectedTugas)
  }

  async function handleSimpanPoin() {
    if (!selectedTugas) return
    const poinBaru = parseFloat(editPoin)
    if (isNaN(poinBaru)) return
    await supabase.from('tugas').update({ poin: poinBaru }).eq('id', selectedTugas.id)
    setSelectedTugas({ ...selectedTugas, poin: poinBaru })
    fetchTugas()
  }

  const now = Date.now()

  // ====== DETAIL VIEW ======
  if (selectedTugas) {
    const dikumpulkan = pengumpulanList.length
    const belum = totalSiswaKelas - dikumpulkan
    return (
      <div className="space-y-5 max-w-4xl">
        <button onClick={() => setSelectedTugas(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          Kembali ke daftar tugas
        </button>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-800">{selectedTugas.judul}</h1>
              <p className="text-sm text-gray-400 mt-0.5">{selectedTugas.kelas_nama} · {selectedTugas.mapel_nama}</p>
              <p className="text-xs text-gray-400 mt-1">Deadline: {new Date(selectedTugas.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Poin maksimal:</label>
              <input type="number" value={editPoin} onChange={e => setEditPoin(e.target.value)}
                className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center" />
              <button onClick={handleSimpanPoin} className="text-xs px-3 py-1 bg-[#1a6b3a] text-white rounded-lg hover:bg-[#155730]">Simpan</button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{totalSiswaKelas}</p>
              <p className="text-xs text-blue-500">Total Siswa</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{dikumpulkan}</p>
              <p className="text-xs text-green-500">Sudah Kumpul</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-600">{belum}</p>
              <p className="text-xs text-red-400">Belum Kumpul</p>
            </div>
          </div>
        </div>

        {loadingDetail ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">Memuat...</div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('sudah')}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'sudah' ? 'border-[#1a6b3a] text-gray-800' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                📂 Sudah Kumpul
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">{pengumpulanList.length}</span>
              </button>
              <button
                onClick={() => setActiveTab('belum')}
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'belum' ? 'border-[#1a6b3a] text-gray-800' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                📁 Belum Kumpul
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{belumList.length}</span>
              </button>
            </div>

            {activeTab === 'sudah' ? (
              pengumpulanList.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">Belum ada siswa yang mengumpulkan.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {pengumpulanList.map(p => (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1a6b3a]/10 flex items-center justify-center text-[#1a6b3a] text-xs font-bold flex-shrink-0">
                          {(p.siswa_nama ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{p.siswa_nama}</p>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'Terlambat' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                          }`}>{p.status ?? 'Tepat Waktu'}</span>
                        </div>
                      </div>

                      {p.catatan_siswa && <p className="text-xs text-gray-500 mb-2 italic line-clamp-2">"{p.catatan_siswa}"</p>}

                      {(p.file_jawaban || []).length > 0 && (
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {(p.file_jawaban || []).map((f, i) => (
                            <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                              📎 {f.nama}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-2">
                        <input type="number" placeholder="Nilai" min={0} max={selectedTugas.poin}
                          value={editNilai[p.id]?.nilai ?? ''}
                          onChange={e => setEditNilai(prev => ({ ...prev, [p.id]: { ...prev[p.id], nilai: e.target.value } }))}
                          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center" />
                        <button onClick={() => handleSimpanNilai(p.id)}
                          className="flex-1 px-3 py-1.5 bg-[#1a6b3a] text-white text-xs font-semibold rounded-lg hover:bg-[#155730]">
                          Simpan Nilai
                        </button>
                      </div>
                      <textarea placeholder="Catatan untuk siswa (opsional)" rows={2}
                        value={editNilai[p.id]?.catatan ?? ''}
                        onChange={e => setEditNilai(prev => ({ ...prev, [p.id]: { ...prev[p.id], catatan: e.target.value } }))}
                        className="w-full px-2.5 py-1.5 border border-gray-100 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20" />
                    </div>
                  ))}
                </div>
              )
            ) : belumList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">Semua siswa sudah mengumpulkan 🎉</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {belumList.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[10px] font-bold flex-shrink-0">
                      {s.nama.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{s.nama}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ====== LIST VIEW ======
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Kelola Tugas</h1>
          <p className="text-sm text-gray-400 mt-0.5">Berikan tugas ke siswa dan pantau pengumpulannya</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#1a6b3a] text-white text-sm font-semibold rounded-lg hover:bg-[#155730] transition-all flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Beri Tugas Baru
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm font-medium border ${msg.includes('berhasil') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg}</div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Tugas Baru</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Mata Pelajaran</label>
              <select value={form.mapelId} onChange={e => setForm(f => ({ ...f, mapelId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Kelas</label>
              <select value={form.kelasId} onChange={e => setForm(f => ({ ...f, kelasId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Judul Tugas</label>
            <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
              placeholder="Contoh: Latihan Soal Bab 2"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Instruksi / Deskripsi</label>
            <textarea rows={3} value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Deadline</label>
              <input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Poin Maksimal</label>
              <input type="number" value={form.poin} onChange={e => setForm(f => ({ ...f, poin: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Lampiran (opsional)</label>
            <input type="file" onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
              className="w-full text-sm" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSimpan} disabled={saving}
              className="px-5 py-2 bg-[#1a6b3a] text-white text-sm font-semibold rounded-lg hover:bg-[#155730] disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Buat Tugas'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200">Batal</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">Memuat...</div>
      ) : tugasList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">Belum ada tugas. Klik "Beri Tugas Baru" untuk mulai.</div>
      ) : (
        <div className="space-y-3">
          {tugasList.map(t => {
            const lewatDeadline = new Date(t.deadline).getTime() < now
            return (
              <div key={t.id} onClick={() => bukaDetail(t)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{t.mapel_nama} · {t.kelas_nama}</span>
                    <h3 className="text-sm font-semibold text-gray-800 mt-2">{t.judul}</h3>
                    <p className={`text-xs mt-1 ${lewatDeadline ? 'text-red-500' : 'text-gray-400'}`}>
                      Deadline: {new Date(t.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      {lewatDeadline && ' (sudah lewat)'}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleHapus(t.id) }} className="text-xs text-red-400 hover:text-red-600 shrink-0">Hapus</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
