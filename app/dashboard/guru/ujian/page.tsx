'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Opsi = { id: string; nama: string }
type Ujian = {
  id: string; judul: string; mapel_id: string; kelas_id: string
  jenis_ujian: string; token: string; durasi_menit: number
  status: 'draft' | 'aktif' | 'selesai' | 'dibatalkan'
  acak_soal: boolean; created_at: string
  mapel?: { nama_mapel: string }; kelas?: { nama_rombel: string }
}
type Soal = { id: string; pertanyaan: string; jenis: string; bobot_nilai: number }
type Sesi = {
  id: string; siswa_id: string; status: string
  nilai_otomatis: number | null; nilai_manual: number | null; nilai_akhir: number | null
  waktu_mulai: string | null; waktu_selesai: string | null
  siswa?: { nama: string; nisn: string }
}

const JENIS_LABEL: Record<string, string> = {
  ulangan_harian: 'Ulangan Harian', pts: 'PTS', pas: 'PAS', asat: 'ASAT', tugas: 'Tugas',
}
const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', aktif: 'bg-green-50 text-green-700',
  selesai: 'bg-blue-50 text-blue-700', dibatalkan: 'bg-red-50 text-red-700',
}

const buatToken = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

const emptyForm = {
  judul: '', mapelId: '', kelasId: '', jenisUjian: 'ulangan_harian',
  durasiMenit: 60, acakSoal: true, soalTerpilih: [] as string[],
}

