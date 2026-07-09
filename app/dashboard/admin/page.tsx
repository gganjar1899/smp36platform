'use client'

export default function DashboardAdminPage() {
  const stats = [
    { label: 'Total Siswa',    value: '888',  sub: '28 rombel',      color: 'text-[#1a3a6b]', bg: 'bg-blue-50',   icon: (
      <svg className="w-5 h-5 text-[#1a3a6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    )},
    { label: 'Total Guru',     value: '43',   sub: 'Tenaga pengajar', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: (
      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    )},
    { label: 'Mata Pelajaran', value: '12',   sub: 'Kelompok A B C',  color: 'text-violet-700', bg: 'bg-violet-50', icon: (
      <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    )},
    { label: 'Tahun Ajaran',   value: '26/27', sub: 'Semester 1 aktif', color: 'text-amber-700', bg: 'bg-amber-50', icon: (
      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    )},
  ]

  const quickAccess = [
    {
      href: '/dashboard/admin/absensi',
      label: 'Rekap Absensi',
      desc: 'Monitor kehadiran per kelas & mapel',
      color: 'border-l-[#1a3a6b]',
      icon: (
        <svg className="w-5 h-5 text-[#1a3a6b]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
      )
    },
    {
      href: '/dashboard/admin/nilai',
      label: 'Leger Nilai',
      desc: 'Rekap nilai formatif & sumatif siswa',
      color: 'border-l-emerald-500',
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      )
    },
    {
      href: '/dashboard/admin/jurnal',
      label: 'Jurnal Mengajar',
      desc: 'Pantau jurnal harian seluruh guru',
      color: 'border-l-violet-500',
      icon: (
        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
      )
    },
    {
      href: '/dashboard/guru/absensi',
      label: 'Input Absensi',
      desc: 'Catat kehadiran siswa per pertemuan',
      color: 'border-l-amber-500',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      )
    },
    {
      href: '/dashboard/admin/siswa',
      label: 'Data Siswa',
      desc: 'Kelola data 888 siswa aktif',
      color: 'border-l-rose-500',
      icon: (
        <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      )
    },
    {
      href: '/dashboard/admin/dokumen',
      label: 'Dokumen Ajar',
      desc: 'LKPD, modul, dan materi pembelajaran',
      color: 'border-l-cyan-500',
      icon: (
        <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
      )
    },
  ]

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Welcome */}
      <div className="bg-[#1a3a6b] rounded-2xl p-6 flex items-center justify-between overflow-hidden relative">
        <div className="relative z-10">
          <p className="text-blue-300 text-xs font-medium mb-1 uppercase tracking-wider">{today}</p>
          <h1 className="text-white text-xl font-bold mb-1">Selamat datang, Administrator</h1>
          <p className="text-blue-200 text-sm">SMP Negeri 36 Bandung — Platform Administrasi Digital</p>
          <div className="mt-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs px-3 py-1.5 rounded-full border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
              Sistem aktif
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/10 text-white text-xs px-3 py-1.5 rounded-full border border-white/20">
              Semester 1 · 2026/2027
            </span>
          </div>
        </div>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
          <svg className="w-40 h-40 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              {s.icon}
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Access */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Akses Cepat</h2>
          <span className="text-xs text-gray-400">6 modul tersedia</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickAccess.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`bg-white rounded-xl p-4 border-l-4 ${item.color} border border-gray-100 shadow-sm hover:shadow-md transition-all group flex items-start gap-4`}
            >
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-[#1a3a6b] transition-colors">{item.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
              <svg className="w-4 h-4 text-gray-300 group-hover:text-[#1a3a6b] flex-shrink-0 mt-0.5 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          ))}
        </div>
      </div>

      {/* School Info */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-[#1a3a6b] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">36</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">SMP Negeri 36 Bandung</p>
          <p className="text-xs text-gray-400">Jl. Caringin Babakan Ciparay · Telp. (022) 6078507 · Akreditasi A</p>
        </div>
        <div className="text-right flex-shrink-0 hidden md:block">
          <p className="text-xs text-gray-400">Kepala Sekolah</p>
          <p className="text-sm font-semibold text-gray-700">Elly Amalya, S.Pd., M.M.Pd.</p>
        </div>
      </div>

    </div>
  )
}
