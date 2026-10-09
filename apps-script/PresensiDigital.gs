// Google Apps Script backend untuk Presensi Digital 8.G
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Siswa"; // PASTIKAN NAMA TAB DI GOOGLE SHEET ADALAH "Siswa"
const SHEET_PRESENSI = "Presensi";
const SHEET_PRESENSI_MAPEL = "Presensi Mapel";
const DEFAULT_KELAS = "8.G";
const ATTENDANCE_TIME_ZONE = "Asia/Jakarta";
const LATE_AFTER = "08:00:00";
const ALPA_AFTER = "14:15:00";

// --- KONFIGURASI WHATSAPP GATEWAY ---
// CATATAN DEPLOY: Web App Apps Script menjalankan SALINAN kode pada saat
// "Deploy > New deployment / Manage deployments" dibuat. Konstanta yang diubah
// di editor sumber TIDAK berlaku sampai redeploy. Karena itu WA_URL & token
// dibaca lewat fungsi + Script Properties (lihat getWaUrl/getWaToken) agar
// bisa dikoreksi tanpa deploy ulang, dan tersedia setupWaNotifikasi() untuk
// mendiagnosis penyebab "pesan scan tidak terkirim ke orang tua".
const WA_URL = "https://api.fonnte.com/send";

function getWaUrl() {
  const stored = asText(PropertiesService.getScriptProperties().getProperty("WA_URL"));
  return stored || WA_URL;
}

function getWaToken() {
  // WA_TOKEN adalah nama kunci lama; FONNTE_TOKEN dipakai sebagai alternatif.
  const props = PropertiesService.getScriptProperties();
  return asText(props.getProperty("WA_TOKEN") || props.getProperty("FONNTE_TOKEN"));
}

function getSpreadsheet() {
  if (!SPREADSHEET_ID) throw new Error("Spreadsheet ID tidak ditemukan.");
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeDate(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd");
  }
  const raw = asText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return raw;
}

function normalizeTime(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "GMT+7", "HH:mm:ss");
  }
  const raw = asText(value).replace(/\./g, ":");
  if (!raw) return "";
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    const [h, m] = raw.split(":");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return raw;
}

// Deteksi baris header (baris pertama yang memuat >=2 kata kunci kolom),
// lalu baca baris data SETELAH baris header tersebut. Ini mengatasi sheet
// "Siswa" yang diawali baris kop/judul (mis. dari file Excel: "REKAP PRESENSI",
// "KELAS 8.G", "SMP NEGERI 18 PADANG", baris kosong) — penyebab utama
// "data siswa tidak muncul / tidak ada yang cocok": tanpa deteksi ini,
// header terbaca dari baris yang salah sehingga kolom nomorQr & nama tidak
// pernah ketemu dan seluruh baris terbuang menjadi siswa kosong.
function findHeaderRowIndex(values, keywords) {
  for (let i = 0; i < Math.min(values.length, 30); i++) {
    const norm = values[i].map(function (c) {
      return asText(c).toLowerCase().replace(/[^a-z0-9]/g, "");
    });
    let found = 0;
    for (let k = 0; k < keywords.length; k++) {
      if (norm.indexOf(keywords[k]) >= 0) found++;
    }
    if (found >= 2) return i;
  }
  return -1;
}

// Cari indeks kolom berdasarkan daftar variasi nama header (sudah dinormalisasi).
function pickColumnIndex(normRow, candidates) {
  for (var c = 0; c < candidates.length; c++) {
    var idx = normRow.indexOf(candidates[c]);
    if (idx >= 0) return idx;
  }
  return -1;
}

var QR_HEADER_CANDIDATES = ["nomorqr", "noqr", "kodeqr", "qr", "kode", "nisn", "nis", "id"];
var NAMA_HEADER_CANDIDATES = ["namasiswa", "namalengkap", "nama", "name"];
var KELAS_HEADER_CANDIDATES = ["ruangankelas", "rombel", "kelas"];
// DAFTAR VARIASI NAMA KOLOM NOMOR ORANG TUA/WALI.
// PENTING: daftar ini juga bisa dioverride lewat Script Properties (key:
// ORTU_HEADER_CANDIDATES, dipisah koma) supaya bisa disesuaikan TANPA deploy
// ulang kode — lihat getOrtuHeaderCandidates() dan setupWaNotifikasi().
var DEFAULT_ORTU_HEADER_CANDIDATES = [
  "noortu", "nomorortu", "nohportu", "nomorhportu",
  "nohporangtua", "nomorhporangtua", "nomorhportua",
  "nowali", "nomorwali", "nohpwali", "nomorhpwali",
  "notelp", "nomortelp", "notelepon", "nomortelepon",
  "hportu", "nohp", "nomorhp", "waortu",
  "nowaortu", "nomorwaortu", "nowhatsapp", "nomorwhatsapp",
  "whatsapportu", "whatsapporangtua", "nowhatsapporangtua",
  "nomorwhatsapporangtua", "whatsappwali", "nomorwhatsappwali",
  // variasi lain yang umum dipakai di sheet sekolah
  "kontak", "nomorkontak", "kontakortu", "nohportu",
  "nomorhandphone", "nohandphone", "telepon", "telephone", "nomorteleponortu"
];

// Baca daftar kandidat kolom nomor ortu. Prioritas: Script Properties
// (langsung berlaku tanpa deploy ulang) -> konstanta default di sumber ini.
function getOrtuHeaderCandidates() {
  var stored = "";
  try {
    stored = asText(PropertiesService.getScriptProperties().getProperty("ORTU_HEADER_CANDIDATES"));
  } catch (e) {
    stored = "";
  }
  if (stored) {
    var list = stored.split(",").map(function (s) {
      return asText(s).toLowerCase().replace(/[^a-z0-9]/g, "");
    }).filter(function (s) { return s !== ""; });
    if (list.length > 0) return list;
  }
  return DEFAULT_ORTU_HEADER_CANDIDATES.slice();
}

// Nama variabel lama tetap dipertahankan agar tidak ada kode yang tertinggal.
var ORTU_HEADER_CANDIDATES = DEFAULT_ORTU_HEADER_CANDIDATES;

