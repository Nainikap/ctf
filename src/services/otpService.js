import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import questionBank from '../data/questions.json';

const STORAGE_KEY = 'ctf_otp_registry_v1';
const ACTIVE_SESSION_KEY = 'ctf_active_candidate_session_v1';
const COORDINATOR_PIN_KEY = 'ctf_coordinator_pin_v1';
const DEFAULT_COORDINATOR_PIN = 'admin123';
const API_BASE = '/api';

/**
 * Base64URL helper for JWT generation
 */
function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function createJWT(payload, secret = 'ctf_secret_salt_2026') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  let hash = 0;
  const signatureInput = `${encodedHeader}.${encodedPayload}.${secret}`;
  for (let i = 0; i < signatureInput.length; i++) {
    const char = signatureInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const signature = base64UrlEncode(hash.toString(16));
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Helper to pick N distinct random items from an array
 */
function pickRandomItems(array, count) {
  const cloned = [...array];
  const picked = [];
  for (let i = 0; i < count && cloned.length > 0; i++) {
    const randIdx = Math.floor(Math.random() * cloned.length);
    picked.push(cloned.splice(randIdx, 1)[0]);
  }
  return picked;
}

/**
 * Selects 5 questions: 2 Easy, 2 Medium, 1 Hard
 */
export function generateRandomQuestionSet() {
  const easyPicked = pickRandomItems(questionBank.easy || [], 2);
  const mediumPicked = pickRandomItems(questionBank.medium || [], 2);
  const hardPicked = pickRandomItems(questionBank.hard || [], 1);

  return [
    ...easyPicked.map(q => ({ ...q, tierOrder: 1 })),
    ...mediumPicked.map(q => ({ ...q, tierOrder: 2 })),
    ...hardPicked.map(q => ({ ...q, tierOrder: 3 }))
  ];
}

/**
 * Local cache helpers
 */
function getLocalOTPs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

export function saveOTPs(otps) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(otps));
    window.dispatchEvent(new Event('ctf_otp_updated'));
  } catch (err) {
    console.error('Failed to save local OTP storage', err);
  }
}

/**
 * Fetch Network Info (LAN IP for cross-device access)
 */
export async function getNetworkInfo() {
  try {
    const res = await fetch(`${API_BASE}/network-info`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // ignore
  }
  return { localUrl: window.location.origin, networkUrls: [] };
}

/**
 * Firestore DB: Load all OTPs (for Coordinator)
 */
export async function getStoredOTPs() {
  // 1. Try Firestore DB first
  try {
    const querySnapshot = await getDocs(collection(db, 'otps'));
    const firestoreOtps = [];
    querySnapshot.forEach((docSnap) => {
      firestoreOtps.push(docSnap.data());
    });

    // Sort by createdAt descending
    firestoreOtps.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (firestoreOtps.length > 0) {
      saveOTPs(firestoreOtps);
      return firestoreOtps;
    }
  } catch (err) {
    console.warn('Firestore getStoredOTPs error, trying backend/local fallback:', err.message);
  }

  // 2. Try Local API Server fallback
  try {
    const res = await fetch(`${API_BASE}/otps`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.otps)) {
        saveOTPs(data.otps);
        return data.otps;
      }
    }
  } catch (err) {
    // ignore
  }

  // 3. Local storage cache fallback
  return getLocalOTPs();
}

/**
 * Firestore DB: Generate and register a new OTP with 5 assigned question references
 */
