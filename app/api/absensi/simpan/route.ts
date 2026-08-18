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
  const kelasId: string | undefined = body?.kelasId;
  const mapelId: string | undefined = body?.mapelId;
  const tanggal: string | undefined = body?.tanggal;
  const pertemuanKe: number | undefined = body?.pertemuanKe;
  const absensi: Record<string, string> = body?.absensi ?? {};

  if (!kelasId || !mapelId || !tanggal || !pertemuanKe) {
    return NextResponse.json({ error: "Data absensi belum lengkap." }, { status: 400 });
  }

  const supabase = await createClient();

  // Cuma guru yang boleh nyimpen absensi — nutup celah siswa nembak endpoint ini langsung
  const { data: user } = await (supabase as AnyRow).from("users").select("role").eq("id", userId).single();
  if (user?.role !== "guru") {
    return NextResponse.json({ error: "Hanya guru yang bisa menyimpan absensi." }, { status: 403 });
  }

  const siswaIds = Object.keys(absensi);
  if (siswaIds.length === 0) {
    return NextResponse.json({ error: "Belum ada data absensi siswa." }, { status: 400 });
  }

  const rows = siswaIds.map((siswaId) => ({
    siswa_id: siswaId,
    kelas_id: kelasId,
    mapel_id: mapelId,
    guru_id: userId, // guru_id diambil dari cookie, bukan dari body — gak bisa dipalsuin jadi guru lain
    tanggal,
    pertemuan_ke: pertemuanKe,
    status: absensi[siswaId] || "H",
  }));

  const { error } = await (supabase as AnyRow)
    .from("absensi_mapel")
    .upsert(rows, { onConflict: "siswa_id,kelas_id,mapel_id,tanggal,pertemuan_ke" });

  if (error) {
    return NextResponse.json({ error: "Gagal menyimpan: " + error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, jumlah: rows.length });
}
