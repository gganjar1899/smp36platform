'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Kelas = {
  id: string
  nama_rombel: string
  tingkat: number
  tahun_ajaran: string
  wali_kelas: string
  jumlah_siswa?: number
}

export default function DataKelasPage() {
  const [kelasList, setKelasList] = useState<Kelas[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTingkat, setFilterTingkat] = useState('')

  const fetchKelas = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('kelas')
      .select('*')
      .order('tingkat')
      .order('nama_rombel')

    if (filterTingkat) query = query.eq('tingkat', parseInt(filterTingkat))

    const { data: kelasData } = await query

    // Hitung jumlah siswa per kelas (format IX-A)
    const { data: siswaData } = await supabase
      .from('siswa')
      .select('kelas')
      .eq('status', 'Aktif')

    const countMap: Record<string, number> = {}
    siswaData?.forEach(s => {
      countMap[s.kelas] = (countMap[s.kelas] || 0) + 1
    })

    const enriched = (kelasData || []).map(k => ({
      ...k,
      jumlah_siswa: countMap[k.nama_rombel] || 0
    }))

    setKelasList(enriched)
    setLoading(false)
  }, [filterTingkat])

  useEffect(() => { fetchKelas() }, [fetchKelas])

  const kelas7 = kelasList.filter(k => k.tingkat === 7)
  const kelas8 = kelasList.filter(k => k.tingkat === 8)
  const kelas9 = kelasList.filter(k => k.tingkat === 9)
  const totalSiswa = kelasList.reduce((a, k) => a + (k.jumlah_siswa || 0), 0)

  const KelasCard = ({ k }: { k: Kelas }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 hover:shadow-sm transition">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-gray-800 text-lg">{k.nama_rombel}</p>
          <p className="text-xs text-gray-400 mt-0.5">{k.tahun_ajaran}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold
          ${k.tingkat === 7 ? 'bg-purple-50 text-purple-700' :
            k.tingkat === 8 ? 'bg-blue-50 text-blue-700' :
            'bg-green-50 text-green-700'}`}>
          Kelas {k.tingkat}
        </span>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex-1 mr-3">
          <p className="text-xs text-gray-400">Wali Kelas</p>
          <p className="text-xs font-medium text-gray-600 mt-0.5 truncate">
            {k.wali_kelas || <span className="text-gray-300 italic">Belum ditentukan</span>}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">Siswa</p>
          <p className={`text-xl font-bold ${k.jumlah_siswa ? 'text-blue-600' : 'text-gray-300'}`}>
            {k.jumlah_siswa || 0}
          </p>
        </div>
      </div>
    </div>
  )

  const KelasGroup = ({ title, list, color }: { title: string, list: Kelas[], color: string }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">({list.length} rombel · {list.reduce((a,k) => a+(k.jumlah_siswa||0),0)} siswa)</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(k => <KelasCard key={k.id} k={k} />)}
      </div>
    </div>
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Kelas</h1>
          <p className="text-gray-500 text-sm mt-1">
            <span className="font-semibold text-blue-600">{kelasList.length}</span> rombel ·{' '}
            <span className="font-semibold text-blue-600">{totalSiswa}</span> siswa aktif
          </p>
        </div>
        <div className="flex gap-2">
          {[
            { val: '', label: 'Semua' },
            { val: '7', label: 'Kelas 7' },
            { val: '8', label: 'Kelas 8' },
            { val: '9', label: 'Kelas 9' },
          ].map(t => (
            <button
              key={t.val}
              onClick={() => setFilterTingkat(t.val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                ${filterTingkat === t.val
                  ? 'bg-[#1a3a6b] text-white border-[#1a3a6b]'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Kelas 7', list: kelas7, color: 'text-purple-600' },
          { label: 'Kelas 8', list: kelas8, color: 'text-blue-600' },
          { label: 'Kelas 9', list: kelas9, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>
              {s.list.length} <span className="text-sm font-normal text-gray-400">rombel</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {s.list.reduce((a, k) => a + (k.jumlah_siswa || 0), 0)} siswa
            </p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Memuat data kelas...
        </div>
      ) : kelasList.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="font-medium">Belum ada data kelas</p>
        </div>
      ) : (
        <>
          {(!filterTingkat || filterTingkat === '7') && kelas7.length > 0 &&
            <KelasGroup title="Kelas VII" list={kelas7} color="bg-purple-400" />}
          {(!filterTingkat || filterTingkat === '8') && kelas8.length > 0 &&
            <KelasGroup title="Kelas VIII" list={kelas8} color="bg-blue-400" />}
          {(!filterTingkat || filterTingkat === '9') && kelas9.length > 0 &&
            <KelasGroup title="Kelas IX" list={kelas9} color="bg-green-400" />}
        </>
      )}
    </div>
  )
}