export async function coordinatorGenerateOTP(candidateName = '', durationMinutes = 20) {
  const now = Date.now();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const id = 'otp_' + now + '_' + Math.random().toString(36).substring(2, 6);

  // Assign the 5 questions (2 Easy, 2 Medium, 1 Hard) referenced by this OTP
  const questions = generateRandomQuestionSet();

  const payload = {
    id,
    otp: code,
    candidate: candidateName || `Participant #${now.toString().slice(-4)}`,
    iat: now,
    durationMs: (Number(durationMinutes) || 20) * 60 * 1000
  };
  const jwt = createJWT(payload);

  const newRecord = {
    id,
    code,
    jwt,
    candidate: candidateName || `Participant #${now.toString().slice(-4)}`,
    createdAt: now,
    durationMinutes: Number(durationMinutes) || 20,
    status: 'ACTIVE_UNUSED', // ACTIVE_UNUSED | IN_PROGRESS | COMPLETED | EXPIRED | REVOKED
    firstUsedAt: null,
    expiresAt: null,
    assignedQuestions: questions, // Exact 5 questions referenced in the database
    submittedAnswers: {},
    score: null
  };

  // 1. Write to Firestore DB
  let savedToFirestore = false;
  try {
    await setDoc(doc(db, 'otps', code), newRecord);
    savedToFirestore = true;
    console.log('OTP registered in Firestore DB at otps/' + code);
  } catch (err) {
    console.warn('Firestore setDoc failed, saving to backup server/local:', err.message);
  }

  // 2. Also write to backend API for resilience
  try {
    await fetch(`${API_BASE}/otps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateName, durationMinutes })
    });
  } catch (err) {
    // ignore
  }

  // 3. Save to local cache
  const local = getLocalOTPs();
  local.unshift(newRecord);
  saveOTPs(local);

  return newRecord;
}

/**
 * Firestore DB: Unlock questions with OTP on ANY device across networks
 */
export async function unlockQuestionsWithOTP(inputCode) {
  const cleaned = (inputCode || '').trim();
  if (!cleaned) {
    return { success: false, error: 'Please enter a valid OTP or JWT token.' };
  }

  const now = Date.now();

  // 1. Query Firestore DB directly for this OTP
  try {
    const docRef = doc(db, 'otps', cleaned);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const record = docSnap.data();

      if (record.status === 'REVOKED') {
        return { success: false, error: 'This OTP has been revoked by the coordinator.' };
      }
      if (record.status === 'COMPLETED') {
        return {
          success: false,
          error: 'This test has already been completed with this OTP. You cannot take the test again with the same OTP.'
        };
      }
      if (record.status === 'EXPIRED') {
        return {
          success: false,
          error: 'This OTP has expired (20-minute limit exceeded). You cannot reuse this OTP or get the same questions.'
        };
      }

      // If IN_PROGRESS, check if time limit passed
      if (record.status === 'IN_PROGRESS') {
        if (record.expiresAt && now >= record.expiresAt) {
          try {
            await updateDoc(docRef, { status: 'EXPIRED' });
          } catch (e) {}
          return {
            success: false,
            error: 'The 20-minute time window for this OTP has expired. You cannot take the test.'
          };
        }

        // Resume session with the referenced questions from DB
        const sessionData = {
          otpId: record.id,
          code: record.code,
          candidate: record.candidate,
          startedAt: record.firstUsedAt,
          expiresAt: record.expiresAt,
          questions: record.assignedQuestions
        };
        saveActiveSession(sessionData);
        return { success: true, resumed: true, data: sessionData };
      }

      // If ACTIVE_UNUSED: First time unlocking on this device!
      if (record.status === 'ACTIVE_UNUSED') {
        const durationMs = (record.durationMinutes || 20) * 60 * 1000;
        const expiresAt = now + durationMs;

        // Use the questions referenced in the document, or generate if missing
        const questions = (record.assignedQuestions && record.assignedQuestions.length > 0)
          ? record.assignedQuestions
          : generateRandomQuestionSet();

        // Update status in Firestore so other devices see it is in progress
        await updateDoc(docRef, {
          status: 'IN_PROGRESS',
          firstUsedAt: now,
          expiresAt: expiresAt,
          assignedQuestions: questions
        });

        const sessionData = {
          otpId: record.id,
          code: record.code,
          candidate: record.candidate,
          startedAt: now,
          expiresAt,
          questions
        };
        saveActiveSession(sessionData);
        return { success: true, resumed: false, data: sessionData };
      }
    }
  } catch (err) {
    console.warn('Firestore unlock query failed, trying fallback:', err.message);
  }

  // 2. Backend API fallback
  try {
    const res = await fetch(`${API_BASE}/otps/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleaned })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      saveActiveSession(data.data);
      return { success: true, resumed: data.resumed || false, data: data.data };
    } else if (res.status === 403 || res.status === 404) {
      return { success: false, error: data.error || 'Invalid OTP.' };
    }
  } catch (err) {
    // ignore
  }

  // 3. Local storage fallback
  const otps = getLocalOTPs();
  const record = otps.find(o => o.code === cleaned || o.jwt === cleaned);
  if (record) {
    if (record.status === 'REVOKED') return { success: false, error: 'This OTP has been revoked.' };
    if (record.status === 'COMPLETED') return { success: false, error: 'This test has already been completed.' };
    if (record.status === 'EXPIRED') return { success: false, error: 'This OTP has expired.' };

    if (record.status === 'ACTIVE_UNUSED') {
      const durationMs = (record.durationMinutes || 20) * 60 * 1000;
      const expiresAt = now + durationMs;
      const questions = (record.assignedQuestions && record.assignedQuestions.length > 0)
        ? record.assignedQuestions
        : generateRandomQuestionSet();

      record.status = 'IN_PROGRESS';
      record.firstUsedAt = now;
      record.expiresAt = expiresAt;
      record.assignedQuestions = questions;
      saveOTPs(otps);

      const sessionData = {
        otpId: record.id,
        code: record.code,
        candidate: record.candidate,
        startedAt: now,
        expiresAt,
        questions
      };
      saveActiveSession(sessionData);
      return { success: true, resumed: false, data: sessionData };
    }
  }

  return {
    success: false,
    error: 'Invalid OTP. Please check the code provided by your coordinator.'
  };
}

