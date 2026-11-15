import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

async function serveDonki(request, response, url) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendJson(response, 405, { error: 'Use GET for this endpoint.' });
  }

  const startDate = url.searchParams.get('startDate') || '';
  const endDate = url.searchParams.get('endDate') || '';
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return sendJson(response, 400, { error: 'Provide valid startDate and endDate values in YYYY-MM-DD format.' });
  }

  const spanDays = (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000;
  if (spanDays > 31) {
    return sendJson(response, 400, { error: 'Choose a date range of 32 days or less.' });
  }

  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    return sendJson(response, 503, { error: 'NASA data is not configured on this demo.' });
  }

  const nasaUrl = new URL('https://api.nasa.gov/DONKI/SEP');
  nasaUrl.searchParams.set('startDate', startDate);
  nasaUrl.searchParams.set('endDate', endDate);
  nasaUrl.searchParams.set('api_key', apiKey);

  try {
    const nasaResponse = await fetch(nasaUrl, { signal: AbortSignal.timeout(15_000) });
    const body = await nasaResponse.text();
    response.writeHead(nasaResponse.status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(body);
  } catch {
    sendJson(response, 502, { error: 'Could not reach NASA DONKI. Try again shortly.' });
  }
}

async function serveStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end('Method not allowed');
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400);
    return response.end('Bad request');
  }

  const relativePath = decodedPath.replace(/^[/\\]+/, '');
  let filePath = path.resolve(dist, relativePath || 'index.html');
  const relative = path.relative(dist, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');
  } catch {
    if (path.extname(relativePath)) {
      response.writeHead(404);
      return response.end('Not found');
    }
    filePath = path.join(dist, 'index.html');
  }

  try {
    const contents = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Cache-Control': path.basename(filePath) === 'index.html' ? 'no-cache' : 'public, max-age=3600',
      'Content-Length': contents.byteLength,
      'Content-Type': mimeTypes[extension] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = createServer(async (request, response) => {
  let url;
  try {
    url = new URL(request.url || '/', 'http://localhost');
  } catch {
    response.writeHead(400);
    return response.end('Bad request');
  }

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('ok');
  }
  if (url.pathname === '/api/donki/sep') return serveDonki(request, response, url);
  return serveStatic(request, response, url.pathname);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Lunar Days Out listening on port ${port}`);
});
