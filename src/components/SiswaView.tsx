import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit3, 
  Trash2, 
  Download,
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Sparkles,
  QrCode
} from 'lucide-react';
import { callAPI, DEFAULT_KELAS } from '../services/api';
import { Siswa } from '../types';

export const SiswaView: React.FC = () => {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [nomorQr, setNomorQr] = useState('');
  const [nama, setNama] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<Siswa | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Random Caller
  const [randomPick, setRandomPick] = useState<Siswa | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSiswa = async () => {
    setLoading(true);
    try {
      const res = await callAPI("getDaftarSiswa", { kelas: DEFAULT_KELAS });
      if (res.success && Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a, b) => a.nama.localeCompare(b.nama, "id"));
        setSiswaList(sorted);
      } else {
        showToast(res.message || "Gagal memuat data siswa", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSiswa();
  }, []);

  // Update SVG barcode whenever print modal opens

  // Handle Submit (Tambah / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanQr = nomorQr.trim();
    const cleanNama = nama.trim();

    if (!cleanQr || !cleanNama) {
      setFormError('Nomor QR dan Nama Lengkap wajib diisi.');
      return;
    }

    if (/\s/.test(cleanQr)) {
      setFormError('Nomor QR tidak boleh mengandung spasi.');
      return;
    }

    // Check duplicate if adding
    if (!isEditing) {
      const exists = siswaList.some(s =>
        s.nomorQr.toLowerCase() === cleanQr.toLowerCase()
      );
      if (exists) {
        setFormError('Nomor QR ini sudah terdaftar untuk siswa lain.');
        return;
      }
    }

    setSaving(true);
    try {
      const action = isEditing ? "editSiswa" : "tambahSiswa";
      const res = await callAPI(action, {
        nomorQr: cleanQr,
        barcode: cleanQr,
        nama: cleanNama,
        kelas: DEFAULT_KELAS
      });

      if (res.success) {
        showToast(isEditing ? `Data ${cleanNama} berhasil diperbarui!` : `Siswa ${cleanNama} berhasil ditambahkan!`);
        resetForm();
        loadSiswa();
      } else {
        setFormError(res.message || 'Gagal menyimpan data.');
      }
    } catch {
      setFormError('Terjadi kesalahan saat menghubungi server.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: Siswa) => {
    setNomorQr(s.nomorQr);
    setNama(s.nama);
    setIsEditing(true);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setNomorQr('');
    setNama('');
    setIsEditing(false);
    setFormError('');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await callAPI("hapusSiswa", {
        nomorQr: deleteTarget.nomorQr,
        kelas: DEFAULT_KELAS
      });

      if (res.success) {
        showToast(`Data ${deleteTarget.nama} berhasil dihapus.`);
        setDeleteTarget(null);
        loadSiswa();
      } else {
        showToast(res.message || "Gagal menghapus siswa.", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handlePanggilAcak = () => {
    if (siswaList.length === 0) {
      setRandomPick(null);
      showToast("Belum ada data siswa yang bisa dipanggil.", "error");
      return;
    }

    const nextPick = siswaList[Math.floor(Math.random() * siswaList.length)];
    setRandomPick(nextPick);
    showToast(`Dipanggil: ${nextPick.nama}`, "success");
  };

  const handleDownloadBarcode = async (student: Siswa) => {
    const imageUrl = getTemplateImage(student);
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('Gagal mengambil gambar barcode');
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${student.nama.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      showToast(`Barcode ${student.nama} berhasil diunduh.`);
    } catch {
      showToast('Gagal mengunduh barcode.', 'error');
    }
  };

  const filtered = siswaList.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.nama.toLowerCase().includes(q) || s.nomorQr.toLowerCase().includes(q);
  });

  const getTemplateImage = (student: Siswa) => {
    const indexInList = siswaList.findIndex((s) => s.nomorQr === student.nomorQr);
    const selectedNumber = ((indexInList >= 0 ? indexInList : 0) % 32) + 1;
    return `/brcode/${selectedNumber}.png`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-bounce-short ${
          toast.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Data Siswa Kelas {DEFAULT_KELAS}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manajemen database siswa, kartu barcode, dan nomor QR identitas</p>
        </div>

        <button
          onClick={loadSiswa}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Random Caller Card */}
      <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-2xl p-5 text-white shadow-lg shadow-orange-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] font-bold text-orange-100">Pemanggilan acak</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight">
              {randomPick ? randomPick.nama : 'Belum ada siswa dipilih'}
            </h2>
            <p className="mt-1 text-sm text-orange-50/90">
              {randomPick
                ? `Nomor QR: ${randomPick.nomorQr} • Kelas ${randomPick.kelas}`
                : 'Tekan tombol untuk memilih satu siswa secara acak.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePanggilAcak}
              className="bg-white text-orange-600 hover:bg-orange-50 font-bold px-4 py-2.5 rounded-xl text-sm shadow-md active:scale-98 transition"
            >
              {randomPick ? 'Panggil Lagi' : 'Panggil Siswa'}
            </button>
            {randomPick && (
              <button
                type="button"
                onClick={() => setRandomPick(null)}
                className="bg-orange-900/20 hover:bg-orange-900/30 border border-white/30 text-white font-semibold px-3 py-2.5 rounded-xl text-sm transition"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Tambah / Edit Siswa */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
            {isEditing ? <Edit3 className="w-4 h-4 text-blue-600" /> : <UserPlus className="w-4 h-4 text-blue-600" />}
            <span>{isEditing ? `Edit Siswa — ${nama}` : 'Tambah Siswa Baru'}</span>
          </div>

          {isEditing && (
            <button
              onClick={resetForm}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Batal Edit
            </button>
          )}
        </div>

        {formError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor QR / NISN
              </label>
              <input
                type="text"
                placeholder="Contoh: 2408001"
                value={nomorQr}
                disabled={isEditing}
                onChange={(e) => setNomorQr(e.target.value)}
                className="w-full bg-slate-50 disabled:bg-slate-100 text-slate-800 disabled:text-slate-400 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Kode identitas utama</span>
            </div>

            <div className="sm:col-span-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap Siswa
              </label>
              <input
                type="text"
                placeholder="Nama lengkap siswa"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Sesuai data rapor sekolah</span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kelas
              </label>
              <input
                type="text"
                value={DEFAULT_KELAS}
                readOnly
                className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold cursor-not-allowed"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">{DEFAULT_KELAS}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-md shadow-blue-600/20 active:scale-98"
            >
              {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Tambah Siswa'}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2.5 rounded-xl text-sm transition"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-sm text-slate-800">Daftar Siswa Terdaftar</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {filtered.length} Siswa
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Cari nama atau nomor QR..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-1.5 pl-8 text-xs focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/60 text-xs">
                <th className="py-3 px-4">Nomor QR</th>
                <th className="py-3 px-4">Nama Siswa</th>
                <th className="py-3 px-4">Kelas</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Memuat data siswa...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                    Tidak ada data siswa yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.nomorQr} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-600">{s.nomorQr}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{s.nama}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {s.kelas}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleEdit(s)}
                          title="Edit Siswa"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-blue-600 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          title="Hapus Siswa"
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadBarcode(s)}
                          title="Unduh Kartu Barcode"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Hapus Data Siswa?</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">
              Apakah Anda yakin ingin menghapus data siswa <strong className="text-slate-800">{deleteTarget.nama}</strong> (Nomor: {deleteTarget.nomorQr})? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-md shadow-rose-600/20"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Siswa'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
