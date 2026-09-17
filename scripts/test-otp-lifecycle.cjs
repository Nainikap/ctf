const fs = require('fs');
const path = require('path');
const { handleApiRequest, loadState, saveState } = require('../server/apiHandler.cjs');

// Mock request / response helper for API tests
function mockRequest(method, url, body = null) {
  return new Promise((resolve) => {
    const { EventEmitter } = require('events');
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:3000' };

    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers || {};
      },
      end(data) {
        if (data) this.body += data;
        let parsed = null;
        try {
          parsed = JSON.parse(this.body);
        } catch (e) {
          parsed = this.body;
        }
        resolve({ statusCode: this.statusCode, headers: this.headers, data: parsed });
      }
    };

    setImmediate(async () => {
      await handleApiRequest(req, res);
    });

    if (body) {
      setImmediate(() => {
        req.emit('data', JSON.stringify(body));
        req.emit('end');
      });
    } else {
      setImmediate(() => {
        req.emit('end');
      });
    }
  });
}

async function runTests() {
  console.log('=== TEST 1: Question Pool Verification ===');
  const questionBank = require('../src/data/questions.json');
  console.log('Total Easy in Bank:', questionBank.easy.length);
  console.log('Total Medium in Bank:', questionBank.medium.length);
  console.log('Total Hard in Bank:', questionBank.hard.length);
  if (questionBank.easy.length !== 150 || questionBank.medium.length !== 150 || questionBank.hard.length !== 50) {
    throw new Error('Question bank counts do not match expected 150/150/50');
  }
  console.log('PASS: Question bank counts are exactly 150 Easy, 150 Medium, 50 Hard.');

  console.log('\n=== TEST 2: Network Info & Diagnostics ===');
  const netRes = await mockRequest('GET', '/api/network-info');
  console.log('Local URL:', netRes.data.localUrl);
  console.log('Available Network Interfaces:', netRes.data.networkUrls.length);
  if (!netRes.data.localUrl) throw new Error('Missing network info');
  console.log('PASS: Network info endpoint works.');

  console.log('\n=== TEST 3: Cross-Device OTP Synchronization Simulation ===');
  
  // Step 3a: Device 1 (Coordinator phone) generates an OTP
  console.log('Step 3a: Phone 1 (Coordinator) generates OTP for "Mobile Candidate 1"');
  const genRes = await mockRequest('POST', '/api/otps', {
    candidateName: 'Mobile Candidate 1',
    durationMinutes: 20
  });

  if (genRes.statusCode !== 201 || !genRes.data.record) {
    throw new Error('Failed to generate OTP via API');
  }
  const generatedCode = genRes.data.record.code;
  const generatedId = genRes.data.record.id;
  console.log(`Generated OTP code: ${generatedCode} (ID: ${generatedId})`);

  // Step 3b: Device 2 (Candidate phone - with zero local storage of Device 1)
  console.log(`Step 3b: Phone 2 (Candidate) enters OTP "${generatedCode}" on separate device`);
  const unlockRes = await mockRequest('POST', '/api/otps/unlock', {
    code: generatedCode
  });

  if (unlockRes.statusCode !== 200 || !unlockRes.data.success) {
    throw new Error(`Phone 2 failed to unlock OTP: ${JSON.stringify(unlockRes.data)}`);
  }
  console.log('Phone 2 successfully unlocked 5 questions cross-device!');
  console.log('Candidate assigned:', unlockRes.data.data.candidate);
  console.log('Questions received:', unlockRes.data.data.questions.length);
  if (unlockRes.data.data.questions.length !== 5) {
    throw new Error('Expected 5 questions');
  }

  // Step 3c: Device 1 (Coordinator phone) checks dashboard
  console.log('\nStep 3c: Phone 1 (Coordinator) checks live dashboard');
  const dashRes = await mockRequest('GET', '/api/otps');
  const matchedOnDash = dashRes.data.otps.find(o => o.code === generatedCode);
  if (!matchedOnDash || matchedOnDash.status !== 'IN_PROGRESS') {
    throw new Error('Coordinator dashboard did not reflect IN_PROGRESS status from Phone 2');
  }
  console.log(`PASS: Coordinator sees Phone 2 is IN_PROGRESS (Started at: ${new Date(matchedOnDash.firstUsedAt).toLocaleTimeString()})`);

  // Step 3d: Device 2 submits assessment
  console.log('\nStep 3d: Phone 2 submits answers');
  const q1 = unlockRes.data.data.questions[0];
  const q2 = unlockRes.data.data.questions[1];
  const answers = {
    [q1.id]: q1.answer, // correct
    [q2.id]: 'Z. Wrong Option' // incorrect
  };
  const submitRes = await mockRequest('POST', '/api/otps/submit', {
    code: generatedCode,
    answers
  });
  if (submitRes.statusCode !== 200 || !submitRes.data.success) {
    throw new Error('Failed to submit assessment from Phone 2');
  }
  console.log('Submission score:', submitRes.data.score);
  console.log('PASS: Submission scored successfully.');

  // Step 3e: Device 1 checks dashboard after submission
  console.log('\nStep 3e: Phone 1 (Coordinator) checks completed status');
  const dashRes2 = await mockRequest('GET', '/api/otps');
  const matchedOnDash2 = dashRes2.data.otps.find(o => o.code === generatedCode);
  if (!matchedOnDash2 || matchedOnDash2.status !== 'COMPLETED') {
    throw new Error('Coordinator dashboard did not reflect COMPLETED status from Phone 2');
  }
  console.log(`PASS: Coordinator sees Phone 2 is COMPLETED with score ${matchedOnDash2.score.correct}/${matchedOnDash2.score.total}`);

  // Step 3f: Device 2 (or any other device) attempts to re-enter the completed OTP
  console.log('\nStep 3f: Attempting to reuse completed OTP on any device');
  const reuseRes = await mockRequest('POST', '/api/otps/unlock', {
    code: generatedCode
  });
  if (reuseRes.statusCode === 200) {
    throw new Error('FAILED: Completed OTP was allowed to be re-unlocked!');
  }
  console.log('Rejected as expected:', reuseRes.data.error);
  console.log('PASS: Replay protection prevents completed OTP reuse cross-device.');

  console.log('\n=== ALL CROSS-DEVICE VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
