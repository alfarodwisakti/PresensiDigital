// Google Apps Script backend untuk Presensi Digital 8.G
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Siswa"; // PASTIKAN NAMA TAB DI GOOGLE SHEET ADALAH "Siswa"
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";
const DEFAULT_KELAS = "8.G";

// --- KONFIGURASI WHATSAPP GATEWAY ---
const WA_URL = "https://api.fonnte.com/send";

function getWaToken() {
  return PropertiesService.getScriptProperties().getProperty("WA_TOKEN");
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
var ORTU_HEADER_CANDIDATES = ["noortu", "nohportu", "notelp", "notelepon", "hportu", "nohp", "waortu"];

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
  const ortuCol = pickColumnIndex(normHeader, ORTU_HEADER_CANDIDATES);
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

function parseRequestBody(payload) {
  if (!payload) return {};
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch (err) { return {}; }
  }
  return payload;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "Backend Aktif. Sheet target: " + SHEET_DATA_SISWA,
    spreadsheetId: SPREADSHEET_ID
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
        const noOrtu = asText(body.noOrtu || body["no_ortu"] || body["No Ortu"] || "");
        if (!nomorQr || !nama) return outputJson({ success: false, message: "Nomor QR dan Nama wajib diisi." });

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
          if (h === "no_ortu" || h === "noortu" || h === "nohp" || h === "notelepon" || h === "hportu") return noOrtu;
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

        for (let i = 1; i < values.length; i++) {
          if (asText(values[i][qrCol]).toLowerCase() === nomorQr) {
            const namaIdx = headers.indexOf("nama");
            const kelasIdx = headers.indexOf("kelas");
            const ortuIdx = headers.findIndex(h => h === "no_ortu" || h === "noortu" || h === "nohp");
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
        const kelasFilter = asText(body.kelas || "");
        const records = getPresensiRows().filter(r => normalizeDate(r.tanggal) === tanggalReq);
        const filtered = kelasFilter ? records.filter(r => r.kelas.toUpperCase() === kelasFilter.toUpperCase()) : records;
        const hitung = (st) => filtered.filter(r => r.status === st).length;
        return outputJson({
          success: true,
          data: {
            hadir: hitung("Hadir"),
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

        const tanggal = normalizeDate(body.tanggal || new Date());
        const jam = normalizeTime(body.jam || new Date());
        let status = asText(body.status || "Hadir");
        
        // Cek duplikasi hari ini
        const sudahAbsen = getPresensiRows().some(r => 
          r.nomorQr.toLowerCase() === cleanQr && normalizeDate(r.tanggal) === tanggal
        );

        if (sudahAbsen) {
          return outputJson({ success: true, duplicate: true, message: siswa.nama + " sudah absen hari ini." });
        }

        if (status === "Hadir" && jam.substring(0,5) > JAM_BATAS_TERLAMBAT) status = "Terlambat";

        // Simpan ke Sheet Presensi
        const id = "P-" + Math.random().toString(36).substr(2, 8).toUpperCase();
        const sheetPresensi = getSpreadsheet().getSheetByName(SHEET_PRESENSI);
        sheetPresensi.appendRow([id, tanggal, jam, nomorQr, siswa.nama, siswa.kelas, status, "Scan", ""]);

        // --- PROSES KIRIM WA ---
        Logger.log("Mencoba kirim WA ke: " + siswa.noOrtu + " (Siswa: " + siswa.nama + ")");
        let whatsapp;
        if (siswa.noOrtu) {
          whatsapp = kirimWaOrtu(siswa.nama, status, siswa.noOrtu, jam.substring(0,5));
        } else {
          Logger.log("GAGAL KIRIM WA: Kolom No_Ortu kosong untuk siswa " + siswa.nama);
          whatsapp = { success: false, message: "Nomor WhatsApp wali murid tidak tersedia di data siswa." };
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

function outputJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function kirimWaOrtu(nama, status, noHp, jam) {
  const waToken = getWaToken();
  if (!waToken) {
    Logger.log("GAGAL KIRIM WA: Token Fonnte belum diisi.");
    return { success: false, message: "Token Fonnte tidak ditemukan di Script Properties (WA_TOKEN)." };
  }

  const rawNoHp = asText(noHp);
  if (!rawNoHp) {
    Logger.log("GAGAL KIRIM WA: Nomor HP wali murid kosong.");
    return { success: false, message: "Nomor WhatsApp wali murid kosong." };
  }

  let normalized = rawNoHp.replace(/\s+/g, "").replace(/[()\-.]/g, "");
  if (!normalized) {
    Logger.log("GAGAL KIRIM WA: Nomor HP wali murid invalid setelah dibersihkan.");
    return { success: false, message: "Nomor WhatsApp wali murid tidak valid." };
  }

  const hasPlusPrefix = normalized.startsWith("+");
  if (hasPlusPrefix) normalized = normalized.slice(1);
  if (normalized.startsWith("00")) normalized = normalized.slice(2);

  let digitsOnly = normalized.replace(/\D/g, "");
  if (!digitsOnly) {
    Logger.log("GAGAL KIRIM WA: Tidak ada angka pada nomor HP wali murid.");
    return { success: false, message: "Nomor WhatsApp wali murid tidak berisi angka yang valid." };
  }

  let target = digitsOnly;
  let countryCode = "";

  if (digitsOnly.startsWith("0")) {
    // Di sheet boleh 0812..., tapi Fonnte memerlukan format full international tanpa 0 depan.
    target = "62" + digitsOnly.slice(1);
  } else if (digitsOnly.startsWith("62")) {
    target = digitsOnly;
  } else if (digitsOnly.startsWith("1") && digitsOnly.length >= 10) {
    // Format nomor AS seperti +1...
    target = digitsOnly;
    countryCode = "1";
  }

  const pesan = "Yth. Wali Murid,\n\nAnak Anda *" + nama + "* telah presensi *" + status + "* pada jam " + jam + ".\n\nTerima kasih.\n- Class Digital SMPN 18 Padang";

  const payload = {
    target: target,
    message: pesan
  };
  if (countryCode) payload.countryCode = countryCode;

  Logger.log("Kirim WA target=" + target + " countryCode=" + (countryCode || "(none)"));

  const options = {
    method: 'post',
    headers: { Authorization: waToken },
    payload: payload,
    muteHttpExceptions: true,
    followRedirects: true
  };

  try {
    const response = UrlFetchApp.fetch(WA_URL, options);
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