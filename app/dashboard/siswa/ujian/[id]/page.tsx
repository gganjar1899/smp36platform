'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Ujian = {
  id: string; judul: string; durasi_menit: number; acak_soal: boolean
  maks_peringatan: number | null
  mapel?: { nama_mapel: string }; kelas?: { nama_rombel: string }
}
type Soal = {
  id: string; jenis: 'pilihan_ganda' | 'esai' | 'upload_file'
  pertanyaan: string
  pilihan_a: string | null; pilihan_b: string | null; pilihan_c: string | null; pilihan_d: string | null; pilihan_e: string | null
  jawaban_benar: string | null; bobot_nilai: number
}
type Sesi = { id: string; status: string; waktu_mulai: string; jumlah_strike: number }

// Acak deterministik berdasarkan seed (siswa) supaya urutan soal konsisten kalau halaman di-refresh
function shuffleDenganSeed<T>(arr: T[], seed: string): T[] {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  const rand = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967295 }
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const formatWaktu = (detik: number) => {
  const j = Math.floor(detik / 3600)
  const m = Math.floor((detik % 3600) / 60)
  const d = detik % 60
  return j > 0
    ? `${String(j).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(d).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(d).padStart(2, '0')}`
}

export default function KerjakanUjianPage() {
  const params = useParams()
  const router = useRouter()
  const ujianId = params.id as string

  const [siswaId, setSiswaId] = useState('')
  const [ujian, setUjian] = useState<Ujian | null>(null)
  const [sesi, setSesi] = useState<Sesi | null>(null)
  const [soalList, setSoalList] = useState<Soal[]>([])
  const [jawabanMap, setJawabanMap] = useState<Record<string, { pg?: string; esai?: string }>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sisaDetik, setSisaDetik] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selesai, setSelesai] = useState<{ nilaiAkhir: number | null } | null>(null)
  const [peringatan, setPeringatan] = useState<{ ke: number; maks: number } | null>(null)

  const strikeRef = useRef(0)
  const statusRef = useRef('sedang_ujian')

  // Muat sesi, soal, dan jawaban tersimpan
  useEffect(() => {
    async function init() {
      const res = await fetch('/api/auth/me')
      const meData = await res.json()
      if (!meData.loggedIn || meData.role !== 'siswa') { setError('Sesi login tidak ditemukan.'); setLoading(false); return }
      setSiswaId(meData.userId)

      const { data: u } = await supabase.from('ujian')
        .select('id, judul, durasi_menit, acak_soal, maks_peringatan, mapel:mapel_id(nama_mapel), kelas:kelas_id(nama_rombel)')
        .eq('id', ujianId).single()
      if (!u) { setError('Ujian tidak ditemukan.'); setLoading(false); return }
      setUjian(u as any)

      const { data: s } = await supabase.from('sesi_siswa')
        .select('id, status, waktu_mulai, jumlah_strike')
        .eq('ujian_id', ujianId).eq('siswa_id', meData.userId).maybeSingle()

      if (!s) { setError('Kamu belum memulai ujian ini. Masukkan token terlebih dahulu dari halaman daftar ujian.'); setLoading(false); return }
      if (s.status === 'selesai') { setSelesai({ nilaiAkhir: null }); setLoading(false); return }
      if (s.status === 'diskualifikasi') { setError('Kamu didiskualifikasi dari ujian ini karena pelanggaran berulang.'); setLoading(false); return }

      setSesi(s)
      strikeRef.current = s.jumlah_strike || 0

      const { data: soalUjian } = await supabase.from('ujian_soal')
        .select('urutan, soal:soal_id(id, jenis, pertanyaan, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, jawaban_benar, bobot_nilai)')
        .eq('ujian_id', ujianId).order('urutan')

      let soal = ((soalUjian || []).map((r: any) => r.soal).filter(Boolean)) as Soal[]
      if (u.acak_soal) soal = shuffleDenganSeed(soal, meData.userId)
      setSoalList(soal)

      const { data: jawabanTersimpan } = await supabase.from('jawaban_siswa')
        .select('soal_id, jawaban_pg, jawaban_esai').eq('sesi_id', s.id)
      const jm: Record<string, { pg?: string; esai?: string }> = {}
      ;(jawabanTersimpan || []).forEach((j: any) => { jm[j.soal_id] = { pg: j.jawaban_pg, esai: j.jawaban_esai } })
      setJawabanMap(jm)

      const deadline = new Date(s.waktu_mulai).getTime() + u.durasi_menit * 60000
      setSisaDetik(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))
      setLoading(false)
    }
    init()
  }, [ujianId])

  const handleSubmit = useCallback(async (paksa: 'timeout' | 'strike' | null = null) => {
    if (!sesi || submitting) return
    setSubmitting(true)

    const { data: semuaJawaban } = await supabase.from('jawaban_siswa')
      .select('poin_didapat, benar').eq('sesi_id', sesi.id)

    const totalBobot = soalList.filter(s => s.jenis === 'pilihan_ganda').reduce((a, s) => a + s.bobot_nilai, 0)
    const totalDapat = (semuaJawaban || []).filter(j => j.benar !== null).reduce((a, j) => a + (j.poin_didapat || 0), 0)
    const adaEsai = soalList.some(s => s.jenis !== 'pilihan_ganda')
    const nilaiOtomatis = totalBobot > 0 ? Math.round((totalDapat / totalBobot) * 100) : 0

    const statusAkhir = paksa === 'strike' ? 'diskualifikasi' : 'selesai'

    await supabase.from('sesi_siswa').update({
      waktu_selesai: new Date().toISOString(),
      status: statusAkhir,
      sisa_detik: 0,
      nilai_otomatis: nilaiOtomatis,
      nilai_akhir: adaEsai ? null : nilaiOtomatis,
    }).eq('id', sesi.id)

    statusRef.current = statusAkhir
    setSelesai({ nilaiAkhir: adaEsai ? null : nilaiOtomatis })
    setSubmitting(false)
  }, [sesi, soalList, submitting])

  // Timer countdown
  useEffect(() => {
    if (loading || selesai || error || sisaDetik <= 0) return
    const interval = setInterval(() => {
      setSisaDetik(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          handleSubmit('timeout')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [loading, selesai, error, sisaDetik <= 0, handleSubmit])

  // Anti-cheat: deteksi pindah tab / minimize
  useEffect(() => {
    if (loading || selesai || error || !sesi || !ujian) return

    const handleVisibility = async () => {
      if (document.hidden && statusRef.current === 'sedang_ujian') {
        strikeRef.current += 1
        const maks = ujian.maks_peringatan ?? 3
        await supabase.from('sesi_siswa').update({ jumlah_strike: strikeRef.current }).eq('id', sesi.id)
        await supabase.from('log_pelanggaran').insert({
          sesi_id: sesi.id, jenis_pelanggaran: 'keluar_tab',
          status: strikeRef.current >= maks ? 'diskualifikasi' : 'peringatan',
          strike_ke: strikeRef.current, sisa_waktu: formatWaktu(sisaDetik),
          platform: navigator.platform, user_agent: navigator.userAgent,
        })
        if (strikeRef.current >= maks) {
          handleSubmit('strike')
        } else {
          setPeringatan({ ke: strikeRef.current, maks })
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [loading, selesai, error, sesi, ujian, sisaDetik, handleSubmit])

  const simpanJawabanPG = async (soalId: string, pilihan: string) => {
    if (!sesi) return
    const soal = soalList.find(s => s.id === soalId)
    if (!soal) return
    const benar = soal.jawaban_benar === pilihan
    setJawabanMap(prev => ({ ...prev, [soalId]: { ...prev[soalId], pg: pilihan } }))
    await supabase.from('jawaban_siswa').upsert({
      sesi_id: sesi.id, soal_id: soalId, jawaban_pg: pilihan,
      benar, poin_didapat: benar ? soal.bobot_nilai : 0,
    }, { onConflict: 'sesi_id,soal_id' })
  }

  const simpanJawabanEsai = async (soalId: string, teks: string) => {
    setJawabanMap(prev => ({ ...prev, [soalId]: { ...prev[soalId], esai: teks } }))
  }
  const blurJawabanEsai = async (soalId: string) => {
    if (!sesi) return
    const teks = jawabanMap[soalId]?.esai || ''
    await supabase.from('jawaban_siswa').upsert({
      sesi_id: sesi.id, soal_id: soalId, jawaban_esai: teks,
    }, { onConflict: 'sesi_id,soal_id' })
  }

  const jumlahTerjawab = soalList.filter(s => jawabanMap[s.id]?.pg || jawabanMap[s.id]?.esai).length

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Memuat ujian...</div>
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-sm font-semibold text-red-700 mb-2">Tidak bisa membuka ujian</p>
          <p className="text-xs text-red-500 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard/siswa/ujian')} className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50">
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    )
  }
  if (selesai) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-md text-center shadow-sm">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="font-semibold text-gray-800 mb-1">Ujian sudah dikumpulkan</p>
          {selesai.nilaiAkhir !== null ? (
            <p className="text-sm text-gray-500 mb-4">Nilai kamu: <span className="font-bold text-gray-800">{selesai.nilaiAkhir}</span></p>
          ) : (
            <p className="text-sm text-gray-500 mb-4">Ada soal esai/upload yang perlu dikoreksi guru terlebih dahulu.</p>
          )}
          <button onClick={() => router.push('/dashboard/siswa/ujian')} className="px-4 py-2 bg-[#1a3a6b] text-white rounded-lg text-sm hover:bg-[#15305a]">
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    )
  }
  if (!ujian || soalList.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-gray-400 text-sm text-center">
        Ujian ini belum memiliki soal. Hubungi guru mata pelajaran.
      </div>
    )
  }

  const soal = soalList[currentIndex]

  return (
    <div className="min-h-screen bg-[#f4f5fb]">
      {/* Peringatan pelanggaran */}
      {peringatan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPeringatan(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <p className="text-2xl mb-2">⚠️</p>
            <p className="font-semibold text-red-600 mb-1">Peringatan {peringatan.ke} dari {peringatan.maks}</p>
            <p className="text-sm text-gray-500 mb-4">Kamu terdeteksi keluar dari halaman ujian. Jangan buka tab/aplikasi lain selama ujian berlangsung, atau kamu akan didiskualifikasi.</p>
            <button onClick={() => setPeringatan(null)} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600">Mengerti</button>
          </div>
        </div>
      )}

      {/* Header sticky: judul, timer */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{ujian.judul}</p>
          <p className="text-xs text-gray-400">{ujian.mapel?.nama_mapel} · {ujian.kelas?.nama_rombel}</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono font-bold text-sm flex-shrink-0
          ${sisaDetik <= 60 ? 'bg-red-50 text-red-600' : sisaDetik <= 300 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-700'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {formatWaktu(sisaDetik)}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 pb-24">
        {/* Navigator soal */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {soalList.map((s, i) => {
              const terjawab = !!(jawabanMap[s.id]?.pg || jawabanMap[s.id]?.esai)
              return (
                <button key={s.id} onClick={() => setCurrentIndex(i)}
                  className={`w-8 h-8 rounded-md text-xs font-semibold transition
                    ${i === currentIndex ? 'bg-[#1a3a6b] text-white' : terjawab ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">{jumlahTerjawab} dari {soalList.length} soal terjawab</p>
        </div>

        {/* Soal */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <p className="text-xs text-gray-400 mb-2">Soal {currentIndex + 1} dari {soalList.length} · Bobot {soal.bobot_nilai}</p>
          <p className="text-gray-800 mb-4 whitespace-pre-line">{soal.pertanyaan}</p>

          {soal.jenis === 'pilihan_ganda' && (
            <div className="space-y-2">
              {(['a', 'b', 'c', 'd', 'e'] as const).map(huruf => {
                const val = (soal as any)[`pilihan_${huruf}`]
                if (!val) return null
                const dipilih = jawabanMap[soal.id]?.pg === huruf.toUpperCase()
                return (
                  <button key={huruf} onClick={() => simpanJawabanPG(soal.id, huruf.toUpperCase())}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition
                      ${dipilih ? 'bg-blue-50 border-blue-300' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${dipilih ? 'bg-[#1a3a6b] text-white' : 'bg-gray-100 text-gray-500'}`}>{huruf.toUpperCase()}</span>
                    <span className="text-sm text-gray-700">{val}</span>
                  </button>
                )
              })}
            </div>
          )}
          {soal.jenis === 'esai' && (
            <textarea value={jawabanMap[soal.id]?.esai || ''}
              onChange={e => simpanJawabanEsai(soal.id, e.target.value)}
              onBlur={() => blurJawabanEsai(soal.id)}
              rows={6} placeholder="Tulis jawabanmu di sini..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          )}
          {soal.jenis === 'upload_file' && (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Jenis soal upload file belum didukung — sampaikan jawabanmu langsung ke guru.
            </p>
          )}
        </div>

        {/* Navigasi bawah */}
        <div className="flex items-center justify-between gap-3">
          <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => i - 1)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            ← Sebelumnya
          </button>
          {currentIndex < soalList.length - 1 ? (
            <button onClick={() => setCurrentIndex(i => i + 1)}
              className="px-4 py-2 bg-[#1a3a6b] text-white rounded-lg text-sm hover:bg-[#15305a]">
              Selanjutnya →
            </button>
          ) : (
            <button onClick={() => { if (confirm('Yakin sudah selesai? Jawaban tidak bisa diubah lagi setelah dikumpulkan.')) handleSubmit() }}
              disabled={submitting}
              className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Mengumpulkan...' : 'Selesai & Kumpulkan'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
