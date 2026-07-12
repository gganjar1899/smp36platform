"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DokumenAjarCard,
  JenisKonten,
  KONTEN_UPLOAD_FIELDS,
} from "@/types/dokumen-ajar";

interface KelasOption {
  id: string;
  nama_rombel: string;
}
interface MapelOption {
  id: string;
  nama: string;
  tingkat: number;
}

interface Props {
  guruId: string | null;
  kelasList: KelasOption[];
  mapelList: MapelOption[];
  editing: DokumenAjarCard | null;
  onClose: () => void;
  onSaved: () => void;
}

type Tipe = "upload" | "link";

export default function DokumenAjarForm({
  guruId,
  kelasList,
  mapelList,
  editing,
  onClose,
  onSaved,
}: Props) {
  const supabase = createClient();

  const [judul, setJudul] = useState(editing?.judul ?? "");
  const [deskripsi, setDeskripsi] = useState(editing?.deskripsi ?? "");
  const [kelasId, setKelasId] = useState(editing?.kelas_id ?? "");
  const [mapelId, setMapelId] = useState(editing?.mapel_id ?? "");
  const [tahunAjaran, setTahunAjaran] = useState(
    editing?.tahun_ajaran ?? "2026/2027"
  );
  const [semester, setSemester] = useState(editing?.semester ?? 1);
  const [isPublished, setIsPublished] = useState(editing?.is_published ?? true);

  const [videoUrl, setVideoUrl] = useState(
    editing?.konten.video?.file_url ?? ""
  );

  const [tipe, setTipe] = useState<Record<string, Tipe>>(() => {
    const init: Record<string, Tipe> = {};
    for (const f of KONTEN_UPLOAD_FIELDS) init[f.key] = "upload";
    return init;
  });
  const [linkVal, setLinkVal] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of KONTEN_UPLOAD_FIELDS) {
      init[f.key] = editing?.konten[f.key]?.file_url ?? "";
    }
    return init;
  });
  const [file, setFile] = useState<Record<string, File | null>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(f: File, jenis: string) {
    const ext = f.name.split(".").pop();
    const path = `${jenis}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("dokumen-ajar")
      .upload(path, f);
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("dokumen-ajar").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!guruId) {
      setError(
        "Akun guru tidak terdeteksi (guru_id kosong). Cek apakah email login kamu cocok dengan email di tabel guru."
      );
      return;
    }

    if (!judul || !kelasId || !mapelId) {
      setError("Judul, Kelas, dan Mapel wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const base = {
        guru_id: guruId,
        kelas_id: kelasId,
        mapel_id: mapelId,
        judul,
        deskripsi: deskripsi || null,
        tahun_ajaran: tahunAjaran,
        semester,
        is_published: isPublished,
      };

      // gabungkan video + 5 jenis upload field jadi satu daftar kerja
      const jobs: { jenis: JenisKonten; url: string; f: File | null }[] = [
        { jenis: "video", url: videoUrl, f: null },
        ...KONTEN_UPLOAD_FIELDS.map((field) => ({
          jenis: field.key,
          url: tipe[field.key] === "link" ? linkVal[field.key] : "",
          f: tipe[field.key] === "upload" ? file[field.key] ?? null : null,
        })),
      ];

      for (const job of jobs) {
        const existing = editing?.konten[job.jenis];
        let finalUrl = job.url;

        if (job.f) {
          finalUrl = await uploadFile(job.f, job.jenis);
        } else if (!finalUrl && existing) {
          // tipe upload tapi gak ganti file baru -> pertahankan url lama
          finalUrl = existing.file_url;
        }

        if (!finalUrl) {
          // kosong -> hapus row lama kalau ada
          if (existing) {
            await supabase.from("materi_belajar").delete().eq("id", existing.id);
          }
          continue;
        }

        if (existing) {
          const { error: updErr } = await supabase
            .from("materi_belajar")
            .update({ ...base, jenis: job.jenis, file_url: finalUrl })
            .eq("id", existing.id);
          if (updErr) throw updErr;
        } else {
          const { error: insErr } = await supabase
            .from("materi_belajar")
            .insert({ ...base, jenis: job.jenis, file_url: finalUrl });
          if (insErr) throw insErr;
        }
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const supaMsg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : null;
      setError(supaMsg || "Gagal menyimpan (error tidak diketahui).");
      console.error("Gagal menyimpan dokumen ajar:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1a3a6b]">
            {editing ? "Edit Dokumen Ajar" : "Tambah Dokumen Ajar"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {!guruId && (
            <div className="rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-700">
              ⚠️ Akun guru tidak terdeteksi. Data belum bisa disimpan sampai ini
              diperbaiki — cek email login vs email di tabel guru.
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Judul / Topik
            </label>
            <input
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a3a6b] focus:outline-none"
              placeholder="cth: Struktur Kontrol: Percabangan dan Perulangan"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Kelas
              </label>
              <select
                value={kelasId}
                onChange={(e) => setKelasId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Pilih kelas</option>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_rombel}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Mata Pelajaran
              </label>
              <select
                value={mapelId}
                onChange={(e) => setMapelId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Pilih mapel</option>
                {mapelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} (Kelas {m.tingkat})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tahun Ajaran
              </label>
              <input
                value={tahunAjaran}
                onChange={(e) => setTahunAjaran(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={1}>Ganjil</option>
                <option value={2}>Genap</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                Publish ke siswa
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Deskripsi (opsional)
            </label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              🎬 Video YouTube (opsional)
            </label>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>

          <hr />

          {KONTEN_UPLOAD_FIELDS.map((f) => (
            <div key={f.key} className="rounded-lg border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1a3a6b]">
                  {f.label}
                </span>
                <div className="flex gap-1 rounded-full bg-gray-100 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setTipe((prev) => ({ ...prev, [f.key]: "upload" }))
                    }
                    className={`rounded-full px-3 py-1 ${
                      tipe[f.key] === "upload"
                        ? "bg-[#1a3a6b] text-white"
                        : "text-gray-600"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTipe((prev) => ({ ...prev, [f.key]: "link" }))
                    }
                    className={`rounded-full px-3 py-1 ${
                      tipe[f.key] === "link"
                        ? "bg-[#1a3a6b] text-white"
                        : "text-gray-600"
                    }`}
                  >
                    Link Eksternal
                  </button>
                </div>
              </div>

              {tipe[f.key] === "upload" ? (
                <div>
                  <input
                    type="file"
                    accept={f.accept}
                    onChange={(e) =>
                      setFile((prev) => ({
                        ...prev,
                        [f.key]: e.target.files?.[0] ?? null,
                      }))
                    }
                    className="w-full text-sm"
                  />
                  {editing?.konten[f.key] && !file[f.key] && (
                    <p className="mt-1 text-xs text-gray-500">
                      File tersimpan sekarang tetap dipakai kalau tidak diganti.
                    </p>
                  )}
                </div>
              ) : (
                <input
                  value={linkVal[f.key]}
                  onChange={(e) =>
                    setLinkVal((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}

          <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#1a3a6b] px-4 py-2 text-sm font-medium text-white hover:bg-[#15305a] disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
