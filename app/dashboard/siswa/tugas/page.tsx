'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TAHUN_AJARAN = '2026/2027'

type Tugas = {
  id: string; judul: string; deskripsi: string | null; deadline: string
  file_lampiran_url: string | null
  mapel?: { nama_mapel: string }
}
type Pengumpulan = {
  id: string; status: string; nilai: number | null; catatan_siswa: string | null
  catatan_guru: string | null; file_jawaban_url: string | null; dikumpulkan_at: string | null
}

function formatDeadline(iso: string) {
  return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TugasSiswaPage() {
  const [siswaId, setSiswaId] = useState('')
  const [authReady, setAuthReady] = useState(false)

  const [tugasList, setTugasList] = useState<Tugas[]>([])
  const [pengumpulanMap, setPengumpulanMap] = useState<Record<string, Pengumpulan>>({})
  const [loading, setLoading] = useState(true)

  const [detailTugas, setDetailTugas] = useState<Tugas | null>(null)
  const [catatan, setCatatan] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (!data.loggedIn || data.role !== 'siswa') { setAuthReady(true); return }
        setSiswaId(data.userId)
      } finally {
        setAuthReady(true)
      }
    }
    init()
  }, [])

  const fetchTugas = useCallback(async () => {
    if (!siswaId) return
    setLoading(true)
    const { data: kelasRows } = await supabase.from('siswa_kelas').select('kelas_id')
      .eq('siswa_id', siswaId).eq('tahun_ajaran', TAHUN_AJARAN).eq('status', 'aktif')
    const kelasIds = (kelasRows || []).map((r: any) => r.kelas_id)
    if (kelasIds.length === 0) { setTugasList([]); setLoading(false); return }

    const { data: tugasRows } = await supabase.from('tugas')
      .select('*, mapel:mapel_id(nama_mapel)')
      .in('kelas_id', kelasIds)
      .order('deadline', { ascending: true })
    const list = (tugasRows || []) as Tugas[]
    setTugasList(list)

    if (list.length > 0) {
      const { data: pengRows } = await supabase.from('pengumpulan_tugas').select('*')
        .in('tugas_id', list.map(t => t.id)).eq('siswa_id', siswaId)
      const map: Record<string, Pengumpulan> = {}
      ;(pengRows || []).forEach((p: any) => { map[p.tugas_id] = p })
      setPengumpulanMap(map)
    }
    setLoading(false)
  }, [siswaId])

  useEffect(() => { fetchTugas() }, [fetchTugas])

  const bukaDetail = (t: Tugas) => {
    setDetailTugas(t)
    const p = pengumpulanMap[t.id]
    setCatatan(p?.catatan_siswa ?? '')
    setFile(null)
  }

  const handleKumpul = async () => {
    if (!detailTugas) return
    if (!catatan.trim() && !file) { alert('Isi catatan/jawaban atau lampirkan file dulu.'); return }
    setSaving(true)
    try {
      let fileUrl: string | null = pengumpulanMap[detailTugas.id]?.file_jawaban_url ?? null
      if (file) {
        const path = `jawaban/${detailTugas.id}/${siswaId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('tugas-files').upload(path, file, { upsert: false })
        if (uploadError) throw new Error('Gagal upload file: ' + uploadError.message)
        fileUrl = supabase.storage.from('tugas-files').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('pengumpulan_tugas').upsert({
        tugas_id: detailTugas.id, siswa_id: siswaId, catatan_siswa: catatan.trim() || null,
        file_jawaban_url: fileUrl, status: 'sudah', dikumpulkan_at: new Date().toISOString(),
      }, { onConflict: 'tugas_id,siswa_id' })
      if (error) throw new Error(error.message)

      setDetailTugas(null)
      fetchTugas()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (authReady && !siswaId) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-700 font-medium">Data siswa tidak terdeteksi</p>
          <p className="text-xs text-amber-500 mt-1">Silakan login ulang, atau hubungi guru/admin kalau masih bermasalah.</p>
        </div>
      </div>
    )
  }

  // ====== DETAIL & KUMPUL TUGAS ======
  if (detailTugas) {
    const p = pengumpulanMap[detailTugas.id]
    const sudahKumpul = p?.status === 'sudah'
    return (
      <div className="p-3 sm:p-4 lg:p-6 max-w-2xl">
        <button onClick={() => setDetailTugas(null)} className="text-sm text-blue-600 hover:underline mb-4">← Kembali</button>

        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">{detailTugas.mapel?.nama_mapel}</span>
          <h1 className="text-lg font-bold text-gray-800 mt-2">{detailTugas.judul}</h1>
          <p className="text-sm text-gray-500 mt-1">Deadline: {formatDeadline(detailTugas.deadline)}</p>
          {detailTugas.deskripsi && <p className="text-sm text-gray-600 mt-3 whitespace-pre-wrap">{detailTugas.deskripsi}</p>}
          {detailTugas.file_lampiran_url && (
            <a href={detailTugas.file_lampiran_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline mt-2">📎 Lihat lampiran soal</a>
          )}
        </div>

        {sudahKumpul && p?.nilai !== null && p?.nilai !== undefined && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5">
            <p className="text-sm font-semibold text-green-700">Nilai: {p.nilai}</p>
            {p.catatan_guru && <p className="text-sm text-green-600 mt-1">Catatan guru: {p.catatan_guru}</p>}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">{sudahKumpul ? 'Jawaban Kamu (bisa diubah)' : 'Kumpulkan Jawaban'}</h2>
          <textarea rows={5} value={catatan} onChange={e => setCatatan(e.target.value)}
            placeholder="Tulis jawaban atau catatan di sini..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
          <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-xs mb-1" />
          {p?.file_jawaban_url && !file && (
            <a href={p.file_jawaban_url} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-600 hover:underline mb-3">📎 File tersimpan sebelumnya</a>
          )}
          <button onClick={handleKumpul} disabled={saving}
            className="w-full mt-3 px-6 py-2.5 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? 'Mengirim...' : sudahKumpul ? 'Perbarui Jawaban' : 'Kumpulkan Tugas'}
          </button>
        </div>
      </div>
    )
  }

  // ====== DAFTAR TUGAS ======
  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1">Tugas</h1>
      <p className="text-gray-500 text-sm mb-6">Daftar tugas dari semua mata pelajaran</p>

      {loading ? (
        <div className="p-10 text-center text-gray-400 text-sm">Memuat...</div>
      ) : tugasList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">Belum ada tugas.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tugasList.map(t => {
            const p = pengumpulanMap[t.id]
            const sudah = p?.status === 'sudah'
            const lewatDeadline = new Date(t.deadline) < new Date()
            return (
              <button key={t.id} onClick={() => bukaDetail(t)}
                className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-200 transition">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700">{t.mapel?.nama_mapel}</span>
                  {sudah ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-50 text-green-700">Sudah kumpul</span>
                  ) : lewatDeadline ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-50 text-red-600">Lewat deadline</span>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-600">Belum kumpul</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{t.judul}</h3>
                <p className="text-xs text-gray-400">Deadline: {formatDeadline(t.deadline)}</p>
                {sudah && p?.nilai !== null && p?.nilai !== undefined && (
                  <p className="text-xs font-semibold text-green-700 mt-2">Nilai: {p.nilai}</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
