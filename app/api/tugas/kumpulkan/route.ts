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
  const tugasId: string | undefined = body?.tugasId;
  const catatan: string | null = body?.catatan || null;
  const fileJawaban: { nama: string; url: string }[] = Array.isArray(body?.fileJawaban) ? body.fileJawaban : [];

  if (!tugasId) {
    return NextResponse.json({ error: "tugasId wajib diisi." }, { status: 400 });
  }
  if (fileJawaban.length === 0 && !catatan) {
    return NextResponse.json({ error: "Isi catatan atau lampirkan file dulu." }, { status: 400 });
  }

  const supabase = await createClient();

  // Pastikan tugas ini beneran untuk kelas siswa yang login (bukan kelas lain)
  const { data: siswaKelas } = await (supabase as AnyRow)
    .from("siswa_kelas")
    .select("kelas_id")
    .eq("siswa_id", userId)
    .eq("tahun_ajaran", "2026/2027")
    .eq("status", "aktif")
    .maybeSingle();

  if (!siswaKelas) {
    return NextResponse.json({ error: "Data kelas kamu tidak ditemukan." }, { status: 403 });
  }

  const { data: tugas, error: tugasErr } = await (supabase as AnyRow)
    .from("tugas")
    .select("id, judul, kelas_id, deadline, dibuat_oleh")
    .eq("id", tugasId)
    .single();

  if (tugasErr || !tugas) {
    return NextResponse.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (tugas.kelas_id !== siswaKelas.kelas_id) {
    return NextResponse.json({ error: "Tugas ini bukan untuk kelasmu." }, { status: 403 });
  }

  // Ambil pengumpulan lama (kalau kumpul ulang) buat jaga-jaga field yang gak dikirim ulang
  const { data: lama } = await (supabase as AnyRow)
    .from("pengumpulan_tugas")
    .select("file_jawaban, catatan_siswa")
    .eq("tugas_id", tugasId)
    .eq("siswa_id", userId)
    .maybeSingle();

  const terlambat = new Date() > new Date(tugas.deadline);

  // Hanya field jawaban siswa yang boleh ditulis di sini — nilai & catatan_guru
  // sengaja TIDAK ada di payload ini, jadi gak mungkin ke-tulis lewat endpoint ini.
  const { data: hasil, error: upsertErr } = await (supabase as AnyRow)
    .from("pengumpulan_tugas")
    .upsert(
      {
        tugas_id: tugasId,
        siswa_id: userId,
        file_jawaban: fileJawaban.length > 0 ? fileJawaban : lama?.file_jawaban ?? [],
        catatan_siswa: catatan || lama?.catatan_siswa || null,
        status: terlambat ? "Terlambat" : "Tepat Waktu",
        dikumpulkan_at: new Date().toISOString(),
      },
      { onConflict: "tugas_id,siswa_id" }
    )
    .select()
    .single();

  if (upsertErr || !hasil) {
    return NextResponse.json({ error: "Gagal menyimpan pengumpulan tugas." }, { status: 500 });
  }

  if (tugas.dibuat_oleh) {
    await (supabase as AnyRow).from("notifikasi").insert({
      user_id: tugas.dibuat_oleh,
      judul: "Tugas dikumpulkan",
      pesan: `Ada siswa mengumpulkan tugas "${tugas.judul}"${terlambat ? " (terlambat)" : ""}`,
      link: "/dashboard/guru/tugas",
    });
  }

  return NextResponse.json({ pengumpulan: hasil });
}
