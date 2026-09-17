const https = require('https');

function testEndpoint(name, options, data = null) {
  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`[${name}] Status: ${res.statusCode}, Body: ${body.substring(0, 150)}`);
        resolve({ statusCode: res.statusCode, body });
      });
    });
    req.on('error', (err) => {
      console.log(`[${name}] Error: ${err.message}`);
      resolve(null);
    });
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // Test 1: npoint.io
  await testEndpoint('npoint', {
    hostname: 'api.npoint.io',
    path: '/',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ otps: { '123456': { test: true } } }));

  // Test 2: jsonbin.io
  await testEndpoint('jsonbin', {
    hostname: 'api.jsonbin.io',
    path: '/v3/b',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ test: true }));

  // Test 3: countapi or keyval
  await testEndpoint('keyval', {
    hostname: 'keyval.org',
    path: '/set/ctf_test_123456',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ test: true }));

  // Test 4: pastebin / dpaste
  await testEndpoint('dpaste', {
    hostname: 'dpaste.org',
    path: '/api/',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }, 'content=test&format=json');
}

run();
