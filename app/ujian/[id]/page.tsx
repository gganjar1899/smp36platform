'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type UjianDetail = {
  id: string
  judul: string
  jenis_ujian: string
  durasi_menit: number
  status: 'draft' | 'aktif' | 'selesai' | 'dibatalkan'
  kelas_id: string
  acak_soal: boolean
  token: string
  maks_peringatan: number
  mapel?: { nama_mapel: string }
}

type Soal = {
  id: string
  jenis: 'pilihan_ganda' | 'esai' | 'upload_file'
  pertanyaan: string
  gambar_soal_url: string | null
  pilihan_a: string | null
  pilihan_b: string | null
  pilihan_c: string | null
  pilihan_d: string | null
  pilihan_e: string | null
  bobot_nilai: number
}

type Sesi = {
  id: string
  status: 'belum_mulai' | 'sedang_ujian' | 'selesai' | 'diskualifikasi'
  waktu_mulai: string | null
  jumlah_strike: number
  nilai_akhir: number | null
}

type JawabanItem = { rowId: string | null; pg: string; esai: string; fileUrl: string }
type JawabanState = Record<string, JawabanItem>

type Step = 'loading' | 'error' | 'intro' | 'ujian' | 'selesai' | 'diskualifikasi'

const JENIS_LABEL: Record<string, string> = {
  ulangan_harian: 'Ulangan Harian',
  pts: 'PTS',
  pas: 'PAS',
  asat: 'ASAT',
  tugas: 'Tugas',
}