function readSheetRows(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("ERROR: Sheet '" + sheetName + "' tidak ditemukan!");
    return [];
  }

  // getDisplayValues: nilai apa pun (tanggal/angka) jadi string tampil,
  // hindari objek Date pada ID numerik.
  const values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) return [];

  // Baris 0 dipakai sebagai header bila memang memuat kata kunci kolom;
  // jika tidak (ada baris kop/judul di atasnya), scan sampai 30 baris pertama.
  let headerIdx = findHeaderRowIndex(values, QR_HEADER_CANDIDATES.concat(NAMA_HEADER_CANDIDATES));
  if (headerIdx < 0) {
    // Fallback: perlakukan baris pertama sebagai header seperti perilaku lama.
    headerIdx = 0;
  }

  const normHeader = values[headerIdx].map(function (h) {
    return asText(h).toLowerCase().replace(/[^a-z0-9]/g, "");
  });

  const qrCol = pickColumnIndex(normHeader, QR_HEADER_CANDIDATES);
  const namaCol = pickColumnIndex(normHeader, NAMA_HEADER_CANDIDATES);
  const kelasCol = pickColumnIndex(normHeader, KELAS_HEADER_CANDIDATES);
  const ortuCol = pickColumnIndex(normHeader, getOrtuHeaderCandidates());
  const idCol = pickColumnIndex(normHeader, ["id"]);

  // Bangun objek per baris dengan key kanonik + key header mentah (fallback).
  return values.slice(headerIdx + 1).map(function (row) {
    const rowObj = {};
    normHeader.forEach(function (header, idx) {
      if (header) rowObj[header] = asText(row[idx]);
    });
    if (qrCol >= 0) rowObj.nomorQr = asText(row[qrCol]);
    if (namaCol >= 0) rowObj.nama = asText(row[namaCol]);
    if (kelasCol >= 0) rowObj.kelas = asText(row[kelasCol]);
    if (ortuCol >= 0) rowObj.noOrtu = asText(row[ortuCol]);
    if (idCol >= 0) rowObj.id = asText(row[idCol]);
    return rowObj;
  });
}

function getAdminUsers() {
  return readSheetRows(SHEET_ADMIN).map((row) => ({
    username: asText(row.username),
    password: asText(row.password),
    nama: asText(row.nama || row.username),
    role: asText(row.role || "Admin")
  }));
}

function getDaftarSiswa(kelasFilter) {
  // readSheetRows sudah mendeteksi baris header (melewati baris kop/judul
  // ala Excel) dan memetakan kolom secara fleksibel (nomorQr/nama/kelas/noOrtu).
  const rawRows = readSheetRows(SHEET_DATA_SISWA);
  if (rawRows.length === 0) return [];

  // Header ternormalisasi untuk penentuan kolom cadangan bila perlu.
  const sampleKeys = Object.keys(rawRows[0]);

  const rows = rawRows.map(function (row) {
    const nomorQr = asText(row.nomorQr || row["nomorqr"] || row["noqr"] || row.nis || row.nisn || row.kode || row.id || "");
    const noOrtu = asText(row.noOrtu || row["noortu"] || row["nohportu"] || row.notelp || row.notelepon || row.hportu || row.nohp || row.waortu || "");
    const kelas = asText(row.kelas || row.rombel || row.ruangankelas || "") || DEFAULT_KELAS;

    // Nama: pakai kolom nama kanonik; jika kosong, ambil sel teks terpanjang
    // yang bukan nomor QR dan bukan kode kelas.
    let nama = asText(row.nama || row["namasiswa"] || row["namalengkap"] || "");
    if (!nama) {
      sampleKeys.forEach(function (k) {
        if (k === "nomorqr" || k === "noqr" || k === "nis" || k === "nisn" || k === "kode" || k === "id" || k === "kelas" || k === "barcode") return;
        const cell = asText(row[k]);
        if (cell && isNaN(Number(cell)) && cell !== kelas && cell.length > nama.length) nama = cell;
      });
    }

    return {
      nomorQr: nomorQr,
      barcode: nomorQr,
      nama: nama,
      kelas: kelas,
      noOrtu: noOrtu
    };
  }).filter(function (s) {
    // Buang baris kop/kosong/catatan: siswa valid minimal punya Nomor QR dan Nama.
    return s.nomorQr !== "" && s.nama !== "";
  });

  if (!kelasFilter) return rows;
  return rows.filter((item) => item.kelas.toUpperCase() === kelasFilter.toUpperCase());
}

function getPresensiRows() {
  return readSheetRows(SHEET_PRESENSI).map((row) => ({
    id: asText(row.id),
    tanggal: asText(row.tanggal),
    jam: normalizeTime(row.jam),
    nomorQr: asText(row["nomorqr"] || row["noqr"]),
    nama: asText(row.nama),
    kelas: asText(row.kelas),
    status: asText(row.status),
    metode: asText(row.metode || "Scan"),
    keterangan: asText(row.keterangan)
  }));
}

function getAttendanceDateTime(date) {
  const value = date || new Date();
  return {
    tanggal: Utilities.formatDate(value, ATTENDANCE_TIME_ZONE, "yyyy-MM-dd"),
    jam: Utilities.formatDate(value, ATTENDANCE_TIME_ZONE, "HH:mm:ss")
  };
}

function isAfterAlpaCutoff(jam) {
  return normalizeTime(jam) > ALPA_AFTER;
}

function resolveAttendanceStatus(status, jam) {
  if (status === "Hadir" || status === "Terlambat") {
    return normalizeTime(jam) > LATE_AFTER ? "Terlambat" : "Hadir";
  }
  return status;
}

function isSchoolDay(date) {
  const weekday = Number(Utilities.formatDate(date, ATTENDANCE_TIME_ZONE, "u"));
  if (weekday > 5) return false;

  const dateString = Utilities.formatDate(date, ATTENDANCE_TIME_ZONE, "yyyy-MM-dd");
  const holidays = asText(PropertiesService.getScriptProperties().getProperty("SCHOOL_HOLIDAYS"))
    .split(/[,\s]+/)
    .filter((value) => value !== "");
  return holidays.indexOf(dateString) < 0;
}

