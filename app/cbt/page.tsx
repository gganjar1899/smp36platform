'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Soal = {
  id: string
  judul: string
  mata_pelajaran: string
  kelas: string
  durasi_menit: number
  jumlah_soal: number
  acak_soal: boolean
  deskripsi: string
  waktu_mulai?: string
  waktu_selesai?: string
}

type Pertanyaan = {
  id: string
  nomor: number
  pertanyaan: string
  gambar_url?: string
  pilihan_a: string
  pilihan_b: string
  pilihan_c: string
  pilihan_d: string
  pilihan_e: string
  bobot: number
}

// Anti-cheat warning levels
type WarningLevel = 0 | 1 | 2 | 3

export default function CBTSiswaPage() {
  const [step, setStep] = useState<'memuat' | 'gagal' | 'token' | 'intro' | 'ujian' | 'selesai'>('memuat')
  const [nis, setNis] = useState('')
  const [namaSiswa, setNamaSiswa] = useState('')
  const [kelas, setKelas] = useState('')
  const [gagalPesan, setGagalPesan] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [selectedSoal, setSelectedSoal] = useState<Soal | null>(null)
  const [pertanyaanList, setPertanyaanList] = useState<Pertanyaan[]>([])
  const [jawaban, setJawaban] = useState<Record<string, string>>({})
  const [raguList, setRaguList] = useState<Set<string>>(new Set())
  const [currentNo, setCurrentNo] = useState(0)
  const [sisa, setSisa] = useState(0)
  const [hasilId, setHasilId] = useState('')
  const [waktuMulaiSesi, setWaktuMulaiSesi] = useState<string | null>(null)
  const [nilaiAkhir, setNilaiAkhir] = useState(0)
  const [jumlahBenar, setJumlahBenar] = useState(0)

  // Anti-cheat state
  const [warningLevel, setWarningLevel] = useState<WarningLevel>(0)
  const [warningMsg, setWarningMsg] = useState('')
  const [showWarning, setShowWarning] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [cheating, setCheating] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const submitRef = useRef<(() => void) | null>(null)

  // ====== ANTI-CHEAT FUNCTIONS ======
  const triggerWarning = useCallback((level: WarningLevel, msg: string) => {
    setWarningLevel(level)
    setWarningMsg(msg)
    setShowWarning(true)
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
    if (level < 3) {
      warningTimeoutRef.current = setTimeout(() => setShowWarning(false), 4000)
    }
    // Vibrasi di HP
    if (navigator.vibrate) {
      if (level === 1) navigator.vibrate([200])
      if (level === 2) navigator.vibrate([300, 100, 300])
      if (level === 3) navigator.vibrate([500, 200, 500, 200, 500])
    }
  }, [])

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement
    if (el.requestFullscreen) el.requestFullscreen()
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen()
    setIsFullscreen(true)
  }, [])

  // Catat pelanggaran langsung ke database (real-time), supaya guru bisa pantau saat itu juga
  const catatPelanggaran = useCallback(async (jenis: string) => {
    if (!hasilId) return
    try {
      const { data: current } = await supabase.from('hasil_cbt')
        .select('jumlah_pelanggaran, detail_pelanggaran').eq('id', hasilId).single()
      const detailBaru = [...(current?.detail_pelanggaran || []), { jenis, waktu: new Date().toISOString() }]
      await supabase.from('hasil_cbt').update({
        jumlah_pelanggaran: (current?.jumlah_pelanggaran || 0) + 1,
        detail_pelanggaran: detailBaru,
        last_activity: new Date().toISOString(),
      }).eq('id', hasilId)
    } catch (err) {
      console.error('[cbt] gagal mencatat pelanggaran:', err)
    }
  }, [hasilId])

  // Heartbeat -- update last_activity tiap 15 detik selagi ujian berlangsung, jadi guru tahu siapa yang masih aktif online
  useEffect(() => {
    if (step !== 'ujian' || !hasilId) return
    const hb = setInterval(() => {
      supabase.from('hasil_cbt').update({ last_activity: new Date().toISOString() }).eq('id', hasilId)
    }, 15000)
    return () => clearInterval(hb)
  }, [step, hasilId])

  // Setup anti-cheat saat ujian dimulai
  useEffect(() => {
    if (step !== 'ujian') return

    let tabSwitchCount = 0
    let copyAttempts = 0

    // Tab/window visibility change
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchCount++
        catatPelanggaran('keluar_tab')
        if (tabSwitchCount === 1) {
          triggerWarning(1, '⚠️ Peringatan 1: Jangan berpindah tab atau aplikasi lain!')
        } else if (tabSwitchCount === 2) {
          triggerWarning(2, '🚨 Peringatan 2: Terdeteksi berpindah tab! Sekali lagi ujian akan disubmit otomatis!')
        } else {
          triggerWarning(3, '🔴 Ujian disubmit otomatis karena terdeteksi kecurangan!')
          setCheating(true)
          setTimeout(() => submitRef.current?.(), 2000)
        }
      }
    }

    // Copy paste prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      copyAttempts++
      catatPelanggaran('copy_paste')
      triggerWarning(1, '⚠️ Copy-paste tidak diizinkan selama ujian!')
    }
    const handlePaste = (e: ClipboardEvent) => { e.preventDefault() }
    const handleCut = (e: ClipboardEvent) => { e.preventDefault() }

    // Right click prevention
    const handleRightClick = (e: MouseEvent) => {
      e.preventDefault()
      catatPelanggaran('klik_kanan')
      triggerWarning(1, '⚠️ Klik kanan tidak diizinkan selama ujian!')
    }

    // Keyboard shortcut prevention
    const handleKeydown = (e: KeyboardEvent) => {
      // Block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Alt+Tab, F11
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
        (e.ctrlKey && ['u','U','s','S','p','P'].includes(e.key)) ||
        (e.altKey && e.key === 'Tab') ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault()
        catatPelanggaran('shortcut_keyboard')
        triggerWarning(1, '⚠️ Shortcut keyboard tidak diizinkan selama ujian!')
      }
    }

    // Fullscreen change detection
    const handleFullscreenChange = () => {
      const isFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement)
      setIsFullscreen(isFS)
      if (!isFS && step === 'ujian') {
        catatPelanggaran('keluar_fullscreen')
        triggerWarning(2, '🚨 Fullscreen dinonaktifkan! Klik tombol di bawah untuk kembali ke fullscreen.')
      }
    }

    // Cegah seleksi teks (blokir bubble "Copy" dari long-press di HP)
    const handleSelectStart = (e: Event) => { e.preventDefault() }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('cut', handleCut)
    document.addEventListener('contextmenu', handleRightClick)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('contextmenu', handleRightClick)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [step, triggerWarning, catatPelanggaran])

  // Ambil identitas otomatis dari sesi yang sudah login -- siswa tidak perlu ketik NISN lagi
  useEffect(() => {
    async function initIdentitas() {
      try {
        const res = await fetch('/api/auth/me')
        const me = await res.json()

        if (!me.loggedIn || me.role !== 'siswa') {
          setGagalPesan('Kamu belum login. Silakan login lewat halaman utama dulu.')
          setStep('gagal')
          return
        }
        if (!me.siswa || !me.siswa.kelasNama) {
          setGagalPesan('Data kelasmu belum lengkap. Hubungi wali kelas atau admin.')
          setStep('gagal')
          return
        }

        setNis(me.nisn || '')
        setNamaSiswa(me.nama)
        setKelas(me.siswa.kelasNama)
        setStep('token')
      } catch (err) {
        console.error('[cbt] gagal ambil identitas:', err)
        setGagalPesan('Gagal memuat data. Coba muat ulang halaman.')
        setStep('gagal')
      }
    }
    initIdentitas()
  }, [])

  // Verifikasi token yang diberikan guru -- langsung menuju ujian yang sesuai, tanpa perlu memilih dari daftar
  const handleVerifikasiToken = async () => {
    setTokenError('')
    if (!tokenInput) { setTokenError('Token wajib diisi'); return }
    const { data: soal } = await supabase.from('soal_cbt').select('*')
      .eq('token', tokenInput.trim().toUpperCase())
      .eq('status', 'Aktif')
      .eq('kelas', kelas)
      .maybeSingle()

    if (!soal) {
      setTokenError('Token tidak valid, sudah tidak aktif, atau bukan untuk kelasmu. Tanyakan lagi ke guru.')
      return
    }

    const { data: existing } = await supabase.from('hasil_cbt')
      .select('*').eq('soal_id', soal.id).eq('nis', nis).maybeSingle()
    if (existing?.status === 'Selesai') {
      setTokenError('Kamu sudah menyelesaikan ujian ini sebelumnya.')
      return
    }

    setSelectedSoal(soal)
    let { data: pertanyaan } = await supabase.from('pertanyaan_cbt')
      .select('*').eq('soal_id', soal.id).order('nomor')
    if (soal.acak_soal && pertanyaan) {
      pertanyaan = [...pertanyaan].sort(() => Math.random() - 0.5).map((p, i) => ({ ...p, nomor: i + 1 }))
    }
    setPertanyaanList(pertanyaan || [])
    if (existing?.jawaban) setJawaban(existing.jawaban)
    setHasilId(existing?.id || '')
    setWaktuMulaiSesi(existing?.waktu_mulai || null)
    setStep('intro')
  }

  const handleMulaiUjian = async () => {
    if (!selectedSoal) return
    // Request fullscreen
    requestFullscreen()

    // Kalau ini melanjutkan sesi lama, hitung sisa waktu dari waktu mulai ASLI
    // -- supaya refresh/tutup HP tidak bisa dipakai untuk mendapat waktu tambahan
    const waktuMulaiAsli = waktuMulaiSesi ?? new Date().toISOString()
    const detikTerpakai = Math.floor((Date.now() - new Date(waktuMulaiAsli).getTime()) / 1000)
    const sisaWaktu = Math.max(0, selectedSoal.durasi_menit * 60 - detikTerpakai)

    setSisa(sisaWaktu)
    setCurrentNo(0)
    setRaguList(new Set())
    setWarningLevel(0)
    setCheating(false)

    if (sisaWaktu <= 0) {
      // Waktu sudah habis dari sesi sebelumnya -- langsung submit
      setStep('ujian')
      setTimeout(() => submitRef.current?.(), 500)
      return
    }

    const { data } = await supabase.from('hasil_cbt').upsert({
      soal_id: selectedSoal.id, nis, nama_siswa: namaSiswa, kelas,
      status: 'Berlangsung', waktu_mulai: waktuMulaiAsli,
      jawaban, // pakai jawaban yang sudah dimuat (kalau melanjutkan sesi), jangan direset ke kosong
      last_activity: new Date().toISOString(),
    }, { onConflict: 'soal_id,nis', ignoreDuplicates: false }).select().single()
    if (data) setHasilId(data.id)
    setStep('ujian')
  }

  // Submit ujian
  const handleSubmit = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!selectedSoal || !hasilId) return

    // Exit fullscreen
    if (document.exitFullscreen) document.exitFullscreen()

    let benar = 0; let totalBobot = 0
    const { data: kunciData } = await supabase.from('pertanyaan_cbt')
      .select('id, kunci_jawaban, bobot').eq('soal_id', selectedSoal.id)
    kunciData?.forEach(k => {
      totalBobot += k.bobot
      if (jawaban[k.id] === k.kunci_jawaban) benar += k.bobot
    })
    const salah = pertanyaanList.length - benar
    const nilai = totalBobot > 0 ? Math.round((benar / totalBobot) * 100) : 0

    setJumlahBenar(benar)
    setNilaiAkhir(nilai)

    await supabase.from('hasil_cbt').update({
      jawaban, nilai, benar, salah,
      status: 'Selesai', waktu_selesai: new Date().toISOString()
    }).eq('id', hasilId)

    setStep('selesai')
  }, [selectedSoal, hasilId, jawaban, pertanyaanList])

  // Store submit ref untuk anti-cheat
  useEffect(() => { submitRef.current = handleSubmit }, [handleSubmit])

  // Timer
  useEffect(() => {
    if (step !== 'ujian') return
    timerRef.current = setInterval(() => {
      setSisa(prev => {
        if (prev <= 1) { handleSubmit(); return 0 }
        // Auto-save jawaban setiap 30 detik
        if (prev % 30 === 0 && hasilId) {
          supabase.from('hasil_cbt').update({ jawaban }).eq('id', hasilId)
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step, handleSubmit, hasilId, jawaban])

  const formatWaktu = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const toggleRagu = (id: string) => {
    setRaguList(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const p = pertanyaanList[currentNo]
  const persen = pertanyaanList.length > 0 ? Math.round((Object.keys(jawaban).length / pertanyaanList.length) * 100) : 0
  const kual = nilaiAkhir >= 90 ? 'A' : nilaiAkhir >= 80 ? 'B' : nilaiAkhir >= 70 ? 'C' : 'D'
  const kualLabel = nilaiAkhir >= 90 ? 'Sangat Baik' : nilaiAkhir >= 80 ? 'Baik' : nilaiAkhir >= 70 ? 'Cukup' : 'Perlu Perbaikan'
  const kualColor = nilaiAkhir >= 90 ? 'text-green-600' : nilaiAkhir >= 80 ? 'text-blue-600' : nilaiAkhir >= 70 ? 'text-yellow-600' : 'text-red-600'

  // ====== LOGIN ======
  if (step === 'memuat') return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3a6b] to-[#2d5a9e] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-[#1a3a6b] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-white font-bold text-2xl">36</span>
        </div>
        <div className="w-8 h-8 border-2 border-[#1a3a6b] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Memuat identitasmu...</p>
      </div>
    </div>
  )

  if (step === 'gagal') return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3a6b] to-[#2d5a9e] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <p className="text-sm text-gray-600 mb-5">{gagalPesan}</p>
        <a href="/dashboard/siswa"
          className="block w-full py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl font-semibold transition shadow-md">
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  )

  // ====== TOKEN ======
  if (step === 'token') return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-2xl p-5 mb-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-sm">
              {namaSiswa.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{namaSiswa}</p>
              <p className="text-xs text-gray-500">{kelas} · NIS: {nis}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 text-center">
          <div className="text-3xl mb-2">🔑</div>
          <h2 className="text-lg font-bold text-gray-800">Masukkan Token Ujian</h2>
          <p className="text-xs text-gray-500 mt-1 mb-5">Minta token dari guru mata pelajaran sebelum mulai</p>
          <input
            type="text"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleVerifikasiToken()}
            placeholder="Contoh: A3F9K2"
            maxLength={6}
            className="w-full text-center tracking-[0.4em] font-mono font-bold text-xl px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
          />
          {tokenError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
              <p className="text-red-600 text-xs">{tokenError}</p>
            </div>
          )}
          <button onClick={handleVerifikasiToken}
            className="w-full mt-4 py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl font-semibold transition shadow-md">
            Buka Ujian →
          </button>
        </div>
      </div>
    </div>
  )

  // ====== INTRO ======
  if (step === 'intro') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full border border-gray-200">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">📝</div>
          <h2 className="text-xl font-bold text-gray-800">{selectedSoal?.judul}</h2>
          <p className="text-sm text-gray-500 mt-1">{selectedSoal?.mata_pelajaran} · {selectedSoal?.kelas}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { icon: '⏱️', label: 'Durasi', val: `${selectedSoal?.durasi_menit} menit` },
            { icon: '📝', label: 'Jumlah Soal', val: `${pertanyaanList.length} soal` },
            { icon: '🔀', label: 'Urutan', val: selectedSoal?.acak_soal ? 'Diacak' : 'Berurutan' },
            { icon: '✅', label: 'Tipe', val: 'Pilihan Ganda' },
          ].map(i => (
            <div key={i.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl mb-1">{i.icon}</p>
              <p className="text-xs text-gray-500">{i.label}</p>
              <p className="text-sm font-semibold text-gray-800">{i.val}</p>
            </div>
          ))}
        </div>

        {/* Tata tertib */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
          <p className="font-semibold text-red-700 text-sm mb-2">🚨 Tata Tertib Ujian:</p>
          <ul className="space-y-1 text-xs text-red-600">
            <li>• Ujian akan berjalan dalam mode <strong>layar penuh</strong></li>
            <li>• Dilarang berpindah tab atau aplikasi lain</li>
            <li>• Dilarang copy-paste dan klik kanan</li>
            <li>• Pelanggaran akan dicatat dan ujian dapat disubmit otomatis</li>
            <li>• Pastikan koneksi internet stabil sebelum mulai</li>
          </ul>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 mb-5">
          <p className="text-xs text-blue-700 text-center">
            💡 Dengan mengklik "Mulai Ujian", kamu menyetujui tata tertib di atas
          </p>
        </div>

        <button onClick={handleMulaiUjian}
          className="w-full py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl font-semibold transition shadow-md">
          Mulai Ujian (Layar Penuh) →
        </button>
      </div>
    </div>
  )

  // ====== UJIAN ======
  if (step === 'ujian' && p) return (
    <div className="min-h-screen bg-gray-50 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}>

      {/* Modal konfirmasi submit -- pengganti confirm() bawaan browser yang tombolnya ambigu (OK/Cancel) */}
      {showSubmitConfirm && (() => {
        const belumDijawab = pertanyaanList.length - Object.keys(jawaban).length
        const jumlahRagu = raguList.size
        return (
          <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">📝</div>
                <h3 className="font-bold text-gray-800">Yakin Submit Ujian Sekarang?</h3>
              </div>

              {(belumDijawab > 0 || jumlahRagu > 0) && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 space-y-1">
                  {belumDijawab > 0 && (
                    <p className="text-xs text-orange-700">⚠️ Masih ada <b>{belumDijawab} soal</b> belum dijawab</p>
                  )}
                  {jumlahRagu > 0 && (
                    <p className="text-xs text-orange-700">🚩 Masih ada <b>{jumlahRagu} soal</b> ditandai ragu-ragu</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <button onClick={() => { setShowSubmitConfirm(false); handleSubmit() }}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition shadow-md">
                  Ya, Submit Sekarang
                </button>
                <button onClick={() => setShowSubmitConfirm(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition">
                  Kembali, Cek Jawaban Lagi
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Warning Overlay */}
      {showWarning && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none
          ${warningLevel === 3 ? 'bg-red-900/80' : 'bg-black/40'}`}>
          <div className={`rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl pointer-events-auto
            ${warningLevel === 1 ? 'bg-yellow-50 border-2 border-yellow-400' :
              warningLevel === 2 ? 'bg-orange-50 border-2 border-orange-500' :
              'bg-red-50 border-2 border-red-600'}`}>
            <p className="text-2xl mb-2">{warningLevel === 1 ? '⚠️' : warningLevel === 2 ? '🚨' : '🔴'}</p>
            <p className={`font-bold text-sm mb-2 ${warningLevel === 1 ? 'text-yellow-800' : warningLevel === 2 ? 'text-orange-800' : 'text-red-800'}`}>
              {warningMsg}
            </p>
            {warningLevel === 2 && (
              <button onClick={requestFullscreen}
                className="mt-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-semibold">
                Kembali ke Layar Penuh
              </button>
            )}
            {warningLevel < 3 && (
              <button onClick={() => setShowWarning(false)}
                className="mt-2 ml-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold">
                Mengerti
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen wajib -- overlay penuh yang mengunci ujian sampai siswa klik kembali ke fullscreen */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-[60] bg-[#1a3a6b]/97 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-gray-800 mb-1">Mode Layar Penuh Wajib Aktif</h3>
            <p className="text-xs text-gray-500 mb-4">Ujian dijeda sementara. Klik tombol di bawah untuk melanjutkan mengerjakan.</p>
            <button onClick={requestFullscreen}
              className="w-full py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl font-semibold text-sm transition shadow-md">
              Lanjutkan Ujian (Layar Penuh)
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate">{namaSiswa} · {kelas}</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{selectedSoal?.judul}</p>
        </div>

        {/* Warning indicators */}
        <div className="flex items-center gap-2 mx-3">
          {warningLevel > 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
              ${warningLevel === 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              ⚠️ {warningLevel}x
            </div>
          )}
        </div>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-sm flex-shrink-0
          ${sisa < 60 ? 'bg-red-100 text-red-600 animate-pulse' : sisa < 300 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
          ⏱️ {formatWaktu(sisa)}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${persen}%` }} />
          </div>
          <span className="text-xs text-gray-500 flex-shrink-0">{Object.keys(jawaban).length}/{pertanyaanList.length} dijawab</span>
        </div>

        {/* Soal */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 shadow-sm">
          <div className="flex items-start gap-3 mb-5">
            <span className="w-9 h-9 bg-[#1a3a6b] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md">
              {currentNo + 1}
            </span>
            <div className="flex-1">
              <p className="text-gray-800 font-medium leading-relaxed">{p.pertanyaan}</p>
              {/* Gambar soal */}
              {p.gambar_url && (
                <div className="mt-3">
                  <img
                    src={p.gambar_url}
                    alt="Gambar soal"
                    className="max-h-64 max-w-full rounded-xl border border-gray-200 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {['a', 'b', 'c', 'd', 'e'].map(opt => {
              const val = (p as any)[`pilihan_${opt}`]
              if (!val) return null
              const isSelected = jawaban[p.id] === opt.toUpperCase()
              return (
                <button key={opt} onClick={() => setJawaban(prev => ({ ...prev, [p.id]: opt.toUpperCase() }))}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition active:scale-[0.98]
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition
                    ${isSelected ? 'bg-blue-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>
                    {opt.toUpperCase()}
                  </span>
                  <span className={`text-sm leading-relaxed ${isSelected ? 'text-blue-800 font-medium' : 'text-gray-700'}`}>{val}</span>
                </button>
              )
            })}
          </div>

          <button onClick={() => toggleRagu(p.id)}
            className={`mt-4 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition
              ${raguList.has(p.id) ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            🚩 {raguList.has(p.id) ? '✓ Ditandai ragu-ragu (klik untuk hapus)' : 'Tandai ragu-ragu'}
          </button>
        </div>

        {/* Navigasi */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentNo(n => Math.max(0, n - 1))} disabled={currentNo === 0}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">
            ← Sebelumnya
          </button>
          <span className="text-sm text-gray-500 font-medium">{currentNo + 1} / {pertanyaanList.length}</span>
          {currentNo < pertanyaanList.length - 1 ? (
            <button onClick={() => setCurrentNo(n => Math.min(pertanyaanList.length - 1, n + 1))}
              className="px-4 py-2.5 bg-[#1a3a6b] text-white rounded-xl text-sm font-medium hover:bg-[#15305a] transition shadow-md">
              Selanjutnya →
            </button>
          ) : (
            <button onClick={() => setShowSubmitConfirm(true)}
              className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition shadow-md">
              ✅ Submit Ujian
            </button>
          )}
        </div>

        {/* Grid nomor soal */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 mb-3">Navigasi Soal</p>
          <div className="flex flex-wrap gap-2">
            {pertanyaanList.map((q, i) => (
              <button key={q.id} onClick={() => setCurrentNo(i)}
                className={`w-9 h-9 rounded-lg text-xs font-semibold transition active:scale-95
                  ${i === currentNo ? 'bg-[#1a3a6b] text-white shadow-md' :
                    raguList.has(q.id) ? 'bg-yellow-200 text-yellow-800 border border-yellow-400' :
                    jawaban[q.id] ? 'bg-green-100 text-green-700 border border-green-300' :
                    'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100">
            {[
              { color: 'bg-green-100 border border-green-300', label: 'Dijawab' },
              { color: 'bg-yellow-200 border border-yellow-400', label: 'Ragu-ragu' },
              { color: 'bg-gray-100', label: 'Belum dijawab' },
              { color: 'bg-[#1a3a6b]', label: 'Soal ini' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className={`w-4 h-4 rounded ${l.color}`} />
                <span className="text-xs text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ====== SELESAI ======
  if (step === 'selesai') return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3a6b] to-[#2d5a9e] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-1">Ujian Selesai!</h2>
        <p className="text-sm text-gray-500 mb-1">{selectedSoal?.judul}</p>
        <p className="text-xs text-gray-400 mb-6">{namaSiswa} · {kelas}</p>

        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-green-700">Jawabanmu sudah berhasil tersimpan</p>
        </div>

        <p className="text-xs text-gray-400 mb-6">
          Nilai akan diumumkan oleh guru mata pelajaran. Terima kasih sudah mengerjakan dengan jujur! 🙏
        </p>

        <a href="/dashboard/siswa"
          className="block w-full py-3 bg-[#1a3a6b] hover:bg-[#15305a] text-white rounded-xl font-semibold transition shadow-md">
          Kembali ke Dashboard
        </a>
      </div>
    </div>
  )

  return null
}
