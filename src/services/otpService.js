import questionBank from '../data/questions.json';

const STORAGE_KEY = 'ctf_otp_registry_v1';
const ACTIVE_SESSION_KEY = 'ctf_active_candidate_session_v1';
const COORDINATOR_PIN_KEY = 'ctf_coordinator_pin_v1';

// Default coordinator PIN
const DEFAULT_COORDINATOR_PIN = 'admin123';

/**
 * Base64URL helper for JWT generation (pure client-side)
 */
function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

/**
 * Generate a client-verifiable JWT token
 */
export function createJWT(payload, secret = 'ctf_secret_salt_2026') {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  // Simple deterministic client signature hash
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
 * Load OTP registry from localStorage
 */
export function getStoredOTPs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse OTP storage', err);
    return [];
  }
}

/**
 * Save OTP registry to localStorage
 */
export function saveOTPs(otps) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(otps));
    // Dispatch custom event for cross-component and cross-tab update
    window.dispatchEvent(new Event('ctf_otp_updated'));
  } catch (err) {
    console.error('Failed to save OTP storage', err);
  }
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
  const easyPicked = pickRandomItems(questionBank.easy, 2);
  const mediumPicked = pickRandomItems(questionBank.medium, 2);
  const hardPicked = pickRandomItems(questionBank.hard, 1);

  return [
    ...easyPicked.map(q => ({ ...q, tierOrder: 1 })),
    ...mediumPicked.map(q => ({ ...q, tierOrder: 2 })),
    ...hardPicked.map(q => ({ ...q, tierOrder: 3 }))
  ];
}

/**
 * Generate a new unique OTP by the Coordinator
 */
export function coordinatorGenerateOTP(candidateName = '', durationMinutes = 20) {
  const otps = getStoredOTPs();

  // Generate 6-digit numeric OTP that is unique
  let code = '';
  let attempts = 0;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    attempts++;
  } while (otps.some(o => o.code === code) && attempts < 100);

  const id = 'otp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const now = Date.now();

  const payload = {
    id,
    otp: code,
    candidate: candidateName || `Participant #${otps.length + 1}`,
    iat: now,
    durationMs: durationMinutes * 60 * 1000
  };

  const jwt = createJWT(payload);

  const newRecord = {
    id,
    code,
    jwt,
    candidate: candidateName || `Participant #${otps.length + 1}`,
    createdAt: now,
    durationMinutes: Number(durationMinutes) || 20,
    status: 'ACTIVE_UNUSED', // ACTIVE_UNUSED | IN_PROGRESS | COMPLETED | EXPIRED | REVOKED
    firstUsedAt: null,
    expiresAt: null,
    assignedQuestions: [], // Will be generated when first unlocked
    submittedAnswers: {},
    score: null
  };

  otps.unshift(newRecord);
  saveOTPs(otps);
  return newRecord;
}

/**
 * Verify & Unlock questions for a given OTP or JWT
 */
