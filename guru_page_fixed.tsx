'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

export default function GuruDashboard() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [userName, setUserName]     = useState('Guru')
  const [kelasDiajar, setKelasDiajar] = useState<any[]>([])
  const [waliKelas, setWaliKelas]   = useState<any>(null)
  const [loading, setLoading]       = useState(true)

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  useEffect(() => {
    // Fix: decode nama dari cookie
    const namaCookie = document.cookie.split('; ')
      .find(r => r.startsWith('smpn36_user_nama='))?.split('=')[1]
    if (namaCookie) setUserName(decodeURIComponent(namaCookie))

    const userId = document.cookie.split('; ')
      .find(r => r.startsWith('smpn36_user_id='))?.split('=')[1]
    if (!userId) { setLoading(false); return }

    async function fetchData() {
      const { data: kelas } = await supabase
        .from('mapel_guru')
        .select('mapel:mapel_id(nama, kode), kelas:kelas_id(nama_rombel, tingkat)')
        .eq('guru_id', userId!)
        .eq('tahun_ajaran', '2026/2027')

      if (kelas) setKelasDiajar(kelas)

      const { data: wk } = await supabase
        .from('kelas')
        .select('nama_rombel, tingkat')
        .eq('wali_kelas_id', userId!)
        .eq('tahun_ajaran', '2026/2027')
        .single()

      if (wk) setWaliKelas(wk)
      setLoading(false)
    }
    fetchData()
  }, [])

  const sapaanNama = userName.split(',')[0]
  const mapelUnik  = [...new Set(kelasDiajar.map((k: any) => k.mapel?.nama).filter(Boolean))]

  const quickMenu = [
    { href: '/dashboard/guru/absensi',     label: 'Input Absensi',  desc: 'Catat kehadiran siswa',       color: 'bg-blue-500',   icon: '✓'  },
    { href: '/dashboard/guru/materi',      label: 'Upload Materi',  desc: 'Bagikan bahan ajar',           color: 'bg-green-500',  icon: '📄' },
    { href: '/dashboard/guru/dokumen-ajar',label: 'Dokumen Ajar',   desc: 'Modul & RPP digital',          color: 'bg-purple-500', icon: '📁' },
    { href: '/dashboard/guru/bank-soal',   label: 'Bank Soal',      desc: 'Kelola soal CBT',              color: 'bg-amber-500',  icon: '📝' },
    { href: '/dashboard/guru/ujian',       label: 'Buat Ujian',     desc: 'Paket soal & jadwal ujian',    color: 'bg-red-500',    icon: '🎯' },
    { href: '/dashboard/guru/nilai',       label: 'Rekap Nilai',    desc: 'Nilai & laporan siswa',        color: 'bg-teal-500',   icon: '📊' },
  ]

  return (
    <div className="space-y-6">

      {/* Hero */}
      <div className="bg-gradient-to-r from-[#1a6b3a] to-[#2d9a57] rounded-2xl p-6 text-white">
        <p className="text-green-200 text-sm mb-1">{today}</p>
        <h1 className="text-2xl font-bold mb-1">Selamat datang, {sapaanNama}!</h1>
        <p className="text-green-100 text-sm">SMP Negeri 36 Bandung — Portal Guru Digital</p>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">Sistem aktif</span>
          {waliKelas && (
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">
              Wali Kelas {waliKelas.nama_rombel}
            </span>
          )}
          <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full">
            {loading ? '...' : `${kelasDiajar.length} kelas diajar`}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Kelas Diajar',   value: loading ? '...' : kelasDiajar.length, sub: 'rombel aktif',  color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Mata Pelajaran', value: loading ? '...' : mapelUnik.length,   sub: 'mapel diampu',  color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Wali Kelas',     value: waliKelas?.nama_rombel ?? '-',         sub: 'kelas binaan',  color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Tahun Ajaran',   value: '2026/2027',                           sub: 'Semester 1',    color: 'text-amber-600',  bg: 'bg-amber-50'  },
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
              <p className="text-sm font-semibold text-gray-800 group-hover:text-[#1a6b3a] transition-colors">{item.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Daftar kelas */}
      {!loading && kelasDiajar.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Kelas yang Diajar — 2026/2027</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {kelasDiajar.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  item.mapel?.kode === 'INFO' ? 'bg-blue-400' : 'bg-green-400'
                }`}/>
                <div>
                  <p className="text-xs font-medium text-gray-700">{item.kelas?.nama_rombel}</p>
                  <p className="text-[11px] text-gray-400">{item.mapel?.nama}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info kalau belum ada kelas */}
      {!loading && kelasDiajar.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-sm text-amber-700 font-medium">Data kelas mengajar belum tersedia</p>
          <p className="text-xs text-amber-500 mt-1">Hubungi admin untuk mengatur data mengajar kamu.</p>
        </div>
      )}
    </div>
  )
}
