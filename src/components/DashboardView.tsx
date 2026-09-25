import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  HelpCircle, 
  XCircle, 
  QrCode, 
  BarChart3, 
  Users, 
  RefreshCw,
  Calendar,
  Sparkles,
  Search,
  WifiOff
} from 'lucide-react';
import { callAPI, formatTanggal, formatJam, DEFAULT_KELAS } from '../services/api';
import { RekapHarianData, StatusPresensi } from '../types';
import { NavTab } from './Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  userRole?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, userRole }) => {
  const [data, setData] = useState<RekapHarianData>({
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpa: 0,
    log: []
  });
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(formatJam());
  const [searchQuery, setSearchQuery] = useState('');
  const todayStr = formatTanggal();
  const isVisitor = userRole === 'Pengunjung';
  const totalToday = data.hadir + data.izin + data.sakit + data.alpa || 1;
  const hadirPct = Math.round((data.hadir / totalToday) * 100);

  const filteredLog = data.log.filter((row) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return row.nama.toLowerCase().includes(q) || row.nomorQr.toLowerCase().includes(q);
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await callAPI("getRekapHarian", { tanggal: todayStr, kelas: DEFAULT_KELAS });
      if (res.success && res.data) {
        setData(res.data);
        setSyncError(null);
      } else {
        // Jangan diam-diam tetap tampil 0 — beri tahu kalau gagal terhubung
        // ke server bersama, supaya jelas ini masalah koneksi, bukan
        // memang belum ada presensi hari ini.
        setSyncError(res.message || 'Gagal memuat data dari server.');
      }
    } catch (err) {
      console.error("Gagal memuat rekap harian:", err);
      setSyncError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const timer = setInterval(() => {
      setCurrentTime(formatJam());
    }, 1000);

    const syncTimer = setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(syncTimer);
    };
  }, []);

  const getStatusBadge = (status: StatusPresensi) => {
    switch (status) {
      case 'Hadir':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Hadir</span>;
      case 'Terlambat':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Terlambat</span>;
      case 'Izin':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Izin</span>;
      case 'Sakit':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Sakit</span>;
      case 'Alpa':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Alpa</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {syncError && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm">
          <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Tidak terhubung ke server pusat</p>
            <p className="text-xs text-rose-700 mt-0.5">{syncError} Data yang tampil mungkin tidak sinkron dengan perangkat lain sampai koneksi pulih.</p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className={`rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 ${isVisitor ? 'bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 shadow-sky-600/20' : 'bg-gradient-to-r from-blue-600 to-indigo-700 shadow-blue-600/10'}`}>
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>{isVisitor ? 'Live Update Pengunjung' : 'Presensi Harian Kelas'} {DEFAULT_KELAS}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{isVisitor ? 'Pantau Kehadiran Kelas 8.G' : 'Dashboard Presensi'}</h1>
          <p className="text-blue-100 text-sm mt-1">
            {isVisitor
              ? 'Data hadir siswa ditampilkan secara real-time agar pengunjung bisa melihat kondisi kelas dengan tampilan yang lebih informatif.'
              : 'Monitoring kehadiran siswa kelas 8.G secara real-time dan terintegrasi.'}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-3 rounded-xl shrink-0 self-start md:self-auto">
          <Calendar className="w-5 h-5 text-blue-200" />
          <div className="text-right">
            <div className="text-xs text-blue-200 font-medium">{todayStr}</div>
            <div className="text-lg font-bold font-mono tracking-wider">{currentTime}</div>
          </div>
          <button
            id="btnRefreshDashboard"
            onClick={loadData}
            title="Muat ulang data"
            className="ml-2 p-2 rounded-lg bg-white/15 hover:bg-white/25 active:scale-95 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isVisitor && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-5 shadow-lg shadow-emerald-500/20">
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-100">Persentase Hadir</div>
            <div className="mt-3 text-3xl font-black">{hadirPct}%</div>
            <div className="mt-2 text-sm text-emerald-50">Kehadiran hari ini</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Siswa Tercatat</div>
            <div className="mt-3 text-3xl font-black text-slate-800">{data.hadir + data.izin + data.sakit + data.alpa}</div>
            <div className="mt-2 text-sm text-slate-500">Catatan absensi hari ini</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</div>
            <div className="mt-3 flex items-center gap-2 text-lg font-bold text-slate-800">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Online & sinkron
            </div>
            <div className="mt-2 text-sm text-slate-500">Data terhubung dengan admin</div>
          </div>
        </div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hadir */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Hadir Hari Ini</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800">{data.hadir}</div>
          <div className="text-xs text-slate-500 mt-1">Termasuk hadir tepat waktu & terlambat</div>
        </div>

        {/* Izin */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Izin</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800">{data.izin}</div>
          <div className="text-xs text-slate-500 mt-1">Disertai keterangan izin</div>
        </div>

        {/* Sakit */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600">Sakit</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800">{data.sakit}</div>
          <div className="text-xs text-slate-500 mt-1">Surat / konfirmasi wali</div>
        </div>

        {/* Alpa */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Alpa</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-800">{data.alpa}</div>
          <div className="text-xs text-slate-500 mt-1">Tanpa keterangan</div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div>
        <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
          <span>{isVisitor ? 'Navigasi Cepat' : 'Aksi Cepat'}</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200/80 hover:border-blue-500 hover:shadow-md active:scale-98 transition text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-800 group-hover:text-blue-600 transition">
                {isVisitor ? 'Ringkasan Kehadiran' : 'Dashboard Utama'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {isVisitor ? 'Lihat statistik real-time untuk kondisi kelas hari ini.' : 'Monitoring presensi aktif dan status segera.'}
              </div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('rekap')}
            className="flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200/80 hover:border-emerald-500 hover:shadow-md active:scale-98 transition text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition flex items-center justify-center shrink-0">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-800 group-hover:text-emerald-600 transition">
                Rekap & Laporan
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Lihat grafik persentase kehadiran dan unduh laporan format Excel (.xlsx).
              </div>
            </div>
          </button>

          <button
            onClick={() => onNavigate('siswa')}
            className="flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200/80 hover:border-purple-500 hover:shadow-md active:scale-98 transition text-left group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-slate-800 group-hover:text-purple-600 transition">
                {isVisitor ? 'Data Kelas' : 'Kelola Data Siswa'}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {isVisitor ? 'Informasi siswa dan status kehadiran yang selalu terupdate.' : 'Tambah, ubah, hapus, dan cetak kartu barcode identitas siswa.'}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Presensi Table */}
      <div className={`rounded-xl border overflow-hidden ${isVisitor ? 'bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 border-sky-400/30 shadow-[0_20px_45px_rgba(14,165,233,0.12)]' : 'bg-white border-slate-200/80 shadow-xs'}`}>
        <div className={`p-5 border-b ${isVisitor ? 'border-sky-400/20 bg-sky-500/5' : 'border-slate-100'} flex flex-col md:flex-row md:items-center justify-between gap-3`}>
          <div>
            <h2 className={`text-base font-bold ${isVisitor ? 'text-sky-50' : 'text-slate-800'}`}>
              {isVisitor ? 'Pencarian Kehadiran Siswa' : 'Presensi Terbaru Hari Ini'}
            </h2>
            <p className={`text-xs mt-0.5 ${isVisitor ? 'text-sky-100/80' : 'text-slate-500'}`}>
              {isVisitor ? 'Cari siswa berdasarkan nama atau nomor QR untuk melihat kehadiran hari ini.' : 'Daftar siswa yang telah melakukan presensi sesi hari ini'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isVisitor && (
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-sky-200 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama / nomor QR..."
                  className="w-full bg-white/10 border border-sky-300/20 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-sky-100/70 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                />
              </div>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isVisitor ? 'bg-sky-500/15 text-sky-100 border border-sky-300/20' : 'bg-slate-100 text-slate-600'}`}>
              {filteredLog.length} Catatan
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`${isVisitor ? 'bg-sky-500/10 text-sky-100' : 'bg-slate-50 text-slate-500'} font-semibold border-b ${isVisitor ? 'border-sky-400/20' : 'border-slate-200/60'} text-xs`}>
                <th className="py-3 px-4">Jam</th>
                <th className="py-3 px-4">Nomor QR</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Metode</th>
              </tr>
            </thead>
            <tbody className={`${isVisitor ? 'divide-y divide-sky-400/10 text-sky-50' : 'divide-y divide-slate-100'}`}>
              {filteredLog.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`py-10 text-center ${isVisitor ? 'text-sky-200/80' : 'text-slate-400'} text-sm`}>
                    <HelpCircle className={`w-8 h-8 mx-auto mb-2 ${isVisitor ? 'text-sky-300/70' : 'text-slate-300'}`} />
                    {searchQuery ? 'Tidak ada siswa yang cocok dengan pencarian ini.' : 'Belum ada presensi yang tercatat untuk hari ini.'}
                  </td>
                </tr>
              ) : (
                filteredLog.map((row, idx) => (
                  <tr key={idx} className={isVisitor ? 'hover:bg-sky-500/5 transition' : 'hover:bg-slate-50/70 transition'}>
                    <td className={`py-3 px-4 font-mono text-xs font-medium ${isVisitor ? 'text-sky-100' : 'text-slate-600'}`}>{row.jam}</td>
                    <td className={`py-3 px-4 font-mono text-xs font-semibold ${isVisitor ? 'text-cyan-300' : 'text-blue-600'}`}>{row.nomorQr}</td>
                    <td className={`py-3 px-4 font-semibold ${isVisitor ? 'text-white' : 'text-slate-800'}`}>{row.nama}</td>
                    <td className="py-3 px-4">{getStatusBadge(row.status)}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${isVisitor ? 'text-sky-100 bg-sky-500/10 border border-sky-400/20' : 'text-slate-500 bg-slate-100'}`}>
                        {row.metode}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
