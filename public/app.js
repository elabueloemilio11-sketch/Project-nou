(() => {
  'use strict';

  const HISTORY_KEY = 'estudio-audiovisual-v2-history';
  const MAX_HISTORY = 30;
  const MAX_FILE_BYTES = 12 * 1024 * 1024;
  const emotions = ['STANDARD', 'NARRADOR', 'CÁLIDO', 'EMOCIONAL', 'FELIZ', 'FIRME', 'ENFADADO'];
  const titles = { video: 'Generador de vídeo', image: 'Generador de imagen', voice: 'Estudio de voz', history: 'Historial', settings: 'Configuración' };

  let config = null;
  let selectedModelId = '';
  let videoMode = 'image';
  let images = [];
  let voiceMode = 'tts';
  let voiceAudio = null;
  let selectedEmotion = 'CÁLIDO';
  let pollTimer = null;
  let toastTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function loadHistory() {
    try {
      const items = JSON.parse(localStorage.getItem(HISTORY_KEY));
      return Array.isArray(items) ? items.slice(0, MAX_HISTORY) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY))); }
    catch { showToast('No se pudo guardar el historial en este navegador.', 'warning'); }
  }

  function addHistory(item) {
    const items = loadHistory();
    items.unshift(item);
    saveHistory(items);
    renderHistory();
  }

  function updateHistory(id, patch) {
    saveHistory(loadHistory().map((item) => item.id === id ? { ...item, ...patch } : item));
    renderHistory();
  }

  function showToast(message, type = 'success') {
    const toast = $('#toast');
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast is-${type}`;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
  }

  function formMessage(selector, message = '', type = 'error') {
    const node = $(selector);
    node.textContent = message;
    node.className = `form-message ${message ? `is-${type}` : ''}`;
  }

  async function api(url, options) {
    const response = await fetch(url, options);
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) {
      const error = new Error(body.message || 'No se pudo completar la solicitud.');
      error.code = body.code;
      throw error;
    }
    return body;
  }

  function modelById(id = selectedModelId) {
    return config?.models?.find((model) => model.id === id) || null;
  }

  function setTab(name) {
    if (!titles[name]) name = 'video';
    $$('[data-panel]').forEach((panel) => { const active = panel.dataset.panel === name; panel.hidden = !active; panel.classList.toggle('is-active', active); });
    $$('[data-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === name));
    $('#page-title').textContent = titles[name];
    window.history.replaceState(null, '', `#${name}`);
    if (name === 'history') renderHistory();
    if (name === 'settings') renderProviders();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderConnection() {
    const connected = config?.providers?.fal?.configured === true;
    $('#provider-pill').textContent = connected ? '● FAL.AI CONECTADO' : 'REQUIERE CONFIGURACIÓN';
    $('#provider-pill').className = `provider-pill ${connected ? 'is-connected' : 'is-missing'}`;
    $('#sidebar-provider-dot').className = connected ? 'is-connected' : 'is-missing';
    $('#sidebar-provider-title').textContent = connected ? 'fal.ai conectado' : 'fal.ai no configurado';
    $('#sidebar-provider-copy').textContent = connected ? 'Generación disponible' : 'Añade FAL_KEY en Render';
    $('#generate-button-note').textContent = connected ? 'El coste se cobra en tu proveedor' : 'Requiere FAL_KEY en Render';
  }

  function renderModels() {
    const grid = $('#model-grid');
    grid.innerHTML = config.models.map((model) => `<button type="button" class="model-option ${selectedModelId === model.id ? 'is-selected' : ''} ${model.configured ? '' : 'is-unavailable'}" data-model="${model.id}" role="radio" aria-checked="${selectedModelId === model.id}"><span class="model-badge">${escapeHtml(model.badge)}</span><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.description)}</small><i>${model.configured ? 'DISPONIBLE' : 'REQUIERE CONFIGURACIÓN'}</i></button>`).join('');
    $$('[data-model]', grid).forEach((button) => button.addEventListener('click', () => {
      selectedModelId = button.dataset.model;
      renderModels();
      renderModelControls();
      updateEstimate();
      const model = modelById();
      if (!model.configured) showToast(`${model.name}: ${model.provider === 'runway' ? 'integración independiente pendiente' : 'añade FAL_KEY en Render'}.`, 'warning');
    }));
  }

  function optionMarkup(items, format, emptyLabel) {
    if (!items?.length) return `<option value="">${emptyLabel}</option>`;
    return items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(format ? format(item) : item)}</option>`).join('');
  }

  function renderModelControls() {
    const model = modelById();
    const caps = model?.capabilities || { ratios: [], durations: [], resolutions: [], qualities: [] };
    $('#aspect-ratio').innerHTML = optionMarkup(caps.ratios, null, 'Automático / proveedor');
    $('#duration').innerHTML = optionMarkup(caps.durations, (value) => `${value} segundos`, 'Duración del modelo');
    $('#resolution').innerHTML = optionMarkup(caps.resolutions, null, 'Resolución del modelo');
    $('#quality').innerHTML = optionMarkup(caps.qualities, (value) => value.toUpperCase(), 'Calidad del modelo');
    $('#negative-prompt-wrap').hidden = !caps.negativePrompt;
    $('#seed-wrap').hidden = !caps.seed;
    $('#audio-toggle-wrap').hidden = !caps.audio;
    const modeAvailable = model?.capabilities?.modes?.includes(videoMode) !== false;
    if (!modeAvailable && model?.capabilities?.modes?.length) setVideoMode(model.capabilities.modes[0]);
  }

  function setVideoMode(mode) {
    videoMode = mode === 'text' ? 'text' : 'image';
    $$('[data-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.mode === videoMode));
    $('#upload-section').hidden = videoMode !== 'image';
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }

  async function addImages(fileList) {
    const supportsMultiple = modelById()?.capabilities?.multipleImages === true;
    const selected = [...fileList].filter((file) => /^image\/(png|jpeg|webp)$/i.test(file.type));
    const files = supportsMultiple ? selected : selected.slice(0, 1);
    if (!files.length) return showToast('Selecciona imágenes PNG, JPG o WEBP.', 'warning');
    if (!supportsMultiple && selected.length > 1) showToast('Este modelo usa una sola imagen inicial. Se conservará la primera.', 'warning');
    if (!supportsMultiple) images = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) { showToast(`${file.name} supera 12 MB.`, 'warning'); continue; }
      if (images.length >= 9) { showToast('Puedes preparar hasta 9 referencias.', 'warning'); break; }
      images.push({ id: `${Date.now()}-${Math.random()}`, name: file.name, size: file.size, dataUrl: await readFile(file) });
    }
    renderPreviews();
  }

  function renderPreviews() {
    const list = $('#image-previews');
    list.innerHTML = images.map((image, index) => `<article class="image-preview"><img src="${image.dataUrl}" alt="Referencia ${index + 1}"><button type="button" data-remove-image="${image.id}" aria-label="Eliminar ${escapeHtml(image.name)}">×</button><span>${index === 0 ? 'START' : `REF ${index + 1}`}</span></article>`).join('');
    $$('[data-remove-image]', list).forEach((button) => button.addEventListener('click', () => { images = images.filter((image) => image.id !== button.dataset.removeImage); renderPreviews(); }));
  }

  function updateEstimate() {
    const model = modelById();
    const duration = Number($('#duration').value);
    if (model?.pricing && duration) {
      const value = duration * model.pricing.rate;
      $('#estimated-price').textContent = `$${value.toFixed(2)} USD`;
      $('#estimate-copy').textContent = `${duration} s × $${model.pricing.rate.toFixed(4)}/s. Precio orientativo.`;
    } else {
      $('#estimated-price').textContent = 'Consultar proveedor';
      $('#estimate-copy').textContent = 'No hay una tarifa verificada en la configuración. Confírmala antes de generar.';
    }
  }

  function videoPayload() {
    return {
      modelId: selectedModelId,
      mode: videoMode,
      images: images.map(({ name, dataUrl }) => ({ name, dataUrl })),
      prompt: $('#video-prompt').value,
      negativePrompt: $('#negative-prompt').value,
      aspectRatio: $('#aspect-ratio').value,
      duration: $('#duration').value,
      resolution: $('#resolution').value,
      quality: $('#quality').value,
      seed: $('#seed').value,
      generateAudio: $('#generate-audio').checked
    };
  }

  function validateVideo(payload) {
    if (!payload.modelId) return 'Selecciona un modelo.';
    const model = modelById(payload.modelId);
    if (!model?.configured) return `${model?.name || 'El modelo'} requiere configurar su proveedor.`;
    if (payload.mode === 'image' && !payload.images.length) return 'Sube una imagen inicial.';
    if (payload.prompt.trim().length < 5) return 'Escribe un prompt de al menos 5 caracteres.';
    return '';
  }

  function setJobState(status, kind = 'video', copy = '') {
    const label = { idle: 'LISTO', queued: 'EN COLA', processing: 'PROCESANDO', finalizing: 'FINALIZANDO', completed: 'COMPLETADO', failed: 'ERROR' }[status] || status.toUpperCase();
    const badge = kind === 'voice' ? $('#voice-job-status') : $('#job-status');
    badge.textContent = label;
    badge.className = `status-badge status-${status}`;
    if (kind === 'voice') {
      $('#voice-result-title').textContent = status === 'completed' ? 'Voz completada' : status === 'failed' ? 'No se pudo generar' : status === 'idle' ? 'Tu voz aparecerá aquí' : `${label}…`;
      if (copy) $('#voice-result-copy').textContent = copy;
      return;
    }
    if (status === 'idle') return;
    $('#empty-result').hidden = true;
    if (status !== 'completed') {
      $('#result-video').hidden = true;
      $('#result-actions').hidden = true;
    }
    $('#job-progress').hidden = status === 'completed';
    $('#job-progress-title').textContent = status === 'failed' ? 'NO SE PUDO COMPLETAR' : status === 'completed' ? 'COMPLETADO' : `${label}…`;
    $('#job-progress-copy').textContent = copy || 'Esperando una respuesta real del proveedor.';
  }

  function setProgress(value) {
    const normalized = [0, 12, 58, 88, 100].reduce((best, item) => Math.abs(item - value) < Math.abs(best - value) ? item : best, 0);
    $('#job-progress-bar').className = `progress-value-${normalized}`;
    $('#job-progress-percent').textContent = `${value}%`;
  }

  async function pollJob(jobId, kind, historyId, attempt = 0) {
    clearTimeout(pollTimer);
    if (attempt > 225) {
      setJobState('failed', kind, 'La espera ha terminado. El trabajo puede seguir en el proveedor; consulta su panel.');
      updateHistory(historyId, { status: 'unknown' });
      return;
    }
    try {
      const result = await api(`/api/jobs/${encodeURIComponent(jobId)}`);
      setJobState(result.status, kind, 'Estado confirmado por el proveedor.');
      if (kind === 'video') setProgress(result.progress || 0);
      updateHistory(historyId, { status: result.status, mediaUrl: result.mediaUrl || null, voiceId: result.voiceId || null });
      if (result.status === 'completed') {
        if (!result.mediaUrl) throw new Error('El proveedor terminó, pero no devolvió un archivo descargable.');
        if (kind === 'video') showVideoResult(result.mediaUrl);
        else showVoiceResult(result.mediaUrl, result.voiceId);
        showToast(kind === 'video' ? 'Vídeo completado.' : 'Voz completada.');
        return;
      }
      pollTimer = setTimeout(() => pollJob(jobId, kind, historyId, attempt + 1), 4000);
    } catch (error) {
      if (attempt < 2) {
        pollTimer = setTimeout(() => pollJob(jobId, kind, historyId, attempt + 1), 5000);
        return;
      }
      setJobState('failed', kind, error.message);
      updateHistory(historyId, { status: 'failed', error: error.message });
      formMessage(kind === 'video' ? '#video-form-message' : '#voice-form-message', error.message);
    }
  }

  function showVideoResult(url) {
    const video = $('#result-video');
    video.crossOrigin = 'anonymous';
    video.src = url;
    video.hidden = false;
    $('#job-progress').hidden = true;
    $('#result-actions').hidden = false;
    $('#download-result').href = url;
    setJobState('completed');
  }

  function useVideoAsStartFrame() {
    const video = $('#result-video');
    if (!video.src || !video.videoWidth || video.readyState < 2) return showToast('Reproduce o pausa el vídeo en el fotograma que quieres usar.', 'warning');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', .92);
      images = [{ id: `frame-${Date.now()}`, name: 'fotograma-generado.jpg', size: Math.ceil(dataUrl.length * .75), dataUrl }];
      setVideoMode('image');
      renderPreviews();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Fotograma preparado como start frame.');
    } catch {
      showToast('El proveedor no permite extraer este fotograma. Descárgalo y súbelo manualmente.', 'warning');
    }
  }

  function showVoiceResult(url, voiceId) {
    const audio = $('#voice-result-audio');
    audio.src = url;
    audio.hidden = false;
    $('#download-audio').href = url;
    $('#download-audio').hidden = false;
    $('#voice-result-copy').textContent = voiceId ? `Voice ID: ${voiceId}` : 'Audio real recibido del proveedor.';
    if (voiceId) $('#voice-id').value = voiceId;
    setJobState('completed', 'voice');
  }

  async function submitVideoForm(event) {
    event.preventDefault();
    formMessage('#video-form-message');
    const payload = videoPayload();
    const problem = validateVideo(payload);
    if (problem) return formMessage('#video-form-message', problem);
    const button = $('#generate-video');
    button.disabled = true;
    setJobState('queued', 'video', 'Subiendo referencias y preparando la solicitud.');
    setProgress(12);
    const historyId = `video-${Date.now()}`;
    try {
      const result = await api('/api/generations/video', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      addHistory({ id: historyId, kind: 'video', createdAt: new Date().toISOString(), modelId: payload.modelId, modelName: modelById(payload.modelId).name, duration: payload.duration || null, prompt: payload.prompt, aspectRatio: payload.aspectRatio || 'auto', resolution: payload.resolution || 'auto', estimatedCost: $('#estimated-price').textContent, status: 'queued', jobId: result.jobId, mediaUrl: null });
      pollJob(result.jobId, 'video', historyId);
    } catch (error) {
      setJobState('failed', 'video', error.message);
      formMessage('#video-form-message', error.message);
      showToast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function submitVoiceForm(event) {
    event.preventDefault();
    formMessage('#voice-form-message');
    const payload = { mode: voiceMode, text: $('#voice-text').value, voiceId: $('#voice-id').value, speed: $('#voice-speed').value, emotion: selectedEmotion, audioDataUrl: voiceAudio?.dataUrl || '' };
    if (!config?.voice?.configured) return formMessage('#voice-form-message', 'Añade FAL_KEY en Render antes de generar voz.');
    if (!payload.text.trim()) return formMessage('#voice-form-message', 'Escribe el texto de la voz.');
    if (voiceMode === 'clone' && !voiceAudio) return formMessage('#voice-form-message', 'Sube un archivo WAV con consentimiento.');
    const button = $('#generate-voice');
    button.disabled = true;
    setJobState('queued', 'voice', 'Enviando la solicitud al proveedor.');
    const historyId = `voice-${Date.now()}`;
    try {
      const result = await api('/api/generations/voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      addHistory({ id: historyId, kind: 'voice', createdAt: new Date().toISOString(), modelName: voiceMode === 'clone' ? 'MiniMax Voice Clone' : 'MiniMax Speech 2.6 HD', duration: null, prompt: payload.text, status: 'queued', jobId: result.jobId, mediaUrl: null });
      pollJob(result.jobId, 'voice', historyId);
    } catch (error) {
      setJobState('failed', 'voice', error.message);
      formMessage('#voice-form-message', error.message);
      showToast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  function statusLabel(status) {
    return { queued: 'EN COLA', processing: 'PROCESANDO', finalizing: 'FINALIZANDO', completed: 'COMPLETADO', failed: 'ERROR', unknown: 'REVISAR' }[status] || String(status || 'GUARDADO').toUpperCase();
  }

  function renderHistory() {
    const list = $('#history-list');
    if (!list) return;
    const items = loadHistory();
    if (!items.length) {
      list.innerHTML = '<div class="empty-history"><span>↺</span><strong>Todavía no hay generaciones</strong><p>Los trabajos aparecerán aquí con su estado real.</p></div>';
      return;
    }
    list.innerHTML = items.map((item) => `<article class="history-item"><div class="history-thumb ${item.kind === 'voice' ? 'is-audio' : ''}">${item.mediaUrl && item.kind === 'video' ? `<video src="${escapeHtml(item.mediaUrl)}" muted preload="metadata"></video>` : `<span>${item.kind === 'voice' ? '◉' : '▶'}</span>`}</div><div class="history-copy"><div><span class="history-kind">${item.kind === 'voice' ? 'VOZ' : 'VÍDEO'}</span><span class="status-badge status-${escapeHtml(item.status)}">${statusLabel(item.status)}</span></div><strong>${escapeHtml(item.modelName || 'Generación')}</strong><p>${escapeHtml(item.prompt || '')}</p><small>${new Date(item.createdAt).toLocaleString('es-ES')} ${item.duration ? `· ${escapeHtml(item.duration)} s` : ''} ${item.estimatedCost ? `· ${escapeHtml(item.estimatedCost)}` : ''}</small></div><div class="history-actions">${item.mediaUrl ? `<a href="${escapeHtml(item.mediaUrl)}" target="_blank" rel="noopener noreferrer">VER</a><a href="${escapeHtml(item.mediaUrl)}" target="_blank" rel="noopener noreferrer" download>DESCARGAR</a>` : ''}<button type="button" data-repeat-history="${escapeHtml(item.id)}">REPETIR</button></div></article>`).join('');
    $$('[data-repeat-history]', list).forEach((button) => button.addEventListener('click', () => repeatHistory(button.dataset.repeatHistory)));
  }

  function repeatHistory(id) {
    const item = loadHistory().find((entry) => entry.id === id);
    if (!item) return;
    if (item.kind === 'voice') {
      setTab('voice');
      $('#voice-text').value = item.prompt || '';
    } else {
      setTab('video');
      selectedModelId = item.modelId || selectedModelId;
      $('#video-prompt').value = item.prompt || '';
      renderModels();
      renderModelControls();
      if (item.aspectRatio && [...$('#aspect-ratio').options].some((option) => option.value === item.aspectRatio)) $('#aspect-ratio').value = item.aspectRatio;
      if (item.duration && [...$('#duration').options].some((option) => option.value === String(item.duration))) $('#duration').value = String(item.duration);
      updateEstimate();
      $('#prompt-count').textContent = `${$('#video-prompt').value.length} / 4000`;
    }
    showToast('Configuración recuperada. Revisa imágenes y coste antes de generar.');
  }

  function renderProviders() {
    const list = $('#provider-list');
    if (!list || !config) return;
    list.innerHTML = Object.entries(config.providers).map(([id, provider]) => `<article class="provider-row"><span class="provider-logo">${id === 'fal' ? 'F' : 'R'}</span><div><strong>${escapeHtml(provider.label)}</strong><small>${provider.configured ? 'Clave disponible en el servidor' : escapeHtml(provider.message || 'Añade la variable en Render')}</small></div><b class="connection-state ${provider.configured ? 'is-connected' : 'is-missing'}">${provider.configured ? '✓ CONECTADO' : 'NO CONFIGURADO'}</b></article>`).join('');
  }

  function setVoiceMode(mode) {
    voiceMode = mode === 'clone' ? 'clone' : 'tts';
    $$('[data-voice-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.voiceMode === voiceMode));
    $('#voice-upload-section').hidden = voiceMode !== 'clone';
    $('#voice-id-wrap').hidden = voiceMode === 'clone';
    $('#generate-voice').querySelector('b').textContent = voiceMode === 'clone' ? 'CLONAR VOZ' : 'GENERAR VOZ';
  }

  function bindEvents() {
    $$('[data-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)));
    $('[data-tab-link]')?.addEventListener('click', (event) => { event.preventDefault(); setTab('video'); });
    $$('[data-mode]').forEach((button) => button.addEventListener('click', () => setVideoMode(button.dataset.mode)));
    $$('[data-voice-mode]').forEach((button) => button.addEventListener('click', () => setVoiceMode(button.dataset.voiceMode)));
    $('#video-images').addEventListener('change', (event) => addImages(event.target.files));
    $('#drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); event.currentTarget.classList.add('is-dragging'); });
    $('#drop-zone').addEventListener('dragleave', (event) => event.currentTarget.classList.remove('is-dragging'));
    $('#drop-zone').addEventListener('drop', (event) => { event.preventDefault(); event.currentTarget.classList.remove('is-dragging'); addImages(event.dataTransfer.files); });
    document.addEventListener('paste', (event) => { if (videoMode !== 'image') return; const files = [...event.clipboardData.files]; if (files.length) addImages(files); });
    $('#video-prompt').addEventListener('input', (event) => { $('#prompt-count').textContent = `${event.target.value.length} / 4000`; });
    $('#duration').addEventListener('change', updateEstimate);
    $('#video-form').addEventListener('submit', submitVideoForm);
    $('#repeat-generation').addEventListener('click', () => { $('#result-video').pause(); $('#result-video').hidden = true; $('#result-actions').hidden = true; $('#empty-result').hidden = false; setJobState('idle'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#use-start-frame').addEventListener('click', useVideoAsStartFrame);
    $('#voice-speed').addEventListener('input', (event) => { $('#voice-speed-value').textContent = `${Number(event.target.value).toFixed(1)}×`; });
    $('#voice-file').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!/\.wav$/i.test(file.name) && !/wav/i.test(file.type)) { event.target.value = ''; return showToast('Selecciona un archivo WAV.', 'warning'); }
      if (file.size > MAX_FILE_BYTES) { event.target.value = ''; return showToast('El WAV supera 12 MB.', 'warning'); }
      voiceAudio = { name: file.name, dataUrl: await readFile(file) };
      $('#voice-file-name').textContent = `✓ ${file.name}`;
    });
    $('#voice-form').addEventListener('submit', submitVoiceForm);
    $('#clear-history').addEventListener('click', () => { saveHistory([]); renderHistory(); showToast('Historial eliminado de este navegador.'); });
    $('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
    $('#close-help').addEventListener('click', () => $('#help-dialog').close());
    $('#close-help-action').addEventListener('click', () => $('#help-dialog').close());
    $('#help-dialog').addEventListener('click', (event) => { if (event.target === $('#help-dialog')) $('#help-dialog').close(); });
  }

  function renderEmotions() {
    $('#emotion-chips').innerHTML = emotions.map((emotion) => `<button type="button" class="choice-chip ${emotion === selectedEmotion ? 'is-selected' : ''}" data-emotion="${emotion}">${emotion}</button>`).join('');
    $$('[data-emotion]').forEach((button) => button.addEventListener('click', () => { selectedEmotion = button.dataset.emotion; renderEmotions(); }));
  }

  async function boot() {
    bindEvents();
    renderEmotions();
    renderHistory();
    setTab(location.hash.slice(1) || 'video');
    try {
      config = await api('/api/config');
      const firstConfigured = config.models.find((model) => model.configured && model.provider === 'fal');
      selectedModelId = firstConfigured?.id || config.models[0]?.id || '';
      renderConnection();
      renderModels();
      renderModelControls();
      renderProviders();
      updateEstimate();
    } catch (error) {
      $('#provider-pill').textContent = 'SIN CONEXIÓN';
      $('#provider-pill').className = 'provider-pill is-missing';
      formMessage('#video-form-message', `No se pudo cargar la configuración: ${error.message}`);
      showToast('No se pudo conectar con el servidor.', 'error');
    }
  }

  boot();
})();
