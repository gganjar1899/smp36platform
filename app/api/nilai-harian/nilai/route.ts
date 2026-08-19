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
  const kolomId: string | undefined = body?.kolomId;
  const siswaId: string | undefined = body?.siswaId;
  const nilai: number | null = body?.nilai ?? null;

  if (!kolomId || !siswaId) {
    return NextResponse.json({ error: "Data belum lengkap." }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: user } = await (supabase as AnyRow).from("users").select("role").eq("id", userId).single();
  if (user?.role !== "guru") {
    return NextResponse.json({ error: "Hanya guru yang bisa mengisi nilai." }, { status: 403 });
  }

  // Pastikan kolom ini beneran punya guru yang login
  const { data: kolom } = await (supabase as AnyRow).from("nilai_harian_kolom").select("guru_id").eq("id", kolomId).single();
  if (!kolom || kolom.guru_id !== userId) {
    return NextResponse.json({ error: "Kamu tidak berhak mengisi nilai di kolom ini." }, { status: 403 });
  }

  const { error } = await (supabase as AnyRow)
    .from("nilai_harian_nilai")
    .upsert(
      { kolom_id: kolomId, siswa_id: siswaId, nilai, updated_at: new Date().toISOString() },
      { onConflict: "kolom_id,siswa_id" }
    );

  if (error) {
    return NextResponse.json({ error: "Gagal menyimpan nilai." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
