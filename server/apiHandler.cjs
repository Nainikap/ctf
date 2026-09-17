const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to question bank and persistent storage
const QUESTIONS_PATH = path.join(__dirname, '../src/data/questions.json');
const DATA_DIR = path.join(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'otp-store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create data directory', e);
  }
}

// Load question bank
let questionBank = { easy: [], medium: [], hard: [] };
try {
  if (fs.existsSync(QUESTIONS_PATH)) {
    questionBank = JSON.parse(fs.readFileSync(QUESTIONS_PATH, 'utf8'));
  }
} catch (err) {
  console.error('Failed to load questions.json', err);
}

// Initial default state
const DEFAULT_STATE = {
  coordinatorPin: 'admin123',
  otps: []
};

// Pure in-memory cache synchronized with JSON file
let state = null;

function loadState() {
  if (state) return state;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      state = JSON.parse(raw);
      if (!Array.isArray(state.otps)) state.otps = [];
      if (!state.coordinatorPin) state.coordinatorPin = 'admin123';
      return state;
    }
  } catch (err) {
    console.error('Failed to read otp-store.json, using default state', err);
  }
  state = { ...DEFAULT_STATE };
  saveState();
  return state;
}

function saveState() {
  if (!state) return;
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist otp-store.json', err);
  }
}

// Helper to pick random items
function pickRandomItems(array, count) {
  const cloned = [...array];
  const picked = [];
  for (let i = 0; i < count && cloned.length > 0; i++) {
    const randIdx = Math.floor(Math.random() * cloned.length);
    picked.push(cloned.splice(randIdx, 1)[0]);
  }
  return picked;
}

// 5 random questions: 2 Easy, 2 Medium, 1 Hard
function generateRandomQuestionSet() {
  const easy = pickRandomItems(questionBank.easy || [], 2);
  const medium = pickRandomItems(questionBank.medium || [], 2);
  const hard = pickRandomItems(questionBank.hard || [], 1);
  return [
    ...easy.map(q => ({ ...q, tierOrder: 1 })),
    ...medium.map(q => ({ ...q, tierOrder: 2 })),
    ...hard.map(q => ({ ...q, tierOrder: 3 }))
  ];
}

// Base64URL helper for JWT
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function createJWT(payload, secret = 'ctf_secret_salt_2026') {
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

// Get LAN IPv4 addresses
function getNetworkInfo(port = 3000) {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          ip: iface.address,
          url: `http://${iface.address}:${port}`
        });
      }
    }
  }
  return {
    port,
    localUrl: `http://localhost:${port}`,
    networkUrls: addresses
  };
}

// Body parser helper for raw Node http req
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * Handle /api/* requests
 */
