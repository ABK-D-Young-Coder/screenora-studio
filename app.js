(() => {
  'use strict';

  const els = {
    supportBadge: document.getElementById('supportBadge'),
    formatLabel: document.getElementById('formatLabel'),
    screenToggle: document.getElementById('screenToggle'),
    cameraToggle: document.getElementById('cameraToggle'),
    micToggle: document.getElementById('micToggle'),
    systemAudioToggle: document.getElementById('systemAudioToggle'),
    cameraPosition: document.getElementById('cameraPosition'),
    cameraSize: document.getElementById('cameraSize'),
    cameraSizeOut: document.getElementById('cameraSizeOut'),
    countdownSelect: document.getElementById('countdownSelect'),
    resolutionSelect: document.getElementById('resolutionSelect'),
    screenVideo: document.getElementById('screenVideo'),
    cameraVideo: document.getElementById('cameraVideo'),
    cameraPreview: document.getElementById('cameraPreview'),
    canvas: document.getElementById('compositeCanvas'),
    stage: document.getElementById('previewStage'),
    emptyPreview: document.getElementById('emptyPreview'),
    cameraBubble: document.getElementById('cameraBubble'),
    countdown: document.getElementById('countdown'),
    timer: document.getElementById('timer'),
    state: document.getElementById('recordState'),
    previewHint: document.getElementById('previewHint'),
    startBtn: document.getElementById('startBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stopBtn: document.getElementById('stopBtn'),
    recordingsPanel: document.getElementById('recordingsPanel'),
    recordingPreview: document.getElementById('recordingPreview'),
    downloadBtn: document.getElementById('downloadBtn'),
    newRecordingBtn: document.getElementById('newRecordingBtn'),
    recordingSize: document.getElementById('recordingSize'),
    recordingMessage: document.getElementById('recordingMessage'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsDialog: document.getElementById('settingsDialog'),
    toast: document.getElementById('toast')
  };

  const state = {
    screenStream: null,
    cameraStream: null,
    micStream: null,
    combinedStream: null,
    recorder: null,
    chunks: [],
    recordingUrl: null,
    isRecording: false,
    isPaused: false,
    startedAt: 0,
    timerId: null,
    drawId: null,
    canvasStream: null,
    audioContext: null,
    audioDestination: null
  };

  const supportedMimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  function pickMimeType() {
    if (!window.MediaRecorder) return '';
    return supportedMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function humanBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => els.toast.classList.remove('show'), 2700);
  }

  function setState(kind, label) {
    els.state.className = `record-state ${kind}`;
    els.state.innerHTML = `<span></span>${label}`;
  }

  function stopStream(stream) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
  }

  function clearSources() {
    stopStream(state.screenStream);
    stopStream(state.cameraStream);
    stopStream(state.micStream);
    state.screenStream = null;
    state.cameraStream = null;
    state.micStream = null;
    els.screenVideo.srcObject = null;
    els.cameraVideo.srcObject = null;
    els.cameraPreview.srcObject = null;
  }

  function getCanvasSize(video) {
    const sourceWidth = video?.videoWidth || 1280;
    const sourceHeight = video?.videoHeight || 720;
    const maxHeight = Number(els.resolutionSelect.value);
    if (!Number.isFinite(maxHeight)) return { width: sourceWidth, height: sourceHeight };
    const ratio = Math.min(1, maxHeight / sourceHeight);
    return { width: Math.max(320, Math.round(sourceWidth * ratio)), height: Math.max(180, Math.round(sourceHeight * ratio)) };
  }

  function positionCamera(ctx, canvasWidth, canvasHeight) {
    if (!state.screenStream || !state.cameraStream || els.cameraVideo.readyState < 2) return;
    const ratio = Number(els.cameraSize.value) / 100;
    const size = Math.round(Math.min(canvasWidth, canvasHeight) * ratio);
    const margin = Math.round(Math.min(canvasWidth, canvasHeight) * 0.025);
    const pos = els.cameraPosition.value;
    let x = canvasWidth - size - margin;
    let y = canvasHeight - size - margin;
    if (pos.includes('left')) x = margin;
    if (pos.includes('top')) y = margin;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    ctx.drawImage(els.cameraVideo, 0, 0, size, size);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = Math.max(3, Math.round(size * 0.025));
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawComposite() {
    const canvas = els.canvas;
    const ctx = canvas.getContext('2d');
    const video = state.screenStream ? els.screenVideo : els.cameraVideo;
    if (!video) return;
    const size = getCanvasSize(video);
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (state.screenStream && els.screenVideo.readyState >= 2) {
      ctx.drawImage(els.screenVideo, 0, 0, canvas.width, canvas.height);
    } else if (state.cameraStream && els.cameraVideo.readyState >= 2) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(els.cameraVideo, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    positionCamera(ctx, canvas.width, canvas.height);
    state.drawId = requestAnimationFrame(drawComposite);
  }

  async function waitForVideo(video, stream) {
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    if (video.readyState < 2) {
      await new Promise((resolve) => video.addEventListener('loadeddata', resolve, { once: true }));
    }
  }

  async function prepareSources() {
    if (!els.screenToggle.checked && !els.cameraToggle.checked) throw new Error('Enable Screen or Camera first.');

    clearSources();

    if (els.screenToggle.checked) {
      const displayOptions = {
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: els.systemAudioToggle.checked
      };
      state.screenStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
      await waitForVideo(els.screenVideo, state.screenStream);
      const [screenTrack] = state.screenStream.getVideoTracks();
      if (screenTrack) screenTrack.addEventListener('ended', handleSourceEnded, { once: true });
    }

    if (els.cameraToggle.checked) {
      state.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      await waitForVideo(els.cameraVideo, state.cameraStream);
      els.cameraPreview.srcObject = state.cameraStream;
      await els.cameraPreview.play().catch(() => {});
      els.cameraBubble.hidden = false;
    } else {
      els.cameraBubble.hidden = true;
    }

    if (els.micToggle.checked) {
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }

    els.emptyPreview.hidden = true;
    els.previewHint.textContent = 'Sources are live. Check the frame and start when ready.';
    drawComposite();
  }

  function createAudioMix() {
    const hasScreenAudio = state.screenStream?.getAudioTracks().length > 0;
    const hasMic = state.micStream?.getAudioTracks().length > 0;
    if (!hasScreenAudio && !hasMic) return [];
    state.audioContext = new AudioContext();
    state.audioDestination = state.audioContext.createMediaStreamDestination();
    state.audioContext.resume().catch(() => {});
    if (hasScreenAudio) {
      state.audioContext.createMediaStreamSource(new MediaStream(state.screenStream.getAudioTracks())).connect(state.audioDestination);
    }
    if (hasMic) {
      state.audioContext.createMediaStreamSource(new MediaStream(state.micStream.getAudioTracks())).connect(state.audioDestination);
    }
    return state.audioDestination.stream.getAudioTracks();
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getDisplayMedia && els.screenToggle.checked) {
      throw new Error('This browser does not support screen capture.');
    }
    if (!window.MediaRecorder) throw new Error('This browser does not support MediaRecorder.');

    await prepareSources();
    const countdown = Number(els.countdownSelect.value);
    if (countdown > 0) await runCountdown(countdown);

    const audioTracks = createAudioMix();
    state.canvasStream = els.canvas.captureStream(30);
    state.combinedStream = new MediaStream([
      ...state.canvasStream.getVideoTracks(),
      ...audioTracks
    ]);

    const mimeType = pickMimeType();
    state.chunks = [];
    state.recorder = new MediaRecorder(state.combinedStream, mimeType ? { mimeType } : undefined);
    state.recorder.ondataavailable = (event) => { if (event.data?.size) state.chunks.push(event.data); };
    state.recorder.onerror = (event) => toast(`Recorder error: ${event.error?.message || 'unknown error'}`);
    state.recorder.onstop = finishRecording;
    state.recorder.start(1000);

    state.isRecording = true;
    state.isPaused = false;
    state.startedAt = performance.now();
    els.timer.hidden = false;
    els.timer.textContent = '00:00';
    els.startBtn.disabled = true;
    els.pauseBtn.disabled = false;
    els.stopBtn.disabled = false;
    setState('recording', 'Recording');
    els.previewHint.textContent = 'Recording locally. Your camera overlay is being composited into the video.';
    updateTimer();
  }

  async function runCountdown(seconds) {
    els.countdown.hidden = false;
    for (let i = seconds; i > 0; i -= 1) {
      els.countdown.textContent = i;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    els.countdown.hidden = true;
  }

  function updateTimer() {
    clearTimeout(state.timerId);
    if (!state.isRecording) return;
    if (!state.isPaused) {
      els.timer.textContent = formatTime(performance.now() - state.startedAt);
    }
    state.timerId = setTimeout(updateTimer, 250);
  }

  function togglePause() {
    if (!state.recorder || !state.isRecording) return;
    if (state.recorder.state === 'recording') {
      state.recorder.pause();
      state.isPaused = true;
      setState('paused', 'Paused');
      els.pauseBtn.textContent = 'Resume';
      els.previewHint.textContent = 'Recording paused.';
    } else if (state.recorder.state === 'paused') {
      state.recorder.resume();
      state.isPaused = false;
      setState('recording', 'Recording');
      els.pauseBtn.textContent = 'Pause';
      els.previewHint.textContent = 'Recording locally.';
      updateTimer();
    }
  }

  function stopRecording() {
    if (!state.recorder || !state.isRecording) return;
    state.recorder.stop();
    state.isRecording = false;
    state.isPaused = false;
    clearTimeout(state.timerId);
    setState('', 'Finishing');
    els.startBtn.disabled = true;
    els.pauseBtn.disabled = true;
    els.stopBtn.disabled = true;
  }

  function finishRecording() {
    const blob = new Blob(state.chunks, { type: state.recorder?.mimeType || 'video/webm' });
    if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
    state.recordingUrl = URL.createObjectURL(blob);
    els.recordingPreview.src = state.recordingUrl;
    els.downloadBtn.href = state.recordingUrl;
    els.downloadBtn.download = `screenora-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
    els.recordingSize.textContent = humanBytes(blob.size);
    els.recordingMessage.textContent = `Saved in memory for this page session as ${blob.type}. Download it before closing the tab.`;
    els.recordingsPanel.hidden = false;
    setState('', 'Ready');
    els.startBtn.disabled = false;
    els.previewHint.textContent = 'Recording finished. Preview and download it below.';
    toast('Recording ready.');
    stopAllAfterRecording();
  }

  function stopAllAfterRecording() {
    stopStream(state.combinedStream);
    stopStream(state.canvasStream);
    clearSources();
    if (state.audioContext) state.audioContext.close().catch(() => {});
    state.combinedStream = null;
    state.canvasStream = null;
    state.audioContext = null;
    state.audioDestination = null;
    els.timer.hidden = true;
    els.cameraBubble.hidden = true;
  }

  function handleSourceEnded() {
    if (state.isRecording) stopRecording();
    toast('Screen sharing ended.');
  }

  function updateCameraUI() {
    els.cameraSizeOut.value = `${els.cameraSize.value}%`;
    els.cameraBubble.style.width = `${els.cameraSize.value}%`;
    els.cameraBubble.style.top = 'auto';
    els.cameraBubble.style.bottom = '16px';
    els.cameraBubble.style.left = 'auto';
    els.cameraBubble.style.right = '16px';
    const pos = els.cameraPosition.value;
    if (pos.includes('left')) { els.cameraBubble.style.left = '16px'; els.cameraBubble.style.right = 'auto'; }
    if (pos.includes('top')) { els.cameraBubble.style.top = '16px'; els.cameraBubble.style.bottom = 'auto'; }
  }

  function browserSupport() {
    const screenOk = !!navigator.mediaDevices?.getDisplayMedia;
    const cameraOk = !!navigator.mediaDevices?.getUserMedia;
    const recorderOk = !!window.MediaRecorder;
    if (screenOk && cameraOk && recorderOk) {
      els.supportBadge.textContent = 'Recorder supported';
    } else {
      els.supportBadge.textContent = 'Browser support limited';
    }
    const mime = pickMimeType();
    els.formatLabel.textContent = mime ? 'WebM' : 'Browser default';
  }

  els.startBtn.addEventListener('click', async () => {
    try {
      await startRecording();
    } catch (error) {
      stopAllAfterRecording();
      setState('', 'Ready');
      els.startBtn.disabled = false;
      els.pauseBtn.disabled = true;
      els.stopBtn.disabled = true;
      if (error?.name === 'NotAllowedError') toast('Permission was cancelled.');
      else toast(error?.message || 'Could not start recording.');
    }
  });

  els.pauseBtn.addEventListener('click', togglePause);
  els.stopBtn.addEventListener('click', stopRecording);
  els.cameraSize.addEventListener('input', updateCameraUI);
  els.cameraPosition.addEventListener('change', updateCameraUI);
  els.cameraToggle.addEventListener('change', () => {
    if (!els.cameraToggle.checked) { els.cameraBubble.hidden = true; }
    else if (state.cameraStream) els.cameraBubble.hidden = false;
  });
  els.newRecordingBtn.addEventListener('click', () => {
    els.recordingsPanel.hidden = true;
    els.recordingPreview.removeAttribute('src');
    if (state.recordingUrl) { URL.revokeObjectURL(state.recordingUrl); state.recordingUrl = null; }
    els.recordingMessage.textContent = '';
    els.startBtn.focus();
  });
  els.settingsBtn.addEventListener('click', () => els.settingsDialog.showModal());
  window.addEventListener('beforeunload', () => {
    stopAllAfterRecording();
    if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
  });

  updateCameraUI();
  browserSupport();
})();
