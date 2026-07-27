'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TAHUN_AJARAN = '2026/2027'

type Opsi = { id: string; nama: string }
type Tugas = {
  id: string; judul: string; deskripsi: string | null; deadline: string
  file_lampiran_url: string | null; kelas_id: string; mapel_id: string; created_at: string
  kelas?: { nama_rombel: string }; mapel?: { nama_mapel: string }
}
type Pengumpulan = {
  id: string; siswa_id: string; status: string; nilai: number | null
  catatan_siswa: string | null; catatan_guru: string | null
  file_jawaban_url: string | null; dikumpulkan_at: string | null
  siswa?: { nama: string; nisn: string }
}

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function KelolaTugasPage() {
  const [guruId, setGuruId] = useState('')
  const [guruNama, setGuruNama] = useState('Guru')
  const [authReady, setAuthReady] = useState(false)

  const [kelasList, setKelasList] = useState<Opsi[]>([])
  const [mapelList, setMapelList] = useState<Opsi[]>([])

  const [tugasList, setTugasList] = useState<Tugas[]>([])
  const [pengumpulanCount, setPengumpulanCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ judul: '', deskripsi: '', kelasId: '', mapelId: '', deadline: '', file: null as File | null })

  const [detailTugas, setDetailTugas] = useState<Tugas | null>(null)
  const [pengumpulanList, setPengumpulanList] = useState<Pengumpulan[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [nilaiModal, setNilaiModal] = useState<Pengumpulan | null>(null)
  const [nilaiInput, setNilaiInput] = useState('')
  const [catatanInput, setCatatanInput] = useState('')
  const [savingNilai, setSavingNilai] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data.loggedIn || data.role !== 'guru') { setAuthReady(true); return }
        setGuruId(data.userId)
        setGuruNama(data.nama ?? 'Guru')

        const { data: mengajar } = await supabase
          .from('guru_mapel')
          .select('kelas:kelas_id(id, nama_rombel), mapel:mapel_id(id, nama_mapel)')
          .eq('guru_id', data.userId).eq('tahun_ajaran', TAHUN_AJARAN)

        if (mengajar) {
          const kelas = Array.from(new Map(mengajar.map((m: any) => [m.kelas?.id, { id: m.kelas?.id, nama: m.kelas?.nama_rombel }])).values()).filter(k => k.id) as Opsi[]
          const mapel = Array.from(new Map(mengajar.map((m: any) => [m.mapel?.id, { id: m.mapel?.id, nama: m.mapel?.nama_mapel }])).values()).filter(m => m.id) as Opsi[]
          kelas.sort((a, b) => a.nama.localeCompare(b.nama))
          setKelasList(kelas)
          setMapelList(mapel)
          setForm(f => ({ ...f, kelasId: kelas[0]?.id ?? '', mapelId: mapel[0]?.id ?? '' }))
        }
      } finally {
        setAuthReady(true)
      }
    }
    init()
  }, [])

  const fetchTugas = useCallback(async () => {
    if (!guruId) return
    setLoading(true)
    const { data } = await supabase
      .from('tugas')
      .select('*, kelas:kelas_id(nama_rombel), mapel:mapel_id(nama_mapel)')
      .eq('dibuat_oleh', guruId)
      .order('deadline', { ascending: false })
    const list = (data || []) as Tugas[]
    setTugasList(list)

    if (list.length > 0) {
      const { data: pengRows } = await supabase.from('pengumpulan_tugas').select('tugas_id').in('tugas_id', list.map(t => t.id)).eq('status', 'sudah')
      const counts: Record<string, number> = {}
      ;(pengRows || []).forEach((r: any) => { counts[r.tugas_id] = (counts[r.tugas_id] || 0) + 1 })
      setPengumpulanCount(counts)
    }
    setLoading(false)
  }, [guruId])

  useEffect(() => { fetchTugas() }, [fetchTugas])

  const handleBuatTugas = async () => {
    if (!form.judul.trim() || !form.kelasId || !form.mapelId || !form.deadline) {
      alert('Judul, kelas, mapel, dan deadline wajib diisi.')
      return
    }
    setSaving(true)
    try {
      let fileUrl: string | null = null
      if (form.file) {
        const path = `lampiran/${guruId}/${Date.now()}-${form.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('tugas-files').upload(path, form.file, { upsert: false })
        if (uploadError) throw new Error('Gagal upload lampiran: ' + uploadError.message)
        fileUrl = supabase.storage.from('tugas-files').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('tugas').insert({
        judul: form.judul.trim(), deskripsi: form.deskripsi.trim() || null,
        kelas_id: form.kelasId, mapel_id: form.mapelId, dibuat_oleh: guruId,
        file_lampiran_url: fileUrl, deadline: new Date(form.deadline).toISOString(),
      })
      if (error) throw new Error(error.message)

      setShowForm(false)
      setForm(f => ({ ...f, judul: '', deskripsi: '', deadline: '', file: null }))
      fetchTugas()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const bukaDetail = async (t: Tugas) => {
    setDetailTugas(t)
    setLoadingDetail(true)
    const [{ data: siswaRows }, { data: pengRows }] = await Promise.all([
      supabase.from('siswa_kelas').select('users(id, nama, nisn)').eq('kelas_id', t.kelas_id).eq('tahun_ajaran', TAHUN_AJARAN).eq('status', 'aktif'),
      supabase.from('pengumpulan_tugas').select('*').eq('tugas_id', t.id),
    ])
    const siswaList = ((siswaRows ?? []) as any[]).map(r => r.users).filter(Boolean)
    const pengMap = new Map((pengRows || []).map((p: any) => [p.siswa_id, p]))
    const merged: Pengumpulan[] = siswaList
      .map((s: any) => {
        const p = pengMap.get(s.id)
        return p
          ? { ...p, siswa: { nama: s.nama, nisn: s.nisn } }
          : { id: '', siswa_id: s.id, status: 'belum', nilai: null, catatan_siswa: null, catatan_guru: null, file_jawaban_url: null, dikumpulkan_at: null, siswa: { nama: s.nama, nisn: s.nisn } }
      })
      .sort((a, b) => (a.siswa?.nama ?? '').localeCompare(b.siswa?.nama ?? ''))
    setPengumpulanList(merged)
    setLoadingDetail(false)
  }

  const bukaNilai = (p: Pengumpulan) => {
    setNilaiModal(p)
    setNilaiInput(p.nilai !== null ? String(p.nilai) : '')
    setCatatanInput(p.catatan_guru ?? '')
  }

  const simpanNilai = async () => {
    if (!nilaiModal) return
    setSavingNilai(true)
    const nilai = nilaiInput === '' ? null : Math.max(0, Math.min(100, parseFloat(nilaiInput)))
    const { error } = await supabase.from('pengumpulan_tugas').update({
      nilai, catatan_guru: catatanInput || null, dinilai_at: new Date().toISOString(),
    }).eq('id', nilaiModal.id)
    setSavingNilai(false)
    if (error) { alert('Gagal menyimpan nilai: ' + error.message); return }
    setNilaiModal(null)
    if (detailTugas) bukaDetail(detailTugas)
  }

  if (authReady && !guruId) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-700 font-medium">Data guru tidak terdeteksi</p>
          <p className="text-xs text-amber-500 mt-1">Silakan login ulang, atau hubungi admin kalau masih bermasalah.</p>
        </div>
      </div>
    )
  }

  // ====== DETAIL TUGAS (daftar pengumpulan siswa) ======
  if (detailTugas) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <button onClick={() => setDetailTugas(null)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
          ← Kembali ke daftar tugas
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h1 className="text-lg font-bold text-gray-800">{detailTugas.judul}</h1>
          <p className="text-sm text-gray-500 mt-1">{detailTugas.mapel?.nama_mapel} · {detailTugas.kelas?.nama_rombel} · Deadline {formatDeadline(detailTugas.deadline)}</p>
          {detailTugas.deskripsi && <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{detailTugas.deskripsi}</p>}
          {detailTugas.file_lampiran_url && (
            <a href={detailTugas.file_lampiran_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline mt-2">📎 Lihat lampiran soal</a>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingDetail ? (
            <div className="p-10 text-center text-gray-400 text-sm">Memuat...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1a3a6b] text-white">
                    <th className="px-4 py-3 text-left font-semibold">Nama Siswa</th>
                    <th className="px-4 py-3 text-left font-semibold">NISN</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Dikumpulkan</th>
                    <th className="px-4 py-3 text-center font-semibold">Nilai</th>
                    <th className="px-4 py-3 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pengumpulanList.map(p => (
                    <tr key={p.siswa_id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.siswa?.nama}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{p.siswa?.nisn}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded ${p.status === 'sudah' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                          {p.status === 'sudah' ? 'Sudah kumpul' : 'Belum kumpul'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{p.dikumpulkan_at ? formatDeadline(p.dikumpulkan_at) : '-'}</td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{p.nilai ?? '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {p.status === 'sudah' ? (
                          <button onClick={() => bukaNilai(p)} className="text-xs font-medium text-blue-600 hover:underline">
                            {p.nilai !== null ? 'Lihat/Ubah Nilai' : 'Beri Nilai'}
                          </button>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Beri Nilai */}
        {nilaiModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Beri Nilai — {nilaiModal.siswa?.nama}</h3>
              </div>
              <div className="p-5 space-y-4">
                {nilaiModal.catatan_siswa && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Catatan/jawaban siswa:</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{nilaiModal.catatan_siswa}</p>
                  </div>
                )}
                {nilaiModal.file_jawaban_url && (
                  <a href={nilaiModal.file_jawaban_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline">📎 Lihat file jawaban siswa</a>
                )}
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Nilai (0-100)</label>
                  <input type="number" min={0} max={100} value={nilaiInput} onChange={e => setNilaiInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Catatan untuk siswa (opsional)</label>
                  <textarea rows={3} value={catatanInput} onChange={e => setCatatanInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 justify-end px-5 py-4 border-t border-gray-100">
                <button onClick={() => setNilaiModal(null)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
                <button onClick={simpanNilai} disabled={savingNilai}
                  className="px-6 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {savingNilai ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ====== DAFTAR TUGAS ======
  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kelola Tugas</h1>
          <p className="text-gray-500 text-sm mt-1">{guruNama} · {TAHUN_AJARAN}</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold transition">
          + Buat Tugas
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400 text-sm">Memuat...</div>
      ) : tugasList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
          Belum ada tugas yang dibuat. Klik "+ Buat Tugas" untuk mulai.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tugasList.map(t => {
            const lewatDeadline = new Date(t.deadline) < new Date()
            return (
              <button key={t.id} onClick={() => bukaDetail(t)}
                className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">{t.mapel?.nama_mapel}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${lewatDeadline ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                    {lewatDeadline ? 'Berakhir' : 'Aktif'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{t.judul}</h3>
                <p className="text-xs text-gray-400 mb-3">{t.kelas?.nama_rombel} · Deadline {formatDeadline(t.deadline)}</p>
                <p className="text-xs text-gray-500">📥 {pengumpulanCount[t.id] || 0} siswa sudah kumpul</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Modal Buat Tugas */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Buat Tugas Baru</h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Judul Tugas</label>
                <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                  placeholder="Contoh: Tugas Kelompok Bab 3"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas</label>
                  <select value={form.kelasId} onChange={e => setForm(f => ({ ...f, kelasId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran</label>
                  <select value={form.mapelId} onChange={e => setForm(f => ({ ...f, mapelId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Deskripsi / Instruksi</label>
                <textarea rows={4} value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                  placeholder="Jelaskan instruksi tugas untuk siswa..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Deadline</label>
                <input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Lampiran Soal (opsional)</label>
                <input type="file" onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs" />
              </div>
            </div>
            <div className="flex gap-3 justify-end px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
              <button onClick={handleBuatTugas} disabled={saving}
                className="px-6 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Buat Tugas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
