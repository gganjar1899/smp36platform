'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type Pengumuman = {
  id: string
  judul: string
  isi: string
  kategori?: string | null
  created_at: string
}

const KATEGORI_STYLE: Record<string, string> = {
  penting:  'bg-red-50 text-red-600 border-red-200',
  akademik: 'bg-blue-50 text-blue-600 border-blue-200',
  umum:     'bg-gray-50 text-gray-600 border-gray-200',
}

export default function PengumumanSiswaPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [items, setItems] = useState<Pengumuman[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('pengumuman')
        .select('id, judul, isi, kategori, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        setErrorMsg('Belum bisa memuat pengumuman. Coba lagi nanti.')
      } else {
        setItems(data ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Pengumuman</h1>
        <p className="text-sm text-gray-400 mt-0.5">Informasi terbaru dari sekolah dan wali kelas</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Memuat pengumuman...</p>
      ) : errorMsg ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg p-3">{errorMsg}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
          </svg>
          <p className="text-sm text-gray-400">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <h3 className="text-sm font-semibold text-gray-800">{p.judul}</h3>
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {p.kategori && (
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2 ${KATEGORI_STYLE[p.kategori] ?? KATEGORI_STYLE.umum}`}>
                  {p.kategori.toUpperCase()}
                </span>
              )}
              <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{p.isi}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