function ensureAutomaticAlpaForToday(requestedDate) {
  const now = getAttendanceDateTime();
  if (isSchoolDay(new Date()) && normalizeDate(requestedDate) === now.tanggal && isAfterAlpaCutoff(now.jam)) {
    createAutomaticAlpaRecords(now.tanggal);
  }
}

function createAutomaticAlpaRecords(tanggal) {
  const students = getDaftarSiswa(DEFAULT_KELAS);
  if (students.length === 0) return 0;

  const sheet = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
  if (!sheet) throw new Error("Sheet '" + SHEET_PRESENSI + "' tidak ditemukan.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const values = sheet.getDataRange().getDisplayValues();
    const headerIndex = findHeaderRowIndex(values, ["nomorqr", "nama", "tanggal"]);
    if (headerIndex < 0) throw new Error("Header sheet Presensi tidak ditemukan.");

    const headers = values[headerIndex].map((header) =>
      asText(header).toLowerCase().replace(/[^a-z0-9]/g, "")
    );
    const columns = {
      id: headers.indexOf("id"),
      tanggal: headers.indexOf("tanggal"),
      jam: headers.indexOf("jam"),
      nomorQr: pickColumnIndex(headers, QR_HEADER_CANDIDATES),
      nama: pickColumnIndex(headers, NAMA_HEADER_CANDIDATES),
      kelas: pickColumnIndex(headers, KELAS_HEADER_CANDIDATES),
      status: headers.indexOf("status"),
      metode: headers.indexOf("metode"),
      keterangan: headers.indexOf("keterangan")
    };
    const requiredColumns = ["tanggal", "jam", "nomorQr", "nama", "kelas", "status", "metode", "keterangan"];
    if (requiredColumns.some((key) => columns[key] < 0)) {
      throw new Error("Header sheet Presensi tidak memiliki kolom wajib untuk membuat Alpa otomatis.");
    }

    const recordedQr = {};
    for (let rowIndex = headerIndex + 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      if (normalizeDate(row[columns.tanggal]) === tanggal) {
        recordedQr[asText(row[columns.nomorQr]).toLowerCase()] = true;
      }
    }

    const width = values[headerIndex].length;
    const rowsToAppend = students
      .filter((student) => !recordedQr[student.nomorQr.toLowerCase()])
      .map((student) => {
        const row = new Array(width).fill("");
        if (columns.id >= 0) row[columns.id] = "P-" + Utilities.getUuid();
        row[columns.tanggal] = tanggal;
        row[columns.jam] = ALPA_AFTER;
        row[columns.nomorQr] = student.nomorQr;
        row[columns.nama] = student.nama;
        row[columns.kelas] = student.kelas || DEFAULT_KELAS;
        row[columns.status] = "Alpa";
        row[columns.metode] = "Otomatis";
        row[columns.keterangan] = "Belum presensi sampai pukul 14.15";
        return row;
      });

    if (rowsToAppend.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, width).setValues(rowsToAppend);
    }
    return rowsToAppend.length;
  } finally {
    lock.releaseLock();
  }
}

function updateAutomaticAlpaRecord(sheet, nomorQr, tanggal, jam, status, metode, keterangan) {
  const values = sheet.getDataRange().getDisplayValues();
  const headerIndex = findHeaderRowIndex(values, ["nomorqr", "nama", "tanggal"]);
  if (headerIndex < 0) throw new Error("Header sheet Presensi tidak ditemukan.");

  const headers = values[headerIndex].map((header) =>
    asText(header).toLowerCase().replace(/[^a-z0-9]/g, "")
  );
  const columns = {
    tanggal: headers.indexOf("tanggal"),
    jam: headers.indexOf("jam"),
    nomorQr: pickColumnIndex(headers, QR_HEADER_CANDIDATES),
    status: headers.indexOf("status"),
    metode: headers.indexOf("metode"),
    keterangan: headers.indexOf("keterangan")
  };
  if (Object.keys(columns).some((key) => columns[key] < 0)) {
    throw new Error("Header sheet Presensi tidak lengkap untuk memperbarui Alpa otomatis.");
  }

  for (let rowIndex = headerIndex + 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (
      asText(row[columns.nomorQr]).toLowerCase() === nomorQr.toLowerCase() &&
      normalizeDate(row[columns.tanggal]) === tanggal &&
      asText(row[columns.status]) === "Alpa" &&
      asText(row[columns.metode]).toLowerCase() === "otomatis"
    ) {
      const sheetRow = rowIndex + 1;
      sheet.getRange(sheetRow, columns.jam + 1).setValue(jam);
      sheet.getRange(sheetRow, columns.status + 1).setValue(status);
      sheet.getRange(sheetRow, columns.metode + 1).setValue(metode);
      sheet.getRange(sheetRow, columns.keterangan + 1).setValue(keterangan);
      return true;
    }
  }
  return false;
}

function setupAutomaticAlpa() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "runAutomaticAlpa")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("runAutomaticAlpa")
    .timeBased()
    .atHour(14)
    .nearMinute(31)
    .everyDays(1)
    .inTimezone(ATTENDANCE_TIME_ZONE)
    .create();
  Logger.log("Pemicu Alpa otomatis dibuat. Jalankan sekitar pukul 14.16–14.46 WIB setiap hari.");
}

function runAutomaticAlpa() {
  const now = getAttendanceDateTime();
  if (isSchoolDay(new Date()) && isAfterAlpaCutoff(now.jam)) {
    const added = createAutomaticAlpaRecords(now.tanggal);
    Logger.log(added + " siswa ditandai Alpa otomatis untuk " + now.tanggal + ".");
  }
}

function parseRequestBody(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch (err) { return {}; }
  }
  return payload;
}

