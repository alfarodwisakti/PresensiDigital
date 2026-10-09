import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ChartNoAxesCombined,
  ClipboardCheck,
  Clock3,
  MessageCircle,
  QrCode,
  RefreshCw,
  Save,
  Trash2,
  UserRoundCheck,
  Wifi
} from 'lucide-react';
import { callAPI, DEFAULT_KELAS } from '../services/api';

interface RulesViewProps {
  canManageHolidays: boolean;
}

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

export const RulesView: React.FC<RulesViewProps> = ({ canManageHolidays }) => {
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [loadingHolidays, setLoadingHolidays] = useState(true);
  const [savingHolidays, setSavingHolidays] = useState(false);
  const [holidayMessage, setHolidayMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const loadHolidays = async () => {
    setLoadingHolidays(true);
    setHolidayMessage(null);
    const response = await callAPI('getSchoolHolidays');
    if (response.success && Array.isArray(response.data) && response.data.every((date) => typeof date === 'string')) {
      setHolidayDates(response.data);
    } else {
      setHolidayMessage({
        text: response.message || 'Gagal memuat daftar libur manual. Periksa koneksi dan deployment Apps Script.',
        isError: true
      });
    }
    setLoadingHolidays(false);
  };

  useEffect(() => {
    void loadHolidays();
  }, []);

  const addHoliday = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newHolidayDate || holidayDates.includes(newHolidayDate)) return;
    setHolidayDates((current) => [...current, newHolidayDate].sort());
    setNewHolidayDate('');
    setHolidayMessage(null);
  };

  const saveHolidays = async () => {
    setSavingHolidays(true);
    setHolidayMessage(null);
    const response = await callAPI('setSchoolHolidays', { dates: holidayDates });
    if (response.success && Array.isArray(response.data)) {
      setHolidayDates(response.data);
      setHolidayMessage({ text: response.message || 'Tanggal libur berhasil disimpan.', isError: false });
    } else {
      setHolidayMessage({
        text: response.message || 'Gagal menyimpan tanggal libur. Periksa koneksi dan hak akses admin.',
        isError: true
      });
    }
    setSavingHolidays(false);
  };

  return (
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
        Senin–Jumat; pemicu Apps Script berjalan sekitar pukul 14.16–14.46. Admin dapat memasukkan tanggal libur
        manual pada halaman ini. Presensi mapel tetap
        merupakan observasi terpisah dan tidak mengubah presensi harian.
      </p>
    </div>

    <section className="rounded-2xl border border-cyan-300/20 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-100">
            <CalendarPlus className="h-5 w-5 text-cyan-300" />
            <h2 className="text-base font-bold">Libur Manual</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Tanggal libur mendadak dapat ditambahkan kapan saja. Setelah disimpan, catatan Alpa yang dibuat otomatis
            untuk tanggal tersebut juga dihapus.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadHolidays()}
          disabled={loadingHolidays || savingHolidays}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingHolidays ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </div>

      {canManageHolidays ? (
        <>
          <form onSubmit={addHoliday} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="manual-holiday-date" className="sr-only">Pilih tanggal libur</label>
            <input
              id="manual-holiday-date"
              type="date"
              required
              value={newHolidayDate}
              onChange={(event) => setNewHolidayDate(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 scheme-dark"
            />
            <button
              type="submit"
              disabled={!newHolidayDate || holidayDates.includes(newHolidayDate) || loadingHolidays || savingHolidays}
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
            >
              Tambahkan tanggal
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {loadingHolidays ? (
              <p className="text-sm text-slate-400">Memuat daftar libur dari server...</p>
            ) : holidayDates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-sm text-slate-400">
                Belum ada tanggal libur manual.
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {holidayDates.map((date) => (
                  <li key={date} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
                    <span className="text-sm font-medium text-slate-200">
                      {new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setHolidayDates((current) => current.filter((item) => item !== date));
                        setHolidayMessage(null);
                      }}
                      aria-label={`Hapus libur ${date}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-400/10 hover:text-rose-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => void saveHolidays()}
            disabled={loadingHolidays || savingHolidays}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/20 transition hover:brightness-110 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {savingHolidays ? 'Menyimpan...' : 'Simpan tanggal libur'}
          </button>
        </>
      ) : (
        <div className="mt-4 space-y-2">
          {loadingHolidays ? (
            <p className="text-sm text-slate-400">Memuat daftar libur dari server...</p>
          ) : holidayDates.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada tanggal libur manual yang didaftarkan.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {holidayDates.map((date) => (
                <li key={date} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5 text-sm text-slate-200">
                  {new Date(`${date}T12:00:00`).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">Hanya admin yang dapat mengubah daftar libur manual.</p>
        </div>
      )}

      {holidayMessage && (
        <p
          role={holidayMessage.isError ? 'alert' : 'status'}
          className={`mt-3 rounded-xl border px-3 py-2.5 text-sm ${
            holidayMessage.isError
              ? 'border-rose-300/20 bg-rose-300/10 text-rose-200'
              : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
          }`}
        >
          {holidayMessage.text}
        </p>
      )}
    </section>

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
        Libur mendadak dapat dimasukkan oleh admin pada bagian Libur Manual di atas. Jika Alpa otomatis sudah
        terlanjur dibuat, penyimpanan libur akan menghapus catatan Alpa otomatis tersebut.
      </p>
    </div>
  </div>
  );
};
