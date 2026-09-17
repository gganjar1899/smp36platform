'use client'

import { useEffect, useState } from 'react'

type Pengumuman = { id: string; judul: string; isi: string; kategori: string; created_at: string }

const KATEGORI_STYLE: Record<string, { label: string; cls: string }> = {
  penting: { label: '🔴 Penting', cls: 'bg-red-50 text-red-600' },
  akademik: { label: '📘 Akademik', cls: 'bg-blue-50 text-blue-600' },
  umum: { label: '📢 Umum', cls: 'bg-gray-100 text-gray-600' },
}

export default function PengumumanGuruPage() {
  const [list, setList] = useState<Pengumuman[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch('/api/pengumuman/list')
      .then(res => res.json())
      .then(data => setList(data.pengumuman ?? []))
      .catch(() => setErrorMsg('Belum bisa memuat pengumuman. Coba lagi nanti.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Pengumuman</h1>
        <p className="text-sm text-gray-400 mt-0.5">Info dari sekolah</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Memuat pengumuman...</p>
      ) : errorMsg ? (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg p-3">{errorMsg}</div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-sm text-gray-400">Belum ada pengumuman.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map(p => {
            const kat = KATEGORI_STYLE[p.kategori] ?? KATEGORI_STYLE.umum
            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${kat.cls}`}>{kat.label}</span>
                  <span className="text-[11px] text-gray-400">{new Date(p.created_at).toLocaleDateString('id-ID')}</span>
                </div>
                <h4 className="text-sm font-semibold text-gray-800">{p.judul}</h4>
                <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{p.isi}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
