const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest, getNetworkInfo } = require('./server/apiHandler.cjs');

const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  // Handle API routes
  if (req.url.startsWith('/api/')) {
    return handleApiRequest(req, res);
  }

  // Serve static files from dist
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath = path.normalize(parsedUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, safePath);

  // If path is root or directory, check for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA fallback: if file doesn't exist, serve dist/index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    return fs.createReadStream(filePath).pipe(res);
  }

  // If dist hasn't been built yet
  res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
  res.end('<h1>CTF Portal Server Running</h1><p>Run <code>npm run build</code> or use <code>npm run dev</code> for development.</p>');
});

server.listen(PORT, '0.0.0.0', () => {
  const info = getNetworkInfo(PORT);
  console.log(`\n======================================================`);
  console.log(`  CTF Portal Server listening on:`);
  console.log(`  Local:   ${info.localUrl}`);
  info.networkUrls.forEach(n => {
    console.log(`  Network: ${n.url} (${n.interface})`);
  });
  console.log(`======================================================\n`);
});
