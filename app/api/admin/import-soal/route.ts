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
    const soalId = formData.get('soal_id') as string

    if (!file || !soalId) {
      return NextResponse.json({ error: 'File dan soal_id wajib ada' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    // Ambil sheet pertama
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Skip header rows (cari baris yang dimulai dengan angka)
    const pertanyaanRows = rows.filter(row => {
      const no = row[0]
      return typeof no === 'number' && no > 0
    })

    if (pertanyaanRows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data soal yang ditemukan. Pastikan kolom No diisi dengan angka.' }, { status: 400 })
    }

    // Parse soal
    const pertanyaan = pertanyaanRows.map(row => {
      const kunci = String(row[7] || 'A').trim().toUpperCase()
      return {
        soal_id: soalId,
        nomor: parseInt(row[0]) || 0,
        pertanyaan: String(row[1] || '').trim(),
        pilihan_a: String(row[2] || '').trim(),
        pilihan_b: String(row[3] || '').trim(),
        pilihan_c: String(row[4] || '').trim(),
        pilihan_d: String(row[5] || '').trim(),
        pilihan_e: String(row[6] || '').trim(),
        kunci_jawaban: ['A','B','C','D','E'].includes(kunci) ? kunci : 'A',
        bobot: parseInt(row[8]) || 1,
      }
    }).filter(p => p.pertanyaan && p.pilihan_a && p.pilihan_b)

    if (pertanyaan.length === 0) {
      return NextResponse.json({ error: 'Tidak ada soal valid. Pastikan kolom Pertanyaan, Pilihan A, dan Pilihan B terisi.' }, { status: 400 })
    }

    // Hapus soal lama & insert baru
    await supabase.from('pertanyaan_cbt').delete().eq('soal_id', soalId)
    const { error } = await supabase.from('pertanyaan_cbt').insert(pertanyaan)
    if (error) throw error

    // Update jumlah soal
    await supabase.from('soal_cbt').update({ jumlah_soal: pertanyaan.length }).eq('id', soalId)

    return NextResponse.json({ count: pertanyaan.length, message: 'Import berhasil' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Terjadi kesalahan' }, { status: 500 })
  }
}
