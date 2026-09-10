import test from 'node:test';
import assert from 'node:assert/strict';
import { getModel, modelCatalog, publicCatalog } from '../src/models.js';

test('model ids and configured endpoints are unique', () => {
  assert.equal(new Set(modelCatalog.map((item) => item.id)).size, modelCatalog.length);
  const endpoints = modelCatalog.flatMap((item) => Object.values(item.endpoints));
  assert.equal(new Set(endpoints).size, endpoints.length);
});

test('public catalog never exposes endpoints or keys', () => {
  process.env.FAL_KEY = 'secret-value-for-test';
  const serialized = JSON.stringify(publicCatalog());
  assert.equal(serialized.includes('secret-value-for-test'), false);
  assert.equal(serialized.includes('endpoints'), false);
  assert.equal(getModel('seedance').provider, 'fal');
});
