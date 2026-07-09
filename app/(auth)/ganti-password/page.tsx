'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function GantiPasswordPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    passwordBaru:    '',
    konfirmasiPassword: '',
  })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (form.passwordBaru.length < 6) {
      setError('Password minimal 6 karakter')
      return
    }
    if (form.passwordBaru !== form.konfirmasiPassword) {
      setError('Konfirmasi password tidak cocok')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/ganti-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ passwordBaru: form.passwordBaru }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Gagal mengganti password')
        return
      }

      setSuccess(true)
      setTimeout(() => router.push(data.redirectTo ?? '/siswa'), 1500)

    } catch {
      setError('Koneksi bermasalah. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 border border-amber-200 mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[#1a3a5c]">Ganti Password</h1>
          <p className="text-sm text-gray-500 mt-1">
            Kamu harus mengganti password sebelum melanjutkan
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {success ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 mb-3">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">Password berhasil diganti!</p>
              <p className="text-xs text-gray-400 mt-1">Mengalihkan ke dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password Baru
                </label>
                <input
                  type="password"
                  name="passwordBaru"
                  value={form.passwordBaru}
                  onChange={handleChange}
                  placeholder="Minimal 6 karakter"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4f8a]/30 focus:border-[#1a4f8a] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Konfirmasi Password
                </label>
                <input
                  type="password"
                  name="konfirmasiPassword"
                  value={form.konfirmasiPassword}
                  onChange={handleChange}
                  placeholder="Ulangi password baru"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4f8a]/30 focus:border-[#1a4f8a] transition-all"
                />
              </div>

              {/* Indikator kekuatan password */}
              {form.passwordBaru && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          form.passwordBaru.length >= i * 3
                            ? i <= 1 ? 'bg-red-400'
                            : i <= 2 ? 'bg-amber-400'
                            : i <= 3 ? 'bg-blue-400'
                            : 'bg-green-400'
                            : 'bg-gray-100'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {form.passwordBaru.length < 4 ? 'Terlalu pendek' :
                     form.passwordBaru.length < 7 ? 'Cukup' :
                     form.passwordBaru.length < 10 ? 'Bagus' : 'Sangat kuat'}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !form.passwordBaru || !form.konfirmasiPassword}
                className="w-full py-2.5 px-4 rounded-lg bg-[#1a4f8a] text-white text-sm font-semibold hover:bg-[#153f6e] disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
              >
                {loading ? 'Menyimpan...' : 'Simpan Password Baru'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
