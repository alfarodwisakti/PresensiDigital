import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { callAPI, formatTanggal, formatJam, DEFAULT_KELAS } from '../services/api';
import { Siswa, StatusPresensi } from '../types';

interface PresensiMapelViewProps {
  guruNama: string;
}

interface RowState {
  nomorQr: string;
  nama: string;
  status: StatusPresensi;
  keterangan: string;
}

const DAFTAR_MAPEL = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'Ilmu Pengetahuan Alam (IPA)',
  'Ilmu Pengetahuan Sosial (IPS)',
  'Pendidikan Pancasila',
  'Pendidikan Agama',
  'Seni Budaya',
  'Pendidikan Jasmani (PJOK)',
  'Prakarya',
  'Informatika',
  'Bahasa Daerah / Muatan Lokal',
  'Lainnya (isi manual)'
];

const STATUS_OPTIONS: { value: StatusPresensi; label: string; activeClass: string }[] = [
  { value: 'Hadir', label: 'Hadir', activeClass: 'bg-emerald-600 border-emerald-600 text-white' },
  { value: 'Izin', label: 'Izin', activeClass: 'bg-blue-600 border-blue-600 text-white' },
  { value: 'Sakit', label: 'Sakit', activeClass: 'bg-purple-600 border-purple-600 text-white' },
  { value: 'Alpa', label: 'Alpa', activeClass: 'bg-rose-600 border-rose-600 text-white' }
];

