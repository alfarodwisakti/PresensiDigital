/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { PresensiView } from './components/PresensiView';
import { PresensiMapelView } from './components/PresensiMapelView';
import { RekapView } from './components/RekapView';
import { SiswaView } from './components/SiswaView';
import { RandomCallView } from './components/RandomCallView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { getSession, clearSession, saveSession } from './services/api';
import { supabase } from './lib/supabase';
import { UserSession } from './types';

export default function App() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedUser = getSession();
    if (savedUser && savedUser.provider === 'supabase' && supabase) {
      setUser(savedUser);
    } else if (savedUser) {
      clearSession();
      setUser(null);
    }

    if (supabase) {
      const hydrateSupabaseUser = (session: any) => {
        if (!session?.user) {
          clearSession();
          setUser(null);
          return;
        }

        const nextUser: UserSession = {
          username: session.user.email || session.user.user_metadata?.full_name || 'user',
          nama: session.user.user_metadata?.full_name || session.user.email || 'User',
          role: 'Pengunjung',
          token: session.access_token,
          email: session.user.email || undefined,
          provider: 'supabase'
        };

        saveSession(nextUser);
        setUser(nextUser);
      };

      let mounted = true;
      const hydrate = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (mounted) hydrateSupabaseUser(session);
        } finally {
          if (mounted) setIsReady(true);
        }
      };

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (mounted) hydrateSupabaseUser(session);
      });

      void hydrate();
      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    setIsReady(true);
  }, []);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut().catch(() => undefined);
    }

    clearSession();
    setUser(null);
    setCurrentTab('dashboard');
  };

  const handleLoginSuccess = (loggedInUser: UserSession) => {
    setUser(loggedInUser);
    setCurrentTab('dashboard');
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        Memuat aplikasi...
      </div>
    );
  }

  // If not logged in, show login page
  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="digital-app-shell text-slate-100">
      <div className="digital-grid" />
      <div className="digital-noise" />

      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          user={user}
          onLogout={handleLogout}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <main className="relative flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto max-h-screen z-10">
          <div className="mx-auto max-w-7xl">
            <div className="digital-topbar">
              <div className="digital-topbar-badge">Digital Class</div>
              <div className="digital-topbar-info">
                <span className="digital-topbar-dot" />
                <span>Kelas 8.G • Sistem Presensi</span>
              </div>
            </div>

            {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} userRole={user?.role} />}
            {currentTab === 'presensi' && <PresensiView />}
            {currentTab === 'presensi-mapel' && <PresensiMapelView guruNama={user?.nama || user?.username || 'Guru'} />}
            {currentTab === 'rekap' && <RekapView userRole={user?.role} />}
            {currentTab === 'siswa' && <SiswaView />}
            {currentTab === 'random-call' && <RandomCallView />}
            {currentTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>
    </div>
  );
}
