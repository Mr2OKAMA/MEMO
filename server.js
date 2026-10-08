const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'memos.json');
const PUBLIC = path.join(__dirname, 'public');
const MAX_BODY = 5 * 1024 * 1024;

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return { entries: [] }; }
}
function save(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}
function clean(entries) {
  if (!Array.isArray(entries)) return null;
  return entries.map(e => ({
    id: String(e.id || ''),
    page: String(e.page || ''),
    keypoint: String(e.keypoint || ''),
    notes: Array.isArray(e.notes) ? e.notes.map(n => ({
      kind: ['気付き', '業務への活用', '疑問'].includes(n.kind) ? n.kind : '気付き',
      text: String(n.text || '')
    })) : []
  }));
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/memos') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(load()));
    }
    if (req.method === 'PUT') {
      let body = '', size = 0, tooBig = false;
      req.on('data', c => {
        size += c.length;
        if (size > MAX_BODY) { tooBig = true; return; }
        body += c;
      });
      req.on('end', () => {
        if (tooBig) { res.writeHead(413); return res.end(); }
        try {
          const entries = clean(JSON.parse(body).entries);
          if (!entries) throw new Error('bad');
          save({ entries, savedAt: new Date().toISOString() });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400); res.end('bad request');
        }
      });
      return;
    }
    res.writeHead(405); return res.end();
  }
  const name = url.pathname === '/' ? 'index.html' : path.basename(url.pathname);
  const file = path.join(PUBLIC, name);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => console.log(`MEMO app: http://localhost:${PORT}`));
