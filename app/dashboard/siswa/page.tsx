'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function SiswaDashboard() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [userName, setUserName] = useState('Siswa')
  const [kelasNama, setKelasNama] = useState('')
  const [kelasId, setKelasId] = useState<string | null>(null)
  const [jumlahMateri, setJumlahMateri] = useState<number | null>(null)
  const [jumlahPengumuman, setJumlahPengumuman] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()

        if (!data.loggedIn) { setLoading(false); return }

        setUserName(data.nama ?? 'Siswa')
        const kId = data.siswa?.kelasId ?? null
        setKelasId(kId)
        setKelasNama(data.siswa?.kelasNama ?? '')

        if (kId) {
          const { count: materiCount } = await supabase
            .from('materi_belajar')
            .select('*', { count: 'exact', head: true })
            .eq('kelas_id', kId)
            .eq('is_published', true)

          setJumlahMateri(materiCount ?? 0)

          const { count: pengumumanCount } = await supabase
            .from('pengumuman')
            .select('*', { count: 'exact', head: true })

          setJumlahPengumuman(pengumumanCount ?? 0)
        }
      } catch {
        // gagal ambil data tambahan, tetap tampilkan dashboard dasar
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const sapaanNama = userName.split(',')[0]

  const quickMenu = [
    { href: '/dashboard/siswa/materi',       label: 'Materi',       desc: 'Bahan belajar per mapel',     color: 'bg-blue-500',   icon: '📚' },
    { href: '/dashboard/siswa/dokumen-ajar', label: 'Dokumen Ajar', desc: 'Modul, video & latihan',      color: 'bg-purple-500', icon: '📁' },
    { href: '/dashboard/siswa/tugas',        label: 'Tugas',        desc: 'Kumpulkan tugas & lihat status', color: 'bg-amber-500', icon: '📝' },
    { href: '/dashboard/siswa/pengumuman',   label: 'Pengumuman',   desc: 'Info terbaru dari sekolah',   color: 'bg-teal-500',   icon: '📢' },
    { href: '/dashboard/siswa/hasil-ujian',  label: 'Hasil Ujian',  desc: 'Nilai & riwayat ujian CBT',   color: 'bg-red-500',    icon: '🎯' },
  ]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-gradient-to-r from-[#1a3a6b] to-[#2d5a9a] rounded-2xl p-6 text-white">
        <p className="text-blue-200 text-sm mb-1">{today}</p>
        <h1 className="text-2xl font-bold mb-1">Halo, {sapaanNama}!</h1>
        <p className="text-blue-100 text-sm">SMP Negeri 36 Bandung — Portal Siswa Digital</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">Sistem aktif</span>
          {kelasNama && (
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">Kelas {kelasNama}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Materi Tersedia', value: loading ? '...' : (jumlahMateri ?? '-'), sub: 'untuk kelasmu',   color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Pengumuman',      value: loading ? '...' : (jumlahPengumuman ?? '-'), sub: 'info terbaru', color: 'text-teal-600',   bg: 'bg-teal-50' },
          { label: 'Kelas',           value: kelasNama || '-',                             sub: 'kelas aktif',  color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Tahun Ajaran',    value: '2026/2027',                                   sub: 'Semester 1',   color: 'text-amber-600',  bg: 'bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-[11px] text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick menu */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Akses Cepat</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {quickMenu.map((item, i) => (
            <Link key={i} href={item.href}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all group">
              <div className={`w-9 h-9 ${item.color} rounded-xl flex items-center justify-center text-white text-base mb-3`}>
                {item.icon}
              </div>
              <p className="text-sm font-semibold text-gray-800 group-hover:text-[#1a3a6b] transition-colors">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
