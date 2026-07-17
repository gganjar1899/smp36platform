'use client'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'

type MateriRow = {
  id: string
  judul: string
  deskripsi: string | null
  mapel_id: string | null
  kelas_id: string | null
  created_at: string
  mapelNama?: string
}

export default function MateriSiswaPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [items, setItems] = useState<MateriRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        const kelasId: string | null = data?.siswa?.kelasId ?? null

        let query = supabase
          .from('materi_belajar')
          .select('id, judul, deskripsi, mapel_id, kelas_id, created_at')
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (kelasId) query = query.eq('kelas_id', kelasId)

        const { data: rows, error } = await query
        if (error) {
          setErrorMsg('Belum bisa memuat materi. Coba lagi nanti.')
          setLoading(false)
          return
        }

        const mapelIds = [...new Set((rows ?? []).map(r => r.mapel_id).filter(Boolean))]
        let mapelMap = new Map<string, string>()
        if (mapelIds.length > 0) {
          const { data: mapelList } = await supabase
            .from('mapel')
            .select('id, nama')
            .in('id', mapelIds as string[])
          mapelMap = new Map((mapelList ?? []).map((m: any) => [m.id, m.nama]))
        }

        setItems((rows ?? []).map(r => ({ ...r, mapelNama: r.mapel_id ? mapelMap.get(r.mapel_id) : undefined })))
      } catch {
        setErrorMsg('Belum bisa memuat materi. Coba lagi nanti.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(
    () => items.filter(m =>
      !search ||
      m.judul.toLowerCase().includes(search.toLowerCase()) ||
      (m.mapelNama ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [items, search]
  )

  const grouped = useMemo(() => {
    const acc: Record<string, MateriRow[]> = {}
    for (const m of filtered) {
      const key = m.mapelNama ?? 'Mapel Lainnya'
      if (!acc[key]) acc[key] = []
      acc[key].push(m)
    }
    return acc
  }, [filtered])

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Materi</h1>
        <p className="text-sm text-gray-400 mt-0.5">Materi belajar yang dibagikan guru untuk kelasmu</p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Cari judul atau mata pelajaran..."
        className="w-full max-w-md px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[#1a3a6b]"
      />

      {loading ? (
        <p className="text-sm text-gray-400">Memuat materi...</p>
      ) : errorMsg ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg p-3">{errorMsg}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
          <p className="text-sm text-gray-400">Belum ada materi untuk kelasmu.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([mapelNama, list]) => (
          <div key={mapelNama} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-1 border-l-4 border-[#1a3a6b] pl-2">{mapelNama}</h3>
            {list.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800">{m.judul}</h4>
                    {m.deskripsi && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{m.deskripsi}</p>}
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
