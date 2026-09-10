import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getModel, publicCatalog } from './models.js';
import { readJob, submitVideo, submitVoice } from './provider.js';
import { createJobToken, readJobToken } from './token.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 3000);
const maxUploadBytes = Math.min(25 * 1024 * 1024, Math.max(1024 * 1024, Number(process.env.MAX_UPLOAD_BYTES || 12 * 1024 * 1024)));
const bodyLimit = maxUploadBytes * 2 + 1024 * 1024;
const rateWindows = new Map();

const staticFiles = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['public/styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']]
]);

function securityHeaders(response) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('cross-origin-opener-policy', 'same-origin');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function allowGeneration(request) {
  const key = clientIp(request);
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt > 5 * 60 * 1000) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 12;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const expectedProtocol = request.headers['x-forwarded-proto'] || 'http';
    return new URL(origin).origin === `${expectedProtocol}://${request.headers.host}`;
  } catch {
    return false;
  }
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] || '').split(';')[0];
  if (contentType !== 'application/json') {
    const error = new Error('Content-Type debe ser application/json.');
    error.statusCode = 415;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > bodyLimit) {
      const error = new Error('La petición supera el tamaño permitido.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    const error = new Error('JSON no válido.');
    error.statusCode = 400;
    throw error;
  }
}

function text(value, field, { min = 0, max = 4000 } = {}) {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (clean.length < min || clean.length > max) throw new Error(`${field} debe tener entre ${min} y ${max} caracteres.`);
  return clean;
}

function validateVideo(body) {
  const model = getModel(text(body.modelId, 'Modelo', { min: 1, max: 60 }));
  if (!model) throw new Error('Modelo no reconocido.');
  if (model.provider !== 'fal') {
    const error = new Error('Este modelo requiere conectar su proveedor independiente.');
    error.statusCode = 503;
    throw error;
  }
  const mode = body.mode === 'image' ? 'image' : 'text';
  if (!model.capabilities.modes.includes(mode)) throw new Error('El modo elegido no está disponible para este modelo.');
  const images = Array.isArray(body.images) ? body.images.slice(0, model.capabilities.multipleImages ? 9 : 1).map((item) => ({ name: text(item?.name, 'Nombre de archivo', { min: 1, max: 180 }), dataUrl: text(item?.dataUrl, 'Imagen', { min: 20, max: bodyLimit }) })) : [];
  if (mode === 'image' && !images.length) throw new Error('Sube una imagen inicial.');
  return {
    model,
    payload: {
      mode,
      prompt: text(body.prompt, 'Prompt', { min: 5, max: 4000 }),
      negativePrompt: text(body.negativePrompt, 'Negative prompt', { max: 2000 }),
      aspectRatio: text(body.aspectRatio, 'Formato', { max: 10 }),
      duration: Number(body.duration),
      resolution: text(body.resolution, 'Resolución', { max: 20 }),
      quality: text(body.quality, 'Calidad', { max: 40 }),
      seed: body.seed === '' || body.seed == null ? '' : Number(body.seed),
      generateAudio: body.generateAudio !== false,
      images
    }
  };
}

function validateVoice(body) {
  const mode = body.mode === 'clone' ? 'clone' : 'tts';
  return {
    mode,
    text: text(body.text, 'Texto', { min: 1, max: 4000 }),
    voiceId: text(body.voiceId, 'Voice ID', { max: 160 }),
    speed: Math.min(2, Math.max(.5, Number(body.speed) || 1)),
    emotion: text(body.emotion, 'Emoción', { max: 30 }) || 'STANDARD',
    audioDataUrl: mode === 'clone' ? text(body.audioDataUrl, 'Audio WAV', { min: 20, max: bodyLimit }) : ''
  };
}

async function serveStatic(request, response, pathname) {
  const entry = staticFiles.get(pathname);
  if (!entry || request.method !== 'GET') return false;
  const file = await readFile(path.join(root, entry[0]));
  response.statusCode = 200;
  response.setHeader('content-type', entry[1]);
  response.setHeader('cache-control', pathname === '/' || pathname.endsWith('.html') ? 'no-cache' : 'public, max-age=300');
  response.end(file);
  return true;
}

async function handler(request, response) {
  securityHeaders(response);
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (request.method === 'GET' && pathname === '/health') return json(response, 200, { status: 'ok' });
  if (request.method === 'GET' && pathname === '/api/config') {
    return json(response, 200, {
      ok: true,
      app: { name: 'Estudio AudioVisual V2', version: '2.0.0' },
      providers: {
        fal: { label: 'fal.ai', configured: Boolean(process.env.FAL_KEY) },
        runway: { label: 'Runway', configured: false, message: 'Integración independiente no configurada' }
      },
      voice: { configured: Boolean(process.env.FAL_KEY), provider: 'fal.ai / MiniMax' },
      models: publicCatalog()
    });
  }

  if (request.method === 'POST' && (pathname === '/api/generations/video' || pathname === '/api/generations/voice')) {
    if (!sameOrigin(request)) return json(response, 403, { ok: false, code: 'INVALID_ORIGIN', message: 'Solicitud no válida.' });
    if (!allowGeneration(request)) return json(response, 429, { ok: false, code: 'RATE_LIMIT', message: 'Demasiadas generaciones. Espera unos minutos.' });
    const body = await readJson(request);
    const job = pathname.endsWith('/video')
      ? await (async () => { const validated = validateVideo(body); return submitVideo(validated.model, validated.payload, maxUploadBytes); })()
      : await submitVoice(validateVoice(body), maxUploadBytes);
    return json(response, 202, { ok: true, jobId: createJobToken(job), status: 'queued' });
  }

  if (request.method === 'GET' && pathname.startsWith('/api/jobs/')) {
    const token = decodeURIComponent(pathname.slice('/api/jobs/'.length));
    const result = await readJob(readJobToken(token));
    return json(response, 200, { ok: true, ...result });
  }

  if (await serveStatic(request, response, pathname)) return;
  if (pathname.startsWith('/api/')) return json(response, 404, { ok: false, code: 'NOT_FOUND', message: 'No encontrado.' });
  response.statusCode = 302;
  response.setHeader('location', '/');
  response.end();
}

export const server = http.createServer((request, response) => {
  handler(request, response).catch((error) => {
    console.error('[request_error]', error?.code || error?.name, error?.message);
    if (response.headersSent) return response.end();
    json(response, Number(error.statusCode) || 400, {
      ok: false,
      code: error.code || 'REQUEST_FAILED',
      message: error.message || 'No se pudo completar la solicitud.'
    });
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Estudio AudioVisual V2 listo en el puerto ${port}`);
  });
}
