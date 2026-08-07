import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sesiId: string | undefined = body?.sesiId;
  const diskualifikasi: boolean = !!body?.diskualifikasi;

  if (!sesiId) {
    return NextResponse.json({ error: "sesiId wajib diisi." }, { status: 400 });
  }

  const supabase = await createClient();

  // Pastikan sesi ini beneran milik siswa yang sedang login — bukan sesi orang lain
  const { data: sesi, error: sesiErr } = await (supabase as AnyRow)
    .from("sesi_siswa")
    .select("id, ujian_id, siswa_id, status")
    .eq("id", sesiId)
    .single();

  if (sesiErr || !sesi) {
    return NextResponse.json({ error: "Sesi ujian tidak ditemukan." }, { status: 404 });
  }
  if (sesi.siswa_id !== userId) {
    return NextResponse.json({ error: "Sesi ini bukan milikmu." }, { status: 403 });
  }
  if (sesi.status !== "sedang_ujian") {
    // Sudah pernah diselesaikan sebelumnya — jangan dinilai ulang, kembalikan hasil yang sudah ada
    const { data: sesiLama } = await (supabase as AnyRow)
      .from("sesi_siswa")
      .select("status, nilai_akhir")
      .eq("id", sesiId)
      .single();
    return NextResponse.json({ status: sesiLama?.status, nilaiAkhir: sesiLama?.nilai_akhir ?? null });
  }

  // Ambil daftar soal ujian ini
  const { data: relasi } = await (supabase as AnyRow)
    .from("ujian_soal")
    .select("soal_id")
    .eq("ujian_id", sesi.ujian_id);

  const soalIds = (relasi ?? []).map((r: AnyRow) => r.soal_id as string);

  // Kunci jawaban diambil DI SINI SAJA (server), tidak pernah dikirim ke browser siswa
  const { data: soalRows } = await (supabase as AnyRow)
    .from("bank_soal")
    .select("id, jenis, bobot_nilai, jawaban_benar")
    .in("id", soalIds);

  const { data: jawabanRows } = await (supabase as AnyRow)
    .from("jawaban_siswa")
    .select("id, soal_id, jawaban_pg")
    .eq("sesi_id", sesiId);

  const jawabanMap = new Map((jawabanRows ?? []).map((j: AnyRow) => [j.soal_id as string, j]));

  let poinPg = 0;
  let bobotPg = 0;
  let adaNonPg = false;

  for (const s of soalRows ?? []) {
    if (s.jenis === "pilihan_ganda") {
      bobotPg += s.bobot_nilai;
      const j = jawabanMap.get(s.id) as AnyRow;
      const benar = !!j?.jawaban_pg && j.jawaban_pg === s.jawaban_benar;
      const poin = benar ? s.bobot_nilai : 0;
      poinPg += poin;
      if (j?.id) {
        await (supabase as AnyRow).from("jawaban_siswa").update({ benar, poin_didapat: poin }).eq("id", j.id);
      }
    } else {
      adaNonPg = true;
    }
  }

  const nilaiOtomatis = bobotPg > 0 ? Math.round((poinPg / bobotPg) * 10000) / 100 : null;
  const nilaiAkhir = !adaNonPg ? nilaiOtomatis : null;
  const statusAkhir = diskualifikasi ? "diskualifikasi" : "selesai";

  const { error: updateErr } = await (supabase as AnyRow)
    .from("sesi_siswa")
    .update({
      status: statusAkhir,
      waktu_selesai: new Date().toISOString(),
      nilai_otomatis: nilaiOtomatis,
      nilai_akhir: nilaiAkhir,
    })
    .eq("id", sesiId);

  if (updateErr) {
    return NextResponse.json({ error: "Gagal menyimpan hasil ujian." }, { status: 500 });
  }

  return NextResponse.json({ status: statusAkhir, nilaiAkhir });
}