export default function KelolaUjianGuruPage() {
  const [guruId, setGuruId] = useState('')
  const [mapelList, setMapelList] = useState<Opsi[]>([])
  const [kelasList, setKelasList] = useState<Opsi[]>([])
  const [ujianList, setUjianList] = useState<Ujian[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [soalTersedia, setSoalTersedia] = useState<Soal[]>([])

  const [detailUjian, setDetailUjian] = useState<Ujian | null>(null)
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [loadingSesi, setLoadingSesi] = useState(false)

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (!data.loggedIn || data.role !== 'guru') return
      setGuruId(data.userId)

      const { data: mengajar } = await supabase
        .from('guru_mapel')
        .select('kelas:kelas_id(id, nama_rombel), mapel:mapel_id(id, nama_mapel)')
        .eq('guru_id', data.userId).eq('tahun_ajaran', '2026/2027')

      if (mengajar) {
        const kelas = Array.from(new Map(mengajar.map((m: any) => [m.kelas?.id, { id: m.kelas?.id, nama: m.kelas?.nama_rombel }])).values()).filter(k => k.id) as Opsi[]
        const mapel = Array.from(new Map(mengajar.map((m: any) => [m.mapel?.id, { id: m.mapel?.id, nama: m.mapel?.nama_mapel }])).values()).filter(m => m.id) as Opsi[]
        setKelasList(kelas)
        setMapelList(mapel)
      }
    }
    init()
  }, [])

  const fetchUjian = useCallback(async () => {
    if (!guruId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('ujian')
      .select('*, mapel:mapel_id(nama_mapel), kelas:kelas_id(nama_rombel)')
      .eq('dibuat_oleh', guruId)
      .order('created_at', { ascending: false })
    setUjianList(data || [])
    setLoading(false)
  }, [guruId])

  useEffect(() => { fetchUjian() }, [fetchUjian])

  // Ambil soal aktif dari Bank Soal sesuai mapel yang dipilih di form
  useEffect(() => {
    if (!form.mapelId || !guruId) { setSoalTersedia([]); return }
    supabase.from('bank_soal').select('id, pertanyaan, jenis, bobot_nilai')
      .eq('dibuat_oleh', guruId).eq('mapel_id', form.mapelId).eq('aktif', true)
      .then(({ data }) => setSoalTersedia(data || []))
  }, [form.mapelId, guruId])

  const toggleSoal = (id: string) => {
    setForm(f => ({
      ...f, soalTerpilih: f.soalTerpilih.includes(id) ? f.soalTerpilih.filter(s => s !== id) : [...f.soalTerpilih, id],
    }))
  }

  const handleSimpan = async () => {
    if (!form.judul || !form.mapelId || !form.kelasId) { alert('Judul, mapel, dan kelas wajib diisi!'); return }
    if (form.soalTerpilih.length === 0) { alert('Pilih minimal 1 soal dari Bank Soal!'); return }
    setSaving(true)

    const { data: ujianBaru, error } = await supabase.from('ujian').insert({
      judul: form.judul, mapel_id: form.mapelId, kelas_id: form.kelasId, dibuat_oleh: guruId,
      jenis_ujian: form.jenisUjian, token: buatToken(), durasi_menit: form.durasiMenit,
      status: 'draft', acak_soal: form.acakSoal,
    }).select('id').single()

    if (error || !ujianBaru) { alert('Gagal membuat ujian: ' + error?.message); setSaving(false); return }

    const soalRows = form.soalTerpilih.map((soalId, i) => ({ ujian_id: ujianBaru.id, soal_id: soalId, urutan: i + 1 }))
    await supabase.from('ujian_soal').insert(soalRows)

    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    fetchUjian()
  }

  const handleUbahStatus = async (u: Ujian, status: Ujian['status']) => {
    if (status === 'aktif' && !confirm(`Aktifkan ujian "${u.judul}"? Token akan berlaku dan siswa bisa mulai mengerjakan.`)) return
    if (status === 'selesai' && !confirm(`Akhiri ujian "${u.judul}"? Siswa tidak bisa mengerjakan lagi setelah ini.`)) return
    await supabase.from('ujian').update({ status }).eq('id', u.id)
    fetchUjian()
    if (detailUjian?.id === u.id) setDetailUjian({ ...u, status })
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus ujian ini beserta seluruh data pengerjaan siswa? Tindakan ini tidak bisa dibatalkan.')) return
    await supabase.from('ujian').delete().eq('id', id)
    fetchUjian()
  }

  const bukaDetail = async (u: Ujian) => {
    setDetailUjian(u)
    setLoadingSesi(true)
    const { data } = await supabase
      .from('sesi_siswa')
      .select('*, siswa:siswa_id(nama, nisn)')
      .eq('ujian_id', u.id)
      .order('waktu_mulai')
    setSesiList(data || [])
    setLoadingSesi(false)
  }

  const handleSalinKeNilai = async () => {
    if (!detailUjian) return
    const selesai = sesiList.filter(s => s.status === 'selesai' && s.nilai_akhir !== null)
    if (selesai.length === 0) { alert('Belum ada siswa yang menyelesaikan ujian ini.'); return }
    if (!confirm(`Salin nilai ${selesai.length} siswa ke Nilai Sumatif (Semester 1)?`)) return

    const rows = selesai.map(s => ({
      siswa_id: s.siswa_id, kelas_id: detailUjian.kelas_id, mapel_id: detailUjian.mapel_id, guru_id: guruId,
      jenis: 'Sumatif', nilai: s.nilai_akhir, semester: 1, tahun_ajaran: '2026/2027', sumber: 'CBT',
    }))
    const { error } = await supabase.from('nilai_sumatif')
      .upsert(rows, { onConflict: 'siswa_id,mapel_id,kelas_id,jenis,semester,tahun_ajaran' })
    alert(error ? 'Gagal menyalin: ' + error.message : `Berhasil disalin ke Nilai & Leger (${selesai.length} siswa).`)
  }

  if (detailUjian) {
    const rataRata = sesiList.filter(s => s.nilai_akhir !== null).length > 0
      ? Math.round(sesiList.filter(s => s.nilai_akhir !== null).reduce((a, s) => a + (s.nilai_akhir || 0), 0) / sesiList.filter(s => s.nilai_akhir !== null).length)
      : 0
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <button onClick={() => setDetailUjian(null)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
          ← Kembali ke daftar ujian
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{detailUjian.judul}</h1>
              <p className="text-sm text-gray-500 mt-1">{detailUjian.kelas?.nama_rombel} · {detailUjian.mapel?.nama_mapel} · {JENIS_LABEL[detailUjian.jenis_ujian]}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${STATUS_BADGE[detailUjian.status]}`}>{detailUjian.status}</span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-mono font-bold">TOKEN: {detailUjian.token}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl border p-3 text-center bg-blue-50 border-blue-200 text-blue-600">
            <p className="text-xl font-bold">{sesiList.length}</p><p className="text-xs font-medium mt-0.5">Mengerjakan</p>
          </div>
          <div className="rounded-xl border p-3 text-center bg-green-50 border-green-200 text-green-600">
            <p className="text-xl font-bold">{sesiList.filter(s => s.status === 'selesai').length}</p><p className="text-xs font-medium mt-0.5">Selesai</p>
          </div>
          <div className="rounded-xl border p-3 text-center bg-gray-50 border-gray-200 text-gray-600">
            <p className="text-xl font-bold">{rataRata || '-'}</p><p className="text-xs font-medium mt-0.5">Rata Nilai</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {detailUjian.status === 'draft' && (
            <button onClick={() => handleUbahStatus(detailUjian, 'aktif')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">Aktifkan Ujian</button>
          )}
          {detailUjian.status === 'aktif' && (
            <button onClick={() => handleUbahStatus(detailUjian, 'selesai')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Akhiri Ujian</button>
          )}
          {detailUjian.status === 'selesai' && (
            <button onClick={handleSalinKeNilai} className="px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition">Salin Nilai ke Leger</button>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingSesi ? (
            <div className="p-12 text-center text-gray-400">Memuat...</div>
          ) : sesiList.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">Belum ada siswa yang mulai mengerjakan.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1a3a6b] text-white">
                  <th className="px-4 py-3 text-left font-semibold">Nama Siswa</th>
                  <th className="px-4 py-3 text-left font-semibold">NISN</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sesiList.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.siswa?.nama}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{s.siswa?.nisn}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-600">{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">{s.nilai_akhir ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kelola Ujian</h1>
          <p className="text-gray-500 text-sm mt-1">Buat ujian dari soal di Bank Soal, atur token & durasi</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setForm(emptyForm) }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition w-full md:w-auto">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showForm ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
          {showForm ? 'Tutup' : 'Buat Ujian Baru'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 md:p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">📋 Buat Ujian Baru</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Judul Ujian *</label>
              <input type="text" value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                placeholder="Contoh: Ulangan Harian Bab 3 - Percabangan"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Kelas *</label>
              <select value={form.kelasId} onChange={e => setForm(f => ({ ...f, kelasId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih kelas</option>
                {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Mata Pelajaran *</label>
              <select value={form.mapelId} onChange={e => setForm(f => ({ ...f, mapelId: e.target.value, soalTerpilih: [] }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Pilih mapel</option>
                {mapelList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis Ujian</label>
              <select value={form.jenisUjian} onChange={e => setForm(f => ({ ...f, jenisUjian: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(JENIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Durasi (menit)</label>
              <input type="number" min={5} value={form.durasiMenit}
                onChange={e => setForm(f => ({ ...f, durasiMenit: parseInt(e.target.value) || 5 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={form.acakSoal} onChange={e => setForm(f => ({ ...f, acakSoal: e.target.checked }))} className="rounded" />
                Acak urutan soal
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Pilih Soal dari Bank Soal {form.mapelId && `(${soalTersedia.length} soal tersedia)`} — {form.soalTerpilih.length} dipilih
            </label>
            {!form.mapelId ? (
              <p className="text-sm text-gray-400 italic">Pilih mata pelajaran dulu untuk melihat soal tersedia.</p>
            ) : soalTersedia.length === 0 ? (
              <p className="text-sm text-amber-600">Belum ada soal aktif di Bank Soal untuk mapel ini. Tambahkan dulu di menu Bank Soal.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {soalTersedia.map((s, i) => (
                  <label key={s.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={form.soalTerpilih.includes(s.id)} onChange={() => toggleSoal(s.id)} className="mt-0.5 rounded flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{i + 1}. {s.pertanyaan}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.jenis === 'pilihan_ganda' ? 'Pilihan Ganda' : s.jenis === 'esai' ? 'Esai' : 'Upload File'} · Bobot {s.bobot_nilai}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Batal</button>
            <button onClick={handleSimpan} disabled={saving}
              className="px-6 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'Menyimpan...' : 'Buat Ujian (jadi Draft)'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">Memuat ujian...</div>
      ) : ujianList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="font-medium text-sm">Belum ada ujian dibuat</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ujianList.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition cursor-pointer" onClick={() => bukaDetail(u)}>
              <div className="flex items-start justify-between mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[u.status]}`}>{u.status}</span>
                <button onClick={(e) => { e.stopPropagation(); handleHapus(u.id) }} className="text-red-400 hover:text-red-600 text-xs">Hapus</button>
              </div>
              <p className="font-semibold text-gray-800 text-sm mb-1">{u.judul}</p>
              <p className="text-xs text-gray-500 mb-2">{u.kelas?.nama_rombel} · {u.mapel?.nama_mapel} · {JENIS_LABEL[u.jenis_ujian]}</p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>⏱ {u.durasi_menit} menit</span>
                <span className="font-mono font-semibold text-amber-600">Token: {u.token}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
