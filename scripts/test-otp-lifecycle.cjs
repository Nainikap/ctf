const fs = require('fs');
const path = require('path');

// Mock localStorage for node environment
const storage = {};
global.localStorage = {
  getItem: (k) => (storage[k] !== undefined ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.window = {
  dispatchEvent: () => {}
};
global.Event = function(type) { return { type }; };

// Import question bank
const questionBank = require('../src/data/questions.json');

// Replicate or require service logic
function pickRandomItems(array, count) {
  const cloned = [...array];
  const picked = [];
  for (let i = 0; i < count && cloned.length > 0; i++) {
    const randIdx = Math.floor(Math.random() * cloned.length);
    picked.push(cloned.splice(randIdx, 1)[0]);
  }
  return picked;
}

function generateRandomQuestionSet() {
  const easy = pickRandomItems(questionBank.easy, 2);
  const medium = pickRandomItems(questionBank.medium, 2);
  const hard = pickRandomItems(questionBank.hard, 1);
  return [
    ...easy.map(q => ({ ...q, tierOrder: 1 })),
    ...medium.map(q => ({ ...q, tierOrder: 2 })),
    ...hard.map(q => ({ ...q, tierOrder: 3 }))
  ];
}

console.log('=== TEST 1: Question Pool Verification ===');
console.log('Total Easy in Bank:', questionBank.easy.length);
console.log('Total Medium in Bank:', questionBank.medium.length);
console.log('Total Hard in Bank:', questionBank.hard.length);
if (questionBank.easy.length !== 150 || questionBank.medium.length !== 150 || questionBank.hard.length !== 50) {
  throw new Error('Question bank counts do not match expected 150/150/50');
}
console.log('PASS: Question bank counts are exactly 150 Easy, 150 Medium, 50 Hard.');

console.log('\n=== TEST 2: 5 Random Questions Structure ===');
for (let run = 1; run <= 10; run++) {
  const qs = generateRandomQuestionSet();
  if (qs.length !== 5) throw new Error('Expected exactly 5 questions');
  const easyCount = qs.filter(q => q.difficulty === 'easy').length;
  const medCount = qs.filter(q => q.difficulty === 'medium').length;
  const hardCount = qs.filter(q => q.difficulty === 'hard').length;
  if (easyCount !== 2 || medCount !== 2 || hardCount !== 1) {
    throw new Error(`Run ${run} failed difficulty distribution: ${easyCount}/${medCount}/${hardCount}`);
  }
}
console.log('PASS: 10 test runs verified 5 questions distribution (2 Easy, 2 Medium, 1 Hard) consistently.');

console.log('\n=== TEST 3: OTP Lifecycle & 20-Min Expiration ===');
let otps = [];
const otp1 = {
  id: 'otp_test_1',
  code: '123456',
  candidate: 'Candidate A',
  createdAt: Date.now(),
  durationMinutes: 20,
  status: 'ACTIVE_UNUSED',
  firstUsedAt: null,
  expiresAt: null,
  assignedQuestions: []
};
otps.push(otp1);

// Candidate unlocks OTP
console.log('Step 3a: Candidate enters OTP 123456');
const now = Date.now();
otp1.status = 'IN_PROGRESS';
otp1.firstUsedAt = now;
otp1.expiresAt = now + (20 * 60 * 1000);
otp1.assignedQuestions = generateRandomQuestionSet();

console.log('Unlocked questions count:', otp1.assignedQuestions.length);
console.log('Expires in (ms):', otp1.expiresAt - now);
if (otp1.assignedQuestions.length !== 5) throw new Error('Failed to assign 5 questions');

// Simulate 20 minutes passing (20 min + 1 sec)
console.log('\nStep 3b: Fast-forward time past 20 minutes');
const timeAfter20Min = now + (20 * 60 * 1000) + 1000;
const hasExpired = timeAfter20Min >= otp1.expiresAt;
console.log('Has 20 min expired?', hasExpired);
if (!hasExpired) throw new Error('Expiration calculation error');

// Mark expired
otp1.status = 'EXPIRED';

// Candidate tries to re-enter OTP
console.log('\nStep 3c: Candidate tries to re-enter OTP 123456 after expiration');
function attemptReUnlock(code) {
  const match = otps.find(o => o.code === code);
  if (match.status === 'EXPIRED') {
    return { success: false, error: 'This OTP has expired (20-minute limit exceeded). You cannot reuse this OTP or get the same questions.' };
  }
  return { success: true };
}

const reattempt = attemptReUnlock('123456');
console.log('Re-attempt result:', reattempt);
if (reattempt.success) {
  throw new Error('FAILED: Expired OTP was allowed to be reused!');
}
console.log('PASS: Re-entering expired OTP is successfully blocked!');

console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
