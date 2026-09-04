import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ujianId: string | undefined = body?.ujianId;
  if (!ujianId) return NextResponse.json({ error: "ujianId wajib diisi." }, { status: 400 });

  const supabase = await createClient();

  const { data: user } = await (supabase as AnyRow).from("users").select("role").eq("id", userId).single();
  if (user?.role !== "guru" && user?.role !== "admin") {
    return NextResponse.json({ error: "Hanya guru atau admin yang bisa menyalin nilai." }, { status: 403 });
  }

  const { data: ujian, error: uErr } = await (supabase as AnyRow)
    .from("ujian")
    .select("id, kelas_id, mapel_id, jenis_ujian, dibuat_oleh")
    .eq("id", ujianId)
    .single();
  if (uErr || !ujian) return NextResponse.json({ error: "Ujian tidak ditemukan." }, { status: 404 });

  // Guru cuma boleh nyalin nilai dari ujian yang dia buat sendiri — admin boleh dari ujian mana pun
  if (user.role === "guru" && ujian.dibuat_oleh !== userId) {
    return NextResponse.json({ error: "Kamu tidak berhak menyalin nilai dari ujian ini." }, { status: 403 });
  }

  // Ambil hasil langsung dari sesi_siswa di server — tidak dipercaya dari input client sama sekali
  const { data: sesiRows } = await (supabase as AnyRow)
    .from("sesi_siswa")
    .select("siswa_id, status, nilai_akhir")
    .eq("ujian_id", ujianId);

  const selesai = (sesiRows ?? []).filter((s: AnyRow) => s.status === "selesai" && s.nilai_akhir !== null);
  if (selesai.length === 0) {
    return NextResponse.json({ error: "Belum ada siswa yang menyelesaikan ujian ini." }, { status: 400 });
  }

  const sumber = user.role === "admin" ? ujian.jenis_ujian.toUpperCase() : "CBT";
  const rows = selesai.map((s: AnyRow) => ({
    siswa_id: s.siswa_id, kelas_id: ujian.kelas_id, mapel_id: ujian.mapel_id, guru_id: ujian.dibuat_oleh,
    jenis: "Sumatif", nilai: s.nilai_akhir, semester: 1, tahun_ajaran: "2026/2027", sumber,
  }));

  const { error } = await (supabase as AnyRow)
    .from("nilai_sumatif")
    .upsert(rows, { onConflict: "siswa_id,mapel_id,kelas_id,jenis,semester,tahun_ajaran" });

  if (error) return NextResponse.json({ error: "Gagal menyalin: " + error.message }, { status: 500 });
  return NextResponse.json({ success: true, jumlah: rows.length });
}
