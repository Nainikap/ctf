import React, { useState } from 'react';
import { Shield, Lock, Terminal } from 'lucide-react';
import UserScreen from './components/UserScreen';
import CoordinatorPortal from './components/CoordinatorPortal';

export default function App() {
  const [showCoordinatorModal, setShowCoordinatorModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      {/* Top Header / Navigation (Solid White Bar) */}
      <header className="border-b-2 border-gray-300 bg-white sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-sm font-bold">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-lg text-gray-900">
                  CTF<span className="text-red-600">PORTAL</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-300">
                  ASSESSMENT
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium hidden sm:block">
                Time-Locked Question Engine
              </p>
            </div>
          </div>

          {/* Right Action: Coordinator Access */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCoordinatorModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-300 hover:border-red-600 text-xs font-bold shadow-sm transition-all"
            >
              <Lock className="w-4 h-4 text-red-600" />
              <span>Coordinator Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Candidate Screen */}
      <main className="flex-1">
        <UserScreen onRequestCoordinator={() => setShowCoordinatorModal(true)} />
      </main>

      {/* Footer (Solid Clean Box) */}
      <footer className="border-t border-gray-200 bg-white py-4 px-4 text-center text-xs text-gray-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <Terminal className="w-3.5 h-3.5 text-red-600" />
            <span>Question Bank: 350 Problems (150 Easy, 150 Medium, 50 Hard)</span>
          </div>
          <div>
            Session: 20-minute strict limit • Non-reusable OTP
          </div>
        </div>
      </footer>

      {/* Coordinator Modal */}
      {showCoordinatorModal && (
        <CoordinatorPortal onClose={() => setShowCoordinatorModal(false)} />
      )}
    </div>
  );
}
