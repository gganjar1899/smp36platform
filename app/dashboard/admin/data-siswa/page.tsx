'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Siswa = {
  id: string
  nis: string
  nisn: string
  nama: string
  jenis_kelamin: string
  kelas: string
  tahun_masuk: number
  status: string
}

const KELAS_OPTIONS = [
  'VII-A','VII-B','VII-C','VII-D','VII-E','VII-F','VII-G','VII-H','VII-I',
  'VIII-A','VIII-B','VIII-C','VIII-D','VIII-E','VIII-F','VIII-G','VIII-H',
  'IX-A','IX-B','IX-C','IX-D','IX-E','IX-F','IX-G','IX-H','IX-I','IX-J','IX-K',
]

export default function DataSiswaPage() {
  const [siswa, setSiswa] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [filterJk, setFilterJk] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const PER_PAGE = 25

  const fetchSiswa = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('siswa')
      .select('*', { count: 'exact' })
      .order('kelas', { ascending: true })
      .order('nama', { ascending: true })
      .range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

    if (search) query = query.ilike('nama', `%${search}%`)
    if (filterKelas) query = query.eq('kelas', filterKelas)
    if (filterJk) query = query.eq('jenis_kelamin', filterJk)

    const { data, count, error } = await query
    if (!error) {
      setSiswa(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }, [search, filterKelas, filterJk, page])

  useEffect(() => { fetchSiswa() }, [fetchSiswa])
  useEffect(() => { setPage(1) }, [search, filterKelas, filterJk])

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMsg('Mengupload dan memproses file...')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/import-siswa', {
        method: 'POST',
        body: formData,
      })
      const result = await res.json()
      if (res.ok) {
        setImportMsg(`✅ Berhasil import ${result.count} siswa!`)
        fetchSiswa()
      } else {
        setImportMsg(`❌ Gagal: ${result.error}`)
      }
    } catch {
      setImportMsg('❌ Error saat upload file')
    }
    setImporting(false)
    e.target.value = ''
    setTimeout(() => setImportMsg(''), 5000)
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Siswa</h1>
          <p className="text-gray-500 text-sm mt-1">
            Total <span className="font-semibold text-blue-600">{total}</span> siswa terdaftar
          </p>
        </div>
        <div className="flex gap-2">
          {/* Import Excel */}
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition
            ${importing ? 'bg-gray-100 text-gray-400' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {importing ? 'Mengimpor...' : 'Import Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportExcel}
              disabled={importing}
            />
          </label>
          {/* Tambah Manual */}
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Siswa
          </button>
        </div>
      </div>

      {/* Import message */}
      {importMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium
          ${importMsg.startsWith('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {importMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, NIS, NISN..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Filter Kelas */}
        <select
          value={filterKelas}
          onChange={e => setFilterKelas(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[130px]"
        >
          <option value="">Semua Kelas</option>
          <optgroup label="Kelas VII">
            {KELAS_OPTIONS.filter(k => k.startsWith('VII')).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </optgroup>
          <optgroup label="Kelas VIII">
            {KELAS_OPTIONS.filter(k => k.startsWith('VIII')).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </optgroup>
          <optgroup label="Kelas IX">
            {KELAS_OPTIONS.filter(k => k.startsWith('IX')).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </optgroup>
        </select>
        {/* Filter JK */}
        <select
          value={filterJk}
          onChange={e => setFilterJk(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
        {/* Reset */}
        {(search || filterKelas || filterJk) && (
          <button
            onClick={() => { setSearch(''); setFilterKelas(''); setFilterJk('') }}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Reset
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-10">No</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">NIS</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">NISN</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nama Siswa</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Kelas</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">JK</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : siswa.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="font-medium">Belum ada data siswa</p>
                    <p className="text-xs mt-1">Import Excel atau tambah manual</p>
                  </td>
                </tr>
              ) : (
                siswa.map((s, i) => (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition">
                    <td className="px-4 py-3 text-gray-400">{(page - 1) * PER_PAGE + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{s.nis}</td>
                    <td className="px-4 py-3 font-mono text-gray-500 text-xs">{s.nisn}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{s.nama}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium text-xs">
                        {s.kelas}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium
                        ${s.jenis_kelamin === 'L' ? 'bg-sky-50 text-sky-700' : 'bg-pink-50 text-pink-700'}`}>
                        {s.jenis_kelamin === 'L' ? 'L' : 'P'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        <button className="text-red-500 hover:text-red-700 text-xs font-medium">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              Menampilkan {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} dari {total} siswa
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
              >
                ←
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page + i - 2
                if (p < 1 || p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-sm border rounded-lg transition
                      ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