export function unlockQuestionsWithOTP(inputCode) {
  const cleaned = (inputCode || '').trim();
  if (!cleaned) {
    return { success: false, error: 'Please enter a valid OTP or JWT token.' };
  }

  const otps = getStoredOTPs();
  const now = Date.now();

  // Match either by code or jwt
  const recordIndex = otps.findIndex(o => o.code === cleaned || o.jwt === cleaned);
  if (recordIndex === -1) {
    return { 
      success: false, 
      error: 'Invalid OTP. Please check the code provided by your coordinator.' 
    };
  }

  const record = otps[recordIndex];

  // Check if manually revoked
  if (record.status === 'REVOKED') {
    return {
      success: false,
      error: 'This OTP has been revoked by the coordinator.'
    };
  }

  // Check if already completed
  if (record.status === 'COMPLETED') {
    return {
      success: false,
      error: 'This test has already been completed with this OTP. You cannot take the test again with the same OTP.'
    };
  }

  // Check if previously expired
  if (record.status === 'EXPIRED') {
    return {
      success: false,
      error: 'This OTP has expired (20-minute limit exceeded). You cannot reuse this OTP or get the same questions.'
    };
  }

  // If already IN_PROGRESS, check if the 20 minutes have passed
  if (record.status === 'IN_PROGRESS') {
    if (record.expiresAt && now >= record.expiresAt) {
      // Mark as expired immediately
      record.status = 'EXPIRED';
      saveOTPs(otps);
      return {
        success: false,
        error: 'The 20-minute time window for this OTP has expired. You cannot get the same set of questions.'
      };
    }

    // Session is still within the 20 minutes! Resume session.
    saveActiveSession({
      otpId: record.id,
      code: record.code,
      candidate: record.candidate,
      startedAt: record.firstUsedAt,
      expiresAt: record.expiresAt,
      questions: record.assignedQuestions
    });

    return {
      success: true,
      resumed: true,
      data: {
        otp: record.code,
        candidate: record.candidate,
        startedAt: record.firstUsedAt,
        expiresAt: record.expiresAt,
        questions: record.assignedQuestions
      }
    };
  }

  // If ACTIVE_UNUSED: first time unlocking!
  if (record.status === 'ACTIVE_UNUSED') {
    const durationMs = (record.durationMinutes || 20) * 60 * 1000;
    const expiresAt = now + durationMs;

    // Pick 5 random questions: 2 Easy, 2 Medium, 1 Hard
    const questions = generateRandomQuestionSet();

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

    return {
      success: true,
      resumed: false,
      data: sessionData
    };
  }

  return {
    success: false,
    error: 'OTP status is invalid.'
  };
}

/**
 * Complete/Submit an assessment session
 */
export function submitAssessment(otpCode, answers = {}) {
  const otps = getStoredOTPs();
  const record = otps.find(o => o.code === otpCode);
  if (!record) return { success: false, error: 'Session not found.' };

  const now = Date.now();
  let correctCount = 0;

  // Calculate score
  if (record.assignedQuestions && record.assignedQuestions.length > 0) {
    record.assignedQuestions.forEach(q => {
      const userAnswer = answers[q.id];
      // Compare user choice letter or text with q.answer
      if (userAnswer) {
        const userChoiceLetter = userAnswer.trim().charAt(0).toUpperCase();
        const correctChoiceLetter = q.answer.trim().charAt(0).toUpperCase();
        if (userChoiceLetter === correctChoiceLetter) {
          correctCount++;
        }
      }
    });
  }

  record.status = 'COMPLETED';
  record.submittedAnswers = answers;
  record.score = {
    correct: correctCount,
    total: record.assignedQuestions.length,
    percentage: Math.round((correctCount / record.assignedQuestions.length) * 100)
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

/**
 * Expire an active OTP when 20 minutes runs out
 */
export function markOTPExpired(otpCode) {
  const otps = getStoredOTPs();
  const record = otps.find(o => o.code === otpCode);
  if (record) {
    record.status = 'EXPIRED';
    saveOTPs(otps);
  }
  clearActiveSession();
}

/**
 * Revoke OTP by coordinator
 */
export function revokeOTP(otpId) {
  const otps = getStoredOTPs();
  const record = otps.find(o => o.id === otpId);
  if (record) {
    record.status = 'REVOKED';
    saveOTPs(otps);
  }
}

/**
 * Delete OTP record
 */
export function deleteOTP(otpId) {
  const otps = getStoredOTPs().filter(o => o.id !== otpId);
  saveOTPs(otps);
}

/**
 * Clear all OTP records (coordinator reset)
 */
export function clearAllOTPs() {
  saveOTPs([]);
  clearActiveSession();
}

/**
 * Active Session persistence in localStorage (to survive browser refresh)
 */
export function getActiveSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Check if expired
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
export function getCoordinatorPin() {
  return localStorage.getItem(COORDINATOR_PIN_KEY) || DEFAULT_COORDINATOR_PIN;
}

export function setCoordinatorPin(newPin) {
  localStorage.setItem(COORDINATOR_PIN_KEY, newPin);
}

export function verifyCoordinatorPin(inputPin) {
  const current = getCoordinatorPin();
  return (inputPin || '').trim() === current;
}
