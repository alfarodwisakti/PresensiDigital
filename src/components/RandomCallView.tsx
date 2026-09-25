import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Dice5, RefreshCw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { callAPI, DEFAULT_KELAS } from '../services/api';
import { Siswa } from '../types';

const SOUND_ENABLED_KEY = 'presensi_random_call_sound';

export const RandomCallView: React.FC = () => {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [selected, setSelected] = useState<Siswa | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const raw = localStorage.getItem(SOUND_ENABLED_KEY);
    return raw === null ? true : raw === 'true';
  });

  const previousSelectedRef = useRef<string | null>(null);

  const activePool = useMemo(() => {
    if (!selected) return siswaList;
    return siswaList.filter((s) => s.nomorQr !== selected.nomorQr);
  }, [siswaList, selected]);

  const loadSiswa = async () => {
    setLoading(true);
    try {
      const res = await callAPI('getDaftarSiswa', { kelas: DEFAULT_KELAS });
      if (res.success && Array.isArray(res.data)) {
        const sorted = [...res.data].sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
        setSiswaList(sorted);
      }
    } catch (error) {
      console.error('Gagal memuat data siswa untuk pemanggilan acak:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSiswa();
  }, []);

  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.04) => {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration / 1000);

    setTimeout(() => ctx.close(), duration + 50);
  };

  const normalizeForSpeech = (name: string) => {
    return name
      .trim()
      .replace(/[-_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\./g, '')
      .replace(/\b([A-Z])\b/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const playCallSound = (student: Siswa | null) => {
    if (!soundEnabled) return;

    const tones = [660, 880, 990, 1180];
    tones.forEach((freq, index) => {
      setTimeout(() => playTone(freq, 180, index % 2 === 0 ? 'triangle' : 'sine', 0.06), index * 120);
    });

    const speech = window.speechSynthesis;
    if (student && speech && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(normalizeForSpeech(student.nama));
      utterance.lang = 'id-ID';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1;

      const voices = speech.getVoices();
      const preferredVoice = voices.find((voice) => /id-ID|indonesian|indonesia/i.test(voice.lang))
        || voices.find((voice) => /^id/i.test(voice.lang))
        || voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      speech.cancel();
      setTimeout(() => speech.speak(utterance), 150);
    }
  };

  const handlePickRandom = () => {
    if (siswaList.length === 0) return;

    setIsCalling(true);
    const sourcePool = activePool.length > 0 ? activePool : siswaList;
    const randomIndex = Math.floor(Math.random() * sourcePool.length);
    const nextSelected = sourcePool[randomIndex];

    setTimeout(() => {
      setSelected(nextSelected);
      previousSelectedRef.current = nextSelected.nomorQr;
      setIsCalling(false);
      // Kirim langsung siswa yang baru terpilih, jangan andalkan state
      // `selected` di closure ini — closure-nya masih membawa nilai LAMA
      // (dari render sebelum klik ini), makanya suara sebelumnya selalu
      // telat 1 putaran / hening di klik pertama.
      playCallSound(nextSelected);
    }, 1200);
  };

  const resetPick = () => {
    setSelected(null);
    previousSelectedRef.current = null;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 rounded-3xl p-6 text-white shadow-xl shadow-fuchsia-600/20 overflow-hidden relative">
        <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-10 bottom-0 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-[6px] border-yellow-300 bg-gradient-to-br from-blue-700 to-blue-900 shadow-lg shadow-blue-950/20">
              <div className="absolute inset-2 rounded-full border-2 border-yellow-300/80" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[10px] font-black text-blue-900 shadow-inner">
                SMP
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] font-bold uppercase tracking-[0.22em] text-fuchsia-100">
                <Sparkles className="w-3.5 h-3.5" />
                Pemanggilan Acak
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">SMPN 18 PADANG</h1>
              <div className="mt-1 text-xs sm:text-sm font-bold uppercase tracking-[0.22em] text-blue-100">
                KELAS VIII.G
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 transition"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {soundEnabled ? 'Suara Aktif' : 'Suara Mati'}
            </button>
            <button
              type="button"
              onClick={loadSiswa}
              className="inline-flex items-center gap-2 rounded-xl bg-white text-fuchsia-700 hover:bg-fuchsia-50 px-4 py-2.5 text-sm font-bold shadow-lg active:scale-98 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-slate-800">Layar Pemanggilan</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-semibold">
              {siswaList.length} siswa
            </span>
          </div>

          <div className="relative flex items-center justify-center min-h-[360px] rounded-3xl bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className={[
                'absolute inset-8 rounded-full border-[10px] border-violet-200/80',
                isCalling ? 'animate-spin [animation-duration:1.2s]' : ''
              ].join(' ')}
            />
            <div className="absolute inset-16 rounded-full border-4 border-dashed border-violet-300/80" />

            <div className="relative z-10 w-full max-w-md text-center px-6 py-8">
              <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-100 text-violet-700 shadow-inner">
                <BellRing className={`w-8 h-8 ${isCalling ? 'animate-bounce' : ''}`} />
              </div>

              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-blue-700">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-600" />
                {isCalling ? 'Memanggil...' : selected ? 'Siswa Terpilih' : 'Siap Memanggil'}
              </div>

              <div className="mb-4 rounded-2xl border border-yellow-200 bg-gradient-to-r from-yellow-100 via-white to-blue-50 px-3 py-2 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.35em] text-blue-800">KELAS</div>
                <div className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-violet-700">VIII.G</div>
              </div>

              <h3 className={`font-black tracking-tight text-slate-900 transition-all duration-500 ${isCalling ? 'text-3xl sm:text-4xl animate-pulse' : 'text-4xl sm:text-5xl'}`}>
                {isCalling ? '...' : selected ? selected.nama : 'Belum Dipilih'}
              </h3>

              {selected && (
                <div className="mt-6 space-y-2 text-sm text-slate-600">
                  <div className="font-mono text-base font-bold text-violet-700">{selected.nomorQr}</div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-violet-700 font-semibold">
                    <Dice5 className="w-4 h-4" />
                    {selected.kelas}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handlePickRandom}
              disabled={loading || isCalling || siswaList.length === 0}
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50 text-white font-bold px-5 py-3.5 rounded-2xl shadow-lg shadow-violet-600/20 active:scale-98 transition"
            >
              {isCalling ? 'Sedang Memilih...' : selected ? 'Panggil Lagi' : 'Panggil Siswa'}
            </button>

            <button
              type="button"
              onClick={resetPick}
              className="px-5 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Daftar Siswa</h2>

          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Memuat siswa...
            </div>
          ) : siswaList.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">
              Belum ada siswa yang terdaftar.
            </div>
          ) : (
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {siswaList.map((s) => {
                const isChosen = selected?.nomorQr === s.nomorQr;
                return (
                  <div
                    key={s.nomorQr}
                    className={[
                      'flex items-center justify-between rounded-2xl border px-3 py-3 transition',
                      isChosen
                        ? 'border-violet-200 bg-violet-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{s.nama}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{s.nomorQr}</div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-slate-200 text-slate-600">
                      {s.kelas}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
