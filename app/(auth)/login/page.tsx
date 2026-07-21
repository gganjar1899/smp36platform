'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Login gagal')
        return
      }

      router.push(data.redirectTo)
      router.refresh()

    } catch {
      setError('Koneksi bermasalah. Periksa internet kamu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0f3620]">
      {/* Lapisan latar hijau tua konsisten -- diambil dari warna lambang sekolah, dengan sedikit gradasi radial di belakang lambang supaya tidak flat */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'radial-gradient(1000px 600px at 50% 0%, #1d6b3f 0%, #164a2d 45%, #0f3620 75%, #0a2818 100%)',
        }}
      />
      {/* Tekstur halus supaya tidak terasa flat */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Aksen garis emas tipis, jadi satu-satunya "signature" di halaman ini */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-[#c9a227] to-transparent" />

      <div className="w-full max-w-[400px] relative">

        {/* Lambang & identitas sekolah */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-[84px] h-[84px] rounded-full bg-white shadow-[0_8px_24px_-4px_rgba(15,54,32,0.35)] mb-5 p-2 ring-1 ring-white/60">
            <Image
              src="/logo-smpn36.jpg"
              alt="Lambang SMP Negeri 36 Bandung"
              width={72}
              height={72}
              className="rounded-full object-cover w-full h-full"
              priority
            />
          </div>
          <h1 className="text-[26px] leading-tight font-bold text-white tracking-tight">SMP Negeri 36 Bandung</h1>
          <p className="text-sm text-[#cfe3d5] mt-1.5">Platform Ujian &amp; Pembelajaran Digital</p>
        </div>

        {/* Kartu login */}
        <div className="bg-white rounded-[20px] shadow-[0_20px_50px_-16px_rgba(15,54,32,0.45)] border border-black/[0.03] p-7 sm:p-8">
          <h2 className="text-[15px] font-semibold text-[#12331f] mb-6 tracking-wide">MASUK KE AKUN KAMU</h2>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[13px] font-medium text-[#4b5a52] mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="NISN / NIP / username admin"
                required
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-[#e3e7e3] bg-[#fafbfa] text-[15px] text-[#12331f] placeholder-[#9aa79f] focus:outline-none focus:ring-[3px] focus:ring-[#1d5c38]/12 focus:border-[#1d5c38] focus:bg-white transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[13px] font-medium text-[#4b5a52] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-[#e3e7e3] bg-[#fafbfa] text-[15px] text-[#12331f] placeholder-[#9aa79f] focus:outline-none focus:ring-[3px] focus:ring-[#1d5c38]/12 focus:border-[#1d5c38] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9aa79f] hover:text-[#4b5a52] transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? (
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Tombol login */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3.5 px-4 rounded-xl bg-[#164a2d] text-white text-[14px] font-semibold tracking-wide hover:bg-[#0f3620] disabled:opacity-40 disabled:cursor-not-allowed transition-all mt-1 flex items-center justify-center gap-2 shadow-[0_4px_14px_-2px_rgba(22,74,45,0.5)]"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>

          {/* Info tambahan */}
          <div className="mt-6 pt-5 border-t border-[#f0f1ef]">
            <p className="text-xs text-[#9aa79f] text-center">
              Lupa password? Hubungi guru atau admin sekolah.
            </p>
          </div>
        </div>

        {/* Role hint */}
        <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
          {[
            { role: 'Siswa', hint: 'Gunakan NISN' },
            { role: 'Guru',  hint: 'Gunakan NIP' },
            { role: 'Admin', hint: 'Dari sekolah' },
          ].map(item => (
            <div key={item.role} className="bg-white/95 backdrop-blur-sm rounded-xl px-2 py-2.5 border border-white/40 shadow-sm">
              <p className="text-xs font-semibold text-[#12331f]">{item.role}</p>
              <p className="text-[11px] text-[#7c8a80] mt-0.5">{item.hint}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#d7e5da] mt-7">
          © {new Date().getFullYear()} SMP Negeri 36 Bandung — Platform CBT
        </p>
      </div>
    </div>
  )
}
