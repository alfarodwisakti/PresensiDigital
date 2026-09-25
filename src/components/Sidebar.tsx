import React from 'react';
import { 
  LayoutDashboard, 
  QrCode, 
  BarChart3, 
  Users, 
  Settings, 
  LogOut, 
  GraduationCap,
  Menu,
  X,
  BellRing,
  ClipboardCheck
} from 'lucide-react';
import { UserSession } from '../types';

export type NavTab = 'dashboard' | 'presensi' | 'presensi-mapel' | 'rekap' | 'siswa' | 'random-call' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  user: UserSession | null;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  onLogout,
  mobileOpen,
  setMobileOpen
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, desc: 'Ringkasan harian' },
    { id: 'presensi' as NavTab, label: 'Presensi', icon: QrCode, desc: 'Scan QR & manual' },
    { id: 'presensi-mapel' as NavTab, label: 'Presensi Mapel', icon: ClipboardCheck, desc: 'Observasi guru per mapel' },
    { id: 'rekap' as NavTab, label: 'Rekap & Laporan', icon: BarChart3, desc: 'Grafik & export Excel' },
    { id: 'siswa' as NavTab, label: 'Data Siswa', icon: Users, desc: 'Kelola & cetak kartu' },
    { id: 'random-call' as NavTab, label: 'Panggil Acak', icon: BellRing, desc: 'Animasi & suara' },
    { id: 'settings' as NavTab, label: 'Koneksi & Panduan', icon: Settings, desc: 'Supabase & backend' },
  ];

  const visibleNavItems = user?.role === 'Pengunjung'
    ? navItems.filter(item => item.id === 'dashboard' || item.id === 'rekap')
    : navItems;

  return (
    <>
      {/* Mobile Topbar */}
      <div className="lg:hidden flex items-center justify-between bg-slate-950/85 text-white px-4 py-3 border-b border-cyan-400/20 sticky top-0 z-40 backdrop-blur-xl shadow-[0_15px_30px_rgba(8,47,73,0.55)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center font-black text-white shadow-[0_0_25px_rgba(59,130,246,0.55)]">
            8G
          </div>
          <div>
            <h1 className="font-bold text-sm leading-none">Presensi 8.G</h1>
            <p className="text-[11px] text-slate-400">Digital Class System</p>
          </div>
        </div>
        <button
          id="btnToggleMobileMenu"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2.5 rounded-xl bg-white/5 text-slate-200 hover:bg-white/10 active:scale-95 transition border border-cyan-300/20"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:static top-0 bottom-0 left-0 z-50
        w-72 flex flex-col border-r border-cyan-400/15
        bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.8))]
        text-slate-200 shadow-[0_25px_70px_rgba(2,6,23,0.7)] backdrop-blur-2xl
        transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.15),transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),transparent_24%)]" />

        <div className="relative z-10 p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-[0_12px_30px_rgba(59,130,246,0.45)] font-black text-lg ring-2 ring-white/10">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="font-black text-slate-100 text-base leading-tight tracking-tight">Presensi 8.G</div>
              <div className="text-[11px] text-cyan-300 font-medium tracking-[0.18em] uppercase">Smart Campus</div>
            </div>
          </div>
        </div>

        {user && (
          <div className="relative z-10 mx-4 my-4 p-2.5 rounded-2xl bg-white/5 border border-cyan-300/10 flex items-center gap-2.5 shadow-inner shadow-slate-900/30">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-600/30 text-cyan-200 font-black flex items-center justify-center text-xs border border-cyan-400/30">
              {user.nama ? user.nama.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-100 truncate">{user.nama}</div>
              <div className="text-[10px] text-cyan-300 uppercase tracking-[0.18em] font-bold">{user.role || 'Admin'}</div>
            </div>
          </div>
        )}

        <nav className="relative z-10 flex-1 px-3 py-3 space-y-2 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all text-left
                  ${isActive 
                    ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-violet-500/15 text-white shadow-[0_12px_30px_rgba(56,189,248,0.12)] ring-1 ring-cyan-300/30' 
                    : 'text-slate-300 hover:bg-white/5 hover:text-slate-100'
                  }
                `}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${isActive ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]' : 'border-white/10 bg-white/5 text-slate-400'}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate leading-tight font-semibold">{item.label}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-cyan-100/90' : 'text-slate-500'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="relative z-10 p-3 border-t border-white/10">
          <button
            id="btnLogout"
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 border border-transparent hover:border-rose-500/20 transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
};
