export interface Siswa {
  nomorQr: string;
  barcode?: string;
  nama: string;
  kelas: string;
  email?: string;
  noOrtu?: string;
}

export type StatusPresensi = 'Hadir' | 'Terlambat' | 'Izin' | 'Sakit' | 'Alpa';
export type MetodePresensi = 'Scan' | 'Manual' | 'Otomatis' | 'Observasi';

export interface PresensiRecord {
  id: string;
  tanggal: string; // Format: dd/mm/yyyy atau yyyy-mm-dd
  jam: string;     // Format: HH:mm:ss atau HH:mm
  nomorQr: string;
  nama: string;
  kelas: string;
  status: StatusPresensi;
  metode: MetodePresensi;
  keterangan: string;
  mapel?: string;
  guru?: string;
}

export interface UserSession {
  username: string;
  nama: string;
  role: string;
  token: string;
  email?: string;
  provider?: 'local' | 'supabase';
}

export interface RekapHarianData {
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  log: Array<{
    jam: string;
    nomorQr: string;
    nama: string;
    status: StatusPresensi;
    metode: MetodePresensi;
  }>;
}

export interface SiswaRekapStat {
  nomorQr: string;
  nama: string;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  persenHadir: number;
}

export interface RekapPeriodeData {
  totalHadir: number;
  totalIzin: number;
  totalSakit: number;
  totalAlpa: number;
  perSiswa: SiswaRekapStat[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  nama?: string;
  status?: StatusPresensi;
  username?: string;
  role?: string;
  token?: string;
  email?: string;
  provider?: 'local' | 'supabase';
  noOrtu?: string;
  saved?: number;
  skipped?: string[];
  duplicate?: boolean;
  offline?: boolean;
}
