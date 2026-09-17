import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  Ban, 
  Users, 
  Eye, 
  X,
  FileCode
} from 'lucide-react';
import { 
  getStoredOTPs, 
  coordinatorGenerateOTP, 
  revokeOTP, 
  deleteOTP, 
  clearAllOTPs,
  verifyCoordinatorPin,
  setCoordinatorPin
} from '../services/otpService';

export default function CoordinatorPortal({ onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [otps, setOtps] = useState([]);
  const [candidateName, setCandidateName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [copiedId, setCopiedId] = useState(null);
  const [copiedJwtId, setCopiedJwtId] = useState(null);
  const [inspectQuestions, setInspectQuestions] = useState(null);
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');

  const loadOTPs = () => {
    setOtps(getStoredOTPs());
  };

  useEffect(() => {
    loadOTPs();

    const handleUpdate = () => loadOTPs();
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('ctf_otp_updated', handleUpdate);

    const timer = setInterval(() => {
      loadOTPs();
    }, 5000);

    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('ctf_otp_updated', handleUpdate);
      clearInterval(timer);
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (verifyCoordinatorPin(pinInput)) {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Invalid Coordinator Passcode.');
    }
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    const created = coordinatorGenerateOTP(candidateName, durationMinutes);
    loadOTPs();
    setCandidateName('');
    copyToClipboard(created.code, created.id);
  };

  const copyToClipboard = (text, id, isJwt = false) => {
    navigator.clipboard.writeText(text);
    if (isJwt) {
      setCopiedJwtId(id);
      setTimeout(() => setCopiedJwtId(null), 2500);
    } else {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleRevoke = (id) => {
    revokeOTP(id);
    loadOTPs();
  };

  const handleDelete = (id) => {
    deleteOTP(id);
    loadOTPs();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all generated OTPs? This cannot be undone.')) {
      clearAllOTPs();
      loadOTPs();
    }
  };

  const handleChangePinSubmit = (e) => {
    e.preventDefault();
    if (newPin.trim().length >= 4) {
      setCoordinatorPin(newPin.trim());
      setShowPinChange(false);
      setNewPin('');
      alert('Coordinator passcode updated successfully.');
    } else {
      alert('Passcode must be at least 4 characters.');
    }
  };

  // -------------------------------------------------------------
  // VIEW: PIN AUTHENTICATION GATE
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-60">
        <div className="bg-white border-2 border-gray-300 rounded-lg p-6 max-w-md w-full shadow-xl relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-14 h-14 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600 mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <span className="text-xs uppercase tracking-wider font-bold text-red-700">
              Restricted Area
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-1">Coordinator Portal</h2>
            <p className="text-gray-600 text-sm mt-1">
              Enter your coordinator passcode to access OTP management.
            </p>
          </div>

          {pinError && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-300 text-red-700 text-xs font-medium">
              {pinError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Coordinator Passcode
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter passcode"
                autoFocus
                className="w-full px-3 py-2.5 rounded bg-white border border-gray-300 focus:border-red-600 focus:ring-1 focus:ring-red-600 text-gray-900 font-mono text-center font-bold tracking-widest text-lg outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: COORDINATOR DASHBOARD
  // -------------------------------------------------------------
  const now = Date.now();
  const totalCount = otps.length;
  const activeUnused = otps.filter(o => o.status === 'ACTIVE_UNUSED').length;
  const inProgress = otps.filter(o => o.status === 'IN_PROGRESS' && o.expiresAt > now).length;
  const completed = otps.filter(o => o.status === 'COMPLETED').length;
  const expired = otps.filter(o => o.status === 'EXPIRED' || (o.status === 'IN_PROGRESS' && o.expiresAt <= now)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-gray-900 bg-opacity-70 overflow-y-auto">
      <div className="bg-white border-2 border-gray-300 rounded-lg w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gray-100 border-b border-gray-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-red-600 text-white flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">
                  Coordinator Control Center
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                  ADMIN
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Issue 20-minute assessment OTPs and inspect participant status
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPinChange(!showPinChange)}
              className="px-3 py-1.5 rounded bg-white hover:bg-gray-50 border border-gray-300 text-xs text-gray-700 font-semibold"
            >
              Change Passcode
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Change Passcode Box */}
        {showPinChange && (
          <div className="p-4 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between">
            <form onSubmit={handleChangePinSubmit} className="flex items-center gap-3 w-full max-w-md">
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter new coordinator passcode"
                className="px-3 py-1.5 rounded bg-white border border-gray-300 text-gray-900 text-xs font-mono flex-1 outline-none focus:border-red-600"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
              >
                Save
              </button>
            </form>
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-gray-50 border-b border-gray-200 text-xs">
          <div className="p-3 rounded bg-white border border-gray-200">
            <span className="text-gray-500 block text-[11px] font-semibold">Total Issued</span>
            <span className="text-xl font-bold font-mono text-gray-900">{totalCount}</span>
          </div>
          <div className="p-3 rounded bg-white border border-gray-200">
            <span className="text-yellow-700 block text-[11px] font-semibold">Ready to Use</span>
            <span className="text-xl font-bold font-mono text-yellow-600">{activeUnused}</span>
          </div>
          <div className="p-3 rounded bg-white border border-gray-200">
            <span className="text-yellow-800 block text-[11px] font-semibold">In Progress</span>
            <span className="text-xl font-bold font-mono text-yellow-700">{inProgress}</span>
          </div>
          <div className="p-3 rounded bg-white border border-gray-200">
            <span className="text-green-700 block text-[11px] font-semibold">Completed</span>
            <span className="text-xl font-bold font-mono text-green-600">{completed}</span>
          </div>
          <div className="p-3 rounded bg-white border border-gray-200">
            <span className="text-red-700 block text-[11px] font-semibold">Expired</span>
            <span className="text-xl font-bold font-mono text-red-600">{expired}</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Generation Box */}
          <div className="p-4 rounded-lg bg-white border-2 border-yellow-400">
            <div className="flex items-center gap-2 mb-3">
              <Key className="w-5 h-5 text-red-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Generate Unique OTP
              </h3>
            </div>
            
            <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Candidate / Team Identifier (Optional)
                </label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Candidate #1 / Team A"
                  className="w-full px-3 py-2 rounded bg-white border border-gray-300 text-gray-900 placeholder-gray-400 text-sm focus:border-red-600 outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-white border border-gray-300 text-gray-900 text-sm font-mono focus:border-red-600 outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Generate OTP
                </button>
              </div>
            </form>
            <p className="text-[11px] text-gray-500 mt-2">
              The 20-minute countdown starts when the candidate unlocks the test with this OTP.
            </p>
          </div>

          {/* OTP Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-gray-600" />
                Issued OTP Registry
              </h3>

              {otps.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Registry
                </button>
              )}
            </div>

            {otps.length === 0 ? (
              <div className="p-8 text-center rounded border-2 border-dashed border-gray-300 bg-gray-50 text-gray-500">
                <p className="text-sm font-medium">No OTPs generated yet.</p>
                <p className="text-xs mt-1">Click "Generate OTP" above to issue a code.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {otps.map((record) => {
                  const isCurrentExpired = record.status === 'EXPIRED' || (record.status === 'IN_PROGRESS' && record.expiresAt <= now);
                  const isCurrentInProgress = record.status === 'IN_PROGRESS' && record.expiresAt > now;
                  
                  let remainingSec = 0;
                  if (isCurrentInProgress && record.expiresAt) {
                    remainingSec = Math.max(0, Math.floor((record.expiresAt - now) / 1000));
                  }
                  const remainingMin = Math.floor(remainingSec / 60);
                  const remSecDisplay = remainingSec % 60;

                  return (
                    <div
                      key={record.id}
                      className="p-3.5 rounded-lg border border-gray-300 bg-white hover:border-gray-400 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      {/* Left side */}
                      <div className="flex items-center gap-3">
                        <div className="text-center px-3 py-1.5 rounded bg-gray-100 border border-gray-300 min-w-[95px]">
                          <span className="text-[9px] text-gray-500 uppercase font-bold block">
                            OTP CODE
                          </span>
                          <span className="font-mono text-lg font-bold text-gray-900">
                            {record.code}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              {record.candidate}
                            </span>

                            {record.status === 'ACTIVE_UNUSED' && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-300">
                                Ready to Use
                              </span>
                            )}
                            {isCurrentInProgress && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-yellow-300 text-yellow-950 border border-yellow-500">
                                In Progress ({remainingMin}m {remSecDisplay}s)
                              </span>
                            )}
                            {record.status === 'COMPLETED' && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-800 border border-green-300">
                                Completed ({record.score?.correct}/{record.score?.total})
                              </span>
                            )}
                            {isCurrentExpired && record.status !== 'COMPLETED' && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-300">
                                Expired (20m up)
                              </span>
                            )}
                            {record.status === 'REVOKED' && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700 border border-gray-300">
                                Revoked
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                            <span>Created: {new Date(record.createdAt).toLocaleTimeString()}</span>
                            <span>Limit: {record.durationMinutes}m</span>
                            {record.assignedQuestions?.length > 0 && (
                              <span className="text-gray-700 font-medium">
                                5 Questions Unlocked (2 Easy, 2 Med, 1 Hard)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(record.code, record.id)}
                          className="px-3 py-1.5 rounded bg-white hover:bg-gray-100 text-xs font-bold text-gray-800 border border-gray-300 flex items-center gap-1.5"
                          title="Copy 6-digit OTP code"
                        >
                          {copiedId === record.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-600">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-gray-600" />
                              <span>Copy OTP</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => copyToClipboard(record.jwt, record.id, true)}
                          className="px-2.5 py-1.5 rounded bg-gray-50 hover:bg-gray-100 text-xs text-gray-600 border border-gray-300 flex items-center gap-1"
                          title="Copy JWT Token"
                        >
                          {copiedJwtId === record.id ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <FileCode className="w-3.5 h-3.5 text-gray-500" />
                          )}
                          <span className="hidden sm:inline">JWT</span>
                        </button>

                        {record.assignedQuestions?.length > 0 && (
                          <button
                            onClick={() => setInspectQuestions(record)}
                            className="p-1.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-gray-300"
                            title="Inspect assigned questions"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        {record.status !== 'REVOKED' && record.status !== 'COMPLETED' && !isCurrentExpired && (
                          <button
                            onClick={() => handleRevoke(record.id)}
                            className="p-1.5 rounded bg-white hover:bg-red-50 text-red-600 border border-gray-300"
                            title="Revoke OTP"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-1.5 rounded bg-white hover:bg-red-50 text-red-600 border border-gray-300"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-gray-100 border-t border-gray-300 flex items-center justify-between text-xs text-gray-600">
          <span>CTF Coordinator Portal</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-gray-800 hover:bg-gray-900 text-white font-bold"
          >
            Close
          </button>
        </div>

      </div>

      {/* Inspect Questions Modal */}
      {inspectQuestions && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-gray-900 bg-opacity-70">
          <div className="bg-white border-2 border-gray-300 rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-gray-100 border-b border-gray-300 flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900">
                Questions for {inspectQuestions.candidate} ({inspectQuestions.code})
              </h4>
              <button
                onClick={() => setInspectQuestions(null)}
                className="p-1 rounded text-gray-600 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              {inspectQuestions.assignedQuestions?.map((q, idx) => (
                <div key={idx} className="p-3 rounded bg-gray-50 border border-gray-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-900">Q{idx + 1} ({q.difficulty.toUpperCase()})</span>
                    <span className="text-red-700 font-bold">Ans: {q.answer}</span>
                  </div>
                  <p className="text-gray-800 font-medium mb-1.5">{q.question}</p>
                  <ul className="space-y-0.5 text-gray-600">
                    {q.options.map((opt, i) => (
                      <li key={i}>{opt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
