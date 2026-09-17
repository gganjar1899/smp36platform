import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const semua = searchParams.get("semua") === "true";

  const { data: user } = await supabaseAdmin.from("users").select("role").eq("id", userId).single();
  if (!user) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

  if (semua) {
    if (user.role !== "admin") return NextResponse.json({ error: "Hanya admin yang bisa lihat semua pengumuman." }, { status: 403 });
    const { data } = await supabaseAdmin
      .from("pengumuman")
      .select("*, kelas:target_kelas_id(nama_rombel)")
      .order("created_at", { ascending: false });
    return NextResponse.json({ pengumuman: data ?? [] });
  }

  let kelasId: string | null = null;
  if (user.role === "siswa") {
    const { data: sk } = await supabaseAdmin
      .from("siswa_kelas").select("kelas_id")
      .eq("siswa_id", userId).eq("tahun_ajaran", "2026/2027").eq("status", "aktif")
      .maybeSingle();
    kelasId = sk?.kelas_id ?? null;
  }

  const { data } = await supabaseAdmin
    .from("pengumuman")
    .select("id, judul, isi, kategori, target_role, target_kelas_id, created_at")
    .eq("aktif", true)
    .order("created_at", { ascending: false });

  const hasil = (data ?? []).filter((p) => {
    const cocokRole = p.target_role === "semua" || p.target_role === user.role;
    const cocokKelas = !p.target_kelas_id || p.target_kelas_id === kelasId;
    return cocokRole && cocokKelas;
  });

  return NextResponse.json({ pengumuman: hasil });
}
