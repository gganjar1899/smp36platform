import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    const students: any[] = []
    const sheetNames = wb.SheetNames // ['KELAS 7', 'KELAS 8', 'KELAS 9']

    for (const sheetName of sheetNames) {
      const ws = wb.Sheets[sheetName]
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

      let currentKelas: string | null = null

      for (const row of rows) {
        if (!row || !row[0]) continue

        const col0 = String(row[0]).trim()

        // Detect header kelas
        const kelasMatch = col0.match(/KELAS\s+(VII|VIII|IX)\s*[-–]\s*([A-K])/i)
        if (kelasMatch) {
          currentKelas = `${kelasMatch[1].toUpperCase()}-${kelasMatch[2].toUpperCase()}`
          continue
        }

        // Parse baris siswa: col0=no(int), col1=NIS, col2=NISN, col3=nama, col5=JK
        if (
          typeof row[0] === 'number' &&
          row[0] > 0 && row[0] < 200 &&
          row[1] && row[3] && currentKelas
        ) {
          const nama = String(row[3]).trim()
          if (nama.startsWith('=') || !nama) continue

          const jk = row[5] && ['L', 'P'].includes(String(row[5]).trim())
            ? String(row[5]).trim()
            : 'L'
          const nis = String(row[1]).trim()
          const nisn = String(row[2] || '').trim()
          const tahunMasuk = nis.startsWith('25') ? 2025 : nis.startsWith('24') ? 2024 : 2023

          students.push({
            nis,
            nisn,
            nama,
            jenis_kelamin: jk,
            kelas: currentKelas,
            tahun_masuk: tahunMasuk,
            status: 'Aktif',
          })
        }
      }
    }

    if (students.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data siswa yang bisa dibaca dari file' }, { status: 400 })
    }

    // Upsert ke Supabase (update jika NIS sudah ada)
    const BATCH = 100
    let totalInserted = 0
    for (let i = 0; i < students.length; i += BATCH) {
      const batch = students.slice(i, i + BATCH)
      const { error } = await supabase
        .from('siswa')
        .upsert(batch, { onConflict: 'nis' })
      if (error) throw error
      totalInserted += batch.length
    }

    return NextResponse.json({ count: totalInserted, message: 'Import berhasil' })
  } catch (err: any) {
    console.error('Import error:', err)
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 })
  }
}
