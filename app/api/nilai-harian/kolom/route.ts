import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

// Sama persis dengan kamus di app/dashboard/guru/nilai/page.tsx — nama mapel di dropdown
// (nama lengkap, dari mata_pelajaran) diterjemahkan dulu ke nama singkat di tabel "mapel".
const NAMA_MAPEL_KE_TABEL_MAPEL: Record<string, string> = {
  "Ilmu Pengetahuan Alam": "IPA",
  "Ilmu Pengetahuan Sosial": "IPS",
  "Pendidikan Jasmani": "PJOK",
  "Pendidikan Pancasila": "PKN",
};
function namaMapelUntukTabelMapel(namaDropdown: string) {
  return NAMA_MAPEL_KE_TABEL_MAPEL[namaDropdown] ?? namaDropdown;
}

async function verifikasiGuru(supabase: AnyRow, userId: string) {
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single();
  return user?.role === "guru";
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("smpn36_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Sesi login tidak ditemukan." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const action: string | undefined = body?.action;

  const supabase = await createClient();
  if (!(await verifikasiGuru(supabase, userId))) {
    return NextResponse.json({ error: "Hanya guru yang bisa mengelola kolom nilai." }, { status: 403 });
  }

  if (action === "create") {
    const { kelasNama, mapelNama, label, kelompokFormatif, urutan } = body ?? {};
    if (!kelasNama || !mapelNama || !label) {
      return NextResponse.json({ error: "Data kolom belum lengkap." }, { status: 400 });
    }

    const { data: kelasRow } = await (supabase as AnyRow).from("kelas").select("id, tingkat").eq("nama_rombel", kelasNama).maybeSingle();
    if (!kelasRow) return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });

    const { data: mapelRow } = await (supabase as AnyRow)
      .from("mapel")
      .select("id")
      .eq("nama", namaMapelUntukTabelMapel(mapelNama))
      .eq("tingkat", kelasRow.tingkat)
      .maybeSingle();
    if (!mapelRow) {
      return NextResponse.json({ error: "Mapel tidak ditemukan untuk tingkat kelas ini." }, { status: 404 });
    }

    const { data, error } = await (supabase as AnyRow)
      .from("nilai_harian_kolom")
      .insert({
        guru_id: userId, kelas_id: kelasRow.id, mapel_id: mapelRow.id,
        label, urutan: urutan ?? 0, tahun_ajaran: "2026/2027", semester: "1",
        kelompok_formatif: kelompokFormatif ?? 1,
      })
      .select()
      .single();

    if (error || !data) return NextResponse.json({ error: "Gagal menambah kolom: " + error?.message }, { status: 500 });
    return NextResponse.json({ kolom: data });
  }

  if (action === "rename") {
    const { kolomId, label } = body ?? {};
    if (!kolomId || !label) return NextResponse.json({ error: "Data belum lengkap." }, { status: 400 });

    // Pastikan kolom ini beneran punya guru yang login — gak bisa ubah kolom guru lain
    const { data: kolom } = await (supabase as AnyRow).from("nilai_harian_kolom").select("guru_id").eq("id", kolomId).single();
    if (!kolom || kolom.guru_id !== userId) {
      return NextResponse.json({ error: "Kamu tidak berhak mengubah kolom ini." }, { status: 403 });
    }

    const { error } = await (supabase as AnyRow).from("nilai_harian_kolom").update({ label }).eq("id", kolomId);
    if (error) return NextResponse.json({ error: "Gagal menyimpan nama kolom." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { kolomId } = body ?? {};
    if (!kolomId) return NextResponse.json({ error: "kolomId wajib diisi." }, { status: 400 });

    const { data: kolom } = await (supabase as AnyRow).from("nilai_harian_kolom").select("guru_id").eq("id", kolomId).single();
    if (!kolom || kolom.guru_id !== userId) {
      return NextResponse.json({ error: "Kamu tidak berhak menghapus kolom ini." }, { status: 403 });
    }

    const { error } = await (supabase as AnyRow).from("nilai_harian_kolom").delete().eq("id", kolomId);
    if (error) return NextResponse.json({ error: "Gagal menghapus kolom." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
}
