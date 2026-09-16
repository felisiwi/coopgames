#!/usr/bin/env node
// Zero-dependency static file server with live reload, for local tuning
// (e.g. games/windward's CONFIG constants) without a manual refresh every
// save. Dev-only — never runs in deploy (vercel.json's buildCommand is
// scripts/manifest.js; Vercel serves the static files directly), so it
// can't affect what ships.
//
// Usage: `node scripts/dev-server.js [port]` (default 5173), then open
// e.g. http://localhost:5173/games/windward/index.html?seed=1
//
// Live reload: any HTML page it serves gets a tiny injected <script> that
// opens a Server-Sent-Events connection to /__livereload; a filesystem
// change anywhere under the repo (fs.watch, recursive) pushes a `reload`
// event to every open tab. fs.watch's `recursive` option is macOS/Windows
// only (not Linux) — fine for local use, not needed by CI/deploy.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.argv[2]) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const IGNORED = /(^|[/\\])(\.git|node_modules|\.DS_Store)([/\\]|$)/;

// --- live reload: every open tab holds an SSE connection; any fs change
// (debounced, since editors often fire several events per save) pushes one
// `reload` message to all of them. ------------------------------------
const clients = new Set();
let debounceTimer = null;
fs.watch(ROOT, { recursive: true }, (_event, filename) => {
  if (!filename || IGNORED.test(filename)) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    for (const res of clients) res.write('data: reload\n\n');
  }, 100);
});

const RELOAD_SNIPPET =
  "<script>new EventSource('/__livereload').onmessage = () => location.reload();</script>";

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'index.html');
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const contentType = MIME[path.extname(filePath)] || 'application/octet-stream';
    if (contentType.startsWith('text/html')) {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data.toString('utf-8').replace('</body>', `${RELOAD_SNIPPET}</body>`));
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Dev server + live reload: http://localhost:${PORT}`);
});
