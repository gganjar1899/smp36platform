import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;

  if (!userId) {
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }

  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user, error: userErr } = await (supabase as any)
    .from("users")
    .select("id, nama, role, nisn, nip")
    .eq("id", userId)
    .single();

  if (userErr || !user) {
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }

  if (user.role === "siswa") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sk } = await (supabase as any)
      .from("siswa_kelas")
      .select("kelas_id, kelas:kelas_id(id, nama_rombel)")
      .eq("siswa_id", user.id)
      .eq("tahun_ajaran", "2026/2027")
      .eq("status", "aktif")
      .single();

    const kelasId = sk?.kelas?.id ?? null;
    const kelasNama = sk?.kelas?.nama_rombel ?? null;

    return NextResponse.json({
      loggedIn: true,
      userId: user.id,
      role: "siswa",
      nama: user.nama,
      siswa: kelasId
        ? { id: user.id, kelasId, kelasNama }
        : null,
    });
  }

  if (user.role === "guru") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: guru } = await (supabase as any)
      .from("guru")
      .select("id, nama")
      .eq("nip", user.nip)
      .single();

    return NextResponse.json({
      loggedIn: true,
      userId: user.id,
      role: "guru",
      nama: user.nama,
      // guru.id = id tabel lama `guru` (dipakai halaman skema lama, mis. dokumen-ajar).
      // userId  = id tabel `users` (dipakai tabel baru: mapel_guru, guru_mapel, kelas.wali_kelas_id).
      guru: guru ? { id: guru.id } : null,
    });
  }

  return NextResponse.json({
    loggedIn: true,
    userId: user.id,
    role: user.role,
    nama: user.nama,
  });
}
