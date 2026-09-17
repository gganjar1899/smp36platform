import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifikasiAkses(userId: string, pengumumanId: string) {
  const { data: user } = await supabaseAdmin.from("users").select("role").eq("id", userId).single();
  if (!user || (user.role !== "admin" && user.role !== "guru")) return { ok: false as const, status: 403, error: "Tidak punya akses." };

  const { data: p } = await supabaseAdmin.from("pengumuman").select("dibuat_oleh").eq("id", pengumumanId).single();
  if (!p) return { ok: false as const, status: 404, error: "Pengumuman tidak ditemukan." };

  if (user.role === "guru" && p.dibuat_oleh !== userId) {
    return { ok: false as const, status: 403, error: "Kamu cuma bisa mengubah pengumuman buatanmu sendiri." };
  }
  return { ok: true as const };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action: string | undefined = body?.action;
  const pengumumanId: string | undefined = body?.pengumumanId;
  if (!action || !pengumumanId) return NextResponse.json({ error: "Data belum lengkap." }, { status: 400 });

  const akses = await verifikasiAkses(userId, pengumumanId);
  if (!akses.ok) return NextResponse.json({ error: akses.error }, { status: akses.status });

  if (action === "hapus") {
    const { error } = await supabaseAdmin.from("pengumuman").delete().eq("id", pengumumanId);
    if (error) return NextResponse.json({ error: "Gagal menghapus." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "toggle-aktif") {
    const { data: current } = await supabaseAdmin.from("pengumuman").select("aktif").eq("id", pengumumanId).single();
    const { error } = await supabaseAdmin.from("pengumuman").update({ aktif: !current?.aktif }).eq("id", pengumumanId);
    if (error) return NextResponse.json({ error: "Gagal mengubah status." }, { status: 500 });
    return NextResponse.json({ success: true, aktif: !current?.aktif });
  }

  if (action === "edit") {
    const { judul, isi, kategori, targetRole, targetKelasId } = body ?? {};
    if (!judul || !isi) return NextResponse.json({ error: "Judul dan isi wajib diisi." }, { status: 400 });
    const { error } = await supabaseAdmin.from("pengumuman")
      .update({ judul, isi, kategori, target_role: targetRole, target_kelas_id: targetKelasId || null })
      .eq("id", pengumumanId);
    if (error) return NextResponse.json({ error: "Gagal menyimpan perubahan." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
}