function doGet(e) {
  // PENTING: Web App Apps Script yang ter-deploy menjalankan SALINAN kode pada
  // saat deployment dibuat. Jika pesan WA ke orang tua tidak terkirim padahal
  // kode di editor sudah benar, hampir pasti deployment masih memakai versi
  // lama: Deploy > Manage deployments > edit > Version "New version" > Deploy.
  // Cek juga "Execute as: Me" dan "Who has access: Anyone".
  const waToken = getWaToken();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Backend Aktif. Sheet target: " + SHEET_DATA_SISWA,
    spreadsheetId: SPREADSHEET_ID,
    // Diagnostik cepat notifikasi WhatsApp (tanpa membocorkan token):
    whatsappReady: !!waToken,
    whatsappNote: waToken
      ? "Token Fonnte terdeteksi. Pastikan nomor wali terisi di kolom No_Ortu sheet Siswa."
      : "PERINGATAN: WA_TOKEN belum diisi di Script Properties sehingga pesan scan TIDAK akan terkirim ke orang tua.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let response = { success: false, message: "Aksi tidak dikenali." };

  try {
    const rawBody = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = parseRequestBody(rawBody);
    const action = asText(body.action);

    if (!action) return outputJson({ success: false, message: "Action tidak ditemukan." });

    switch (action) {
      case "login": {
        const users = getAdminUsers();
        const matched = users.find((u) => u.username.toLowerCase() === asText(body.username).toLowerCase() && u.password === asText(body.password));
        if (!matched) return outputJson({ success: false, message: "Username/password salah." });
        
        return outputJson({ 
          success: true, 
          username: matched.username, 
          nama: matched.nama, 
          role: matched.role, 
          token: "gas_" + Utilities.getUuid() 
        });
      }

      // === DATA SISWA ===
      // AKAR MASALAH "data siswa tidak muncul": action getDaftarSiswa (dan
      // aksi CRUD siswa/rekap lainnya) TIDAK PERNAH diimplementasi di sini,
      // sehingga server selalu membalas "Action belum diimplementasi" dan
      // frontend tidak pernah menerima daftar siswa.
      case "getDaftarSiswa": {
        const kelasFilter = asText(body.kelas || body.Kelas || "");
        // Buang baris tanpa Nomor QR (mis. catatan/kosong di sheet) agar tidak muncul sebagai siswa kosong.
        const daftar = getDaftarSiswa(kelasFilter).filter(s => s.nomorQr !== "");
        return outputJson({ success: true, data: daftar, total: daftar.length });
      }

      case "tambahSiswa": {
        const nomorQr = asText(body.nomorQr || body["Nomor Qr"] || "");
        const nama = asText(body.nama || body.Nama || "");
        const kelas = asText(body.kelas || body.Kelas || "") || DEFAULT_KELAS;
        const noOrtu = asText(body.noOrtu || body["no_ortu"] || body["No Ortu"] || body["Nomor HP Orang Tua"] || "");
        if (!nomorQr || !nama) return outputJson({ success: false, message: "Nomor QR dan Nama wajib diisi." });
        if (noOrtu) {
          const cekFormat = normalizeWhatsAppNumber(noOrtu);
          if (!cekFormat.success) return outputJson({ success: false, message: "Nomor WhatsApp orang tua tidak valid: " + cekFormat.message });
        }

        const sheetSiswa = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        if (!sheetSiswa) return outputJson({ success: false, message: "Sheet '" + SHEET_DATA_SISWA + "' tidak ditemukan. Pastikan nama tab di Google Sheet adalah '" + SHEET_DATA_SISWA + "'." });

        const existing = getDaftarSiswa();
        const dup = existing.find(s => s.nomorQr.toLowerCase() === nomorQr.toLowerCase());
        if (dup) return outputJson({ success: false, message: "Nomor QR '" + nomorQr + "' sudah terdaftar atas nama " + dup.nama + "." });

        const headerRow = sheetSiswa.getDataRange().getDisplayValues()[0].map(h => asText(h).toLowerCase().replace(/\s+/g, ""));
        const rowArr = headerRow.map(h => {
          if (h === "nomorqr" || h === "noqr" || h === "nisn" || h === "nis") return nomorQr;
          if (h === "barcode") return asText(body.barcode) || nomorQr;
          if (h === "nama") return nama;
          if (h === "kelas") return kelas;
          if (getOrtuHeaderCandidates().indexOf(h.replace(/[^a-z0-9]/g, "")) >= 0) return noOrtu;
          return "";
        });
        sheetSiswa.appendRow(rowArr);
        return outputJson({ success: true, message: "Siswa berhasil ditambahkan." });
      }

      case "editSiswa": {
        const nomorQr = asText(body.nomorQr).toLowerCase();
        if (!nomorQr) return outputJson({ success: false, message: "Nomor QR kosong." });

        const sheetSiswa = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        if (!sheetSiswa) return outputJson({ success: false, message: "Sheet '" + SHEET_DATA_SISWA + "' tidak ditemukan." });

        const values = sheetSiswa.getDataRange().getValues();
        const headers = values[0].map(h => asText(h).toLowerCase().replace(/\s+/g, ""));
        const qrCol = headers.findIndex(h => h === "nomorqr" || h === "noqr" || h === "nisn" || h === "nis");
        if (qrCol < 0) return outputJson({ success: false, message: "Kolom Nomor QR tidak ditemukan di sheet Siswa." });

        if (body.noOrtu != null && asText(body.noOrtu) !== "") {
          const cekFormat = normalizeWhatsAppNumber(asText(body.noOrtu));
          if (!cekFormat.success) return outputJson({ success: false, message: "Nomor WhatsApp orang tua tidak valid: " + cekFormat.message });
        }

        for (let i = 1; i < values.length; i++) {
          if (asText(values[i][qrCol]).toLowerCase() === nomorQr) {
            const namaIdx = headers.indexOf("nama");
            const kelasIdx = headers.indexOf("kelas");
            const ortuIdx = headers.findIndex(h => getOrtuHeaderCandidates().indexOf(h.replace(/[^a-z0-9]/g, "")) >= 0);
            if (namaIdx >= 0 && body.nama != null) values[i][namaIdx] = asText(body.nama);
            if (kelasIdx >= 0 && body.kelas != null) values[i][kelasIdx] = asText(body.kelas);
            if (ortuIdx >= 0 && body.noOrtu != null) values[i][ortuIdx] = asText(body.noOrtu);
            sheetSiswa.getRange(i + 1, 1, 1, values[i].length).setValues([values[i]]);
            return outputJson({ success: true, message: "Data siswa berhasil diperbarui." });
          }
        }
        return outputJson({ success: false, message: "Siswa dengan Nomor QR tersebut tidak ditemukan." });
      }

      case "hapusSiswa": {
        const nomorQr = asText(body.nomorQr).toLowerCase();
        if (!nomorQr) return outputJson({ success: false, message: "Nomor QR kosong." });

        const sheetSiswa = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
        if (!sheetSiswa) return outputJson({ success: false, message: "Sheet '" + SHEET_DATA_SISWA + "' tidak ditemukan." });

        const values = sheetSiswa.getDataRange().getValues();
        const headers = values[0].map(h => asText(h).toLowerCase().replace(/\s+/g, ""));
        const qrCol = headers.findIndex(h => h === "nomorqr" || h === "noqr" || h === "nisn" || h === "nis");
        if (qrCol < 0) return outputJson({ success: false, message: "Kolom Nomor QR tidak ditemukan di sheet Siswa." });

        for (let i = 1; i < values.length; i++) {
          if (asText(values[i][qrCol]).toLowerCase() === nomorQr) {
            sheetSiswa.deleteRow(i + 1);
            return outputJson({ success: true, message: "Data siswa berhasil dihapus." });
          }
        }
        return outputJson({ success: false, message: "Siswa dengan Nomor QR tersebut tidak ditemukan." });
      }

      // === REKAP HARIAN (dipakai DashboardView) ===
      case "getRekapHarian": {
        const tanggalReq = normalizeDate(body.tanggal || new Date());
        ensureAutomaticAlpaForToday(tanggalReq);
        const kelasFilter = asText(body.kelas || "");
        const records = getPresensiRows().filter(r => normalizeDate(r.tanggal) === tanggalReq);
        const filtered = kelasFilter ? records.filter(r => r.kelas.toUpperCase() === kelasFilter.toUpperCase()) : records;
        const hitung = (st) => filtered.filter(r => r.status === st).length;
        return outputJson({
          success: true,
          data: {
            hadir: hitung("Hadir") + hitung("Terlambat"),
            terlambat: hitung("Terlambat"),
            izin: hitung("Izin"),
            sakit: hitung("Sakit"),
            alpa: hitung("Alpa"),
            log: filtered.map(r => ({
              id: r.id, jam: r.jam, nomorQr: r.nomorQr, nama: r.nama,
              kelas: r.kelas, status: r.status, metode: r.metode, keterangan: r.keterangan
            }))
          }
        });
      }

      // === REKAP PERIODE (dipakai RekapView) ===
      case "getRekapPeriode": {
        const tglAwal = normalizeDate(body.mulai || body.tanggalAwal || body.dari);
        const tglAkhir = normalizeDate(body.selesai || body.tanggalAkhir || body.sampai);
        const kelasFilter = asText(body.kelas || "");
        const daftar = getDaftarSiswa(kelasFilter);
        const records = getPresensiRows().filter(r => {
          const t = normalizeDate(r.tanggal);
          return (!tglAwal || t >= tglAwal) && (!tglAkhir || t <= tglAkhir);
        });
        let totalHadir = 0, totalIzin = 0, totalSakit = 0, totalAlpa = 0;
        const perSiswa = daftar.map(s => {
          const milik = records.filter(r => r.nomorQr.toLowerCase() === s.nomorQr.toLowerCase());
          const hadir = milik.filter(r => r.status === "Hadir" || r.status === "Terlambat").length;
          const izin = milik.filter(r => r.status === "Izin").length;
          const sakit = milik.filter(r => r.status === "Sakit").length;
          const alpa = milik.filter(r => r.status === "Alpa").length;
          totalHadir += hadir; totalIzin += izin; totalSakit += sakit; totalAlpa += alpa;
          const persenHadir = milik.length > 0 ? Math.round((hadir / milik.length) * 100) : 0;
          return { nomorQr: s.nomorQr, nama: s.nama, hadir, izin, sakit, alpa, persenHadir };
        });
        return outputJson({ success: true, data: { totalHadir, totalIzin, totalSakit, totalAlpa, perSiswa } });
      }

      case "getAdminUsers": {
        // Hanya untuk kebutuhan UI login — tanpa password.
        const users = getAdminUsers().map(u => ({ username: u.username, nama: u.nama, role: u.role }));
        return outputJson({ success: true, data: users });
      }

      case "simpanPresensiMapel": {
        const mapel = asText(body.mapel);
        const guru = asText(body.guru);
        const kelas = asText(body.kelas) || DEFAULT_KELAS;
        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        const records = body.records;

        if (!mapel) return outputJson({ success: false, message: "Mata pelajaran belum dipilih." });
        if (!guru) return outputJson({ success: false, message: "Nama guru belum tersedia." });
        if (!Array.isArray(records) || records.length === 0) {
          return outputJson({ success: false, message: "Tidak ada data kehadiran untuk disimpan." });
        }

        const statuses = ["Hadir", "Izin", "Sakit", "Alpa"];
        const students = getDaftarSiswa(kelas);
        const studentsByQr = {};
        students.forEach((student) => {
          studentsByQr[student.nomorQr.toLowerCase()] = student;
        });

        const seenQr = {};
        const validatedRecords = [];
        for (let i = 0; i < records.length; i++) {
          const record = records[i] || {};
          const nomorQr = asText(record.nomorQr);
          const key = nomorQr.toLowerCase();
          const siswa = studentsByQr[key];
          const status = asText(record.status);

          if (!nomorQr || !siswa) {
            return outputJson({ success: false, message: "Siswa dengan Nomor QR '" + (nomorQr || "(kosong)") + "' tidak ditemukan di kelas " + kelas + "." });
          }
          if (seenQr[key]) {
            return outputJson({ success: false, message: "Data siswa " + siswa.nama + " tercantum lebih dari sekali." });
          }
          if (statuses.indexOf(status) < 0) {
            return outputJson({ success: false, message: "Status kehadiran untuk " + siswa.nama + " tidak valid." });
          }

          seenQr[key] = true;
          validatedRecords.push({
            nomorQr: siswa.nomorQr,
            nama: siswa.nama,
            kelas: siswa.kelas || kelas,
            status: status,
            keterangan: asText(record.keterangan)
          });
        }

        const spreadsheet = getSpreadsheet();
        const sheetMapel = spreadsheet.getSheetByName(SHEET_PRESENSI_MAPEL)
          || spreadsheet.insertSheet(SHEET_PRESENSI_MAPEL);
        const headers = ["id", "tanggal", "jam", "nomorQr", "nama", "kelas", "mapel", "guru", "status", "metode", "keterangan"];
        if (sheetMapel.getLastRow() === 0) {
          sheetMapel.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
        const sheetHeaders = sheetMapel.getRange(1, 1, 1, sheetMapel.getLastColumn()).getDisplayValues()[0]
          .map((header) => asText(header).toLowerCase().replace(/[^a-z0-9]/g, ""));
        const columnIndexes = headers.map((header) => sheetHeaders.indexOf(header.toLowerCase()));
        if (columnIndexes.some((index) => index < 0)) {
          return outputJson({ success: false, message: "Header sheet '" + SHEET_PRESENSI_MAPEL + "' tidak sesuai. Gunakan kolom: " + headers.join(", ") + "." });
        }

        const rowsToAppend = validatedRecords.map((record) => {
          const values = {
            id: "MP-" + Utilities.getUuid(),
            tanggal: tanggal,
            jam: jam,
            nomorQr: record.nomorQr,
            nama: record.nama,
            kelas: record.kelas,
            mapel: mapel,
            guru: guru,
            status: record.status,
            metode: "Observasi",
            keterangan: record.keterangan
          };
          const row = new Array(sheetHeaders.length).fill("");
          headers.forEach((header, index) => {
            row[columnIndexes[index]] = values[header];
          });
          return row;
        });

        const lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          const firstRow = sheetMapel.getLastRow() + 1;
          sheetMapel.getRange(firstRow, 1, rowsToAppend.length, sheetHeaders.length).setValues(rowsToAppend);
        } finally {
          lock.releaseLock();
        }

        return outputJson({
          success: true,
          saved: rowsToAppend.length,
          message: "Presensi " + mapel + " berhasil dikonfirmasi untuk " + rowsToAppend.length + " siswa."
        });
      }

      case "simpanPresensi": {
        const nomorQr = asText(body.nomorQr);
        if (!nomorQr) return outputJson({ success: false, message: "Nomor QR kosong." });

        const daftarSiswa = getDaftarSiswa();
        const cleanQr = nomorQr.toLowerCase();
        
        // Cari siswa berdasarkan QR
        const siswa = daftarSiswa.find(s => s.nomorQr.toLowerCase() === cleanQr);

        if (!siswa) {
          // LOG DEBUG: Jika error ini muncul, berarti data QR di sheet tidak cocok
          Logger.log("GAGAL: QR '" + nomorQr + "' tidak ditemukan di sheet '" + SHEET_DATA_SISWA + "'.");
          Logger.log("Isi sheet siswa (5 pertama): " + JSON.stringify(daftarSiswa.slice(0,5)));
          return outputJson({ success: false, message: "Nomor QR '" + nomorQr + "' TIDAK TERDAFTAR di database." });
        }

        const attendanceTime = getAttendanceDateTime();
        const tanggal = attendanceTime.tanggal;
        const jam = attendanceTime.jam;
        const requestedStatus = asText(body.status || "Hadir");
        const status = resolveAttendanceStatus(requestedStatus, jam);
        const metode = asText(body.metode) === "Manual" ? "Manual" : "Scan";

        if (isAfterAlpaCutoff(jam)) createAutomaticAlpaRecords(tanggal);

        const lock = LockService.getScriptLock();
        lock.waitLock(10000);
        let sudahAbsen = false;
        let diperbaruiDariAlpa = false;
        try {
          sudahAbsen = getPresensiRows().some(r =>
            r.nomorQr.toLowerCase() === cleanQr && normalizeDate(r.tanggal) === tanggal
          );
          if (sudahAbsen && (status === "Terlambat" || metode === "Manual")) {
            diperbaruiDariAlpa = updateAutomaticAlpaRecord(
              getSpreadsheet().getSheetByName(SHEET_PRESENSI),
              nomorQr,
              tanggal,
              jam,
              status,
              metode,
              status === "Terlambat" ? "Hadir setelah batas pukul 08.00" : asText(body.keterangan)
            );
          }
          if (!sudahAbsen) {
            const id = "P-" + Math.random().toString(36).substr(2, 8).toUpperCase();
            const sheetPresensi = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
            sheetPresensi.appendRow([id, tanggal, jam, nomorQr, siswa.nama, siswa.kelas, status, metode, ""]);
          }
        } finally {
          lock.releaseLock();
        }

        if (sudahAbsen && !diperbaruiDariAlpa) {
          // Duplikat scan tetap memberi info status ke frontend. Notifikasi WA
          // TIDAK dikirim ulang untuk spam, tetapi jika nomor ortu tersedia dan
          // WA_WA_DUPLIKAT=true di Script Properties, pesan kedua boleh dikirim.
          const noOrtuDup = asText(siswa.noOrtu || body.noOrtu || "");
          const kirimDup = asText(PropertiesService.getScriptProperties().getProperty("WA_KIRIM_DUPLIKAT")).toLowerCase() === "true";
          let whatsappDup;
          if (kirimDup && noOrtuDup) {
            whatsappDup = kirimWaOrtu(siswa.nama, "Hadir (scan ulang)", noOrtuDup, normalizeTime(body.jam || new Date()).substring(0,5), normalizeDate(body.tanggal || new Date()));
          } else if (noOrtuDup) {
            whatsappDup = { success: false, skipped: true, message: "Sudah presensi hari ini; WhatsApp tidak dikirim ulang." };
          }
          return outputJson({
            success: true,
            duplicate: true,
            nama: siswa.nama,
            whatsapp: whatsappDup,
            message: siswa.nama + " sudah presensi hari ini; notifikasi WhatsApp tidak dikirim ulang."
          });
        }

        // --- PROSES KIRIM WA ---
        // Sumber nomor: kolom No_Ortu di sheet Siswa (via getDaftarSiswa),
        // lalu fallback nilai yang dikirim frontend.
        const noOrtu = asText(siswa.noOrtu || body.noOrtu || body["no_ortu"] || body["No Ortu"]);
        Logger.log("Mencoba kirim WA ke nomor wali yang terdaftar (Siswa: " + siswa.nama + ", NoOrtu: " + (noOrtu ? normalizeWhatsAppNumber(noOrtu).target || "(invalid)" : "(kosong)") + ")");
        let whatsapp;
        if (noOrtu) {
          whatsapp = kirimWaOrtu(siswa.nama, status, noOrtu, jam.substring(0,5), tanggal);
        } else {
          Logger.log("GAGAL KIRIM WA: Kolom No_Ortu kosong untuk siswa " + siswa.nama);
          whatsapp = { success: false, message: "Nomor WhatsApp wali murid belum diisi di sheet Siswa (kolom No_Ortunya kosong). Isi nomor HP wali, lalu scan ulang." };
        }

        response = {
          success: true,
          message: "Berhasil",
          nama: siswa.nama,
          status: status,
          whatsapp: whatsapp
        };
        break;
      }
      
      // Case lain (getRekapHarian, dll) bisa ditambahkan sesuai kebutuhan dasar
      default:
        response = { success: false, message: "Action " + action + " belum diimplementasi di versi debug ini." };
    }
  } catch (err) {
    Logger.log("ERROR SYSTEM: " + err.toString());
    response = { success: false, message: err.toString() };
  }

  return outputJson(response);
}

