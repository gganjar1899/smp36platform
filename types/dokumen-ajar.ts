export type JenisKonten =
  | "materi"
  | "video"
  | "latihan"
  | "lkpd"
  | "ppt"
  | "infografis";

export interface DokumenAjarRow {
  id: string;
  guru_id: string;
  mapel_id: string;
  kelas_id: string;
  jenis: JenisKonten;
  judul: string;
  deskripsi: string | null;
  file_url: string | null;
  tahun_ajaran: string;
  semester: number;
  is_published: boolean;
  created_at: string;

  // hasil join
  kelas?: { id: string; nama_rombel: string };
  mapel?: { id: string; nama: string; kode: string; tingkat: number };
}

// 1 "card" = gabungan beberapa row dengan judul + kelas_id + mapel_id +
// tahun_ajaran + semester yang sama
export interface DokumenAjarCard {
  key: string;
  judul: string;
  deskripsi: string;
  kelas_id: string;
  kelasNama: string;
  mapel_id: string;
  mapelNama: string;
  tahun_ajaran: string;
  semester: number;
  is_published: boolean;
  guru_id: string;
  konten: Partial<Record<JenisKonten, { id: string; file_url: string }>>;
  created_at: string;
}

export const KONTEN_UPLOAD_FIELDS: { key: JenisKonten; label: string; accept: string }[] = [
  { key: "materi", label: "Materi", accept: ".pdf,.doc,.docx" },
  { key: "latihan", label: "Latihan", accept: ".pdf,.doc,.docx" },
  { key: "lkpd", label: "LKPD", accept: ".pdf,.doc,.docx" },
  { key: "ppt", label: "PPT", accept: ".ppt,.pptx,.pdf" },
  { key: "infografis", label: "Infografis", accept: ".jpg,.jpeg,.png,.pdf" },
];

export const KONTEN_ICON: Record<JenisKonten, string> = {
  materi: "📄",
  video: "🎬",
  latihan: "📝",
  lkpd: "📋",
  ppt: "📊",
  infografis: "🖼️",
};

export const KONTEN_LABEL: Record<JenisKonten, string> = {
  materi: "Materi",
  video: "Video",
  latihan: "Latihan",
  lkpd: "LKPD",
  ppt: "PPT",
  infografis: "Infografis",
};

// grouping helper dipakai di halaman guru & siswa
export function groupDokumenAjar(rows: DokumenAjarRow[]): DokumenAjarCard[] {
  const map = new Map<string, DokumenAjarCard>();

  for (const r of rows) {
    const key = [r.judul, r.kelas_id, r.mapel_id, r.tahun_ajaran, r.semester].join(
      "::"
    );

    if (!map.has(key)) {
      map.set(key, {
        key,
        judul: r.judul,
        deskripsi: r.deskripsi ?? "",
        kelas_id: r.kelas_id,
        kelasNama: r.kelas?.nama_rombel ?? "",
        mapel_id: r.mapel_id,
        mapelNama: r.mapel?.nama ?? "",
        tahun_ajaran: r.tahun_ajaran,
        semester: r.semester,
        is_published: r.is_published,
        guru_id: r.guru_id,
        konten: {},
        created_at: r.created_at,
      });
    }

    const card = map.get(key)!;
    if (r.file_url) {
      card.konten[r.jenis] = { id: r.id, file_url: r.file_url };
    }
    if (r.is_published) card.is_published = true;
    if (r.created_at < card.created_at) card.created_at = r.created_at;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );
}
