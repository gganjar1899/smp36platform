export type UserRole = 'admin' | 'guru' | 'siswa'
export type SesiStatus = 'belum_mulai' | 'berlangsung' | 'selesai' | 'timeout'
export type JenisUjian =
  | 'ulangan_harian'
  | 'asat'
  | 'asaj'
  | 'asas'
  | 'to_tka'
  | 'latihan'
export type UjianStatus = 'draft' | 'aktif' | 'selesai' | 'diarsipkan'
export type PengumpulanStatus = 'belum' | 'terlambat' | 'dikumpulkan' | 'dinilai'

// ─────────────────────────────────────────
// Tabel-tabel database
// ─────────────────────────────────────────

export interface User {
  id: string
  role: UserRole
  username: string
  password_hash: string
  nama: string
  nisn: string | null
  nip: string | null
  harus_ganti_password: boolean
  aktif: boolean
  foto_url: string | null
  created_at: string
  updated_at: string
}

export interface Kelas {
  id: string
  tingkat: number
  nama_rombel: string
  tahun_ajaran: string
  wali_kelas_id: string | null
  created_at: string
}

export interface Mapel {
  id: string
  nama: string
  kode: string | null
  tingkat: number | null
  created_at: string
}

export interface MapelGuru {
  id: string
  mapel_id: string
  guru_id: string
  kelas_id: string
  tahun_ajaran: string
  created_at: string
}

export interface SiswaKelas {
  id: string
  siswa_id: string
  kelas_id: string
  tahun_ajaran: string
  status: 'aktif' | 'pindah' | 'lulus'
  created_at: string
}

export interface BankSoal {
  id: string
  mapel_id: string
  dibuat_oleh: string
  jenis: 'pilihan_ganda' | 'benar_salah' | 'essay'
  pertanyaan: string
  gambar_soal_url: string | null
  pilihan_a: string | null
  pilihan_b: string | null
  pilihan_c: string | null
  pilihan_d: string | null
  pilihan_e: string | null
  jawaban_benar: string | null
  bobot_nilai: number
  tingkat_kesulitan: 'mudah' | 'sedang' | 'sulit'
  aktif: boolean
  created_at: string
  updated_at: string
}

export interface Ujian {
  id: string
  judul: string
  mapel_id: string
  kelas_id: string
  dibuat_oleh: string
  jenis_ujian: JenisUjian
  token: string
  durasi_menit: number
  maks_peringatan: number
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  status: UjianStatus
  acak_soal: boolean
  created_at: string
}

export interface UjianSoal {
  id: string
  ujian_id: string
  soal_id: string
  urutan: number
}

export interface SesiSiswa {
  id: string
  ujian_id: string
  siswa_id: string
  waktu_mulai: string | null
  waktu_selesai: string | null
  sisa_detik: number | null
  status: SesiStatus
  jumlah_strike: number
  nilai_otomatis: number | null
  nilai_manual: number | null
  nilai_akhir: number | null
  dikoreksi_oleh: string | null
  dikoreksi_at: string | null
  created_at: string
}

export interface JawabanSiswa {
  id: string
  sesi_id: string
  soal_id: string
  jawaban_pg: string | null
  jawaban_esai: string | null
  jawaban_file_url: string | null
  benar: boolean | null
  poin_didapat: number | null
  dijawab_at: string
}

export interface LogPelanggaran {
  id: string
  sesi_id: string
  jenis_pelanggaran: string
  status: string
  strike_ke: number | null
  sisa_waktu: string | null
  platform: string | null
  user_agent: string | null
  created_at: string
}

export interface Tugas {
  id: string
  judul: string
  deskripsi: string | null
  mapel_id: string
  kelas_id: string
  dibuat_oleh: string
  file_lampiran_url: string | null
  deadline: string
  created_at: string
}

