import { fal } from '@fal-ai/client';

let configuredKey = null;

function ensureFal() {
  const key = process.env.FAL_KEY;
  if (!key) {
    const error = new Error('FAL_KEY no está configurada en Render.');
    error.code = 'PROVIDER_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }
  if (configuredKey !== key) {
    fal.config({ credentials: key });
    configuredKey = key;
  }
}

function dataUrlToBlob(dataUrl, maxBytes) {
  if (typeof dataUrl !== 'string') throw new Error('Archivo no válido.');
  const match = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(dataUrl);
  if (!match) throw new Error('El archivo debe enviarse como data URL.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > maxBytes) throw new Error(`El archivo supera el límite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return new Blob([bytes], { type: match[1] });
}

async function uploadDataUrl(dataUrl, maxBytes) {
  const blob = dataUrlToBlob(dataUrl, maxBytes);
  return fal.storage.upload(blob);
}

function allowed(value, list) {
  return Array.isArray(list) && list.includes(value);
}

function buildVideoInput(model, payload, imageUrls) {
  const input = { prompt: payload.prompt.trim() };
  const fields = model.fields;
  const capabilities = model.capabilities;

  if (imageUrls.length > 1 && fields.images) input[fields.images] = imageUrls;
  else if (imageUrls[0] && fields.image) input[fields.image] = imageUrls[0];
  if (fields.negativePrompt && capabilities.negativePrompt && payload.negativePrompt?.trim()) input[fields.negativePrompt] = payload.negativePrompt.trim();
  if (fields.aspect && allowed(payload.aspectRatio, capabilities.ratios)) input[fields.aspect] = payload.aspectRatio;
  if (fields.duration && allowed(Number(payload.duration), capabilities.durations)) input[fields.duration] = `${Number(payload.duration)}${fields.durationSuffix || ''}`;
  if (fields.resolution && allowed(payload.resolution, capabilities.resolutions)) input[fields.resolution] = payload.resolution;
  if (fields.seed && capabilities.seed && Number.isInteger(Number(payload.seed)) && String(payload.seed).trim() !== '') input[fields.seed] = Number(payload.seed);
  if (fields.audio && capabilities.audio) input[fields.audio] = payload.generateAudio !== false;

  return input;
}

export async function submitVideo(model, payload, maxUploadBytes) {
  ensureFal();
  if (model.provider !== 'fal') {
    const error = new Error('Este proveedor todavía no está conectado.');
    error.code = 'PROVIDER_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }
  const mode = payload.mode === 'image' ? 'image' : 'text';
  const useReferences = mode === 'image' && payload.images?.length > 1 && model.capabilities.multipleImages && model.endpoints.reference;
  const endpoint = useReferences ? model.endpoints.reference : model.endpoints[mode];
  if (!endpoint) throw new Error('Este modo no está disponible para el modelo seleccionado.');
  let imageUrls = [];
  if (mode === 'image') {
    if (!payload.images?.length) throw new Error('Sube una imagen inicial para este modo.');
    const accepted = model.capabilities.multipleImages ? payload.images.slice(0, 9) : payload.images.slice(0, 1);
    imageUrls = await Promise.all(accepted.map((image) => uploadDataUrl(image.dataUrl, maxUploadBytes)));
  }
  const input = buildVideoInput(model, payload, imageUrls);
  const submitted = await fal.queue.submit(endpoint, { input });
  return { provider: 'fal', endpoint, requestId: submitted.request_id, kind: 'video' };
}

function emotionForProvider(emotion) {
  const map = { FELIZ: 'happy', ENFADADO: 'angry', EMOCIONAL: 'sad' };
  return map[emotion] || 'neutral';
}

export async function submitVoice(payload, maxUploadBytes) {
  ensureFal();
  if (payload.mode === 'clone') {
    if (!payload.audioDataUrl) throw new Error('Sube un archivo WAV para clonar la voz.');
    const audioUrl = await uploadDataUrl(payload.audioDataUrl, maxUploadBytes);
    const endpoint = 'fal-ai/minimax/voice-clone';
    const input = {
      audio_url: audioUrl,
      text: payload.text.trim(),
      noise_reduction: true,
      need_volume_normalization: true,
      model: 'speech-02-hd'
    };
    const submitted = await fal.queue.submit(endpoint, { input });
    return { provider: 'fal', endpoint, requestId: submitted.request_id, kind: 'voice' };
  }

  const endpoint = 'fal-ai/minimax/speech-2.6-hd';
  const input = {
    prompt: payload.text.trim(),
    output_format: 'url',
    language_boost: 'Spanish',
    voice_setting: {
      voice_id: payload.voiceId?.trim() || 'Wise_Woman',
      speed: Math.min(2, Math.max(.5, Number(payload.speed) || 1)),
      vol: 1,
      pitch: 0,
      emotion: emotionForProvider(payload.emotion)
    }
  };
  const submitted = await fal.queue.submit(endpoint, { input });
  return { provider: 'fal', endpoint, requestId: submitted.request_id, kind: 'voice' };
}

function findMedia(value, kind, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  const preferredKeys = kind === 'voice' ? ['audio', 'audio_url', 'url'] : ['video', 'video_url', 'output', 'url'];
  for (const key of preferredKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && /^https:\/\//i.test(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const found = findMedia(candidate, kind, seen);
      if (found) return found;
    }
  }
  for (const candidate of Object.values(value)) {
    if (candidate && typeof candidate === 'object') {
      const found = findMedia(candidate, kind, seen);
      if (found) return found;
    }
  }
  return null;
}

export async function readJob(job) {
  ensureFal();
  if (job.provider !== 'fal') throw new Error('Proveedor no disponible.');
  const status = await fal.queue.status(job.endpoint, { requestId: job.requestId, logs: true });
  const raw = String(status.status || '').toUpperCase();
  if (raw === 'IN_QUEUE') return { status: 'queued', progress: 12, logs: status.logs || [] };
  if (raw === 'IN_PROGRESS') return { status: 'processing', progress: 58, logs: status.logs || [] };
  if (raw !== 'COMPLETED') return { status: 'finalizing', progress: 88, logs: status.logs || [] };
  const result = await fal.queue.result(job.endpoint, { requestId: job.requestId });
  return {
    status: 'completed',
    progress: 100,
    mediaUrl: findMedia(result.data, job.kind),
    voiceId: result.data?.custom_voice_id || result.data?.voice_id || null,
    result: result.data
  };
}
