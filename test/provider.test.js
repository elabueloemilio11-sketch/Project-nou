import test from 'node:test';
import assert from 'node:assert/strict';
import { fal } from '@fal-ai/client';
import { getModel } from '../src/models.js';
import { initializeProvider, submitVideo, submitVoice } from '../src/provider.js';

test('Seedance uses the verified reference endpoint for multiple images', async () => {
  process.env.FAL_KEY = 'test-provider-key';
  initializeProvider();
  let uploadIndex = 0;
  let submitted;
  fal.storage.upload = async () => `https://example.invalid/reference-${++uploadIndex}.jpg`;
  fal.queue.submit = async (endpoint, options) => {
    submitted = { endpoint, input: options.input };
    return { request_id: 'seedance-reference-request' };
  };

  await submitVideo(getModel('seedance'), {
    mode: 'image',
    prompt: 'Una escena con dos referencias visuales.',
    images: [
      { dataUrl: 'data:image/jpeg;base64,aGVsbG8=' },
      { dataUrl: 'data:image/jpeg;base64,d29ybGQ=' }
    ],
    aspectRatio: '9:16',
    duration: 8,
    resolution: '720p',
    seed: '',
    generateAudio: true
  }, 1024 * 1024);

  assert.equal(submitted.endpoint, 'bytedance/seedance-2.5/reference-to-video');
  assert.deepEqual(submitted.input.image_urls, [
    'https://example.invalid/reference-1.jpg',
    'https://example.invalid/reference-2.jpg'
  ]);
  assert.equal('image_url' in submitted.input, false);
});

test('MiniMax speech sends the documented prompt field', async () => {
  process.env.FAL_KEY = 'test-provider-key';
  initializeProvider();
  let submitted;
  fal.queue.submit = async (endpoint, options) => {
    submitted = { endpoint, input: options.input };
    return { request_id: 'voice-request' };
  };

  await submitVoice({
    mode: 'tts',
    text: 'Hola desde mi estudio.',
    voiceId: 'Wise_Woman',
    speed: 1,
    emotion: 'CÁLIDO'
  }, 1024 * 1024);

  assert.equal(submitted.endpoint, 'fal-ai/minimax/speech-2.6-hd');
  assert.equal(submitted.input.prompt, 'Hola desde mi estudio.');
  assert.equal('text' in submitted.input, false);
  assert.equal(submitted.input.voice_setting.voice_id, 'Wise_Woman');
});
