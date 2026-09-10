import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { server } from '../src/server.js';

test('health, config and static app are served without exposing a key', async (t) => {
  process.env.APP_SIGNING_SECRET = 'a-secure-test-secret-with-more-than-32-characters';
  delete process.env.FAL_KEY;
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const config = await fetch(`${base}/api/config`);
  const configBody = await config.json();
  assert.equal(configBody.ok, true);
  assert.equal(configBody.providers.fal.configured, false);
  assert.equal(JSON.stringify(configBody).includes('FAL_KEY'), false);

  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Estudio AudioVisual V2/);
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);

  const rejected = await fetch(`${base}/api/generations/video`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://wrong.example' },
    body: JSON.stringify({ modelId: 'seedance', mode: 'text', prompt: 'Una escena cinematográfica realista.' })
  });
  assert.equal(rejected.status, 403);

  process.env.FAL_KEY = 'test-provider-key';
  const created = await fetch(`${base}/api/generations/video`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ modelId: 'seedance', mode: 'text', prompt: 'Una escena cinematográfica realista.', aspectRatio: '9:16', duration: 8, resolution: '720p' })
  });
  assert.equal(created.status, 202);
  const createdBody = await created.json();
  assert.equal(typeof createdBody.jobId, 'string');
  const completed = await fetch(`${base}/api/jobs/${encodeURIComponent(createdBody.jobId)}`);
  const completedBody = await completed.json();
  assert.equal(completedBody.status, 'completed');
  assert.equal(completedBody.mediaUrl, 'https://example.invalid/result.mp4');
});
