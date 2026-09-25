import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Chrome
} from 'lucide-react';
import { callAPI, saveSession } from '../services/api';
import { supabase } from '../lib/supabase';
import { UserSession } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: UserSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const logoUrl = new URL('../../LOGO SMP 18 X KELAS 8G.png', import.meta.url).href;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const visitorLabel = 'Masuk sebagai Pengunjung';
  const adminLabel = 'Masuk sebagai Admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await callAPI("login", {
        username: username.trim(),
        password: password.trim()
      });

      if (res.success && res.token) {
        const user: UserSession = {
          username: res.username || username.trim(),
          nama: res.nama || "Admin",
          role: res.role || "Admin",
          token: res.token
        };
        saveSession(user);
        onLoginSuccess(user);
      } else {
        setErrorMsg(res.message || "Username atau password salah.");
      }
    } catch {
      setErrorMsg("Gagal menghubungi server. Periksa koneksi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncAdminUsers = async () => {
      try {
        const res = await callAPI('getAdminUsers');
        if (!res.success || !Array.isArray(res.data)) {
          return;
        }
      } catch {
        // Ignore sync errors
      }
    };

    syncAdminUsers();
  }, []);

  const handleSupabaseGoogleLogin = async () => {
    if (!supabase) {
      setErrorMsg('Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin || '').replace(/\/$/, '');

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: appUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login Google via Supabase gagal.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.25),transparent_30%),linear-gradient(135deg,#020817_0%,#0f172a_30%,#111827_100%)] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute left-10 top-16 h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-12 bottom-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:36px_36px] mask-[radial-gradient(circle_at_center,black_48%,transparent_100%)]" />
      </div>

      <div className="w-full max-w-5xl relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] items-center">
        <div className="hidden lg:flex flex-col gap-5 rounded-[32px] border border-cyan-300/10 bg-slate-950/35 p-8 backdrop-blur-xl shadow-[0_30px_80px_rgba(15,23,42,0.7)]">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-100">
            Smart School
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black leading-tight text-white">
              Presensi Digital<br />
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-300 bg-clip-text text-transparent">Kelas 8.G</span>
            </h2>
            <p className="max-w-md text-sm text-slate-300">
              Kelola absen, pemanggilan siswa, dan laporan kehadiran dengan tampilan yang lebih modern, cepat, dan intuitif.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-2">
            {[
              ['768', 'Siswa'],
              ['96%', 'Hadir'],
              ['24/7', 'Realtime']
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur-sm">
                <div className="text-2xl font-black text-white">{value}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-md justify-self-center relative z-10">
          <div className="bg-white/8 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 shadow-[0_30px_100px_rgba(15,23,42,0.85)] border border-cyan-300/10 space-y-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <img
                  src={logoUrl}
                  alt="Logo sekolah"
                  className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 object-contain"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-100">
                  Smart School
                </div>
                <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight">SMP NEGERI 18 PADANG</h1>
              </div>
              <p className="text-sm text-slate-300 font-medium">
                Presensi Digital Kelas 8.G
              </p>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/30 text-rose-100 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleSupabaseGoogleLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-400 via-cyan-500 to-sky-600 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm transition shadow-[0_18px_35px_rgba(14,165,233,0.35)] flex items-center justify-center gap-2"
              >
                <Chrome className="w-4 h-4 text-white" />
                <span>{visitorLabel}</span>
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-slate-900/80 px-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400">Atau</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                <div className="text-left">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200 mb-2">{adminLabel}</div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-200 uppercase tracking-[0.2em] mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <input
                      id="inputLoginUsername"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username"
                      className="w-full bg-slate-950/30 border border-white/10 rounded-2xl px-3.5 py-3 pl-11 text-sm focus:ring-2 focus:ring-cyan-400/50 outline-none font-medium text-white placeholder:text-slate-400"
                      required
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-200 uppercase tracking-[0.2em] mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="inputLoginPassword"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full bg-slate-950/30 border border-white/10 rounded-2xl px-3.5 py-3 pl-11 text-sm focus:ring-2 focus:ring-cyan-400/50 outline-none font-medium text-white placeholder:text-slate-400"
                      required
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  </div>
                </div>

                <button
                  id="btnLoginSubmit"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-sm transition shadow-[0_18px_35px_rgba(37,99,235,0.45)] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span>Memproses Masuk...</span>
                  ) : (
                    <>
                      <span>{adminLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="text-center mt-6 text-xs text-slate-400 font-medium tracking-[0.22em] uppercase">
            Presensi Digital Kelas 8.G • SMP Negeri
          </div>
        </div>
      </div>
    </div>
  );
};