// === DIAGNOSIS NOTIFIKASI WHATSAPP ===
// Jalankan fungsi ini dari editor Apps Script (pilih fungsi setupWaNotifikasi
// lalu Run) ketika "pesan saat scan tidak terkirim ke orang tua". Fungsinya
// memeriksa seluruh titik kegagalan secara berurutan dan menampilkan hasilnya
// di Execution Log, plus mengirim satu pesan tes jika memungkinkan.
function setupWaNotifikasi() {
  const hasil = [];
  const props = PropertiesService.getScriptProperties();

  // 1. Token Fonnte
  const waToken = getWaToken();
  if (waToken) {
    hasil.push("OK  : Token Fonnte ditemukan (WA_TOKEN/FONNTE_TOKEN), panjang " + waToken.length + ".");
  } else {
    hasil.push("GAGAL: WA_TOKEN belum diisi. Buka Project Settings (ikon roda gigi) > Script Properties > Tambah property bernama WA_TOKEN dengan token dari fonnte.com/dashboard/#account/apikey, lalu jalankan fungsi ini lagi.");
  }

  // 2. Akses spreadsheet & sheet Siswa
  let daftarSiswa = [];
  try {
    const ss = getSpreadsheet();
    hasil.push("OK  : Spreadsheet '" + ss.getName() + "' dapat diakses.");
    const sheetSiswa = ss.getSheetByName(SHEET_DATA_SISWA);
    if (!sheetSiswa) {
      hasil.push("GAGAL: Sheet '" + SHEET_DATA_SISWA + "' tidak ditemukan — tidak ada data siswa/noOrtu sama sekali.");
    } else {
      daftarSiswa = getDaftarSiswa();
      hasil.push("OK  : Sheet '" + SHEET_DATA_SISWA + "' terbaca, jumlah siswa: " + daftarSiswa.length + ".");
    }
  } catch (e) {
    hasil.push("GAGAL: Spreadsheet tidak bisa dibuka: " + e);
  }

  // 3. Kolom nomor ortu: terdeteksi atau tidak?
  if (daftarSiswa.length > 0) {
    const punyaNomor = daftarSiswa.filter(function (s) { return asText(s.noOrtu) !== ""; });
    if (punyaNomor.length === 0) {
      hasil.push("GAGAL: Tidak ada satu pun siswa yang punya nomor ortu. Kemungkinan penyebabnya:");
      hasil.push("       a) Kolom nomor wali di sheet Siswa masih KOSONG — isi dulu nomornya; atau");
      hasil.push("       b) Nama kolomnya tidak dikenali. Header saat ini: " + JSON.stringify(getSiswaHeaders()));
      hasil.push("       Solusi (b): set Script Properties ORTU_HEADER_CANDIDATES berisi nama kolom persis di sheet, contoh 'nomorwali'.");
    } else {
      hasil.push("OK  : " + punyaNomor.length + "/" + daftarSiswa.length + " siswa memiliki nomor ortu. Contoh: " +
        punyaNomor.slice(0, 3).map(function (s) { return s.nama + " -> " + s.noOrtu; }).join("; "));

      // validasi format tanpa mengirim
      const rusak = punyaNomor.filter(function (s) { return !normalizeWhatsAppNumber(s.noOrtu).success; });
      if (rusak.length > 0) {
        hasil.push("PERINGATAN: " + rusak.length + " nomor tidak valid formatnya, mis. " +
          rusak.slice(0, 3).map(function (s) { return s.nama + " (" + s.noOrtu + ")"; }).join(", "));
      } else {
        hasil.push("OK  : Semua nomor yang terisi lolos validasi format.");
      }
    }
  }

  // 4. Kirim pesan tes bila token tersedia
  const targetTes = asText(props.getProperty("WA_TEST_TARGET"));
  if (waToken && targetTes) {
    const norm = normalizeWhatsAppNumber(targetTes);
    if (norm.success) {
      const tes = kirimWaOrtu("(TES)", "Setup", targetTes, Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+7", "HH:mm"), normalizeDate(new Date()));
      hasil.push(tes.success ? "OK  : Pesan TES TERKIRIM ke " + norm.target + ". Jika WA benar-benar masuk, sistem siap." : "GAGAL: Pesan tes ditolak: " + tes.message);
    } else {
      hasil.push("GAGAL: WA_TEST_TARGET tidak valid: " + norm.message);
    }
  } else if (waToken) {
    hasil.push("INFO: Untuk uji kirim sungguhan, set Script Properties WA_TEST_TARGET=08xxxxxxxxxx lalu jalankan lagi.");
  }

  Logger.log("=== HASIL SETUP WA ===\n" + hasil.join("\n"));
  return hasil.join("\n");
}

// Jalankan sekali dari editor Apps Script untuk memberikan izin HTTP keluar.
// Panggilan GET ini tidak mengirim pesan dan tidak menggunakan token Fonnte.
function authorizeUrlFetchAccess() {
  const response = UrlFetchApp.fetch("https://www.google.com/generate_204", {
    method: "get",
    muteHttpExceptions: true
  });
  Logger.log("Izin UrlFetchApp aktif. HTTP " + response.getResponseCode());
}

// Ambil header mentah sheet Siswa (untuk pesan diagnosis).
function getSiswaHeaders() {
  try {
    const sheet = getSpreadsheet().getSheetByName(SHEET_DATA_SISWA);
    if (!sheet) return [];
    const values = sheet.getDataRange().getDisplayValues();
    const idx = findHeaderRowIndex(values, QR_HEADER_CANDIDATES.concat(NAMA_HEADER_CANDIDATES));
    return values[idx < 0 ? 0 : idx].map(asText).filter(function (h) { return h !== ""; });
  } catch (e) {
    return [];
  }
}

function outputJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeWhatsAppNumber(noHp) {
  const raw = asText(noHp);
  const hasPlusPrefix = /^\s*\+/.test(raw);
  const has00Prefix = /^\s*00/.test(raw);
  let digits = raw.replace(/\D/g, "");

  if (!digits) {
    return { success: false, message: "Nomor WhatsApp wali murid tidak berisi angka yang valid." };
  }
  if (has00Prefix) digits = digits.slice(2);

  const validIndonesianMobile = (nationalNumber) =>
    nationalNumber.charAt(0) === "8" && nationalNumber.length >= 9 && nationalNumber.length <= 12;

  if (digits.startsWith("62")) {
    if (!validIndonesianMobile(digits.slice(2))) {
      return { success: false, message: "Nomor Indonesia tidak valid. Gunakan format 08... atau 628...." };
    }
    return { success: true, target: digits };
  }

  if (hasPlusPrefix || has00Prefix) {
    if (digits.startsWith("1") && digits.length === 11) {
      return { success: true, target: digits, countryCode: "1" };
    }
    return {
      success: false,
      message: "Format internasional tidak didukung. Gunakan nomor Indonesia 08.../628... atau nomor AS +1.../001...."
    };
  }

  if (digits.startsWith("0")) {
    const nationalNumber = digits.slice(1);
    if (!validIndonesianMobile(nationalNumber)) {
      return { success: false, message: "Nomor Indonesia tidak valid. Gunakan format 08... atau 628...." };
    }
    return { success: true, target: "62" + nationalNumber };
  }

  if (validIndonesianMobile(digits)) {
    // Sheet angka dapat menghilangkan nol pertama dari nomor lokal 08...
    return { success: true, target: "62" + digits };
  }

  if (digits.startsWith("1") && digits.length === 11) {
    // Accept the US country code as digits because Sheets may drop a leading "+".
    return { success: true, target: digits, countryCode: "1" };
  }

  return {
    success: false,
    message: "Format nomor tidak valid. Gunakan nomor Indonesia 8.../08.../628... atau nomor AS 1 diikuti 10 digit."
  };
}

// Bangun isi pesan WA. Template bisa dioverride lewat Script Properties
// (key: WA_TEMPLATE) dengan placeholder {nama}, {status}, {jam}, {tanggal}.
function buildWaPesan(nama, status, jam, tanggal) {
  const template = asText(
    PropertiesService.getScriptProperties().getProperty("WA_TEMPLATE")
  );
  if (template) {
    return template
      .replace(/\{nama\}/g, nama)
      .replace(/\{status\}/g, status)
      .replace(/\{jam\}/g, jam)
      .replace(/\{tanggal\}/g, tanggal || "");
  }
  return "Yth. Wali Murid,\n\nAnak Anda *" + nama + "* telah presensi *" + status +
    "* pada jam " + jam + ".\n\nTerima kasih.\n- Class Digital SMPN 18 Padang";
}

function kirimWaOrtu(nama, status, noHp, jam, tanggal) {
  const waToken = getWaToken();
  if (!waToken) {
    Logger.log("GAGAL KIRIM WA: Token Fonnte belum diisi di Script Properties.");
    return { success: false, message: "Token Fonnte tidak ditemukan di Script Properties (WA_TOKEN). Buka Project Settings > Script Properties, lalu jalankan setupWaNotifikasi()." };
  }

  const rawNoHp = asText(noHp);
  if (!rawNoHp) {
    Logger.log("GAGAL KIRIM WA: Nomor HP wali murid kosong.");
    return { success: false, message: "Nomor WhatsApp wali murid kosong." };
  }

  const normalized = normalizeWhatsAppNumber(rawNoHp);
  if (!normalized.success) {
    Logger.log("GAGAL KIRIM WA: " + normalized.message + " Nilai: " + rawNoHp);
    return { success: false, message: normalized.message };
  }

  const pesan = buildWaPesan(nama, status, jam, tanggal);

  const payload = {
    target: normalized.target,
    message: pesan
  };
  if (normalized.countryCode) payload.countryCode = normalized.countryCode;

  Logger.log("Kirim WA target=" + normalized.target + " countryCode=" + (normalized.countryCode || "(none)"));

  const options = {
    method: 'post',
    headers: { Authorization: waToken },
    payload: payload,
    muteHttpExceptions: true,
    followRedirects: true
  };

  try {
    const response = UrlFetchApp.fetch(getWaUrl(), options);
    const body = response.getContentText();
    const parsed = (() => {
      try { return JSON.parse(body); } catch (e) { return null; }
    })();
    const responseCode = response.getResponseCode();
    const accepted = responseCode >= 200 && responseCode < 300 && parsed &&
      (parsed.status === true || parsed.status === "true" || parsed.success === true);

    if (accepted) {
      Logger.log("Fonnte menerima permintaan WhatsApp. HTTP " + responseCode);
      return { success: true, message: "Permintaan diterima Fonnte." };
    }

    const apiMessage = parsed && (parsed.reason || parsed.message || parsed.error);
    const message = apiMessage
      ? "Fonnte menolak permintaan: " + String(apiMessage)
      : "Fonnte memberi respons yang tidak menandakan sukses (HTTP " + responseCode + ").";
    Logger.log("GAGAL KIRIM WA: " + message);
    return { success: false, message: message };
  } catch (e) {
    Logger.log("Error Kirim WA: " + e.toString());
    return { success: false, message: "Permintaan ke Fonnte gagal: " + e.toString() };
  }
}