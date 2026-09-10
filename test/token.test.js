import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobToken, readJobToken } from '../src/token.js';

test('job tokens are signed and tamper evident', () => {
  process.env.APP_SIGNING_SECRET = 'a-secure-test-secret-with-more-than-32-characters';
  const original = { provider: 'fal', endpoint: 'example/model', requestId: 'request-1', kind: 'video' };
  const token = createJobToken(original);
  assert.deepEqual(readJobToken(token).endpoint, original.endpoint);
  assert.throws(() => readJobToken(`${token}changed`));
});
