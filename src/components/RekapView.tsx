import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  HelpCircle,
  XCircle,
  FileSpreadsheet,
  WifiOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { callAPI, DEFAULT_KELAS } from '../services/api';
import { RekapPeriodeData, SiswaRekapStat } from '../types';

interface RekapViewProps {
  userRole?: string;
}

export const RekapView: React.FC<RekapViewProps> = ({ userRole }) => {
  const formatDateInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);

  const [tglMulai, setTglMulai] = useState(formatDateInput(weekAgo));
  const [tglSelesai, setTglSelesai] = useState(formatDateInput(today));
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<RekapPeriodeData>({
    totalHadir: 0,
    totalIzin: 0,
    totalSakit: 0,
    totalAlpa: 0,
    perSiswa: []
  });

  const loadRekap = async () => {
    setLoading(true);
    try {
      const res = await callAPI("getRekapPeriode", {
        mulai: tglMulai,
        selesai: tglSelesai,
        kelas: DEFAULT_KELAS
      });

      if (res.success && res.data) {
        setData(res.data);
        setSyncError(null);
      } else {
        setSyncError(res.message || 'Gagal memuat data dari server.');
      }
    } catch (err) {
      console.error("Gagal memuat rekap:", err);
      setSyncError('Gagal terhubung ke server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRekap();

    const syncTimer = setInterval(() => {
      loadRekap();
    }, 15000);

    return () => clearInterval(syncTimer);
  }, [tglMulai, tglSelesai]);

  // Quick Date Presets
  const setPreset = (type: 'today' | '7days' | 'month') => {
    const now = new Date();
    if (type === 'today') {
      setTglMulai(formatDateInput(now));
      setTglSelesai(formatDateInput(now));
    } else if (type === '7days') {
      const past = new Date();
      past.setDate(now.getDate() - 6);
      setTglMulai(formatDateInput(past));
      setTglSelesai(formatDateInput(now));
    } else if (type === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setTglMulai(formatDateInput(startOfMonth));
      setTglSelesai(formatDateInput(now));
    }
  };

  const exportToExcel = async () => {
    if (!data.perSiswa || data.perSiswa.length === 0) {
      alert("Tidak ada data untuk diekspor. Silakan tampilkan rekap terlebih dahulu.");
      return;
    }

    try {
      const sheetName = tglMulai === tglSelesai ? 'REKAP HARIAN' : 'REKAP MINGGUAN';
      const response = await fetch('/PRESENSI DIGITAL.xlsx');
      if (!response.ok) {
        throw new Error('Template Excel tidak ditemukan.');
      }

      const buffer = await response.arrayBuffer();
      const templateWb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const ws = templateWb.Sheets[sheetName];
      if (!ws) {
        throw new Error('Sheet rekap tidak ditemukan di template Excel.');
      }

      const reportRows = filteredStudents.length > 0 ? filteredStudents : data.perSiswa;

      if (sheetName === 'REKAP HARIAN') {
        const dateLabel = `${tglMulai}`;
        ws.A5 = { t: 's', v: 'Hari/Tanggal:' };
        ws.B5 = { t: 's', v: dateLabel };

        reportRows.forEach((s, index) => {
          const rowNum = index + 9;
          const rowRef = rowNum.toString();
          ws[`A${rowRef}`] = { t: 'n', v: index + 1 };
          ws[`B${rowRef}`] = { t: 's', v: s.nama };
          ws[`C${rowRef}`] = { t: 's', v: DEFAULT_KELAS };
          ws[`D${rowRef}`] = { t: 'n', v: s.hadir };
          ws[`E${rowRef}`] = { t: 'n', v: s.izin };
          ws[`F${rowRef}`] = { t: 'n', v: s.sakit };
          ws[`G${rowRef}`] = { t: 'n', v: s.alpa };
          ws[`H${rowRef}`] = { t: 'n', v: s.persenHadir };
          ws[`I${rowRef}`] = { t: 's', v: s.persenHadir < 75 ? 'Perlu Perhatian (<75%)' : 'Baik' };
        });
      } else {
        const dates = [] as string[];
        const start = new Date(`${tglMulai}T00:00:00`);
        const end = new Date(`${tglSelesai}T00:00:00`);
        const cursor = new Date(start);
        while (cursor <= end) {
          const y = cursor.getFullYear();
          const m = String(cursor.getMonth() + 1).padStart(2, '0');
          const d = String(cursor.getDate()).padStart(2, '0');
          dates.push(`${y}-${m}-${d}`);
          cursor.setDate(cursor.getDate() + 1);
        }

        // Template REKAP MINGGUAN hanya punya 5 slot kolom tanggal (D:G, H:K,
        // L:O, P:S, T:W). Kalau rentang tanggal yang dipilih lebih dari 5 hari,
        // potong ke 5 pertama supaya tidak menimpa kolom %Kehadiran/Status Evaluasi.
        const dateColumns = dates.slice(0, 5);
        if (dates.length > 5) {
          alert(`Rentang tanggal yang dipilih (${dates.length} hari) melebihi kapasitas template mingguan (maks. 5 hari). Hanya 5 tanggal pertama yang akan diisi.`);
        }

        // Baris pada template: 9 = header utama, 10 = "(Hari/Tanggal)" per
        // kelompok kolom, 11 = sub-header Hadir/Izin/Sakit/Alpa (sudah ada di
        // template, tidak perlu ditulis ulang), 12 = data siswa pertama.
        const labelRow = 10;
        const startRow = 12;

        // Ambil data presensi ASLI per tanggal dari server (bukan cuma total),
        // supaya tiap kolom tanggal berisi tanda kehadiran harian yang benar.
        const dailyStatusByDate: Record<string, Record<string, string>> = {};
        for (const date of dateColumns) {
          const res = await callAPI('getRekapHarian', { tanggal: date, kelas: DEFAULT_KELAS });
          const map: Record<string, string> = {};
          if (res.success && res.data && Array.isArray(res.data.log)) {
            res.data.log.forEach((entry: any) => {
              map[entry.nomorQr] = entry.status;
            });
          }
          dailyStatusByDate[date] = map;
        }

        // Setiap grup tanggal lebarnya 4 kolom (Hadir/Izin/Sakit/Alpa) dan
        // berurutan langsung tanpa jarak, jadi kelipatannya 4 (bukan 5).
        const firstGroupStart = 3; // kolom D (0-indexed)
        dateColumns.forEach((date, idx) => {
          const groupStart = firstGroupStart + idx * 4;
          const cellKeyDate = XLSX.utils.encode_cell({ c: groupStart, r: labelRow - 1 });
          ws[cellKeyDate] = { t: 's', v: date };
        });

        reportRows.forEach((s, index) => {
          const rowNum = startRow + index;
          ws[`A${rowNum}`] = { t: 'n', v: index + 1 };
          ws[`B${rowNum}`] = { t: 's', v: s.nama };
          ws[`C${rowNum}`] = { t: 's', v: DEFAULT_KELAS };
          ws[`X${rowNum}`] = { t: 'n', v: s.persenHadir };
          ws[`Y${rowNum}`] = { t: 's', v: s.persenHadir < 75 ? 'Perlu Perhatian (<75%)' : 'Baik' };

          dateColumns.forEach((date, idx) => {
            const groupStart = firstGroupStart + idx * 4;
            const statusHariItu = dailyStatusByDate[date]?.[s.nomorQr];
            const tandai = (offset: number, cocok: boolean) => {
              ws[XLSX.utils.encode_cell({ c: groupStart + offset, r: rowNum - 1 })] = { t: 'n', v: cocok ? 1 : 0 };
            };
            tandai(0, statusHariItu === 'Hadir' || statusHariItu === 'Terlambat');
            tandai(1, statusHariItu === 'Izin');
            tandai(2, statusHariItu === 'Sakit');
            tandai(3, statusHariItu === 'Alpa');
          });
        });
      }

      const fileName = `Rekap-Presensi-${sheetName === 'REKAP HARIAN' ? 'Harian' : 'Mingguan'}_${tglMulai}${sheetName === 'REKAP HARIAN' ? '' : `-sd-${tglSelesai}`}.xlsx`;
      XLSX.writeFile(templateWb, fileName);
    } catch (error) {
      console.error('Gagal export template Excel:', error);
      alert('Gagal mengekspor file sesuai template Excel. Silakan coba lagi.');
    }
  };

  const filteredStudents = data.perSiswa.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.nama.toLowerCase().includes(q) || s.nomorQr.toLowerCase().includes(q);
  });

  const totalLogs = data.totalHadir + data.totalIzin + data.totalSakit + data.totalAlpa;
  const persenHadirOverall = totalLogs > 0 ? Math.round((data.totalHadir / totalLogs) * 100) : 0;
  const isVisitor = userRole === 'Pengunjung';

  const getStatusPill = (persen: number) => {
    if (persen < 75) {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">Perlu Perhatian</span>;
    }
    if (persen < 90) {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">Cukup Baik</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Sangat Baik</span>;
  };

  const isSingleDay = tglMulai === tglSelesai;

  const reportRows = filteredStudents.length > 0 ? filteredStudents : data.perSiswa;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {syncError && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm">
          <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Tidak terhubung ke server pusat</p>
            <p className="text-xs text-rose-700 mt-0.5">{syncError} Rekap yang tampil mungkin tidak sinkron dengan perangkat lain sampai koneksi pulih.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-bold">Laporan Presensi</div>
            <h1 className="text-2xl font-black text-slate-800 mt-1">{isVisitor ? 'Rekap Kehadiran Publik' : 'REKAP PRESENSI DIGITAL 8.G'}</h1>
            <p className="text-xs text-slate-500 mt-1">{isVisitor ? 'Pantau perkembangan kehadiran kelas 8.G secara transparan dan mudah dibaca.' : 'Periode ' + tglMulai + ' sampai ' + tglSelesai}</p>
          </div>

          <button
            id="btnExportExcel"
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-md shadow-emerald-600/20 self-start lg:self-auto"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isVisitor ? 'Unduh Ringkasan' : 'Export Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Filter Periode Tanggal</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPreset('today')}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Hari Ini
            </button>
            <button
              onClick={() => setPreset('7days')}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => setPreset('month')}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Bulan Ini
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4">
            <label className="block text-xs font-bold text-slate-600 mb-1">Dari Tanggal</label>
            <input
              id="inputTglMulai"
              type="date"
              value={tglMulai}
              onChange={(e) => setTglMulai(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-bold text-slate-600 mb-1">Sampai Tanggal</label>
            <input
              id="inputTglSelesai"
              type="date"
              value={tglSelesai}
              onChange={(e) => setTglSelesai(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
            />
          </div>

          <div className="sm:col-span-4 flex gap-2">
            <button
              id="btnFilterRekap"
              onClick={loadRekap}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-xs flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{loading ? 'Memuat Data...' : 'Tampilkan Rekap'}</span>
            </button>
          </div>
        </div>
      </div>

      {isVisitor && (
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
          <div className="text-xs uppercase tracking-[0.2em] text-emerald-100">Kondisi Hari Ini</div>
          <div className="mt-3 text-3xl font-black">{persenHadirOverall}%</div>
          <div className="mt-2 text-sm text-emerald-50">Rata-rata kehadiran siswa kelas {DEFAULT_KELAS}</div>
        </div>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Hadir
          </div>
          <div className="text-3xl font-black text-slate-800">{data.totalHadir}</div>
          <div className="text-[11px] text-slate-500 mt-1">Kehadiran tercatat</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 mb-2 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Izin
          </div>
          <div className="text-3xl font-black text-slate-800">{data.totalIzin}</div>
          <div className="text-[11px] text-slate-500 mt-1">Izin terkonfirmasi</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-600 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Sakit
          </div>
          <div className="text-3xl font-black text-slate-800">{data.totalSakit}</div>
          <div className="text-[11px] text-slate-500 mt-1">Keterangan sakit</div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600 mb-2 flex items-center gap-1.5">
            <XCircle className="w-4 h-4" /> Alpa
          </div>
          <div className="text-3xl font-black text-slate-800">{data.totalAlpa}</div>
          <div className="text-[11px] text-slate-500 mt-1">Tanpa keterangan</div>
        </div>
      </div>

      {/* Visual Chart Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Distribusi Kehadiran Kelas {DEFAULT_KELAS}</h2>
            <p className="text-xs text-slate-500">Persentase rata-rata kehadiran: <span className="font-bold text-blue-600">{persenHadirOverall}%</span></p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {totalLogs} Total Catatan
          </span>
        </div>

        {/* Progress Bar Breakdown */}
        {totalLogs > 0 ? (
          <div className="space-y-3">
            <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner">
              {data.totalHadir > 0 && (
                <div 
                  style={{ width: `${(data.totalHadir / totalLogs) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Hadir: ${data.totalHadir}`}
                />
              )}
              {data.totalIzin > 0 && (
                <div 
                  style={{ width: `${(data.totalIzin / totalLogs) * 100}%` }}
                  className="bg-blue-500 h-full transition-all"
                  title={`Izin: ${data.totalIzin}`}
                />
              )}
              {data.totalSakit > 0 && (
                <div 
                  style={{ width: `${(data.totalSakit / totalLogs) * 100}%` }}
                  className="bg-purple-500 h-full transition-all"
                  title={`Sakit: ${data.totalSakit}`}
                />
              )}
              {data.totalAlpa > 0 && (
                <div 
                  style={{ width: `${(data.totalAlpa / totalLogs) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Alpa: ${data.totalAlpa}`}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Hadir ({Math.round((data.totalHadir / totalLogs) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>Izin ({Math.round((data.totalIzin / totalLogs) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-purple-500" />
                <span>Sakit ({Math.round((data.totalSakit / totalLogs) * 100)}%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span>Alpa ({Math.round((data.totalAlpa / totalLogs) * 100)}%)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">
            Tidak ada catatan kehadiran pada periode tanggal yang dipilih.
          </div>
        )}
      </div>

      {/* Rekap per Siswa Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.12em]">Tabel Rekap Kehadiran</h2>
            <p className="text-xs text-slate-500">Siswa dengan kehadiran di bawah 75% ditandai khusus</p>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-1.5 pl-8 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200 text-[11px] uppercase tracking-[0.12em]">
                <th className="py-3 px-4 border-b border-slate-200 text-center">No</th>
                <th className="py-3 px-4 border-b border-slate-200">Nama Siswa</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Nomor QR</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Hadir</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Izin</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Sakit</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Alpa</th>
                <th className="py-3 px-4 border-b border-slate-200 text-right">% Kehadiran</th>
                <th className="py-3 px-4 border-b border-slate-200 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400 text-xs">
                    <HelpCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    Tidak ada data siswa yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, index) => {
                  const isLow = s.persenHadir < 75;
                  return (
                    <tr 
                      key={s.nomorQr} 
                      className={`hover:bg-slate-50/80 transition ${isLow ? 'bg-rose-50/40' : ''}`}
                    >
                      <td className="py-3 px-4 text-center text-slate-600 font-semibold border-b border-slate-100">{index + 1}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span>{s.nama}</span>
                          {isLow && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">
                              &lt;75%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-blue-600 border-b border-slate-100">{s.nomorQr}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600 border-b border-slate-100">{s.hadir}</td>
                      <td className="py-3 px-4 text-center text-slate-600 border-b border-slate-100">{s.izin}</td>
                      <td className="py-3 px-4 text-center text-slate-600 border-b border-slate-100">{s.sakit}</td>
                      <td className="py-3 px-4 text-center font-bold text-rose-600 border-b border-slate-100">{s.alpa}</td>
                      <td className="py-3 px-4 text-right border-b border-slate-100">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-black text-xs ${
                          isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {s.persenHadir}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center border-b border-slate-100">{getStatusPill(s.persenHadir)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
