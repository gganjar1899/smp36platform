'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuGroups = [
  {
    group: 'UTAMA',
    items: [
      { href: '/dashboard/guru', label: 'Dashboard', exact: true, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
      )},
      { href: '/dashboard/guru/absensi', label: 'Absensi', exact: false, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
      )},
      { href: '/dashboard/guru/materi', label: 'Materi Ajar', exact: false, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
      )},
      { href: '/dashboard/guru/dokumen-ajar', label: 'Dokumen Ajar', exact: false, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
      )},
    ]
  },
  {
    group: 'CBT & NILAI',
    items: [
      { href: '/dashboard/guru/bank-soal', label: 'Bank Soal', exact: false, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      )},
      { href: '/dashboard/guru/ujian', label: 'Kelola Ujian', exact: false, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
      )},
      { href: '/dashboard/guru/nilai', label: 'Rekap Nilai', exact: false, icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
      )},
    ]
  },
]

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userName, setUserName] = useState('Guru')

  useEffect(() => {
    const nama = document.cookie.split('; ')
      .find(r => r.startsWith('smpn36_user_nama='))?.split('=')[1]
    if (nama) setUserName(decodeURIComponent(nama))
  }, [])

  const initial = userName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-[#f4f5fb] flex font-sans">
      <aside className={`${collapsed ? 'w-[72px]' : 'w-[260px]'} transition-all duration-300 bg-white border-r border-gray-100 min-h-screen flex flex-col shadow-sm flex-shrink-0`}>
        <div className="h-16 flex items-center px-5 border-b border-gray-100 gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1a6b3a] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">36</span>
          </div>
          {!collapsed && (
            <div>
              <p className="text-[#1a6b3a] font-bold text-sm leading-tight">SMPN 36</p>
              <p className="text-gray-400 text-xs">Portal Guru</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {menuGroups.map(group => (
            <div key={group.group}>
              {!collapsed && <p className="text-[10px] font-semibold text-gray-400 tracking-widest px-3 mb-2">{group.group}</p>}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                        isActive ? 'bg-[#1a6b3a] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      }`}>
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="font-medium">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#1a6b3a] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{initial}</div>
              <div className="overflow-hidden flex-1">
                <p className="text-xs font-semibold text-gray-800 truncate">{userName}</p>
                <p className="text-[10px] text-gray-400">Guru SMPN 36</p>
              </div>
            </div>
          )}
          <a href="/api/auth/logout" className="flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            {!collapsed && <span className="font-medium">Keluar</span>}
          </a>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => setCollapsed(!collapsed)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7"/></svg>
            </button>
            <div>
              <p className="text-sm font-semibold text-gray-800">Portal Guru — SMPN 36</p>
              <p className="text-xs text-gray-400">Tahun Ajaran 2026/2027 · Semester 1</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1a6b3a] flex items-center justify-center text-white text-xs font-bold">{initial}</div>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
        <footer className="px-6 py-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-300 text-center">2026 SMP Negeri 36 Bandung</p>
        </footer>
      </div>
    </div>
  )
}
