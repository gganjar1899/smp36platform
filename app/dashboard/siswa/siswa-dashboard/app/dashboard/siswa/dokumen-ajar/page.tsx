"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DokumenAjarCard,
  DokumenAjarRow,
  KONTEN_LABEL,
  groupDokumenAjar,
} from "@/types/dokumen-ajar";

function getYoutubeEmbed(url: string) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function DokumenAjarSiswaPage() {
  const supabase = createClient();

  const [cards, setCards] = useState<DokumenAjarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DokumenAjarCard | null>(null);
  const [search, setSearch] = useState("");
  const [siswaKelasId, setSiswaKelasId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    const nis =
      typeof window !== "undefined" ? sessionStorage.getItem("nis") : null;

    let kelasId: string | null = null;
    if (nis) {
      const { data: siswa } = await supabase
        .from("siswa")
        .select("kelas_id")
        .eq("nis", nis)
        .single();
      kelasId = siswa?.kelas_id ?? null;
      setSiswaKelasId(kelasId);
    }

    let query = supabase
      .from("materi_belajar")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (kelasId) query = query.eq("kelas_id", kelasId);

    const { data, error: rowsErr } = await query;
    if (rowsErr) console.error("Gagal ambil dokumen_ajar:", rowsErr.message);

    const [{ data: kelasList }, { data: mapelList }] = await Promise.all([
      supabase.from("kelas").select("id, nama_rombel"),
      supabase.from("mapel").select("id, nama, kode, tingkat"),
    ]);
    const kelasMap = new Map((kelasList ?? []).map((k) => [k.id, k]));
    const mapelMap = new Map((mapelList ?? []).map((m) => [m.id, m]));

    const enriched = (data ?? []).map((r) => ({
      ...r,
      kelas: kelasMap.get(r.kelas_id)
        ? { id: r.kelas_id, nama_rombel: kelasMap.get(r.kelas_id)!.nama_rombel }
        : undefined,
      mapel: mapelMap.get(r.mapel_id)
        ? {
            id: r.mapel_id,
            nama: mapelMap.get(r.mapel_id)!.nama,
            kode: mapelMap.get(r.mapel_id)!.kode,
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

  const filtered = useMemo(
    () =>
      cards.filter(
        (c) =>
          !search ||
          c.judul.toLowerCase().includes(search.toLowerCase()) ||
          c.mapelNama.toLowerCase().includes(search.toLowerCase())
      ),
    [cards, search]
  );

  // group by Kelas > Mapel
  const grouped = useMemo(() => {
    const byKelas: Record<
      string,
      { kelasNama: string; mapel: Record<string, DokumenAjarCard[]> }
    > = {};

    for (const c of filtered) {
      if (!byKelas[c.kelas_id]) {
        byKelas[c.kelas_id] = { kelasNama: c.kelasNama, mapel: {} };
      }
      if (!byKelas[c.kelas_id].mapel[c.mapelNama]) {
        byKelas[c.kelas_id].mapel[c.mapelNama] = [];
      }
      byKelas[c.kelas_id].mapel[c.mapelNama].push(c);
    }
    return byKelas;
  }, [filtered]);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1a3a6b]">Dokumen Ajar</h1>
        <p className="text-sm text-gray-500">
          Materi belajar dari guru, dikelompokkan per mata pelajaran & topik
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari topik atau mapel..."
        className="mb-6 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="text-sm text-gray-500">Memuat...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
          Belum ada dokumen ajar untuk kelasmu.
        </div>
      ) : (
        Object.entries(grouped).map(([kelasId, kelasGroup]) => (
          <div key={kelasId} className="mb-8">
            {!siswaKelasId && (
              <h2 className="mb-3 text-lg font-semibold text-gray-700">
                Kelas {kelasGroup.kelasNama}
              </h2>
            )}
            {Object.entries(kelasGroup.mapel).map(([mapelNama, list]) => (
              <div key={mapelNama} className="mb-6">
                <h3 className="mb-3 border-l-4 border-[#1a3a6b] pl-3 font-semibold text-[#1a3a6b]">
                  {mapelNama}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setDetail(c)}
                      className="flex flex-col items-start rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <h4 className="mb-1 font-semibold text-gray-800">
                        {c.judul}
                      </h4>
                      {c.deskripsi && (
                        <p className="mb-3 line-clamp-2 text-xs text-gray-500">
                          {c.deskripsi}
                        </p>
                      )}
                      <div className="mt-auto flex gap-1 text-lg">
                        {Object.keys(c.konten).map((jenis) => (
                          <span key={jenis} title={jenis}>
                            {
                              {
                                materi: "📄",
                                video: "🎬",
                                latihan: "📝",
                                lkpd: "📋",
                                ppt: "📊",
                                infografis: "🖼️",
                              }[jenis]
                            }
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <span className="text-xs font-medium text-[#1a3a6b]">
                  {detail.mapelNama}
                </span>
                <h2 className="text-lg font-semibold text-gray-800">
                  {detail.judul}
                </h2>
              </div>
              <button
                onClick={() => setDetail(null)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              {detail.deskripsi && (
                <p className="text-sm text-gray-600">{detail.deskripsi}</p>
              )}

              {detail.konten.video &&
                getYoutubeEmbed(detail.konten.video.file_url) && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-[#1a3a6b]">
                      🎬 Video
                    </h4>
                    <div className="aspect-video overflow-hidden rounded-lg">
                      <iframe
                        src={
                          getYoutubeEmbed(detail.konten.video.file_url) ?? ""
                        }
                        className="h-full w-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

              {(["materi", "latihan", "lkpd", "ppt", "infografis"] as const)
                .filter((jenis) => detail.konten[jenis])
                .map((jenis) => (
                  <div key={jenis}>
                    <h4 className="mb-2 text-sm font-semibold text-[#1a3a6b]">
                      {
                        { materi: "📄", latihan: "📝", lkpd: "📋", ppt: "📊", infografis: "🖼️" }[
                          jenis
                        ]
                      }{" "}
                      {KONTEN_LABEL[jenis]}
                    </h4>
                    <a
                      href={detail.konten[jenis]?.file_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-lg bg-[#1a3a6b] px-4 py-2 text-sm text-white hover:bg-[#15305a]"
                    >
                      Buka {KONTEN_LABEL[jenis]}
                    </a>
                  </div>
                ))}

              {Object.keys(detail.konten).length === 0 && (
                <p className="text-sm text-gray-400">
                  Belum ada konten untuk topik ini.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
