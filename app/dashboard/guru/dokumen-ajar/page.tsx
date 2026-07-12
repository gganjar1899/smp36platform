"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DokumenAjarCard,
  DokumenAjarRow,
  KONTEN_ICON,
  groupDokumenAjar,
} from "@/types/dokumen-ajar";
import DokumenAjarForm from "@/components/DokumenAjarForm";

interface KelasOption {
  id: string;
  nama_rombel: string;
}
interface MapelOption {
  id: string;
  nama: string;
  tingkat: number;
}

export default function DokumenAjarGuruPage() {
  const supabase = createClient();

  const [guruId, setGuruId] = useState<string | null>(null);
  const [cards, setCards] = useState<DokumenAjarCard[]>([]);
  const [kelasList, setKelasList] = useState<KelasOption[]>([]);
  const [mapelList, setMapelList] = useState<MapelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DokumenAjarCard | null>(null);
  const [filterKelas, setFilterKelas] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);

    // SEMENTARA: belum ada sesi login per-guru di dashboard admin,
    // jadi guru_id diambil berdasarkan NIP tetap punya Ganjar.
    // Nanti kalau udah ada login per-guru, ganti ke deteksi via session.
    const { data: guru } = await supabase
      .from("guru")
      .select("id")
      .eq("nip", "199006252024211002")
      .single();

    const currentGuruId = guru?.id ?? null;
    setGuruId(currentGuruId);

    const { data: kelas } = await supabase
      .from("kelas")
      .select("id, nama_rombel")
      .order("nama_rombel");
    setKelasList(kelas ?? []);

    const { data: mapel } = await supabase
      .from("mapel")
      .select("id, nama, tingkat")
      .order("nama");
    setMapelList(mapel ?? []);

    let query = supabase
      .from("materi_belajar")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentGuruId) query = query.eq("guru_id", currentGuruId);

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr) console.error("Gagal ambil dokumen_ajar:", rowsErr.message);

    const kelasMap = new Map((kelas ?? []).map((k) => [k.id, k]));
    const mapelMap = new Map((mapel ?? []).map((m) => [m.id, m]));

    const enriched = (rows ?? []).map((r) => ({
      ...r,
      kelas: kelasMap.get(r.kelas_id)
        ? { id: r.kelas_id, nama_rombel: kelasMap.get(r.kelas_id)!.nama_rombel }
        : undefined,
      mapel: mapelMap.get(r.mapel_id)
        ? {
            id: r.mapel_id,
            nama: mapelMap.get(r.mapel_id)!.nama,
            kode: "",
            tingkat: mapelMap.get(r.mapel_id)!.tingkat,
          }
        : undefined,
    }));

    setCards(groupDokumenAjar(enriched as unknown as DokumenAjarRow[]));

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleDelete(card: DokumenAjarCard) {
    if (!confirm(`Yakin mau hapus "${card.judul}" beserta semua kontennya?`))
      return;
    const ids = Object.values(card.konten).map((k) => k!.id);
    if (ids.length > 0) {
      await supabase.from("materi_belajar").delete().in("id", ids);
    }
    loadData();
  }

  const filtered = cards.filter((c) => {
    const matchKelas = filterKelas ? c.kelas_id === filterKelas : true;
    const matchSearch = search
      ? c.judul.toLowerCase().includes(search.toLowerCase()) ||
        c.mapelNama.toLowerCase().includes(search.toLowerCase())
      : true;
    return matchKelas && matchSearch;
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a6b]">Dokumen Ajar</h1>
          <p className="text-sm text-gray-500">
            Kelola materi, LKPD, PPT, video, latihan, dan infografis per topik
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="rounded-lg bg-[#1a3a6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#15305a]"
        >
          + Tambah Dokumen Ajar
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <select
          value={filterKelas}
          onChange={(e) => setFilterKelas(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Semua Kelas</option>
          {kelasList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama_rombel}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari topik / mapel..."
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Memuat...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          Belum ada dokumen ajar. Klik &quot;Tambah Dokumen Ajar&quot; untuk mulai.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.key}
              className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <span className="rounded-full bg-[#1a3a6b]/10 px-2 py-0.5 text-xs font-medium text-[#1a3a6b]">
                  {c.mapelNama}
                </span>
                <div className="flex items-center gap-1">
                  {!c.is_published && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">
                      Draft
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{c.kelasNama}</span>
                </div>
              </div>

              <h3 className="mb-1 font-semibold text-gray-800">{c.judul}</h3>
              {c.deskripsi && (
                <p className="mb-3 line-clamp-2 text-xs text-gray-500">
                  {c.deskripsi}
                </p>
              )}

              <div className="mb-3 flex flex-wrap gap-1 text-lg">
                {Object.keys(c.konten).length === 0 ? (
                  <span className="text-xs text-gray-400">Belum ada konten</span>
                ) : (
                  Object.keys(c.konten).map((jenis) => (
                    <span key={jenis} title={jenis}>
                      {KONTEN_ICON[jenis as keyof typeof KONTEN_ICON]}
                    </span>
                  ))
                )}
              </div>

              <div className="mt-auto flex gap-2 border-t pt-3">
                <button
                  onClick={() => {
                    setEditing(c);
                    setShowForm(true);
                  }}
                  className="flex-1 rounded-lg border border-[#1a3a6b] px-3 py-1.5 text-xs font-medium text-[#1a3a6b] hover:bg-[#1a3a6b]/5"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="flex-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <DokumenAjarForm
          guruId={guruId}
          kelasList={kelasList}
          mapelList={mapelList}
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