/**
 * Firestore DB: Submit assessment answers and record score
 */
export async function submitAssessment(otpCode, answers = {}) {
  const now = Date.now();
  let assignedQuestions = [];

  // 1. Try Firestore DB
  try {
    const docRef = doc(db, 'otps', otpCode);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const record = docSnap.data();
      assignedQuestions = record.assignedQuestions || [];

      let correctCount = 0;
      if (assignedQuestions.length > 0) {
        assignedQuestions.forEach(q => {
          const userAnswer = answers[q.id];
          if (userAnswer) {
            const userChoice = userAnswer.trim().charAt(0).toUpperCase();
            const correctChoice = (q.answer || '').trim().charAt(0).toUpperCase();
            if (userChoice === correctChoice) {
              correctCount++;
            }
          }
        });
      }

      const score = {
        correct: correctCount,
        total: assignedQuestions.length,
        percentage: assignedQuestions.length > 0
          ? Math.round((correctCount / assignedQuestions.length) * 100)
          : 0
      };

      await updateDoc(docRef, {
        status: 'COMPLETED',
        submittedAnswers: answers,
        score,
        completedAt: now
      });

      clearActiveSession();

      return {
        success: true,
        score,
        questions: assignedQuestions,
        submittedAnswers: answers
      };
    }
  } catch (err) {
    console.warn('Firestore submit failed, trying fallback:', err.message);
  }

  // 2. Backend API fallback
  try {
    const res = await fetch(`${API_BASE}/otps/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: otpCode, answers })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        clearActiveSession();
        return data;
      }
    }
  } catch (err) {
    // ignore
  }

  // 3. Local fallback
  const otps = getLocalOTPs();
  const record = otps.find(o => o.code === otpCode);
  if (record) {
    let correctCount = 0;
    if (record.assignedQuestions?.length > 0) {
      record.assignedQuestions.forEach(q => {
        const userAnswer = answers[q.id];
        if (userAnswer) {
          const userChoice = userAnswer.trim().charAt(0).toUpperCase();
          const correctChoice = (q.answer || '').trim().charAt(0).toUpperCase();
          if (userChoice === correctChoice) correctCount++;
        }
      });
    }
    record.status = 'COMPLETED';
    record.submittedAnswers = answers;
    record.score = {
      correct: correctCount,
      total: record.assignedQuestions ? record.assignedQuestions.length : 0,
      percentage: record.assignedQuestions && record.assignedQuestions.length > 0
        ? Math.round((correctCount / record.assignedQuestions.length) * 100)
        : 0
    };
    record.completedAt = now;
    saveOTPs(otps);
    clearActiveSession();
    return {
      success: true,
      score: record.score,
      questions: record.assignedQuestions,
      submittedAnswers: answers
    };
  }

  return { success: false, error: 'Session not found.' };
}

/**
 * Firestore DB: Expire an active OTP
 */
export async function markOTPExpired(otpCode) {
  try {
    await updateDoc(doc(db, 'otps', otpCode), {
      status: 'EXPIRED'
    });
  } catch (err) {
    // ignore
  }

  try {
    await fetch(`${API_BASE}/otps/expire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: otpCode })
    });
  } catch (err) {
    // ignore
  }

  const otps = getLocalOTPs();
  const record = otps.find(o => o.code === otpCode);
  if (record) {
    record.status = 'EXPIRED';
    saveOTPs(otps);
  }
  clearActiveSession();
}