async function handleApiRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const current = loadState();

  // 1. GET /api/network-info
  if (pathname === '/api/network-info' && req.method === 'GET') {
    const port = parsedUrl.port || 3000;
    return sendJson(res, 200, getNetworkInfo(port));
  }

  // 2. GET /api/coordinator/pin - Verify coordinator PIN
  if (pathname === '/api/coordinator/pin' && req.method === 'GET') {
    const pin = parsedUrl.searchParams.get('pin') || '';
    const isValid = pin.trim() === current.coordinatorPin;
    return sendJson(res, 200, { success: true, valid: isValid });
  }

  // 3. POST /api/coordinator/pin - Change coordinator PIN
  if (pathname === '/api/coordinator/pin' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    if (!body.newPin || body.newPin.trim().length < 4) {
      return sendJson(res, 400, { success: false, error: 'Passcode must be at least 4 characters.' });
    }
    current.coordinatorPin = body.newPin.trim();
    saveState();
    return sendJson(res, 200, { success: true });
  }

  // 4. GET /api/otps - Fetch all OTPs (for coordinator)
  if (pathname === '/api/otps' && req.method === 'GET') {
    return sendJson(res, 200, { success: true, otps: current.otps });
  }

  // 5. POST /api/otps - Coordinator generates a new OTP
  if (pathname === '/api/otps' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const candidateName = (body.candidateName || '').trim();
    const durationMinutes = Number(body.durationMinutes) || 20;

    // Generate unique 6-digit numeric OTP
    let code = '';
    let attempts = 0;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      attempts++;
    } while (current.otps.some(o => o.code === code) && attempts < 100);

    const now = Date.now();
    const id = 'otp_' + now + '_' + Math.random().toString(36).substring(2, 6);

    const payload = {
      id,
      otp: code,
      candidate: candidateName || `Participant #${current.otps.length + 1}`,
      iat: now,
      durationMs: durationMinutes * 60 * 1000
    };
    const jwt = createJWT(payload);

    const newRecord = {
      id,
      code,
      jwt,
      candidate: candidateName || `Participant #${current.otps.length + 1}`,
      createdAt: now,
      durationMinutes,
      status: 'ACTIVE_UNUSED', // ACTIVE_UNUSED | IN_PROGRESS | COMPLETED | EXPIRED | REVOKED
      firstUsedAt: null,
      expiresAt: null,
      assignedQuestions: [],
      submittedAnswers: {},
      score: null
    };

    current.otps.unshift(newRecord);
    saveState();

    return sendJson(res, 201, { success: true, record: newRecord });
  }

  // 6. POST /api/otps/unlock - Candidate enters OTP to unlock questions
  if (pathname === '/api/otps/unlock' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const cleaned = (body.code || '').trim();

    if (!cleaned) {
      return sendJson(res, 400, { success: false, error: 'Please enter a valid OTP or JWT token.' });
    }

    const now = Date.now();
    const record = current.otps.find(o => o.code === cleaned || o.jwt === cleaned);

    if (!record) {
      return sendJson(res, 404, {
        success: false,
        error: 'Invalid OTP. Please check the code provided by your coordinator.'
      });
    }

    if (record.status === 'REVOKED') {
      return sendJson(res, 403, {
        success: false,
        error: 'This OTP has been revoked by the coordinator.'
      });
    }

    if (record.status === 'COMPLETED') {
      return sendJson(res, 403, {
        success: false,
        error: 'This test has already been completed with this OTP. You cannot take the test again with the same OTP.'
      });
    }

    if (record.status === 'EXPIRED') {
      return sendJson(res, 403, {
        success: false,
        error: 'This OTP has expired (time limit exceeded). You cannot reuse this OTP or get the same questions.'
      });
    }

    // If IN_PROGRESS, check if time limit has passed
    if (record.status === 'IN_PROGRESS') {
      if (record.expiresAt && now >= record.expiresAt) {
        record.status = 'EXPIRED';
        saveState();
        return sendJson(res, 403, {
          success: false,
          error: 'The time window for this OTP has expired. You cannot take the test.'
        });
      }

      // Resume existing session
      return sendJson(res, 200, {
        success: true,
        resumed: true,
        data: {
          otpId: record.id,
          code: record.code,
          candidate: record.candidate,
          startedAt: record.firstUsedAt,
          expiresAt: record.expiresAt,
          questions: record.assignedQuestions
        }
      });
    }

    // If ACTIVE_UNUSED: first time unlocking
    if (record.status === 'ACTIVE_UNUSED') {
      const durationMs = (record.durationMinutes || 20) * 60 * 1000;
      const expiresAt = now + durationMs;
      const questions = generateRandomQuestionSet();

      record.status = 'IN_PROGRESS';
      record.firstUsedAt = now;
      record.expiresAt = expiresAt;
      record.assignedQuestions = questions;
      saveState();

      return sendJson(res, 200, {
        success: true,
        resumed: false,
        data: {
          otpId: record.id,
          code: record.code,
          candidate: record.candidate,
          startedAt: now,
          expiresAt,
          questions
        }
      });
    }

    return sendJson(res, 400, { success: false, error: 'OTP status is invalid.' });
  }

  // 7. POST /api/otps/submit - Candidate finishes & submits assessment
  if (pathname === '/api/otps/submit' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const code = (body.code || '').trim();
    const answers = body.answers || {};

    const record = current.otps.find(o => o.code === code || o.jwt === code);
    if (!record) {
      return sendJson(res, 404, { success: false, error: 'Session not found.' });
    }

    const now = Date.now();
    let correctCount = 0;

    if (record.assignedQuestions && record.assignedQuestions.length > 0) {
      record.assignedQuestions.forEach(q => {
        const userAnswer = answers[q.id];
        if (userAnswer) {
          const userLetter = userAnswer.trim().charAt(0).toUpperCase();
          const correctLetter = (q.answer || '').trim().charAt(0).toUpperCase();
          if (userLetter === correctLetter) {
            correctCount++;
          }
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
    saveState();

    return sendJson(res, 200, {
      success: true,
      score: record.score,
      questions: record.assignedQuestions,
      submittedAnswers: answers
    });
  }

  // 8. POST /api/otps/expire - Mark OTP as expired
  if (pathname === '/api/otps/expire' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const code = (body.code || '').trim();
    const record = current.otps.find(o => o.code === code || o.jwt === code);
    if (record) {
      record.status = 'EXPIRED';
      saveState();
    }
    return sendJson(res, 200, { success: true });
  }

  // 9. POST /api/otps/revoke - Revoke OTP
  if (pathname === '/api/otps/revoke' && req.method === 'POST') {
    const body = await parseJsonBody(req);
    const record = current.otps.find(o => o.id === body.id || o.code === body.code);
    if (record) {
      record.status = 'REVOKED';
      saveState();
    }
    return sendJson(res, 200, { success: true });
  }

  // 10. DELETE /api/otps/:id - Delete single OTP
  if (pathname.startsWith('/api/otps/') && req.method === 'DELETE') {
    const otpId = pathname.replace('/api/otps/', '').trim();
    current.otps = current.otps.filter(o => o.id !== otpId);
    saveState();
    return sendJson(res, 200, { success: true });
  }

  // 11. DELETE /api/otps - Clear all OTPs
  if (pathname === '/api/otps' && req.method === 'DELETE') {
    current.otps = [];
    saveState();
    return sendJson(res, 200, { success: true });
  }

  // Unknown API route
  return sendJson(res, 404, { success: false, error: 'Endpoint not found' });
}

module.exports = {
  handleApiRequest,
  getNetworkInfo,
  loadState,
  saveState
};
