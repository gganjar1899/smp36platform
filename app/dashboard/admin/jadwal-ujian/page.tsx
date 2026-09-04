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
  tanggal_mulai: string | null; tanggal_selesai: string | null
  status: 'draft' | 'aktif' | 'selesai' | 'dibatalkan'
  acak_soal: boolean; created_at: string
  mapel?: { nama_mapel: string }; kelas?: { nama_rombel: string }
}
type Soal = { id: string; pertanyaan: string; jenis: string; bobot_nilai: number; guru?: { nama: string } }
type Sesi = {
  id: string; siswa_id: string; status: string
  nilai_otomatis: number | null; nilai_manual: number | null; nilai_akhir: number | null
  waktu_mulai: string | null; waktu_selesai: string | null
  siswa?: { nama: string; nisn: string }
}

const JENIS_LABEL: Record<string, string> = { asas: 'ASAS (Akhir Semester)', asat: 'ASAT (Akhir Tahun)' }
const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', aktif: 'bg-green-50 text-green-700',
  selesai: 'bg-blue-50 text-blue-700', dibatalkan: 'bg-red-50 text-red-700',
}

const buatToken = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

function formatJadwal(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const emptyForm = {
  judul: '', mapelId: '', kelasIds: [] as string[], jenisUjian: 'asas',
  tanggalMulai: '', tanggalSelesai: '', durasiMenit: 90, acakSoal: true, soalTerpilih: [] as string[],
}

export default function JadwalUjianAdminPage() {
  const [adminId, setAdminId] = useState('')
  const [mapelList, setMapelList] = useState<Opsi[]>([])
  const [kelasList, setKelasList] = useState<{ id: string; nama: string; tingkat: number }[]>([])
  const [ujianList, setUjianList] = useState<Ujian[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [soalTersedia, setSoalTersedia] = useState<Soal[]>([])

  const [detailUjian, setDetailUjian] = useState<Ujian | null>(null)
  const [sesiList, setSesiList] = useState<Sesi[]>([])
  const [loadingSesi, setLoadingSesi] = useState(false)
  const [editJadwal, setEditJadwal] = useState(false)
  const [editForm, setEditForm] = useState({ tanggalMulai: '', tanggalSelesai: '' })

  useEffect(() => {
    async function init() {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      if (!data.loggedIn || data.role !== 'admin') return
      setAdminId(data.userId)

      const [{ data: mapel }, { data: kelas }] = await Promise.all([
        supabase.from('mata_pelajaran').select('id, nama_mapel').order('nama_mapel'),
        supabase.from('kelas').select('id, nama_rombel, tingkat').in('tingkat', [7, 8, 9]).order('tingkat').order('nama_rombel'),
      ])
      setMapelList((mapel || []).map(m => ({ id: m.id, nama: m.nama_mapel })))
      setKelasList((kelas || []).map(k => ({ id: k.id, nama: k.nama_rombel, tingkat: k.tingkat })))
    }
    init()
  }, [])

  const fetchUjian = useCallback(async () => {
    if (!adminId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('ujian')
      .select('*, mapel:mapel_id(nama_mapel), kelas:kelas_id(nama_rombel)')
      .in('jenis_ujian', ['asas', 'asat'])
      .order('tanggal_mulai', { ascending: true, nullsFirst: false })
    setUjianList(data || [])
    setLoading(false)
  }, [adminId])

  useEffect(() => { fetchUjian() }, [fetchUjian])

  // Soal diambil dari Bank Soal SEMUA guru buat mapel yang dipilih (bukan cuma satu guru),
  // soalnya ASAS/ASAT butuh soal dari guru mapel yang bersangkutan, siapa pun itu.
  useEffect(() => {
    if (!form.mapelId) { setSoalTersedia([]); return }
    supabase.from('bank_soal').select('id, pertanyaan, jenis, bobot_nilai, guru:dibuat_oleh(nama)')
      .eq('mapel_id', form.mapelId).eq('aktif', true)
      .then(({ data }) => setSoalTersedia((data || []) as unknown as Soal[]))
  }, [form.mapelId])

  const toggleSoal = (id: string) => {
    setForm(f => ({
      ...f, soalTerpilih: f.soalTerpilih.includes(id) ? f.soalTerpilih.filter(s => s !== id) : [...f.soalTerpilih, id],
    }))
  }

  const handleSimpan = async () => {
    if (!form.judul || !form.mapelId || form.kelasIds.length === 0) { alert('Judul, mapel, dan minimal 1 kelas wajib diisi!'); return }
    if (!form.tanggalMulai || !form.tanggalSelesai) { alert('Jadwal mulai dan selesai wajib diisi!'); return }
    if (new Date(form.tanggalSelesai) <= new Date(form.tanggalMulai)) { alert('Jadwal selesai harus setelah jadwal mulai!'); return }
    if (form.soalTerpilih.length === 0) { alert('Pilih minimal 1 soal dari Bank Soal!'); return }
    setSaving(true)

    let gagal = 0
    for (const kelasId of form.kelasIds) {
      const { data: ujianBaru, error } = await supabase.from('ujian').insert({
        judul: form.judul, mapel_id: form.mapelId, kelas_id: kelasId, dibuat_oleh: adminId,
        jenis_ujian: form.jenisUjian, token: buatToken(), durasi_menit: form.durasiMenit,
        tanggal_mulai: new Date(form.tanggalMulai).toISOString(),
        tanggal_selesai: new Date(form.tanggalSelesai).toISOString(),
        status: 'aktif', acak_soal: form.acakSoal,
      }).select('id').single()

      if (error || !ujianBaru) { gagal++; continue }

      const soalRows = form.soalTerpilih.map((soalId, i) => ({ ujian_id: ujianBaru.id, soal_id: soalId, urutan: i + 1 }))
      await supabase.from('ujian_soal').insert(soalRows)
    }

    if (gagal > 0) alert(`${gagal} dari ${form.kelasIds.length} kelas gagal dijadwalkan. Coba lagi buat kelas yang gagal.`)

    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    fetchUjian()
  }

  const handleUbahStatus = async (u: Ujian, status: Ujian['status']) => {
    if (status === 'dibatalkan' && !confirm(`Batalkan ujian "${u.judul}" (${u.kelas?.nama_rombel})? Siswa tidak akan bisa mengerjakan.`)) return
    if (status === 'selesai' && !confirm(`Akhiri ujian "${u.judul}" (${u.kelas?.nama_rombel}) sekarang, sebelum jadwalnya habis?`)) return
    await supabase.from('ujian').update({ status }).eq('id', u.id)
    fetchUjian()
    if (detailUjian?.id === u.id) setDetailUjian({ ...u, status })
  }

  const handleSimpanJadwal = async () => {
    if (!detailUjian) return
    if (new Date(editForm.tanggalSelesai) <= new Date(editForm.tanggalMulai)) { alert('Jadwal selesai harus setelah jadwal mulai!'); return }
    const tanggal_mulai = new Date(editForm.tanggalMulai).toISOString()
    const tanggal_selesai = new Date(editForm.tanggalSelesai).toISOString()
    await supabase.from('ujian').update({ tanggal_mulai, tanggal_selesai }).eq('id', detailUjian.id)
    setDetailUjian({ ...detailUjian, tanggal_mulai, tanggal_selesai })
    setEditJadwal(false)
    fetchUjian()
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus ujian ini beserta seluruh data pengerjaan siswa? Tindakan ini tidak bisa dibatalkan.')) return
    await supabase.from('ujian').delete().eq('id', id)
    fetchUjian()
  }

  const bukaDetail = async (u: Ujian) => {
    setDetailUjian(u)
    setEditJadwal(false)
    setEditForm({
      tanggalMulai: u.tanggal_mulai ? u.tanggal_mulai.slice(0, 16) : '',
      tanggalSelesai: u.tanggal_selesai ? u.tanggal_selesai.slice(0, 16) : '',
    })
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
    if (!confirm(`Salin nilai ${selesai.length} siswa ke Nilai Sumatif?`)) return

    const res = await fetch('/api/nilai-sumatif/salin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ujianId: detailUjian.id }),
    })
    const hasil = await res.json()
    alert(!res.ok ? 'Gagal menyalin: ' + hasil?.error : `Berhasil disalin ke Nilai & Leger (${hasil.jumlah} siswa).`)
  }

  if (detailUjian) {
    const rataRata = sesiList.filter(s => s.nilai_akhir !== null).length > 0
      ? Math.round(sesiList.filter(s => s.nilai_akhir !== null).reduce((a, s) => a + (s.nilai_akhir || 0), 0) / sesiList.filter(s => s.nilai_akhir !== null).length)
      : 0
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <button onClick={() => setDetailUjian(null)} className="text-sm text-blue-600 hover:underline mb-4 flex items-center gap-1">
          ← Kembali ke Jadwal Ujian
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

          <div className="mt-4 pt-4 border-t border-gray-100">
            {editJadwal ? (
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Jadwal Mulai</label>
                  <input type="datetime-local" value={editForm.tanggalMulai} onChange={e => setEditForm(f => ({ ...f, tanggalMulai: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Jadwal Selesai</label>
                  <input type="datetime-local" value={editForm.tanggalSelesai} onChange={e => setEditForm(f => ({ ...f, tanggalSelesai: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <button onClick={handleSimpanJadwal} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Simpan</button>
                <button onClick={() => setEditJadwal(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">Batal</button>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-gray-600">
                  🗓️ <b>{formatJadwal(detailUjian.tanggal_mulai)}</b> s/d <b>{formatJadwal(detailUjian.tanggal_selesai)}</b> · durasi {detailUjian.durasi_menit} menit
                </p>
                <button onClick={() => setEditJadwal(true)} className="text-xs text-blue-600 hover:underline">
                  ✏️ Ubah jadwal (buat susulan/perpanjangan)
                </button>
              </div>
            )}
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
          {detailUjian.status === 'aktif' && (
            <button onClick={() => handleUbahStatus(detailUjian, 'selesai')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">Akhiri Sekarang</button>
          )}
          {detailUjian.status === 'aktif' && (
            <button onClick={() => handleUbahStatus(detailUjian, 'dibatalkan')} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition">Batalkan</button>
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Jadwal Ujian</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola jadwal ASAS & ASAT untuk semua kelas</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-medium transition w-full md:w-auto">
          + Jadwalkan Ujian
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jenis Ujian *</label>
              <select value={form.jenisUjian} onChange={e => setForm(f => ({ ...f, jenisUjian: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(JENIS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Judul Ujian *</label>
              <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                placeholder="Contoh: ASAS Bahasa Indonesia Semester 1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-500">Kelas * ({form.kelasIds.length} dipilih)</label>
              <button type="button"
                onClick={() => setForm(f => ({ ...f, kelasIds: f.kelasIds.length === kelasList.length ? [] : kelasList.map(k => k.id) }))}
                className="text-xs text-blue-600 hover:underline">
                {form.kelasIds.length === kelasList.length ? 'Kosongkan' : 'Pilih semua'}
              </button>
            </div>
            {[7, 8, 9].map(t => (
              <div key={t} className="mb-1.5">
                <p className="text-[11px] text-gray-400 mb-1">Kelas {t}</p>
                <div className="flex flex-wrap gap-1.5">
                  {kelasList.filter(k => k.tingkat === t).map(k => {
                    const dipilih = form.kelasIds.includes(k.id)
                    return (
                      <button key={k.id} type="button"
                        onClick={() => setForm(f => ({ ...f, kelasIds: dipilih ? f.kelasIds.filter(id => id !== k.id) : [...f.kelasIds, k.id] }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${dipilih ? 'bg-[#1a3a6b] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {k.nama}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 mt-1">Satu perintah bikin ujian buat semua kelas yang dicentang — tiap kelas dapet token sendiri.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jadwal Mulai *</label>
              <input type="datetime-local" value={form.tanggalMulai} onChange={e => setForm(f => ({ ...f, tanggalMulai: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Jadwal Selesai *</label>
              <input type="datetime-local" value={form.tanggalSelesai} onChange={e => setForm(f => ({ ...f, tanggalSelesai: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-[11px] text-gray-400 mt-1">Batas akhir siswa boleh MULAI mengerjakan (bukan batas selesai ngerjain).</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Durasi Pengerjaan (menit) *</label>
              <input type="number" value={form.durasiMenit} onChange={e => setForm(f => ({ ...f, durasiMenit: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.acakSoal} onChange={e => setForm(f => ({ ...f, acakSoal: e.target.checked }))} />
            Acak urutan soal per siswa
          </label>

          {form.mapelId && (
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-2 block">
                Pilih Soal dari Bank Soal ({form.soalTerpilih.length} dipilih dari {soalTersedia.length} tersedia)
              </label>
              {soalTersedia.length === 0 ? (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  Belum ada soal aktif di Bank Soal untuk mapel ini dari guru mana pun. Minta guru mapel yang bersangkutan mengisi Bank Soal dulu.
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-gray-50">
                  {soalTersedia.map(s => (
                    <label key={s.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={form.soalTerpilih.includes(s.id)} onChange={() => toggleSoal(s.id)} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2">{s.pertanyaan}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{s.jenis} · {s.bobot_nilai} poin · dari Bank Soal {s.guru?.nama ?? 'guru'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleSimpan} disabled={saving}
              className="px-6 py-2 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {saving ? 'Menyimpan...' : form.kelasIds.length > 1 ? `Jadwalkan untuk ${form.kelasIds.length} Kelas` : 'Jadwalkan Ujian'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="px-6 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">Batal</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Memuat...</div>
        ) : ujianList.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">Belum ada ujian ASAS/ASAT yang dijadwalkan.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {ujianList.map(u => (
              <button key={u.id} onClick={() => bukaDetail(u)}
                className="w-full text-left p-4 hover:bg-gray-50/60 transition flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[u.status]}`}>{u.status}</span>
                    <span className="text-xs text-gray-400">{JENIS_LABEL[u.jenis_ujian]}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{u.judul}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{u.kelas?.nama_rombel} · {u.mapel?.nama_mapel} · 🗓️ {formatJadwal(u.tanggal_mulai)} s/d {formatJadwal(u.tanggal_selesai)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-mono font-bold">{u.token}</span>
                  <span onClick={(e) => { e.stopPropagation(); handleHapus(u.id) }}
                    className="text-gray-300 hover:text-red-500 text-xs px-2">Hapus</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
