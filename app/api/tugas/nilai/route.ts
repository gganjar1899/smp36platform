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
  const pengumpulanId: string | undefined = body?.pengumpulanId;
  const nilaiInput = body?.nilai;
  const catatan: string | null = body?.catatan || null;

  if (!pengumpulanId) {
    return NextResponse.json({ error: "pengumpulanId wajib diisi." }, { status: 400 });
  }

  const supabase = await createClient();

  // Pastikan yang minta beneran guru, bukan siswa yang coba nembak endpoint ini langsung
  const { data: user } = await (supabase as AnyRow).from("users").select("role").eq("id", userId).single();
  if (user?.role !== "guru") {
    return NextResponse.json({ error: "Hanya guru yang bisa menilai tugas." }, { status: 403 });
  }

  // Pastikan tugas ini beneran dibuat oleh guru yang login — gak bisa nilai tugas guru lain
  const { data: pengumpulan, error: pErr } = await (supabase as AnyRow)
    .from("pengumpulan_tugas")
    .select("id, siswa_id, tugas:tugas_id(id, judul, dibuat_oleh)")
    .eq("id", pengumpulanId)
    .single();

  if (pErr || !pengumpulan) {
    return NextResponse.json({ error: "Data pengumpulan tidak ditemukan." }, { status: 404 });
  }
  if (pengumpulan.tugas?.dibuat_oleh !== userId) {
    return NextResponse.json({ error: "Kamu tidak berhak menilai tugas ini." }, { status: 403 });
  }

  const nilai = nilaiInput === "" || nilaiInput === null || nilaiInput === undefined ? null : parseFloat(nilaiInput);

  // Hanya field penilaian yang boleh ditulis di sini — catatan/file jawaban siswa
  // sengaja TIDAK bisa diubah lewat endpoint ini.
  const { data: hasil, error: updateErr } = await (supabase as AnyRow)
    .from("pengumpulan_tugas")
    .update({ nilai, catatan_guru: catatan, dinilai_at: new Date().toISOString() })
    .eq("id", pengumpulanId)
    .select()
    .single();

  if (updateErr || !hasil) {
    return NextResponse.json({ error: "Gagal menyimpan nilai." }, { status: 500 });
  }

  await (supabase as AnyRow).from("notifikasi").insert({
    user_id: pengumpulan.siswa_id,
    judul: "Tugas sudah dinilai",
    pesan: `Tugas "${pengumpulan.tugas?.judul}" sudah dinilai: ${nilai ?? "-"}`,
    link: "/dashboard/siswa/tugas",
  });

  return NextResponse.json({ pengumpulan: hasil });
}
