import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  MessageCircle,
  QrCode,
  UserRoundCheck,
  Wifi
} from 'lucide-react';
import { DEFAULT_KELAS } from '../services/api';

const ruleSections = [
  {
    title: 'Tanggal dan waktu pencatatan',
    icon: CalendarDays,
    points: [
      'Tanggal dan jam pencatatan presensi harian mengikuti waktu server WIB.',
      'Presensi berstatus Hadir setelah pukul 08.00 otomatis dicatat sebagai Terlambat.',
      'Setelah pukul 14.15 pada hari sekolah, siswa yang belum memiliki catatan presensi otomatis dicatat Alpa.'
    ]
  },
  {
    title: 'Presensi harian dengan QR',
    icon: QrCode,
    points: [
      `QR/barcode harus terdaftar pada data siswa kelas ${DEFAULT_KELAS}. Kode yang tidak dikenal tidak dapat dicatat.`,
      'Scan kamera, scan simulasi, dan upload foto QR mencatat Hadir sebelum pukul 08.00, atau Terlambat setelahnya.',
      'Satu siswa hanya dapat memiliki satu catatan presensi harian pada tanggal yang sama. Scan ulang tidak membuat catatan baru.'
    ]
  },
  {
    title: 'Input manual harian',
    icon: UserRoundCheck,
    points: [
      'Pilih siswa dari daftar yang tersedia; nama atau nomor QR harus cocok dengan data siswa.',
      'Status yang dapat dipilih adalah Hadir, Izin, Sakit, dan Alpa. Status Hadir yang dikirim setelah pukul 08.00 otomatis menjadi Terlambat. Petugas wajib mencentang konfirmasi sebelum menyimpan.',
      'Keterangan bersifat opsional, misalnya alasan izin atau sakit. Aturan satu catatan per siswa per tanggal tetap berlaku.'
    ]
  },
  {
    title: 'Presensi per mata pelajaran',
    icon: ClipboardCheck,
    points: [
      'Guru mencatat berdasarkan observasi langsung, memilih mata pelajaran, memeriksa status setiap siswa, lalu mengonfirmasi.',
      'Status yang tersedia adalah Hadir, Izin, Sakit, dan Alpa. Nama mata pelajaran dapat dipilih dari daftar atau diisi manual.',
      'Data siswa yang tidak terdaftar, status tidak valid, atau nomor QR yang tercantum lebih dari sekali dalam satu kiriman akan ditolak.'
    ]
  },
  {
    title: 'Makna status dan rekap',
    icon: ChartNoAxesCombined,
    points: [
      'Hadir: dicatat sebelum pukul 08.00; Terlambat: hadir setelah pukul 08.00, termasuk jika scan dilakukan setelah batas Alpa; Izin dan Sakit: ketidakhadiran dengan keterangan terkait; Alpa: belum tercatat hadir sampai batas pukul 14.15.',
      'Pada rekap periode, status Terlambat dihitung bersama Hadir. Izin, Sakit, dan Alpa dihitung pada kelompoknya masing-masing.'
    ]
  },
  {
    title: 'Notifikasi dan koneksi',
    icon: MessageCircle,
    points: [
      'Notifikasi WhatsApp wali dicoba jika nomor wali tersedia. Status notifikasi mengikuti hasil dari layanan pengiriman.',
      'Presensi harian yang terdeteksi sebagai duplikat tidak mengirim ulang notifikasi WhatsApp. Jika siswa yang sudah ditandai Alpa otomatis kemudian hadir, catatannya diperbarui menjadi Terlambat.',
      'Pencatatan memerlukan koneksi ke server pusat. Jika aplikasi menampilkan kegagalan koneksi, jangan menganggap data sudah tersimpan.'
    ]
  }
];

export const RulesView: React.FC = () => (
  <div className="mx-auto max-w-5xl space-y-6">
    <header>
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
        <BookOpen className="h-3.5 w-3.5" />
        Panduan sistem presensi
      </div>
      <h1 className="mt-3 text-2xl font-bold text-white">Aturan Kehadiran</h1>
      <p className="mt-1 text-sm text-slate-400">
        Ringkasan cara pencatatan, status, validasi, dan rekap presensi kelas {DEFAULT_KELAS}.
      </p>
    </header>

    <div className="flex items-start gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
      <p>
        <span className="font-bold">Jadwal otomatis:</span> batas waktu memakai WIB. Otomatisasi Alpa berlaku
        Senin–Jumat; pemicu Apps Script berjalan sekitar pukul 14.16–14.46. Pastikan administrator memasangnya satu
        kali. Tanggal libur dapat dikecualikan
        melalui properti Apps Script <span className="font-mono">SCHOOL_HOLIDAYS</span>. Presensi mapel tetap
        merupakan observasi terpisah dan tidak mengubah presensi harian.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      {ruleSections.map(({ title, icon: Icon, points }) => (
        <section key={title} className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-lg shadow-slate-950/20">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-sm font-bold text-slate-100">{title}</h2>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed text-slate-300">
            {points.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>

    <div className="flex items-start gap-3 rounded-2xl border border-blue-300/15 bg-blue-300/5 p-4 text-xs leading-relaxed text-slate-300">
      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
      <p>
        <Wifi className="mr-1 inline h-3.5 w-3.5 text-blue-300" />
        Hari libur tidak diketahui otomatis. Admin perlu mengisi properti Script Properties bernama
        <span className="mx-1 font-mono">SCHOOL_HOLIDAYS</span> dengan tanggal ISO dipisahkan koma, misalnya
        <span className="ml-1 font-mono">2026-12-25,2027-01-01</span>, agar tanggal libur tidak ditandai Alpa.
      </p>
    </div>
  </div>
);
