const sharedRatios = ['9:16', '16:9', '1:1'];

export const modelCatalog = [
  {
    id: 'seedance',
    name: 'Seedance 2.5',
    provider: 'fal',
    badge: 'MULTI-SHOT',
    description: 'Movimiento cinematográfico, referencias y audio nativo.',
    endpoints: {
      text: 'bytedance/seedance-2.5/text-to-video',
      image: 'bytedance/seedance-2.5/image-to-video',
      reference: 'bytedance/seedance-2.5/reference-to-video'
    },
    fields: { image: 'image_url', images: 'image_urls', aspect: 'aspect_ratio', duration: 'duration', resolution: 'resolution', seed: 'seed', audio: 'generate_audio' },
    capabilities: { modes: ['text', 'image'], ratios: sharedRatios, durations: [4, 5, 6, 8, 10, 15, 20, 30], resolutions: ['480p', '720p', '1080p'], qualities: [], negativePrompt: false, seed: true, audio: true, multipleImages: true }
  },
  {
    id: 'kling',
    name: 'Kling V3 Standard',
    provider: 'fal',
    badge: 'REALISMO',
    description: 'Movimiento consistente y control cinematográfico.',
    endpoints: {
      text: 'fal-ai/kling-video/v3/standard/text-to-video',
      image: 'fal-ai/kling-video/v3/standard/image-to-video'
    },
    fields: { image: 'start_image_url', aspect: 'aspect_ratio', duration: 'duration', negativePrompt: 'negative_prompt', audio: 'generate_audio' },
    capabilities: { modes: ['text', 'image'], ratios: sharedRatios, durations: [5, 10], resolutions: [], qualities: ['standard'], negativePrompt: true, seed: false, audio: true, multipleImages: false }
  },
  {
    id: 'veo',
    name: 'Veo 3.1 Fast',
    provider: 'fal',
    badge: 'AUDIO',
    description: 'Vídeo con composición avanzada y audio sincronizado.',
    endpoints: {
      text: 'fal-ai/veo3.1/fast',
      image: 'fal-ai/veo3.1/fast/image-to-video'
    },
    fields: { image: 'image_url', aspect: 'aspect_ratio', duration: 'duration', durationSuffix: 's', resolution: 'resolution', negativePrompt: 'negative_prompt', seed: 'seed', audio: 'generate_audio' },
    capabilities: { modes: ['text', 'image'], ratios: ['9:16', '16:9'], durations: [4, 6, 8], resolutions: ['720p', '1080p'], qualities: ['fast'], negativePrompt: true, seed: true, audio: true, multipleImages: false }
  },
  {
    id: 'minimax',
    name: 'MiniMax Hailuo 2.3',
    provider: 'fal',
    badge: 'EQUILIBRADO',
    description: 'Movimiento natural con salida estándar a 768p.',
    endpoints: {
      text: 'fal-ai/minimax/hailuo-2.3/standard/text-to-video',
      image: 'fal-ai/minimax/hailuo-2.3/standard/image-to-video'
    },
    fields: { image: 'image_url', duration: 'duration', seed: 'seed' },
    capabilities: { modes: ['text', 'image'], ratios: [], durations: [6, 10], resolutions: ['768p'], qualities: ['standard'], negativePrompt: false, seed: true, audio: false, multipleImages: false }
  },
  {
    id: 'ltx',
    name: 'LTX 2.3',
    provider: 'fal',
    badge: 'CREATIVO',
    description: 'Generación de vídeo con audio y controles creativos.',
    endpoints: {
      text: 'fal-ai/ltx-2.3/text-to-video',
      image: 'fal-ai/ltx-2.3/image-to-video'
    },
    fields: { image: 'image_url', seed: 'seed', audio: 'generate_audio' },
    capabilities: { modes: ['text', 'image'], ratios: [], durations: [], resolutions: [], qualities: ['pro'], negativePrompt: false, seed: true, audio: true, multipleImages: false }
  },
  {
    id: 'wan',
    name: 'Wan 2.7',
    provider: 'fal',
    badge: 'VERSÁTIL',
    description: 'Texto o imagen a vídeo con alta coherencia visual.',
    endpoints: {
      text: 'fal-ai/wan/v2.7/text-to-video',
      image: 'fal-ai/wan/v2.7/image-to-video'
    },
    fields: { image: 'image_url', aspect: 'aspect_ratio', duration: 'duration', resolution: 'resolution', seed: 'seed' },
    capabilities: { modes: ['text', 'image'], ratios: sharedRatios, durations: [5, 10], resolutions: ['720p', '1080p'], qualities: [], negativePrompt: false, seed: true, audio: false, multipleImages: false }
  },
  {
    id: 'pixverse',
    name: 'PixVerse 5.6',
    provider: 'fal',
    badge: 'SOCIAL',
    description: 'Clips rápidos y efectos pensados para contenido social.',
    endpoints: {
      text: 'fal-ai/pixverse/v5.6/text-to-video',
      image: 'fal-ai/pixverse/v5.6/image-to-video'
    },
    fields: { image: 'image_url', aspect: 'aspect_ratio', duration: 'duration', resolution: 'resolution', negativePrompt: 'negative_prompt', seed: 'seed' },
    capabilities: { modes: ['text', 'image'], ratios: sharedRatios, durations: [5, 8], resolutions: ['540p', '720p', '1080p'], qualities: [], negativePrompt: true, seed: true, audio: false, multipleImages: false }
  },
  {
    id: 'pika',
    name: 'Pika 2.2',
    provider: 'fal',
    badge: 'EFECTOS',
    description: 'Transformaciones y piezas visuales breves.',
    endpoints: {
      text: 'fal-ai/pika/v2.2/text-to-video',
      image: 'fal-ai/pika/v2.2/image-to-video'
    },
    fields: { image: 'image_url', aspect: 'aspect_ratio', duration: 'duration', resolution: 'resolution', negativePrompt: 'negative_prompt', seed: 'seed' },
    capabilities: { modes: ['text', 'image'], ratios: sharedRatios, durations: [5, 10], resolutions: ['720p', '1080p'], qualities: [], negativePrompt: true, seed: true, audio: false, multipleImages: false }
  },
  {
    id: 'runway',
    name: 'Runway',
    provider: 'runway',
    badge: 'PRO',
    description: 'Integración independiente preparada para una futura conexión.',
    endpoints: {},
    fields: {},
    capabilities: { modes: ['text', 'image'], ratios: ['9:16', '16:9'], durations: [], resolutions: [], qualities: [], negativePrompt: false, seed: false, audio: false, multipleImages: false }
  }
];

function parsePrices() {
  try {
    const parsed = JSON.parse(process.env.MODEL_PRICE_USD_PER_SECOND || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0).map(([key, value]) => [key, Number(value)]));
  } catch {
    return {};
  }
}

export function publicCatalog() {
  const prices = parsePrices();
  return modelCatalog.map((model) => ({
    id: model.id,
    name: model.name,
    provider: model.provider,
    badge: model.badge,
    description: model.description,
    configured: model.provider === 'fal' ? Boolean(process.env.FAL_KEY) : false,
    capabilities: model.capabilities,
    pricing: prices[model.id] == null ? null : { currency: 'USD', unit: 'second', rate: prices[model.id] }
  }));
}

export function getModel(id) {
  return modelCatalog.find((model) => model.id === id) || null;
}