export const PresensiMapelView: React.FC<PresensiMapelViewProps> = ({ guruNama }) => {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(true);

  const [mapelPilihan, setMapelPilihan] = useState(DAFTAR_MAPEL[0]);
  const [mapelManual, setMapelManual] = useState('');

  const [rows, setRows] = useState<RowState[]>([]);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notif, setNotif] = useState<{ message: string; isError: boolean } | null>(null);

  const mapelAktif = mapelPilihan === 'Lainnya (isi manual)' ? mapelManual.trim() : mapelPilihan;

  useEffect(() => {
    const loadStudents = async () => {
      setLoadingSiswa(true);
      const res = await callAPI('getDaftarSiswa', { kelas: DEFAULT_KELAS });
      if (res.success && Array.isArray(res.data)) {
        setSiswaList(res.data);
        setRows(
          res.data.map((s: Siswa) => ({
            nomorQr: s.nomorQr,
            nama: s.nama,
            status: 'Hadir' as StatusPresensi,
            keterangan: ''
          }))
        );
      }
      setLoadingSiswa(false);
    };
    loadStudents();
  }, []);

  const rekapCepat = useMemo(() => {
    const count = { Hadir: 0, Izin: 0, Sakit: 0, Alpa: 0 } as Record<string, number>;
    rows.forEach((r) => {
      count[r.status] = (count[r.status] || 0) + 1;
    });
    return count;
  }, [rows]);

  const setStatusRow = (nomorQr: string, status: StatusPresensi) => {
    setConfirmChecked(false);
    setRows((prev) => prev.map((r) => (r.nomorQr === nomorQr ? { ...r, status } : r)));
  };

  const setKeteranganRow = (nomorQr: string, keterangan: string) => {
    setRows((prev) => prev.map((r) => (r.nomorQr === nomorQr ? { ...r, keterangan } : r)));
  };

  const tandaiSemuaHadir = () => {
    setConfirmChecked(false);
    setRows((prev) => prev.map((r) => ({ ...r, status: 'Hadir' as StatusPresensi })));
  };

  const handleSubmit = async () => {
    if (!mapelAktif) {
      setNotif({ message: 'Pilih atau isi nama mata pelajaran terlebih dahulu.', isError: true });
      return;
    }
    if (rows.length === 0) {
      setNotif({ message: 'Belum ada data siswa yang dimuat.', isError: true });
      return;
    }
    if (!confirmChecked) {
      setNotif({ message: 'Centang konfirmasi validasi kehadiran sebelum menyimpan.', isError: true });
      return;
    }

    setSubmitting(true);
    setNotif(null);

    const res = await callAPI('simpanPresensiMapel', {
      mapel: mapelAktif,
      guru: guruNama,
      kelas: DEFAULT_KELAS,
      tanggal: formatTanggal(),
      jam: formatJam(),
      records: rows.map((r) => ({
        nomorQr: r.nomorQr,
        status: r.status,
        keterangan: r.keterangan
      }))
    });

    setSubmitting(false);

    if (res.success) {
      setNotif({ message: `✅ ${res.message || 'Presensi mapel tersimpan.'}`, isError: false });
      setConfirmChecked(false);
    } else {
      setNotif({ message: `⚠️ ${res.message || 'Gagal menyimpan presensi mapel.'}`, isError: true });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-blue-600" />
          Presensi Per Mata Pelajaran
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Isi kehadiran berdasarkan observasi langsung di kelas, lalu konfirmasi sebagai guru mapel.
        </p>
      </div>

      {/* Pilih Mapel */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Mata Pelajaran
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <select
            value={mapelPilihan}
            onChange={(e) => {
              setMapelPilihan(e.target.value);
              setConfirmChecked(false);
            }}
            className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
          >
            {DAFTAR_MAPEL.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {mapelPilihan === 'Lainnya (isi manual)' && (
            <input
              type="text"
              value={mapelManual}
              onChange={(e) => {
                setMapelManual(e.target.value);
                setConfirmChecked(false);
              }}
              placeholder="Ketik nama mata pelajaran..."
              className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          Guru: <span className="font-semibold text-slate-600">{guruNama}</span> • Kelas {DEFAULT_KELAS} • Tanggal {formatTanggal()}
        </p>
      </div>

      {/* Tabel Siswa */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <span>{rows.length} Siswa</span>
            <span className="text-emerald-600">Hadir {rekapCepat.Hadir || 0}</span>
            <span className="text-blue-600">Izin {rekapCepat.Izin || 0}</span>
            <span className="text-purple-600">Sakit {rekapCepat.Sakit || 0}</span>
            <span className="text-rose-600">Alpa {rekapCepat.Alpa || 0}</span>
          </div>
          <button
            type="button"
            onClick={tandaiSemuaHadir}
            disabled={loadingSiswa || rows.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 disabled:opacity-40 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Tandai Semua Hadir
          </button>
        </div>

        {loadingSiswa ? (
          <div className="p-10 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data siswa...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            Belum ada data siswa. Tambahkan siswa di menu Data Siswa terlebih dahulu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
                  <th className="px-4 py-2.5 w-10">No</th>
                  <th className="px-4 py-2.5">Nama Siswa</th>
                  <th className="px-4 py-2.5">Status Kehadiran</th>
                  <th className="px-4 py-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, idx) => (
                  <tr key={r.nomorQr}>
                    <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">{r.nama}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setStatusRow(r.nomorQr, opt.value)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                              r.status === opt.value
                                ? opt.activeClass
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="text"
                        value={r.keterangan}
                        onChange={(e) => setKeteranganRow(r.nomorQr, e.target.value)}
                        placeholder={r.status === 'Hadir' ? '-' : 'Contoh: demam, ada acara keluarga...'}
                        className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Konfirmasi & Simpan */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start gap-3 text-sm text-slate-700">
            <input
              id="mapelConfirmCheckbox"
              type="checkbox"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="mapelConfirmCheckbox" className="leading-relaxed">
              Saya, <span className="font-semibold">{guruNama}</span>, menyatakan data kehadiran mata pelajaran{' '}
              <span className="font-semibold">{mapelAktif || '(belum dipilih)'}</span> di atas sudah sesuai hasil
              observasi langsung di kelas dan siap dikonfirmasi sebagai data valid.
            </label>
          </div>
        </div>

        {notif && (
          <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-semibold ${
            notif.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}>
            {notif.isError ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{notif.message}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || loadingSiswa || rows.length === 0}
          className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-blue-600/20 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan Presensi Mapel...
            </>
          ) : (
            <>
              <ClipboardCheck className="w-4 h-4" /> Konfirmasi & Simpan Presensi Mapel
            </>
          )}
        </button>
      </div>
    </div>
  );
};
