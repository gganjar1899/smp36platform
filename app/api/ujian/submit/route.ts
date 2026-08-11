import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// PENTING: pakai SERVICE ROLE KEY (bukan anon key), dan cuma dipakai di server ini.
// Kunci ini TIDAK PERNAH dikirim ke browser, jadi request langsung dari
// Console browser siswa tetap kena RLS anon key seperti biasa — tapi proses
// koreksi & penentuan nilai yang sensitif ini sepenuhnya lewat jalur aman ini.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Identifikasi siswa dari cookie login (bukan dari body request —
    //    supaya siswa gak bisa ngaku-ngaku jadi siswa lain).
    const cookieStore = await cookies()
    const userId = cookieStore.get('smpn36_user_id')?.value
    const role = cookieStore.get('smpn36_user_role')?.value

    if (!userId || role !== 'siswa') {
      return NextResponse.json({ error: 'Belum login sebagai siswa.' }, { status: 401 })
    }

    const { sesiId, diskualifikasi } = await req.json()
    if (!sesiId) {
      return NextResponse.json({ error: 'sesiId wajib diisi.' }, { status: 400 })
    }

    // 2. Ambil sesi + data ujian (buat cek maks_peringatan), pastikan ini beneran
    //    sesi milik siswa yang login & masih berjalan
    const { data: sesi, error: sesiErr } = await supabaseAdmin
      .from('sesi_siswa')
      .select('id, siswa_id, ujian_id, status, jumlah_strike, ujian:ujian_id(maks_peringatan)')
      .eq('id', sesiId)
      .single()

    if (sesiErr || !sesi) {
      return NextResponse.json({ error: 'Sesi ujian tidak ditemukan.' }, { status: 404 })
    }
    if (sesi.siswa_id !== userId) {
      return NextResponse.json({ error: 'Sesi ini bukan milik kamu.' }, { status: 403 })
    }
    if (sesi.status !== 'sedang_ujian') {
      return NextResponse.json({ error: 'Sesi ini sudah selesai atau belum dimulai.' }, { status: 400 })
    }

    // Jangan cuma percaya flag dari client — cek juga strike beneran sudah lewat batas.
    const maksPeringatan = (sesi.ujian as any)?.maks_peringatan ?? 3
    const statusAkhirTerverifikasi: 'selesai' | 'diskualifikasi' =
      diskualifikasi || sesi.jumlah_strike >= maksPeringatan ? 'diskualifikasi' : 'selesai'

    // 3. Ambil semua jawaban siswa di sesi ini, sekaligus kunci jawaban & bobot dari bank_soal.
    //    Ini titik SATU-SATUNYA di seluruh alur ujian yang boleh baca jawaban_benar,
    //    dan itu pun terjadi di server, bukan di browser siswa.
    const { data: jawabanRows, error: jawabanErr } = await supabaseAdmin
      .from('jawaban_siswa')
      .select('id, soal_id, jawaban_pg, soal:soal_id(jenis, jawaban_benar, bobot_nilai)')
      .eq('sesi_id', sesiId)

    if (jawabanErr) {
      return NextResponse.json({ error: 'Gagal mengambil jawaban: ' + jawabanErr.message }, { status: 500 })
    }

    const rows = (jawabanRows ?? []) as any[]

    // 4. Koreksi otomatis untuk semua soal pilihan ganda
    let totalPoinPG = 0
    let totalBobotPG = 0
    let adaNonPG = false

    for (const j of rows) {
      const soal = j.soal
      if (!soal) continue

      if (soal.jenis === 'pilihan_ganda') {
        const benar = (j.jawaban_pg ?? '').trim().toUpperCase() === (soal.jawaban_benar ?? '').trim().toUpperCase()
        const poin = benar ? soal.bobot_nilai : 0
        totalPoinPG += poin
        totalBobotPG += soal.bobot_nilai

        await supabaseAdmin
          .from('jawaban_siswa')
          .update({ benar, poin_didapat: poin })
          .eq('id', j.id)
      } else {
        adaNonPG = true
      }
    }

    const nilaiOtomatis = totalBobotPG > 0 ? Math.round((totalPoinPG / totalBobotPG) * 10000) / 100 : null

    // 5. Tentukan nilai akhir:
    //    - Didiskualifikasi -> 0 (kebijakan umum, sesuaikan kalau aturan sekolah beda)
    //    - Ada soal esai/upload -> null dulu, nunggu guru koreksi manual
    //    - Semua PG -> otomatis langsung jadi nilai akhir
    const nilaiAkhir =
      statusAkhirTerverifikasi === 'diskualifikasi' ? 0 : (adaNonPG ? null : nilaiOtomatis)

    const { error: updateErr } = await supabaseAdmin
      .from('sesi_siswa')
      .update({
        status: statusAkhirTerverifikasi,
        waktu_selesai: new Date().toISOString(),
        nilai_otomatis: nilaiOtomatis,
        nilai_akhir: nilaiAkhir,
      })
      .eq('id', sesiId)

    if (updateErr) {
      return NextResponse.json({ error: 'Gagal menyimpan hasil: ' + updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: statusAkhirTerverifikasi,
      nilaiAkhir,
      perluKoreksiManual: statusAkhirTerverifikasi === 'selesai' && adaNonPG,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan: ' + (err?.message ?? 'tidak diketahui') }, { status: 500 })
  }
}
