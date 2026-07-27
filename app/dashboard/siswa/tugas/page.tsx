'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Tugas = {
  id: string; judul: string; deskripsi: string | null; deadline: string; poin: number
  mapel_nama?: string; file_lampiran: { nama: string; url: string }[]
}
type Pengumpulan = {
  id: string; tugas_id: string; status: string | null; nilai: number | null
  catatan_guru: string | null; catatan_siswa: string
  file_jawaban: { nama: string; url: string }[]
}

export default function TugasSiswaPage() {
  const [siswaId, setSiswaId] = useState('')
  const [tugasList, setTugasList] = useState<Tugas[]>([])
  const [pengumpulanMap, setPengumpulanMap] = useState<Record<string, Pengumpulan>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [catatan, setCatatan] = useState<Record<string, string>>({})
  const [file, setFile] = useState<Record<string, File | null>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const me = await res.json()
      if (!me.loggedIn || !me.siswa) { setError('Data kelas kamu belum lengkap. Hubungi wali kelas.'); setLoading(false); return }
      setSiswaId(me.userId)

      const { data: tugas } = await supabase
        .from('tugas')
        .select('id, judul, deskripsi, deadline, poin, file_lampiran, mapel:mapel_id(nama:nama_mapel)')
        .eq('kelas_id', me.siswa.kelasId)
        .order('deadline', { ascending: true })

      const list = (tugas ?? []).map((t: any) => ({ ...t, mapel_nama: t.mapel?.nama }))
      setTugasList(list)

      if (list.length > 0) {
        const { data: pengumpulan } = await supabase
          .from('pengumpulan_tugas').select('*')
          .eq('siswa_id', me.userId).in('tugas_id', list.map(t => t.id))
        const map: Record<string, Pengumpulan> = {}
        ;(pengumpulan ?? []).forEach((p: any) => { map[p.tugas_id] = p })
        setPengumpulanMap(map)
      }
    } catch (err) {
      console.error('[siswa/tugas] gagal memuat:', err)
      setError('Gagal memuat data tugas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function handleKumpulkan(t: Tugas) {
    setSubmitting(t.id)
    try {
      let fileJawaban: { nama: string; url: string }[] = []
      const f = file[t.id]
      if (f) {
        const path = `tugas-jawaban/${siswaId}/${t.id}-${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('dokumen-ajar').upload(path, f)
        if (upErr) throw new Error('Gagal upload: ' + upErr.message)
        const { data: urlData } = supabase.storage.from('dokumen-ajar').getPublicUrl(path)
        fileJawaban = [{ nama: f.name, url: urlData.publicUrl }]
      } else if (!catatan[t.id]) {
        alert('Upload file jawaban atau isi catatan dulu sebelum mengumpulkan.')
        setSubmitting(null)
        return
      }

      const terlambat = new Date() > new Date(t.deadline)
      const { data } = await supabase.from('pengumpulan_tugas').upsert({
        tugas_id: t.id, siswa_id: siswaId,
        file_jawaban: fileJawaban.length > 0 ? fileJawaban : (pengumpulanMap[t.id]?.file_jawaban ?? []),
        catatan_siswa: catatan[t.id] || pengumpulanMap[t.id]?.catatan_siswa || null,
        status: terlambat ? 'Terlambat' : 'Tepat Waktu',
        dikumpulkan_at: new Date().toISOString(),
      }, { onConflict: 'tugas_id,siswa_id' }).select().single()

      if (data) setPengumpulanMap(prev => ({ ...prev, [t.id]: data }))

      // Notifikasi ke guru pembuat tugas
      const { data: tugasDetail } = await supabase.from('tugas').select('dibuat_oleh').eq('id', t.id).single()
      if (tugasDetail) {
        await supabase.from('notifikasi').insert({
          user_id: tugasDetail.dibuat_oleh,
          judul: 'Tugas dikumpulkan',
          pesan: `Ada siswa mengumpulkan tugas "${t.judul}"${terlambat ? ' (terlambat)' : ''}`,
          link: '/dashboard/guru/tugas',
        })
      }
      setExpanded(null)
    } catch (err: any) {
      alert('Gagal mengumpulkan: ' + err.message)
    } finally {
      setSubmitting(null)
    }
  }

  const now = Date.now()

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Tugas</h1>
        <p className="text-sm text-gray-400 mt-0.5">Daftar tugas dan pengumpulanmu</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">Memuat...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
      ) : tugasList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">Belum ada tugas untuk kelasmu saat ini.</div>
      ) : (
        <div className="space-y-3">
          {tugasList.map(t => {
            const p = pengumpulanMap[t.id]
            const lewatDeadline = new Date(t.deadline).getTime() < now
            const sudahKumpul = !!p
            const isOpen = expanded === t.id

            return (
              <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : t.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {t.mapel_nama && <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{t.mapel_nama}</span>}
                      <h3 className="text-sm font-semibold text-gray-800 mt-2">{t.judul}</h3>
                      <p className={`text-xs mt-1 ${lewatDeadline && !sudahKumpul ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        Deadline: {new Date(t.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {sudahKumpul ? (
                        <div>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${p.status === 'Terlambat' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                            ✓ {p.status}
                          </span>
                          {p.nilai !== null && <p className="text-lg font-bold text-[#1a6b3a] mt-1">{p.nilai}</p>}
                        </div>
                      ) : lewatDeadline ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-600">Belum kumpul</span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-500">Belum kumpul</span>
                      )}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
                    {t.deskripsi && <p className="text-xs text-gray-600 whitespace-pre-wrap">{t.deskripsi}</p>}
                    {t.file_lampiran?.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {t.file_lampiran.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">📎 {f.nama} (dari guru)</a>
                        ))}
                      </div>
                    )}

                    {p?.catatan_guru && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <p className="text-[11px] font-semibold text-blue-700 mb-0.5">Catatan Guru:</p>
                        <p className="text-xs text-blue-600">{p.catatan_guru}</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <textarea
                        placeholder="Catatan (opsional)"
                        rows={2}
                        defaultValue={p?.catatan_siswa ?? ''}
                        onChange={e => setCatatan(prev => ({ ...prev, [t.id]: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20"
                      />
                      <input type="file" onChange={e => setFile(prev => ({ ...prev, [t.id]: e.target.files?.[0] ?? null }))}
                        className="w-full text-xs" />
                      {p?.file_jawaban?.length > 0 && (
                        <p className="text-[11px] text-gray-400">File tersimpan: {p.file_jawaban.map(f => f.nama).join(', ')}</p>
                      )}
                      <button
                        onClick={() => handleKumpulkan(t)}
                        disabled={submitting === t.id}
                        className="w-full py-2 bg-[#1a6b3a] hover:bg-[#155730] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-all">
                        {submitting === t.id ? 'Mengirim...' : sudahKumpul ? 'Kumpul Ulang' : 'Kumpulkan Tugas'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
