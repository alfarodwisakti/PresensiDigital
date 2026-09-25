import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Square, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Upload, 
  Sparkles, 
  History, 
  Clock,
  UserCheck,
  Video,
  Volume2,
  Maximize2,
  Minimize2,
  Monitor,
  XCircle,
  Flashlight,
  FlashlightOff,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { callAPI, formatTanggal, formatJam, DEFAULT_KELAS } from '../services/api';
import { Siswa, StatusPresensi, MetodePresensi } from '../types';

interface SessionLogItem {
  nomorQr: string;
  nama: string;
  status: StatusPresensi;
  metode: MetodePresensi;
  jam: string;
}

interface ScanFeedback {
  type: 'success' | 'duplicate' | 'error';
  nama?: string;
  message: string;
}

export const PresensiView: React.FC = () => {
  const scanSoundUrl = new URL('../../store-scanner-beep-sound-effect.mp3', import.meta.url).href;

  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLogItem[]>([]);

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('Tekan "Mulai Kamera" untuk mengaktifkan pemindaian barcode/QR.');
  const [notif, setNotif] = useState<{ message: string; isError: boolean; time: string } | null>(null);
  const [selectedFacing, setSelectedFacing] = useState<string>('environment');
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCooldownRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isFullscreenScan, setIsFullscreenScan] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomValue, setZoomValue] = useState(1);

  // Manual Tab state
  const [manualQuery, setManualQuery] = useState('');
  const [manualNomorQr, setManualNomorQr] = useState('');
  const [manualNama, setManualNama] = useState('');
  const [manualStatus, setManualStatus] = useState<StatusPresensi>('Hadir');
  const [manualKeterangan, setManualKeterangan] = useState('');
  const [manualConfirmChecked, setManualConfirmChecked] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [submittingManual, setSubmittingManual] = useState(false);

  // Play scan sound effect
  const playBeep = (isSuccess: boolean) => {
    try {
      const audio = new Audio(scanSoundUrl);
      audio.volume = 0.8;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Ignore autoplay restrictions until user interacts with the page.
      });
      return;
    } catch {
      // Fallback to synthesized tone if audio cannot be created.
    }

    try {
      const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtor();
      }

      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const duration = isSuccess ? 0.18 : 0.26;
      const startFrequency = isSuccess ? 820 : 260;
      const endFrequency = isSuccess ? 1180 : 180;

      osc.frequency.setValueAtTime(startFrequency, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFrequency, audioCtx.currentTime + duration);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  // Ucapkan kata lewat text-to-speech browser (dipakai untuk suara "Hebat"
  // saat siswa sudah terpresensi, supaya tidak perlu file audio tambahan).
  const speak = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.25;
      utterance.pitch = 1.1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Abaikan jika text-to-speech tidak didukung browser.
    }
  };

  const triggerScanFeedback = (feedback: ScanFeedback, durationMs: number = 900) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setScanFeedback(feedback);
    feedbackTimeoutRef.current = setTimeout(() => {
      setScanFeedback(null);
    }, durationMs);
  };

  // Cek dukungan senter (torch) & zoom pada kamera yang sedang aktif.
  const refreshTrackCapabilities = () => {
    try {
      const caps: any = html5QrCodeRef.current?.getRunningTrackCapabilities?.();
      if (!caps) {
        setTorchSupported(false);
        setZoomSupported(false);
        return;
      }
      setTorchSupported(!!caps.torch);
      if (caps.zoom && typeof caps.zoom === 'object') {
        const min = caps.zoom.min ?? 1;
        const max = caps.zoom.max ?? 1;
        const step = caps.zoom.step || 0.1;
        if (max > min) {
          setZoomSupported(true);
          setZoomCaps({ min, max, step });
          const settings: any = html5QrCodeRef.current?.getRunningTrackSettings?.();
          setZoomValue(settings?.zoom ?? min);
        } else {
          setZoomSupported(false);
          setZoomCaps(null);
        }
      } else {
        setZoomSupported(false);
        setZoomCaps(null);
      }
    } catch {
      setTorchSupported(false);
      setZoomSupported(false);
    }
  };

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !torchSupported) return;
    const next = !torchOn;
    try {
      await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ torch: next }] } as any);
      setTorchOn(next);
    } catch (err) {
      console.warn('Senter tidak didukung perangkat/browser ini:', err);
      setTorchSupported(false);
    }
  };

  const handleZoomChange = async (value: number) => {
    if (!html5QrCodeRef.current || !zoomSupported || !zoomCaps) return;
    const clamped = Math.min(zoomCaps.max, Math.max(zoomCaps.min, value));
    try {
      await html5QrCodeRef.current.applyVideoConstraints({ advanced: [{ zoom: clamped }] } as any);
      setZoomValue(clamped);
    } catch (err) {
      console.warn('Zoom gagal diterapkan:', err);
    }
  };

  // Load students for cache & manual autocomplete
  useEffect(() => {
    const loadStudents = async () => {
      const res = await callAPI("getDaftarSiswa", { kelas: DEFAULT_KELAS });
      if (res.success && Array.isArray(res.data)) {
        setSiswaList(res.data);
      }
    };
    loadStudents();

    // Check cameras
    if (navigator.mediaDevices && typeof Html5Qrcode !== "undefined") {
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          setAvailableCameras(devices);
        }
      }).catch(err => {
        console.warn("Kamera devices check:", err);
      });
    }

    return () => {
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        void scanner.stop().catch(() => undefined).finally(() => {
          try { scanner.clear(); } catch { /* scanner may already be cleared */ }
        });
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const showNotification = (message: string, isError: boolean) => {
    setNotif({
      message,
      isError,
      time: formatJam()
    });
  };

  const handleAttendance = async (
    nomorQr: string,
    statusInput: StatusPresensi,
    metode: MetodePresensi,
    keterangan: string = "",
    options: { playSuccessSound?: boolean; playErrorSound?: boolean } = {}
  ) => {
    const { playSuccessSound = true, playErrorSound = true } = options;
    const nowJam = formatJam();
    const student = siswaList.find((item) => {
      const targetQr = String(item.nomorQr ?? "").trim();
      const targetBarcode = String(item.barcode ?? item.nomorQr ?? "").trim();
      return targetQr === String(nomorQr).trim() || targetBarcode === String(nomorQr).trim();
    });

    const payloadNama = student?.nama || "Tidak Diketahui";
    const payloadKelas = student?.kelas || DEFAULT_KELAS;
    const payloadNoOrtu = student?.noOrtu || "";

    const res = await callAPI("simpanPresensi", {
      nomorQr,
      nama: payloadNama,
      status: statusInput,
      metode,
      keterangan,
      kelas: payloadKelas,
      tanggal: formatTanggal(),
      jam: nowJam,
      noOrtu: payloadNoOrtu
    });

    if (res.success) {
      if (playSuccessSound) {
        playBeep(true);
      }
      const studentName = res.nama || "Siswa";
      const finalStatus = res.status || statusInput;
      showNotification(`✅ Presensi Berhasil: ${studentName} (${nomorQr}) — Status: ${finalStatus}`, false);
      
      setSessionLogs(prev => [
        {
          nomorQr,
          nama: studentName,
          status: finalStatus,
          metode,
          jam: nowJam
        },
        ...prev
      ]);
    } else {
      if (playErrorSound) {
        playBeep(false);
      }
      showNotification(`⚠️ ${res.message || 'Gagal mencatat presensi'} (Nomor: ${nomorQr})`, true);
    }
    return res;
  };

  const startScanner = async () => {
    if (isScanning) return;
    setScannerStatus('Membuka kamera...');

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }

      const qrConfig = { 
        fps: 15, 
        qrbox: { width: 260, height: 260 },
        aspectRatio: 1.0
      };

      const cameraMode = selectedFacing.length > 20 
        ? selectedFacing 
        : { facingMode: selectedFacing === 'user' ? 'user' : 'environment' };

      await html5QrCodeRef.current.start(
        cameraMode,
        qrConfig,
        async (decodedText) => {
          if (isCooldownRef.current) return;
          const cleaned = String(decodedText || "").trim();
          if (!cleaned) return;

          isCooldownRef.current = true;
          setScannerStatus(`Memproses kode: ${cleaned}...`);

          try {
            const result = await handleAttendance(cleaned, "Hadir", "Scan", "", {
              playSuccessSound: false,
              playErrorSound: false
            });

            if (result.success && result.duplicate) {
              speak('Hebat!');
              triggerScanFeedback({
                type: 'duplicate',
                nama: result.nama,
                message: 'Sudah presensi hari ini'
              });
            } else if (result.success) {
              playBeep(true);
              triggerScanFeedback({
                type: 'success',
                nama: result.nama,
                message: result.status || 'Hadir'
              });
            } else {
              playBeep(false);
              triggerScanFeedback({
                type: 'error',
                message: result.message || 'Barcode/QR tidak dikenali.'
              });
            }
          } catch (error) {
            console.error('Gagal memproses hasil scan:', error);
            playBeep(false);
            triggerScanFeedback({
              type: 'error',
              message: 'Terjadi kesalahan saat memproses presensi.'
            });
          } finally {
            const cooldownDuration = isFullscreenScan ? 1100 : 900;
            window.setTimeout(() => {
              isCooldownRef.current = false;
              setScannerStatus('Scanner aktif. Arahkan barcode/QR ke kamera.');
            }, cooldownDuration);
          }
        },
        () => {
          // Frame error (normal during search)
        }
      );

      setIsScanning(true);
      setScannerStatus('Scanner aktif. Arahkan barcode atau QR Code ke dalam kotak.');
      refreshTrackCapabilities();
    } catch (err: any) {
      console.error("Camera start error:", err);
      setIsScanning(false);
      const errName = err?.name || '';
      if (errName === 'NotAllowedError') {
        setScannerStatus('Izin kamera ditolak. Izinkan akses kamera pada browser Anda.');
      } else if (errName === 'NotFoundError') {
        setScannerStatus('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setScannerStatus(`Kamera tidak dapat dibuka (${err?.message || 'Gagal akses'}). Gunakan tombol tes atau input manual.`);
      }
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Scanner stop error:", err);
      } finally {
        setIsScanning(false);
        setScannerStatus('Scanner dihentikan.');
        setIsFullscreenScan(false);
        setScanFeedback(null);
        setTorchOn(false);
        setTorchSupported(false);
        setZoomSupported(false);
        setZoomCaps(null);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerStatus('Memindai gambar yang diunggah...');
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("reader");
      }
      const decoded = await html5QrCodeRef.current.scanFile(file, true);
      const cleaned = String(decoded || "").trim();
      if (cleaned) {
        await handleAttendance(cleaned, "Hadir", "Scan", "Upload Barcode");
      }
    } catch {
      showNotification('⚠️ Barcode/QR tidak terdeteksi pada gambar yang diunggah.', true);
    } finally {
      e.target.value = '';
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNomorQr) {
      showNotification('Pilih siswa dari saran pencarian terlebih dahulu.', true);
      return;
    }

    if (!manualConfirmChecked) {
      showNotification('Centang konfirmasi data siswa sebelum menyimpan presensi manual.', true);
      return;
    }

    setSubmittingManual(true);
    const res = await handleAttendance(manualNomorQr, manualStatus, "Manual", manualKeterangan);
    setSubmittingManual(false);

    if (res.success) {
      setManualQuery('');
      setManualNomorQr('');
      setManualNama('');
      setManualKeterangan('');
      setManualStatus('Hadir');
      setManualConfirmChecked(false);
    }
  };

  const filteredAutocomplete = manualQuery.trim() === '' ? [] : siswaList.filter(s => {
    const q = manualQuery.toLowerCase();
    return s.nama.toLowerCase().includes(q) || s.nomorQr.toLowerCase().includes(q);
  }).slice(0, 6);

  const getStatusBadge = (status: StatusPresensi) => {
    switch (status) {
      case 'Hadir':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Hadir</span>;
      case 'Terlambat':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Terlambat</span>;
      case 'Izin':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Izin</span>;
      case 'Sakit':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Sakit</span>;
      case 'Alpa':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Alpa</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Presensi Kelas {DEFAULT_KELAS}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Scan kode barcode/QR atau input manual kehadiran siswa</p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl shrink-0 self-start">
          <button
            id="tabScanBtn"
            onClick={() => {
              setActiveTab('scan');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'scan'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Scan Barcode/QR</span>
          </button>
          <button
            id="tabManualBtn"
            onClick={() => {
              setActiveTab('manual');
              stopScanner();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === 'manual'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Input Manual</span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Action Area */}
        <div className="lg:col-span-7 space-y-4">
          {activeTab === 'scan' ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <select
                    id="cameraSelector"
                    value={selectedFacing}
                    onChange={(e) => setSelectedFacing(e.target.value)}
                    disabled={isScanning}
                    className="w-full text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-700 font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="environment">📷 Kamera Belakang (Utama)</option>
                    <option value="user">🤳 Kamera Depan (Selfie)</option>
                    {availableCameras.map(cam => (
                      <option key={cam.id} value={cam.id}>
                        {cam.label || `Kamera ${cam.id.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {!isScanning ? (
                  <button
                    id="btnStartScanner"
                    onClick={startScanner}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-xs active:scale-95"
                  >
                    <Video className="w-4 h-4" />
                    <span>Mulai Kamera QR</span>
                  </button>
                ) : (
                  <button
                    id="btnStopScanner"
                    onClick={stopScanner}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow-xs active:scale-95"
                  >
                    <Square className="w-4 h-4" />
                    <span>Hentikan Kamera</span>
                  </button>
                )}

                <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Foto QR</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>

                <button
                  type="button"
                  id="btnFullscreenScan"
                  onClick={() => {
                    if (!isScanning) {
                      startScanner();
                    }
                    setIsFullscreenScan(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Layar Penuh</span>
                </button>
              </div>

              <div
                className={
                  isFullscreenScan
                    ? 'fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center'
                    : 'relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center min-h-[300px]'
                }
              >
                {isFullscreenScan && (
                  <button
                    type="button"
                    onClick={() => setIsFullscreenScan(false)}
                    aria-label="Tutup layar penuh"
                    className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition backdrop-blur-sm"
                  >
                    <Minimize2 className="w-5 h-5" />
                  </button>
                )}

                <div id="reader" className={isFullscreenScan ? 'w-full h-full max-w-none' : 'w-full h-full max-w-[420px]'} />

                {/* Bingkai/border patokan target scan — hanya dekoratif, tidak menghalangi kamera */}
                {isFullscreenScan && isScanning && !scanFeedback && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <div className="relative w-64 h-64 sm:w-80 sm:h-80">
                      <span className="absolute top-0 left-0 w-9 h-9 border-t-4 border-l-4 border-blue-400 rounded-tl-2xl" />
                      <span className="absolute top-0 right-0 w-9 h-9 border-t-4 border-r-4 border-blue-400 rounded-tr-2xl" />
                      <span className="absolute bottom-0 left-0 w-9 h-9 border-b-4 border-l-4 border-blue-400 rounded-bl-2xl" />
                      <span className="absolute bottom-0 right-0 w-9 h-9 border-b-4 border-r-4 border-blue-400 rounded-br-2xl" />
                    </div>
                  </div>
                )}

                {!isScanning && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-900/90 text-slate-200">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center mb-3">
                      <Camera className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-semibold text-slate-100 mb-1">Scanner QR siap</p>
                    <p className="text-xs text-slate-400 max-w-xs mb-4">
                      Arahkan barcode atau QR untuk presensi cepat dan akurat.
                    </p>
                    <button
                      onClick={startScanner}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
                    >
                      Buka Scanner QR
                    </button>
                  </div>
                )}

                {/* Kontrol senter & zoom — hanya muncul kalau kamera perangkat mendukung */}
                {isFullscreenScan && isScanning && (torchSupported || zoomSupported) && (
                  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
                    {torchSupported && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        aria-label="Senter"
                        className={`w-11 h-11 rounded-full flex items-center justify-center border backdrop-blur-sm transition ${
                          torchOn
                            ? 'bg-amber-400 border-amber-300 text-slate-900'
                            : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                        }`}
                      >
                        {torchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
                      </button>
                    )}

                    {zoomSupported && zoomCaps && (
                      <div className="flex items-center gap-1 bg-white/10 border border-white/20 rounded-full px-1 py-1 backdrop-blur-sm">
                        <button
                          type="button"
                          aria-label="Perkecil zoom"
                          onClick={() => handleZoomChange(zoomValue - zoomCaps.step)}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-[11px] font-bold text-white w-8 text-center select-none">{zoomValue.toFixed(1)}x</span>
                        <button
                          type="button"
                          aria-label="Perbesar zoom"
                          onClick={() => handleZoomChange(zoomValue + zoomCaps.step)}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isFullscreenScan && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-black/50 border border-white/10 text-white text-xs font-medium backdrop-blur-sm max-w-[90%] text-center">
                    {scannerStatus}
                  </div>
                )}

                {/* Overlay animasi hasil scan (nama siswa, centang biru, gagal merah, "Hebat") — khusus mode Layar Penuh */}
                {isFullscreenScan && scanFeedback && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 backdrop-blur-sm">
                    {scanFeedback.type === 'success' && (
                      <div className="flex flex-col items-center text-center px-6 animate-scan-pop">
                        <div className="relative flex items-center justify-center mb-4">
                          <span className="absolute w-24 h-24 rounded-full border-4 border-blue-400 animate-scan-ring" />
                          <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
                            <CheckCircle2 className="w-14 h-14 text-white" />
                          </div>
                        </div>
                        <p className="text-2xl font-black text-white mb-1">{scanFeedback.nama || 'Presensi Berhasil'}</p>
                        <p className="text-sm font-semibold text-blue-300">{scanFeedback.message}</p>
                      </div>
                    )}

                    {scanFeedback.type === 'duplicate' && (
                      <div className="flex flex-col items-center text-center px-6 animate-scan-pop">
                        <div className="w-24 h-24 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/40 mb-4">
                          <Monitor className="w-14 h-14 text-white" />
                        </div>
                        <p className="text-2xl font-black text-white mb-1">Hebat, {scanFeedback.nama || 'Siswa'}!</p>
                        <p className="text-sm font-semibold text-amber-300">{scanFeedback.message}</p>
                      </div>
                    )}

                    {scanFeedback.type === 'error' && (
                      <div className="flex flex-col items-center text-center px-6 animate-scan-shake">
                        <div className="w-24 h-24 rounded-full bg-rose-600 flex items-center justify-center shadow-lg shadow-rose-600/40 mb-4">
                          <XCircle className="w-14 h-14 text-white" />
                        </div>
                        <p className="text-xl font-black text-white mb-1">Gagal</p>
                        <p className="text-sm font-semibold text-rose-300 max-w-xs">{scanFeedback.message}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span className="font-medium truncate">{scannerStatus}</span>
                <span className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0 ml-2">
                  <Volume2 className="w-3.5 h-3.5" /> Audio Suara Aktif
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tes Cepat Barcode Siswa:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {siswaList.slice(0, 6).map(s => (
                    <button
                      key={s.nomorQr}
                      onClick={() => handleAttendance(s.nomorQr, "Hadir", "Scan", "Simulasi Scan")}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-slate-200 transition font-mono"
                    >
                      {s.nomorQr} - {s.nama.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Manual Input Form */
            <form onSubmit={handleManualSubmit} className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Cari Nama Siswa atau Nomor QR
                </label>
                <div className="relative">
                  <input
                    id="manualSearchInput"
                    type="text"
                    placeholder="Ketik nama (misal: Ahmad) atau nomor QR (misal: 2408001)..."
                    value={manualQuery}
                    onChange={(e) => {
                      setManualQuery(e.target.value);
                      setManualConfirmChecked(false);
                      setShowAutocomplete(true);
                      if (manualNomorQr && e.target.value !== `${manualNama} (${manualNomorQr})`) {
                        setManualNomorQr('');
                        setManualNama('');
                      }
                    }}
                    onFocus={() => setShowAutocomplete(true)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-4 py-2.5 pl-10 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                    required
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>

                {/* Autocomplete Dropdown */}
                {showAutocomplete && filteredAutocomplete.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg z-20 overflow-hidden divide-y divide-slate-100">
                    {filteredAutocomplete.map(s => (
                      <button
                        key={s.nomorQr}
                        type="button"
                        onClick={() => {
                          setManualNomorQr(s.nomorQr);
                          setManualNama(s.nama);
                          setManualQuery(`${s.nama} (${s.nomorQr})`);
                          setManualConfirmChecked(false);
                          setShowAutocomplete(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 flex items-center justify-between transition"
                      >
                        <span className="font-semibold text-slate-800">{s.nama}</span>
                        <span className="text-xs font-mono font-bold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded">
                          {s.nomorQr}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Kehadiran Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Status Kehadiran
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['Hadir', 'Izin', 'Sakit', 'Alpa'] as StatusPresensi[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setManualStatus(st);
                        setManualConfirmChecked(false);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold border transition text-center ${
                        manualStatus === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">Konfirmasi Data</p>
                <div className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    id="manualConfirmCheckbox"
                    type="checkbox"
                    checked={manualConfirmChecked}
                    onChange={(e) => setManualConfirmChecked(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="manualConfirmCheckbox" className="leading-relaxed">
                    Saya sudah mengecek data siswa <span className="font-semibold">{manualNama || 'belum dipilih'}</span> dengan status <span className="font-semibold">{manualStatus}</span> dan siap konfirmasi presensi.
                  </label>
                </div>
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan (Opsional)
                </label>
                <textarea
                  id="manualKetInput"
                  rows={2}
                  value={manualKeterangan}
                  onChange={(e) => setManualKeterangan(e.target.value)}
                  placeholder="Contoh: Sakit flu demam, ada acara keluarga, dsb."
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden font-medium"
                />
              </div>

              {/* Submit Button */}
              <button
                id="btnSubmitManual"
                type="submit"
                disabled={submittingManual || !manualNomorQr || !manualConfirmChecked}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-md shadow-blue-600/20 active:scale-98"
              >
                {submittingManual ? 'Menyimpan Presensi...' : 'Konfirmasi & Simpan Presensi'}
              </button>
            </form>
          )}

          {/* Result Notification Banner */}
          {notif && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
              notif.isError 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              {notif.isError ? (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold text-sm">{notif.message}</div>
                <div className="text-[11px] opacity-75 mt-0.5">Waktu: {notif.time}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Area: Session Logs */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <h2 className="font-bold text-sm text-slate-800">Riwayat Sesi Ini</h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
              {sessionLogs.length} Terabsen
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto max-h-[460px] divide-y divide-slate-100">
            {sessionLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                Belum ada presensi yang dilakukan pada sesi ini.
              </div>
            ) : (
              sessionLogs.map((log, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-slate-800">{log.nama}</div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                      <span>{log.nomorQr}</span>
                      <span>•</span>
                      <span>{log.metode}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div>{getStatusBadge(log.status)}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">{log.jam}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
