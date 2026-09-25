import React, { useState } from 'react';
import { 
  Settings, 
  Link2, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Copy, 
  Check, 
  FileCode, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { getApiUrl, setApiUrl, resetApiUrl, resetDatabaseToDefault, DEFAULT_KELAS } from '../services/api';

export const SettingsView: React.FC = () => {
  const [url, setUrl] = useState(getApiUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setApiUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleResetUrl = () => {
    resetApiUrl();
    setUrl(getApiUrl());
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "login", username: "test", password: "test" })
      });

      const contentType = res.headers.get("content-type") || "";
      let message = "Koneksi ke Google Apps Script berhasil terhubung!";

      if (!res.ok) {
        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          // keep raw text as fallback
        }
        message = parsed?.message || `Server mengembalikan status HTTP ${res.status}. Pastikan URL Web App benar, spreadsheet aktif, dan akses diatur ke 'Anyone'.`;
        setTestResult({ success: false, message });
        return;
      }

      if (contentType.includes("application/json")) {
        const json = await res.json();
        if (!json.success) {
          message = json.message || message;
        }
      }

      setTestResult({ success: true, message });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Tidak dapat terhubung ke Google Apps Script. Periksa URL Web App, spreadsheet, dan setelan akses 'Anyone'. Detail: ${err?.message || "Unknown error"}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetData = () => {
    if (confirm("Reset seluruh data presensi lokal dan muat ulang 15 siswa default kelas 8.G?")) {
      resetDatabaseToDefault();
      alert("Database lokal telah di-reset ke data default kelas 8.G!");
      window.location.reload();
    }
  };

  const codeGsSnippet = `// Backend Google Apps Script Presensi 8.G
const SHEET_SISWA = "Siswa";
const SHEET_PRESENSI = "Presensi";
const SHEET_ADMIN = "Admin";
const JAM_BATAS_TERLAMBAT = "07:15";

function doPost(e) {
  let response;
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    // ... handler logika login, getDaftarSiswa, simpanPresensi, getRekapPeriode ...
  } catch (err) {
    response = { success: false, message: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(codeGsSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Koneksi & Panduan Backend</h1>
        <p className="text-xs text-slate-500 mt-0.5">Pengaturan Google Apps Script Web App dan integrasi Google Sheets</p>
      </div>

      {/* URL Endpoint Configuration */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">
          <Link2 className="w-4 h-4 text-blue-600" />
          <span>URL Web App Google Apps Script</span>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              API Endpoint URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Salin URL dari menu <strong>Deploy &gt; Manage deployments</strong> pada Google Apps Script Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs"
            >
              Simpan URL
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition"
            >
              {testing ? 'Menguji Koneksi...' : 'Uji Koneksi'}
            </button>
            <button
              type="button"
              onClick={handleResetUrl}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-2"
            >
              Kembalikan Default
            </button>

            {saved && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tersimpan!
              </span>
            )}
          </div>
        </form>

        {testResult && (
          <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
            testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
            <div>{testResult.message}</div>
          </div>
        )}
      </div>

      {/* Google Sheets Structure Guide */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Struktur Wajib Sheet Spreadsheet (Database)</span>
        </div>

        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            Pastikan file Google Spreadsheet Anda memiliki 3 tab dengan nama persis dan urutan header kolom berikut:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-900 mb-1">Sheet "Admin"</div>
              <div className="font-mono text-[11px] text-blue-600">Username | Password | Nama | Role</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="font-bold text-slate-900 mb-1">Sheet "Presensi"</div>
              <div className="font-mono text-[11px] text-blue-600 leading-tight">
                Tanggal | Jam | Nomor QR | Nama | Kelas | Status | Metode | Keterangan
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset & Maintenance */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">
          <RotateCcw className="w-4 h-4 text-rose-600" />
          <span>Pemeliharaan Data Lokal</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-800">Reset Data Presensi Lokal</div>
            <div className="text-[11px] text-slate-500">
              Mengembalikan daftar 15 siswa default kelas {DEFAULT_KELAS} dan mengosongkan riwayat lokal.
            </div>
          </div>

          <button
            onClick={handleResetData}
            className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition shrink-0"
          >
            Reset Database Default
          </button>
        </div>
      </div>
    </div>
  );
};
