import React from 'react';
import { BrainCircuit } from 'lucide-react';

import {
  InteractionMode,
  UserRole,
  CoachingLevel,
  AgentProfile,
  UserAccount,
} from '../types';

interface NavbarProps {
  currentMode: InteractionMode;
  onSelectMode: (mode: InteractionMode) => void;
  userRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  coachingLevel: CoachingLevel;
  onChangeCoachingLevel: (level: CoachingLevel) => void;
  userProfile: AgentProfile;
  piiMaskingEnabled: boolean;
  onTogglePiiMasking: () => void;
  activeLanguage: string;
  onChangeLanguage: (lang: string) => void;
  onOpenQuickManual: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
  currentUser?: UserAccount | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-slate-100">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* =====================================================
            PROJECT BRAND
            ===================================================== */}
        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 shrink-0">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>

          <span className="font-bold tracking-tight text-base sm:text-lg text-white">
            Customer Support{' '}
            <span className="text-indigo-400">
              Assistant
            </span>
          </span>

        </div>

        {/* =====================================================
            USER + LOGOUT
            ===================================================== */}
        <div className="flex items-center gap-3">

          {currentUser && (
            <div className="flex items-center gap-2">

              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-indigo-500/40">
                {currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>

              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold text-slate-100">
                  {currentUser.name}
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  {currentUser.email}
                </div>
              </div>

            </div>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 text-xs font-medium transition"
              title="Log Out of System"
            >
              Logout
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
