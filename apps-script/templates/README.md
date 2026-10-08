# Template sheet untuk Google Sheets

Buat 3 sheet dengan nama persis berikut:

1. Admin
2. Siswa
3. Presensi

Catatan: untuk login pengunjung, tidak diperlukan sheet terpisah. Pengunjung cukup login dengan email Google yang valid.

## Admin.csv
username,password,nama,role
admin,admin123,Admin Utama,Admin

## Siswa.csv
nomorQr,barcode,nama,kelas
2408001,2408001,AFIFAH SYAHIRA FITRI,8.G
2408002,2408002,AFIQAH KHAIRUNNISA RIZALOV,8.G
2408003,2408003,ALFARIS ADRIAN AKBAR,8.G

## Presensi.csv
tanggal,jam,nomorQr,nama,kelas,status,metode,keterangan
2026-09-18,06:45:12,2408001,AFIFAH SYAHIRA FITRI,8.G,Hadir,Scan,
2026-09-18,06:50:35,2408002,AFIQAH KHAIRUNNISA RIZALOV,8.G,Terlambat,Scan,Terlambat masuk

Setelah sheet dibuat, ganti nilai `SPREADSHEET_ID` di [apps-script/PresensiDigital.gs](../PresensiDigital.gs) dengan ID spreadsheet Anda lalu deploy ulang Web App.

Sheet `Presensi Mapel` akan dibuat otomatis ketika konfirmasi presensi per mata pelajaran pertama kali berhasil. Jangan ubah nama atau header kolom sheet tersebut setelah dibuat. Setelah memperbarui kode Apps Script, buka **Deploy > Manage deployments**, edit deployment Web App, pilih **New version**, lalu deploy agar aksi konfirmasi tersedia di aplikasi.
