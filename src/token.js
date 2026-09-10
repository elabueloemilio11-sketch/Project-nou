import crypto from 'node:crypto';

function secret() {
  const value = process.env.APP_SIGNING_SECRET || '';
  if (value.length < 32) {
    const error = new Error('APP_SIGNING_SECRET debe tener al menos 32 caracteres.');
    error.code = 'APP_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }
  return value;
}

function signature(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createJobToken(job) {
  const payload = Buffer.from(JSON.stringify({ ...job, issuedAt: Date.now() })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function readJobToken(token) {
  const [payload, supplied] = String(token || '').split('.');
  if (!payload || !supplied) throw new Error('Identificador de trabajo no válido.');
  const expected = signature(payload);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw new Error('Identificador de trabajo no válido.');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.endpoint || !parsed.requestId || !parsed.kind || !parsed.provider) throw new Error('Identificador de trabajo incompleto.');
  if (Date.now() - Number(parsed.issuedAt || 0) > 7 * 24 * 60 * 60 * 1000) throw new Error('Este trabajo ha caducado.');
  return parsed;
}