/**
 * Firestore DB: Revoke OTP
 */
export async function revokeOTP(otpId, otpCode) {
  const code = otpCode || (getLocalOTPs().find(o => o.id === otpId)?.code);
  if (code) {
    try {
      await updateDoc(doc(db, 'otps', code), { status: 'REVOKED' });
    } catch (err) {
      // ignore
    }
  }

  try {
    await fetch(`${API_BASE}/otps/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: otpId, code })
    });
  } catch (err) {
    // ignore
  }

  const otps = getLocalOTPs();
  const record = otps.find(o => o.id === otpId || o.code === code);
  if (record) {
    record.status = 'REVOKED';
    saveOTPs(otps);
  }
}

/**
 * Firestore DB: Delete single OTP
 */
export async function deleteOTP(otpId, otpCode) {
  const code = otpCode || (getLocalOTPs().find(o => o.id === otpId)?.code);
  if (code) {
    try {
      await deleteDoc(doc(db, 'otps', code));
    } catch (err) {
      // ignore
    }
  }

  try {
    await fetch(`${API_BASE}/otps/${encodeURIComponent(otpId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    // ignore
  }

  const otps = getLocalOTPs().filter(o => o.id !== otpId && o.code !== code);
  saveOTPs(otps);
}

/**
 * Firestore DB: Clear all OTPs
 */
export async function clearAllOTPs() {
  try {
    const snap = await getDocs(collection(db, 'otps'));
    const deletes = [];
    snap.forEach(d => {
      deletes.push(deleteDoc(d.ref));
    });
    await Promise.all(deletes);
  } catch (err) {
    // ignore
  }

  try {
    await fetch(`${API_BASE}/otps`, { method: 'DELETE' });
  } catch (err) {
    // ignore
  }

  saveOTPs([]);
  clearActiveSession();
}

/**
 * Active Session persistence in localStorage
 */
export function getActiveSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt && Date.now() >= session.expiresAt) {
      markOTPExpired(session.code);
      clearActiveSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveActiveSession(sessionData) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.error('Failed to save session', err);
  }
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

/**
 * Coordinator Passcode Management
 */
export function getLocalCoordinatorPin() {
  return localStorage.getItem(COORDINATOR_PIN_KEY) || DEFAULT_COORDINATOR_PIN;
}

export async function verifyCoordinatorPin(inputPin) {
  const pin = (inputPin || '').trim();
  try {
    const docSnap = await getDoc(doc(db, 'settings', 'coordinator'));
    if (docSnap.exists() && docSnap.data().pin) {
      return pin === docSnap.data().pin;
    }
  } catch (err) {
    // ignore
  }

  try {
    const res = await fetch(`${API_BASE}/coordinator/pin?pin=${encodeURIComponent(pin)}`);
    if (res.ok) {
      const data = await res.json();
      return !!data.valid;
    }
  } catch (err) {
    // ignore
  }

  return pin === getLocalCoordinatorPin();
}

export async function setCoordinatorPin(newPin) {
  const pin = (newPin || '').trim();
  try {
    await setDoc(doc(db, 'settings', 'coordinator'), { pin }, { merge: true });
  } catch (err) {
    // ignore
  }

  try {
    await fetch(`${API_BASE}/coordinator/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin: pin })
    });
  } catch (err) {
    // ignore
  }

  localStorage.setItem(COORDINATOR_PIN_KEY, pin);
}