export interface PengumpulanTugas {
  id: string
  tugas_id: string
  siswa_id: string
  file_jawaban_url: string | null
  catatan_siswa: string | null
  status: PengumpulanStatus
  nilai: number | null
  catatan_guru: string | null
  dikumpulkan_at: string | null
  dinilai_at: string | null
}

export interface Pengumuman {
  id: string
  judul: string
  isi: string
  dibuat_oleh: string
  target_role: 'semua' | UserRole
  target_kelas_id: string | null
  aktif: boolean
  created_at: string
}

// ─────────────────────────────────────────
// Tipe Database untuk Supabase Client
// ─────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id'>>
      }
      kelas: {
        Row: Kelas
        Insert: Omit<Kelas, 'id' | 'created_at'>
        Update: Partial<Omit<Kelas, 'id'>>
      }
      mapel: {
        Row: Mapel
        Insert: Omit<Mapel, 'id' | 'created_at'>
        Update: Partial<Omit<Mapel, 'id'>>
      }
      mapel_guru: {
        Row: MapelGuru
        Insert: Omit<MapelGuru, 'id' | 'created_at'>
        Update: Partial<Omit<MapelGuru, 'id'>>
      }
      siswa_kelas: {
        Row: SiswaKelas
        Insert: Omit<SiswaKelas, 'id' | 'created_at'>
        Update: Partial<Omit<SiswaKelas, 'id'>>
      }
      bank_soal: {
        Row: BankSoal
        Insert: Omit<BankSoal, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<BankSoal, 'id'>>
      }
      ujian: {
        Row: Ujian
        Insert: Omit<Ujian, 'id' | 'created_at'>
        Update: Partial<Omit<Ujian, 'id'>>
      }
      ujian_soal: {
        Row: UjianSoal
        Insert: Omit<UjianSoal, 'id'>
        Update: Partial<Omit<UjianSoal, 'id'>>
      }
      sesi_siswa: {
        Row: SesiSiswa
        Insert: Omit<SesiSiswa, 'id' | 'created_at'>
        Update: Partial<Omit<SesiSiswa, 'id'>>
      }
      jawaban_siswa: {
        Row: JawabanSiswa
        Insert: Omit<JawabanSiswa, 'id'>
        Update: Partial<Omit<JawabanSiswa, 'id'>>
      }
      log_pelanggaran: {
        Row: LogPelanggaran
        Insert: Omit<LogPelanggaran, 'id' | 'created_at'>
        Update: Partial<Omit<LogPelanggaran, 'id'>>
      }
      tugas: {
        Row: Tugas
        Insert: Omit<Tugas, 'id' | 'created_at'>
        Update: Partial<Omit<Tugas, 'id'>>
      }
      pengumpulan_tugas: {
        Row: PengumpulanTugas
        Insert: Omit<PengumpulanTugas, 'id'>
        Update: Partial<Omit<PengumpulanTugas, 'id'>>
      }
      pengumuman: {
        Row: Pengumuman
        Insert: Omit<Pengumuman, 'id' | 'created_at'>
        Update: Partial<Omit<Pengumuman, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_role: {
        Args: Record<string, never>
        Returns: string
      }
      get_my_kelas_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      guru_mengajar: {
        Args: { p_mapel_id: string; p_kelas_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
  }
}

// ─────────────────────────────────────────
// Helper types untuk query dengan join
// ─────────────────────────────────────────

export type UjianWithMapel = Ujian & {
  mapel: Pick<Mapel, 'nama' | 'kode'>
  kelas: Pick<Kelas, 'nama_rombel' | 'tingkat'>
}

export type SoalWithPilihan = BankSoal & {
  mapel: Pick<Mapel, 'nama'>
}

export type SesiWithUjian = SesiSiswa & {
  ujian: Pick<Ujian, 'judul' | 'durasi_menit' | 'jenis_ujian'>
}

export type HasilLengkap = SesiSiswa & {
  ujian: UjianWithMapel
  jawaban_siswa: JawabanSiswa[]
}
