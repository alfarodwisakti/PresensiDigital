// Google Apps Script backend untuk Presensi Digital 8.G
const SPREADSHEET_ID = "1IvcU5AgRMF4a9CiY8QnSuMAQMG9pvj_mJBv_bdQPnzo";
const SHEET_ADMIN = "Admin";
const SHEET_DATA_SISWA = "Siswa"; // PASTIKAN NAMA TAB DI GOOGLE SHEET ADALAH "Siswa"
const SHEET_PRESENSI = "Presensi";
const JAM_BATAS_TERLAMBAT = "07:15";

// --- KONFIGURASI WHATSAPP GATEWAY ---
const WA_TOKEN = "JhoAvrvGXDPYWGRMX7Ng"; 
const WA_URL = "https://api.fonnte.com/send";

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

// Fungsi membaca baris dengan mapping header yang lebih fleksibel
function readSheetRows(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log("ERROR: Sheet '" + sheetName + "' tidak ditemukan!");
    return [];
  }

  const values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];

  // Normalisasi header: huruf kecil, hapus spasi
  const headers = values[0].map((h) => asText(h).toLowerCase().replace(/\s+/g, ""));
  
  return values.slice(1).map((row) => {
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = row[idx] ?? "";
    });
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
  const rows = readSheetRows(SHEET_DATA_SISWA).map((row) => {
    // Cari variasi nama kolom untuk Nomor QR dan No Ortu
    const nomorQr = asText(row["nomorqr"] || row["noqr"] || row["nis"] || "");
    const noOrtu = asText(row["no_ortu"] || row["nohp"] || row["notelepon"] || row["hportu"] || "");
    
    return {
      nomorQr: nomorQr,
      nama: asText(row.nama),
      kelas: asText(row.kelas),
      noOrtu: noOrtu // Simpan nomor ortu di objek siswa
    };
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

        response = { success: true, message: "Berhasil", nama: siswa.nama, status: status };

        // --- PROSES KIRIM WA ---
        Logger.log("Mencoba kirim WA ke: " + siswa.noOrtu + " (Siswa: " + siswa.nama + ")");
        
        if (siswa.noOrtu) {
          kirimWaOrtu(siswa.nama, status, siswa.noOrtu, jam.substring(0,5));
        } else {
          Logger.log("GAGAL KIRIM WA: Kolom No_Ortu kosong untuk siswa " + siswa.nama);
        }
        
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
  // Format nomor HP
  if (noHp.startsWith("0")) noHp = "62" + noHp.slice(1);
  if (noHp.startsWith("+")) noHp = noHp.slice(1);

  const pesan = `Yth. Wali Murid,\n\nAnak Anda *${nama}* telah presensi *\${status}* pada jam ${jam}.\n\nTerima kasih.\n- Class Digital SMPN 18 Padang`;

  const options = {
    'method': 'post',
    'headers': { 'Authorization': WA_TOKEN },
    'payload': { 'target': noHp, 'message': pesan, 'countryCode': '62' },
    'mute': true
  };

  try {
    const res = UrlFetchApp.fetch(WA_URL, options);
    Logger.log("Respon Fonnte: " + res.getContentText());
  } catch (e) {
    Logger.log("Error Kirim WA: " + e.toString());
  }
}