// Acak urutan soal dengan seed dari id sesi, biar urutannya tetap sama walau halaman di-refresh
function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  let s = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 1)
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function formatWaktu(detik: number) {
  const m = Math.floor(detik / 60).toString().padStart(2, '0')
  const s = Math.floor(detik % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const emptyJawaban = (): JawabanItem => ({ rowId: null, pg: '', esai: '', fileUrl: '' })

export default function KerjakanUjianPage() {
  const params = useParams()
  const router = useRouter()
  const ujianId = params.id as string

  const [step, setStep] = useState<Step>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [siswaId, setSiswaId] = useState('')
  const [namaSiswa, setNamaSiswa] = useState('')
  const [ujian, setUjian] = useState<UjianDetail | null>(null)
  const [sesi, setSesi] = useState<Sesi | null>(null)
  const [jumlahSoalIntro, setJumlahSoalIntro] = useState(0)
  const [soalList, setSoalList] = useState<Soal[]>([])
  const [jawaban, setJawaban] = useState<JawabanState>({})
  const [currentNo, setCurrentNo] = useState(0)
  const [sisaDetik, setSisaDetik] = useState(0)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [strikeToast, setStrikeToast] = useState('')

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const debounceRef = useRef<Record<string, NodeJS.Timeout>>({})
  const submitRef = useRef<(diskualifikasi?: boolean) => void>(() => {})
  const jawabanRef = useRef<JawabanState>({})
  const tickCountRef = useRef(0)

  useEffect(() => {
    jawabanRef.current = jawaban
  }, [jawaban])

  // ====== MUAT SOAL + JAWABAN TERSIMPAN ======
  const muatSoalDanJawaban = useCallback(
    async (sesiId: string, u: UjianDetail) => {
      const { data: relasi } = await supabase
        .from('ujian_soal')
        .select('soal_id, urutan')
        .eq('ujian_id', ujianId)
        .order('urutan')

      const soalIds = (relasi ?? []).map((r) => r.soal_id as string)
      if (soalIds.length === 0) {
        setSoalList([])
        return
      }

      const { data: soalRows } = await supabase
        .from('bank_soal')
        .select('id, jenis, pertanyaan, gambar_soal_url, pilihan_a, pilihan_b, pilihan_c, pilihan_d, pilihan_e, bobot_nilai')
        .in('id', soalIds)

      const byId = new Map((soalRows ?? []).map((s) => [s.id as string, s as unknown as Soal]))
      let ordered = soalIds.map((id) => byId.get(id)).filter(Boolean) as Soal[]
      if (u.acak_soal) ordered = shuffleSeeded(ordered, sesiId)
      setSoalList(ordered)

      const { data: jawabanRows } = await supabase
        .from('jawaban_siswa')
        .select('id, soal_id, jawaban_pg, jawaban_esai, jawaban_file_url')
        .eq('sesi_id', sesiId)

      const state: JawabanState = {}
      for (const j of jawabanRows ?? []) {
        state[j.soal_id as string] = {
          rowId: j.id as string,
          pg: (j.jawaban_pg as string) ?? '',
          esai: (j.jawaban_esai as string) ?? '',
          fileUrl: (j.jawaban_file_url as string) ?? '',
        }
      }
      setJawaban(state)
    },
    [ujianId]
  )

  // ====== INIT ======
  const init = useCallback(async () => {
    setStep('loading')
    setErrorMsg('')
    try {
      const meRes = await fetch('/api/auth/me')
      const me = await meRes.json()
      if (!me?.siswa?.id) {
        setErrorMsg('Sesi login tidak ditemukan. Silakan login ulang.')
        setStep('error')
        return
      }
      setSiswaId(me.siswa.id)
      setNamaSiswa(me.nama ?? 'Siswa')

      const { data: u, error: uErr } = await supabase
        .from('ujian')
        .select('id, judul, jenis_ujian, durasi_menit, status, kelas_id, acak_soal, token, maks_peringatan, mapel:mapel_id(nama_mapel)')
        .eq('id', ujianId)
        .single()

      if (uErr || !u) {
        setErrorMsg('Ujian tidak ditemukan.')
        setStep('error')
        return
      }
      const detail = u as unknown as UjianDetail
      if (detail.kelas_id !== me.siswa.kelasId) {
        setErrorMsg('Ujian ini bukan untuk kelasmu.')
        setStep('error')
        return
      }
      if (detail.status !== 'aktif') {
        setErrorMsg('Ujian ini sudah tidak aktif.')
        setStep('error')
        return
      }
      setUjian(detail)

      const { count } = await supabase
        .from('ujian_soal')
        .select('soal_id', { count: 'exact', head: true })
        .eq('ujian_id', ujianId)
      setJumlahSoalIntro(count ?? 0)

      const { data: sesiExisting } = await supabase
        .from('sesi_siswa')
        .select('id, status, waktu_mulai, jumlah_strike, nilai_akhir')
        .eq('ujian_id', ujianId)
        .eq('siswa_id', me.siswa.id)
        .maybeSingle()

      if (!sesiExisting) {
        setStep('intro')
        return
      }
      setSesi(sesiExisting as Sesi)

      if (sesiExisting.status === 'selesai') {
        setStep('selesai')
        return
      }
      if (sesiExisting.status === 'diskualifikasi') {
        setStep('diskualifikasi')
        return
      }

      // status sedang_ujian -> lanjutkan dari sisa waktu yang sebenarnya
      await muatSoalDanJawaban(sesiExisting.id, detail)
      const deadline = new Date(sesiExisting.waktu_mulai as string).getTime() + detail.durasi_menit * 60000
      setSisaDetik(Math.max(0, Math.floor((deadline - Date.now()) / 1000)))
      setStep('ujian')
    } catch {
      setErrorMsg('Gagal memuat ujian. Coba muat ulang halaman.')
      setStep('error')
    }
  }, [ujianId, muatSoalDanJawaban])

  useEffect(() => {
    init()
  }, [init])

  // ====== MULAI UJIAN ======
  const handleMulai = async () => {
    if (!ujian) return
    setTokenError('')
    if (tokenInput.trim().toUpperCase() !== ujian.token.toUpperCase()) {
      setTokenError('Token salah. Minta token yang benar ke gurumu.')
      return
    }

    // Minta fullscreen SEBELUM proses async lain — beberapa browser (terutama Safari iOS)
    // menolak permintaan fullscreen kalau tidak dipanggil langsung dari sentuhan/klik pengguna.
    try {
      const el = document.documentElement as any
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {})
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
    } catch {
      // tidak fatal, lanjutkan tanpa fullscreen kalau browser/perangkat tidak mendukung
    }

    setStarting(true)
    const { data: sesiBaru, error } = await supabase
      .from('sesi_siswa')
      .insert({
        ujian_id: ujianId,
        siswa_id: siswaId,
        status: 'sedang_ujian',
        waktu_mulai: new Date().toISOString(),
        sisa_detik: ujian.durasi_menit * 60,
        jumlah_strike: 0,
      })
      .select('id, status, waktu_mulai, jumlah_strike, nilai_akhir')
      .single()

    if (error || !sesiBaru) {
      setTokenError('Gagal memulai ujian. Coba lagi.')
      setStarting(false)
      return
    }

    setSesi(sesiBaru as Sesi)
    await muatSoalDanJawaban(sesiBaru.id, ujian)
    setSisaDetik(ujian.durasi_menit * 60)
    setStarting(false)
    setStep('ujian')
  }

  // ====== SUBMIT (dipakai untuk submit manual, waktu habis, dan diskualifikasi) ======
  const handleSubmit = useCallback(
    async (diskualifikasi = false) => {
      if (!sesi || submitting) return
      setSubmitting(true)
      if (timerRef.current) clearInterval(timerRef.current)

      try {
        // Kunci jawaban baru diambil di titik submit (bukan saat mengerjakan),
        // supaya tidak nongol di tab Network selama siswa masih mengerjakan.
        const soalIds = soalList.map((s) => s.id)
        const { data: kunciRows } = await supabase
          .from('bank_soal')
          .select('id, jawaban_benar')
          .in('id', soalIds)
        const kunciMap = new Map((kunciRows ?? []).map((k) => [k.id as string, k.jawaban_benar as string | null]))

        let poinPg = 0
        let bobotPg = 0
        let adaNonPg = false

        for (const s of soalList) {
          const j = jawabanRef.current[s.id]
          if (s.jenis === 'pilihan_ganda') {
            bobotPg += s.bobot_nilai
            const benar = !!j?.pg && j.pg === kunciMap.get(s.id)
            const poin = benar ? s.bobot_nilai : 0
            poinPg += poin
            if (j?.rowId) {
              await supabase.from('jawaban_siswa').update({ benar, poin_didapat: poin }).eq('id', j.rowId)
            }
          } else {
            adaNonPg = true
          }
        }

        const nilaiOtomatis = bobotPg > 0 ? Math.round((poinPg / bobotPg) * 10000) / 100 : null
        const nilaiAkhir = !adaNonPg ? nilaiOtomatis : null
        const statusAkhir = diskualifikasi ? 'diskualifikasi' : 'selesai'

        await supabase
          .from('sesi_siswa')
          .update({
            status: statusAkhir,
            waktu_selesai: new Date().toISOString(),
            nilai_otomatis: nilaiOtomatis,
            nilai_akhir: nilaiAkhir,
          })
          .eq('id', sesi.id)

        setSesi((prev) => (prev ? { ...prev, status: statusAkhir, nilai_akhir: nilaiAkhir } : prev))
        setStep(statusAkhir)
      } finally {
        setSubmitting(false)
      }
    },
    [sesi, soalList, submitting]
  )

  useEffect(() => {
    submitRef.current = (diskualifikasi?: boolean) => {
      handleSubmit(!!diskualifikasi)
    }
  }, [handleSubmit])

  // Keluar dari fullscreen otomatis begitu ujian selesai/diskualifikasi
  useEffect(() => {
    if (step === 'selesai' || step === 'diskualifikasi') {
      const el = document as any
      if (el.fullscreenElement && el.exitFullscreen) el.exitFullscreen().catch(() => {})
      else if (el.webkitFullscreenElement && el.webkitExitFullscreen) el.webkitExitFullscreen()
    }
  }, [step])

  // ====== TIMER ======
  useEffect(() => {
    if (step !== 'ujian' || !sesi) return
    timerRef.current = setInterval(() => {
      setSisaDetik((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          submitRef.current(false)
          return 0
        }
        tickCountRef.current += 1
        // Simpan sisa waktu ke DB tiap ~15 detik, buat cadangan/visibilitas guru
        if (tickCountRef.current % 15 === 0) {
          supabase.from('sesi_siswa').update({ sisa_detik: prev - 1 }).eq('id', sesi.id)
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [step, sesi])

  // ====== PERINGATAN SEBELUM MENINGGALKAN HALAMAN ======
  useEffect(() => {
    if (step !== 'ujian') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [step])

  // ====== ANTI-CHEAT: DETEKSI PINDAH TAB / APLIKASI LAIN ======
  useEffect(() => {
    if (step !== 'ujian' || !sesi || !ujian) return

    const handleVisibility = async () => {
      if (!document.hidden) return
      const strikeBaru = (sesi.jumlah_strike ?? 0) + 1
      setSesi((prev) => (prev ? { ...prev, jumlah_strike: strikeBaru } : prev))

      const maks = ujian.maks_peringatan ?? 3
      const akanDiskualifikasi = strikeBaru >= maks

      await supabase.from('sesi_siswa').update({ jumlah_strike: strikeBaru }).eq('id', sesi.id)
      await supabase.from('log_pelanggaran').insert({
        sesi_id: sesi.id,
        jenis_pelanggaran: 'pindah_tab',
        status: akanDiskualifikasi ? 'diskualifikasi' : 'peringatan',
        strike_ke: strikeBaru,
        sisa_waktu: formatWaktu(sisaDetik),
        platform: navigator.platform,
        user_agent: navigator.userAgent,
      })

      if (navigator.vibrate) {
        navigator.vibrate(akanDiskualifikasi ? [500, 200, 500, 200, 500] : [250])
      }

      if (akanDiskualifikasi) {
        setStrikeToast(`🔴 Ujian dihentikan otomatis: terdeteksi ${strikeBaru}x berpindah tab.`)
        submitRef.current(true)
      } else {
        setStrikeToast(`⚠️ Peringatan ${strikeBaru}/${maks}: jangan berpindah tab selama ujian!`)
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
        toastTimeoutRef.current = setTimeout(() => setStrikeToast(''), 5000)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handleVisibility)
    }
  }, [step, sesi, ujian, sisaDetik])

  // ====== ANTI-CHEAT: DETEKSI KELUAR DARI MODE LAYAR PENUH ======
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false)
  useEffect(() => {
    if (step !== 'ujian' || !sesi || !ujian) return

    const handleFullscreenChange = async () => {
      const masihFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement)
      if (masihFullscreen) { setShowFullscreenPrompt(false); return }

      setShowFullscreenPrompt(true)

      const strikeBaru = (sesi.jumlah_strike ?? 0) + 1
      setSesi((prev) => (prev ? { ...prev, jumlah_strike: strikeBaru } : prev))

      const maks = ujian.maks_peringatan ?? 3
      const akanDiskualifikasi = strikeBaru >= maks

      await supabase.from('sesi_siswa').update({ jumlah_strike: strikeBaru }).eq('id', sesi.id)
      await supabase.from('log_pelanggaran').insert({
        sesi_id: sesi.id,
        jenis_pelanggaran: 'keluar_fullscreen',
        status: akanDiskualifikasi ? 'diskualifikasi' : 'peringatan',
        strike_ke: strikeBaru,
        sisa_waktu: formatWaktu(sisaDetik),
        platform: navigator.platform,
        user_agent: navigator.userAgent,
      })

      if (akanDiskualifikasi) {
        setStrikeToast(`🔴 Ujian dihentikan otomatis: terdeteksi ${strikeBaru}x keluar dari layar penuh.`)
        submitRef.current(true)
      } else {
        setStrikeToast(`⚠️ Peringatan ${strikeBaru}/${maks}: tetap di mode layar penuh selama ujian!`)
        if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
        toastTimeoutRef.current = setTimeout(() => setStrikeToast(''), 5000)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [step, sesi, ujian, sisaDetik])

  const kembaliFullscreen = async () => {
    try {
      const el = document.documentElement as any
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
      setShowFullscreenPrompt(false)
    } catch {
      // biarkan prompt tetap tampil kalau browser menolak
    }
  }

  // ====== AUTOSAVE JAWABAN ======
  const simpanJawaban = useCallback(
    async (soalId: string, patch: Partial<{ pg: string; esai: string; fileUrl: string }>) => {
      if (!sesi) return
      const existing = jawabanRef.current[soalId] ?? emptyJawaban()
      const merged = { ...existing, ...patch }
      setJawaban((prev) => ({ ...prev, [soalId]: merged }))

      const payload = {
        jawaban_pg: merged.pg || null,
        jawaban_esai: merged.esai || null,
        jawaban_file_url: merged.fileUrl || null,
      }

      if (existing.rowId) {
        await supabase.from('jawaban_siswa').update(payload).eq('id', existing.rowId)
      } else {
        const { data } = await supabase
          .from('jawaban_siswa')
          .insert({ sesi_id: sesi.id, soal_id: soalId, ...payload })
          .select('id')
          .single()
        if (data) setJawaban((prev) => ({ ...prev, [soalId]: { ...prev[soalId], rowId: data.id } }))
      }
    },
    [sesi]
  )

  const handleEsaiChange = (soalId: string, value: string) => {
    setJawaban((prev) => ({ ...prev, [soalId]: { ...(prev[soalId] ?? emptyJawaban()), esai: value } }))
    if (debounceRef.current[soalId]) clearTimeout(debounceRef.current[soalId])
    debounceRef.current[soalId] = setTimeout(() => simpanJawaban(soalId, { esai: value }), 600)
  }

  const handleUploadFile = async (soalId: string, file: File) => {
    if (!sesi) return
    setUploadingId(soalId)
    try {
      const path = `jawaban-ujian/${sesi.id}/${soalId}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const { error: upErr } = await supabase.storage.from('dokumen-ajar').upload(path, file, { upsert: false })
      if (upErr) {
        alert('Gagal upload file: ' + upErr.message)
        return
      }
      const { data: urlData } = supabase.storage.from('dokumen-ajar').getPublicUrl(path)
      await simpanJawaban(soalId, { fileUrl: urlData.publicUrl })
    } finally {
      setUploadingId(null)
    }
  }

  const jumlahDijawab = useMemo(
    () => soalList.filter((s) => {
      const j = jawaban[s.id]
      return !!(j?.pg || j?.esai || j?.fileUrl)
    }).length,
    [soalList, jawaban]
  )
  const persen = soalList.length > 0 ? (jumlahDijawab / soalList.length) * 100 : 0

  // ====================== RENDER ======================

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#f4f5fb] flex items-center justify-center">
        <p className="text-sm text-gray-400">Memuat ujian...</p>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-[#f4f5fb] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">🚫</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Tidak Bisa Membuka Ujian</h2>
          <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
          <button
            onClick={() => router.push('/dashboard/siswa/ujian')}
            className="px-5 py-2.5 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl text-sm font-medium transition"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    )
  }

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a3a6b] to-[#2d5a9e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-[#1a3a6b] mb-2">
            {JENIS_LABEL[ujian?.jenis_ujian ?? ''] ?? ujian?.jenis_ujian}
          </span>
          <h2 className="text-lg font-bold text-gray-800 mb-1">{ujian?.judul}</h2>
          <p className="text-sm text-gray-500 mb-5">{ujian?.mapel?.nama_mapel}</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{jumlahSoalIntro}</p>
              <p className="text-[11px] text-gray-500">Soal</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{ujian?.durasi_menit}</p>
              <p className="text-[11px] text-gray-500">Menit</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{ujian?.maks_peringatan ?? 3}x</p>
              <p className="text-[11px] text-gray-500">Maks Peringatan</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700 leading-relaxed">
            Jangan berpindah tab atau aplikasi lain selama ujian berlangsung. Ujian akan otomatis disubmit
            jika terdeteksi berpindah tab sebanyak {ujian?.maks_peringatan ?? 3} kali.
          </div>

          <label className="text-xs font-semibold text-gray-500 mb-1 block">Masukkan Token dari Guru</label>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
            placeholder="Contoh: A1B2C3"
            maxLength={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center tracking-[0.3em] font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
          />
          {tokenError && <p className="text-xs text-red-500 mb-3">{tokenError}</p>}

          <button
            onClick={handleMulai}
            disabled={starting || !tokenInput}
            className="w-full py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 mb-2"
          >
            {starting ? 'Memulai...' : 'Mulai Ujian'}
          </button>
          <button
            onClick={() => router.push('/dashboard/siswa/ujian')}
            className="w-full py-2 text-gray-400 text-xs hover:text-gray-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    )
  }

  if (step === 'diskualifikasi') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a3a6b] to-[#2d5a9e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Ujian Dihentikan</h2>
          <p className="text-sm text-gray-500 mb-4">{ujian?.judul}</p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 mb-6">
            Ujian ini dihentikan otomatis karena terdeteksi pelanggaran tata tertib (berpindah tab)
            melebihi batas yang diizinkan. Hubungi gurumu jika ini terjadi karena kesalahan teknis.
          </div>
          <button
            onClick={() => router.push('/dashboard/siswa/ujian')}
            className="px-5 py-2.5 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl text-sm font-medium transition"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    )
  }

  if (step === 'selesai') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a3a6b] to-[#2d5a9e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Ujian Selesai!</h2>
          <p className="text-sm text-gray-500 mb-1">{ujian?.judul}</p>
          <p className="text-xs text-gray-400 mb-6">{namaSiswa}</p>

          {sesi?.nilai_akhir !== null && sesi?.nilai_akhir !== undefined ? (
            <div className="text-6xl font-black mb-2 text-[#1a3a6b]">{sesi.nilai_akhir}</div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-[#1a3a6b] mb-2">
              Jawabanmu sudah tersimpan. Sebagian soal perlu dinilai manual oleh guru.
            </div>
          )}

          <p className="text-xs text-gray-400 mb-6 mt-3">Terima kasih telah mengerjakan dengan jujur! 🙏</p>
          <button
            onClick={() => router.push('/dashboard/siswa/ujian')}
            className="px-5 py-2.5 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl text-sm font-medium transition"
          >
            Kembali ke Daftar Ujian
          </button>
        </div>
      </div>
    )
  }

  // ====== STEP: UJIAN (mengerjakan) ======
  const soal = soalList[currentNo]
  const jSoal = soal ? jawaban[soal.id] : undefined

  return (
    <div className="min-h-screen bg-[#f4f5fb]">
      {strikeToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg max-w-[90vw] text-center">
          {strikeToast}
        </div>
      )}

      {showFullscreenPrompt && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-amber-500 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
          <p className="text-xs sm:text-sm font-medium">Kamu keluar dari mode layar penuh. Tetap di layar penuh selama ujian.</p>
          <button onClick={kembaliFullscreen}
            className="px-3 py-1.5 bg-white text-amber-600 rounded-lg text-xs font-semibold flex-shrink-0 hover:bg-amber-50 transition">
            Layar Penuh Lagi
          </button>
        </div>
      )}

      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">{ujian?.mapel?.nama_mapel}</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{ujian?.judul}</p>
        </div>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm flex-shrink-0 ${
            sisaDetik < 60 ? 'bg-red-100 text-red-600 animate-pulse' : sisaDetik < 300 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
          }`}
        >
          ⏱️ {formatWaktu(sisaDetik)}
        </div>
      </div>

      {!soal ? (
        <div className="max-w-3xl mx-auto p-6 text-center text-gray-400 text-sm">
          Belum ada soal untuk ujian ini. Hubungi gurumu.
        </div>
      ) : (
        <div className="max-w-3xl mx-auto p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${persen}%` }} />
            </div>
            <span className="text-xs text-gray-500 flex-shrink-0">{jumlahDijawab}/{soalList.length} dijawab</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 mb-4 shadow-sm">
            <div className="flex items-start gap-3 mb-5">
              <span className="w-9 h-9 bg-[#1a3a6b] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
                {currentNo + 1}
              </span>
              <div className="flex-1">
                <p className="text-gray-800 font-medium leading-relaxed">{soal.pertanyaan}</p>
                {soal.gambar_soal_url && (
                  <div className="mt-3">
                    <img
                      src={soal.gambar_soal_url}
                      alt="Gambar soal"
                      className="max-h-64 max-w-full rounded-xl border border-gray-200 object-contain"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {soal.jenis === 'pilihan_ganda' && (
              <div className="space-y-2">
                {(['a', 'b', 'c', 'd', 'e'] as const).map((opt) => {
                  const val = soal[`pilihan_${opt}`]
                  if (!val) return null
                  const isSelected = jSoal?.pg === opt.toUpperCase()
                  return (
                    <button
                      key={opt}
                      onClick={() => simpanJawaban(soal.id, { pg: opt.toUpperCase() })}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition active:scale-[0.98] ${
                        isSelected ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition ${
                          isSelected ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {opt.toUpperCase()}
                      </span>
                      <span className={`text-sm leading-relaxed ${isSelected ? 'text-blue-800 font-medium' : 'text-gray-700'}`}>{val}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {soal.jenis === 'esai' && (
              <textarea
                value={jSoal?.esai ?? ''}
                onChange={(e) => handleEsaiChange(soal.id, e.target.value)}
                rows={6}
                placeholder="Tulis jawabanmu di sini..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            )}

            {soal.jenis === 'upload_file' && (
              <div>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUploadFile(soal.id, file)
                  }}
                  disabled={uploadingId === soal.id}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1a3a6b] file:text-white hover:file:bg-[#15305a]"
                />
                {uploadingId === soal.id && <p className="text-xs text-gray-400 mt-2">Mengunggah file...</p>}
                {jSoal?.fileUrl && (
                  <a
                    href={jSoal.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-blue-600 underline"
                  >
                    ✓ File terkirim — lihat file
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentNo((n) => Math.max(0, n - 1))}
              disabled={currentNo === 0}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
            >
              ← Sebelumnya
            </button>
            <span className="text-sm text-gray-500 font-medium">
              {currentNo + 1} / {soalList.length}
            </span>
            {currentNo < soalList.length - 1 ? (
              <button
                onClick={() => setCurrentNo((n) => Math.min(soalList.length - 1, n + 1))}
                className="px-4 py-2.5 bg-[#1a3a6b] text-white rounded-xl text-sm font-medium hover:bg-[#15305a] transition shadow-md"
              >
                Selanjutnya →
              </button>
            ) : (
              <button
                onClick={() => {
                  const belumDijawab = soalList.length - jumlahDijawab
                  if (belumDijawab > 0 && !confirm(`Masih ada ${belumDijawab} soal belum dijawab. Yakin ingin submit?`)) return
                  handleSubmit(false)
                }}
                disabled={submitting}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition shadow-md disabled:opacity-50"
              >
                {submitting ? 'Mengirim...' : '✅ Submit Ujian'}
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 mb-3">Navigasi Soal</p>
            <div className="flex flex-wrap gap-2">
              {soalList.map((s, i) => {
                const j = jawaban[s.id]
                const terjawab = !!(j?.pg || j?.esai || j?.fileUrl)
                return (
                  <button
                    key={s.id}
                    onClick={() => setCurrentNo(i)}
                    className={`w-9 h-9 rounded-lg text-xs font-semibold transition active:scale-95 ${
                      i === currentNo
                        ? 'bg-[#1a3a6b] text-white shadow-md'
                        : terjawab
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
              {[
                { color: 'bg-green-100 border border-green-300', label: 'Dijawab' },
                { color: 'bg-gray-100', label: 'Belum dijawab' },
                { color: 'bg-[#1a3a6b]', label: 'Soal ini' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded ${l.color}`} />
                  <span className="text-xs text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
