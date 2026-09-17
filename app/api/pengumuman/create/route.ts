import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const judul: string | undefined = body?.judul;
  const isi: string | undefined = body?.isi;
  const kategori: string = body?.kategori || "umum";
  const targetRole: string = body?.targetRole || "semua";
  const targetKelasId: string | null = body?.targetKelasId || null;

  if (!judul || !isi) return NextResponse.json({ error: "Judul dan isi wajib diisi." }, { status: 400 });

  const { data: user } = await supabaseAdmin.from("users").select("role").eq("id", userId).single();
  if (!user || (user.role !== "admin" && user.role !== "guru")) {
    return NextResponse.json({ error: "Hanya admin atau guru yang bisa membuat pengumuman." }, { status: 403 });
  }

  const { data: pengumumanBaru, error } = await supabaseAdmin
    .from("pengumuman")
    .insert({
      judul, isi, kategori, dibuat_oleh: userId,
      target_role: targetRole, target_kelas_id: targetKelasId, aktif: true,
    })
    .select()
    .single();

  if (error || !pengumumanBaru) {
    return NextResponse.json({ error: "Gagal membuat pengumuman: " + error?.message }, { status: 500 });
  }

  const notifRows: { user_id: string; judul: string; pesan: string; link: string }[] = [];
  if (targetRole === "siswa" || targetRole === "semua") {
    let q = supabaseAdmin.from("siswa_kelas").select("siswa_id")
      .eq("tahun_ajaran", "2026/2027").eq("status", "aktif");
    if (targetKelasId) q = q.eq("kelas_id", targetKelasId);
    const { data: siswaRows } = await q;
    (siswaRows ?? []).forEach((s: { siswa_id: string }) => {
      notifRows.push({ user_id: s.siswa_id, judul: "Pengumuman baru", pesan: judul, link: "/dashboard/siswa/pengumuman" });
    });
  }
  if (targetRole === "guru" || targetRole === "semua") {
    const { data: guruRows } = await supabaseAdmin.from("users").select("id").eq("role", "guru");
    (guruRows ?? []).forEach((g: { id: string }) => {
      notifRows.push({ user_id: g.id, judul: "Pengumuman baru", pesan: judul, link: "/dashboard/guru/pengumuman" });
    });
  }

  if (notifRows.length > 0) {
    await supabaseAdmin.from("notifikasi").insert(notifRows);
  }

  return NextResponse.json({ pengumuman: pengumumanBaru, jumlahDinotifikasi: notifRows.length });
}
