// The Line: email, consent, record up to three minutes in the browser, listen back, send.
(function () {
  'use strict';

  var root = document.querySelector('[data-line]');
  if (!root) return;

  var MAX_SECONDS = 180;
  var MAX_BYTES = 14 * 1024 * 1024;

  var stepEmail = root.querySelector('[data-step="email"]');
  var stepConsent = root.querySelector('[data-step="consent"]');
  var stepRecord = root.querySelector('[data-step="record"]');
  var stepThanks = root.querySelector('[data-step="thanks"]');
  var recorderEl = root.querySelector('.recorder');
  var recBtn = root.querySelector('[data-rec]');
  var hint = root.querySelector('[data-hint]');
  var elapsedEl = root.querySelector('[data-elapsed]');
  var review = root.querySelector('[data-review]');
  var playback = root.querySelector('[data-playback]');
  var redoBtn = root.querySelector('[data-redo]');
  var sendBtn = root.querySelector('[data-send]');
  var msg = root.querySelector('[data-line-msg]');
  var emailMsg = root.querySelector('[data-email-msg]');
  var canvas = root.querySelector('.recorder__screen canvas');
  var ctx = canvas.getContext('2d');
  var over18 = stepConsent.querySelector('[name="over18"]');
  var agree = stepConsent.querySelector('[name="agree"]');
  var updates = stepConsent.querySelector('[name="updates"]');

  var email = '', stream = null, recorder = null, chunks = [], blob = null, mime = '';
  var startedAt = 0, seconds = 0, tick = null, audioCtx = null, analyser = null, raf = null, peaks = null;

  var canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  function pickMime() {
    var options = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (var i = 0; i < options.length; i++) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(options[i])) return options[i];
    }
    return '';
  }

  function fmt(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // ------------------------------------------------ the screen
  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGrid(w, h) {
    ctx.fillStyle = '#0b1017'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,150,190,0.08)'; ctx.lineWidth = 1;
    for (var x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    for (var y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
  }

  function drawIdle() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    drawGrid(w, h);
    if (peaks) return drawPeaks(w, h);
    ctx.strokeStyle = 'rgba(160,185,212,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  }

  function drawLive() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    drawGrid(w, h);
    ctx.strokeStyle = '#a0b9d4'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < data.length; i++) {
      var x = (i / (data.length - 1)) * w;
      var y = h / 2 + ((data[i] - 128) / 128) * (h * 0.45);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // How much of the three minutes is used.
    ctx.fillStyle = 'rgba(160,185,212,0.25)';
    ctx.fillRect(0, h - 4, w * Math.min(1, seconds / MAX_SECONDS), 4);
    raf = requestAnimationFrame(drawLive);
  }

  function drawPeaks(w, h) {
    var n = peaks.length, bw = w / n;
    ctx.fillStyle = 'rgba(160,185,212,0.8)';
    for (var i = 0; i < n; i++) {
      var ph = Math.max(1.5, peaks[i] * h * 0.85);
      ctx.fillRect(i * bw + 0.5, (h - ph) / 2, Math.max(1, bw - 1), ph);
    }
  }

  function computePeaks(b) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ac = new AC();
    b.arrayBuffer().then(function (buf) {
      return new Promise(function (res, rej) { ac.decodeAudioData(buf, res, rej); });
    }).then(function (audio) {
      var data = audio.getChannelData(0), n = 140, size = Math.floor(data.length / n), out = [], max = 0;
      for (var i = 0; i < n; i++) {
        var m = 0;
        for (var j = i * size; j < (i + 1) * size; j += 16) { var v = Math.abs(data[j]); if (v > m) m = v; }
        out.push(m); if (m > max) max = m;
      }
      peaks = out.map(function (v) { return max ? v / max : 0; });
      drawIdle();
      ac.close && ac.close();
    }).catch(function () { /* the playback bar still works without the picture */ });
  }

  // ------------------------------------------------ steps
  stepEmail.addEventListener('submit', function (e) {
    e.preventDefault();
    var input = stepEmail.email;
    if (stepEmail.website.value) return; // honeypot
    if (!input.value.trim() || !input.checkValidity()) {
      emailMsg.textContent = 'That address doesn’t look quite right.';
      input.focus();
      return;
    }
    email = input.value.trim();
    emailMsg.textContent = '';
    stepConsent.hidden = false;
    stepRecord.hidden = false;
    sizeCanvas(); drawIdle();
    if (!canRecord) {
      hint.textContent = 'This browser won’t let the page use a microphone. A current version of Safari, Chrome, or Firefox should work.';
    }
    over18.focus();
  });

  function updateConsent() {
    var ok = over18.checked && agree.checked && canRecord;
    recBtn.disabled = !ok || !!blob;
    if (canRecord && !blob) hint.textContent = ok ? 'Press the red button when you’re ready. Press it again to stop.' : 'Check both boxes above, then press the red button.';
  }
  over18.addEventListener('change', updateConsent);
  agree.addEventListener('change', updateConsent);

  // ------------------------------------------------ recording
  function startRecording() {
    msg.textContent = '';
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (s) {
      stream = s;
      mime = pickMime();
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mime = recorder.mimeType || mime || 'audio/webm';
      chunks = [];
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = finishRecording;

      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        audioCtx = new AC();
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
      }

      recorder.start(1000);
      startedAt = performance.now(); seconds = 0;
      recorderEl.classList.add('is-recording');
      recBtn.setAttribute('aria-label', 'Stop recording');
      hint.textContent = 'Recording. Press the button again when you’re done.';
      tick = setInterval(function () {
        seconds = (performance.now() - startedAt) / 1000;
        elapsedEl.textContent = fmt(seconds);
        if (seconds >= MAX_SECONDS) stopRecording();
      }, 200);
      if (analyser) drawLive();
    }).catch(function () {
      hint.textContent = 'The page couldn’t reach your microphone. If your browser asked for permission, it may have been turned down. You can allow it in the address bar and try again.';
    });
  }

  function stopRecording() {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    clearInterval(tick);
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    if (audioCtx && audioCtx.close) audioCtx.close();
    recorderEl.classList.remove('is-recording');
    recBtn.setAttribute('aria-label', 'Start recording');
  }

  function finishRecording() {
    blob = new Blob(chunks, { type: mime });
    seconds = Math.min(MAX_SECONDS, (performance.now() - startedAt) / 1000);
    elapsedEl.textContent = fmt(seconds);
    playback.src = URL.createObjectURL(blob);
    review.hidden = false;
    recBtn.disabled = true;
    hint.textContent = seconds >= MAX_SECONDS - 0.5 ? 'That’s the three minutes. Have a listen.' : 'Have a listen. Send it, or record it again.';
    peaks = null; drawIdle(); computePeaks(blob);
  }

  recBtn.addEventListener('click', function () {
    if (recorder && recorder.state === 'recording') stopRecording(); else startRecording();
  });

  redoBtn.addEventListener('click', function () {
    if (playback.src) URL.revokeObjectURL(playback.src);
    playback.removeAttribute('src'); playback.load();
    blob = null; peaks = null; review.hidden = true; elapsedEl.textContent = '0:00'; msg.textContent = '';
    drawIdle(); updateConsent();
  });

  // ------------------------------------------------ sending
  function toBase64(b) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej;
      r.readAsDataURL(b);
    });
  }

  sendBtn.addEventListener('click', function () {
    if (!blob) return;
    if (!over18.checked || !agree.checked) { msg.textContent = 'Please check both boxes above first.'; return; }
    if (blob.size > MAX_BYTES) { msg.textContent = 'That recording is too large to send. Could you try a shorter one?'; return; }
    sendBtn.disabled = true; redoBtn.disabled = true;
    msg.textContent = 'Sending…';
    toBase64(blob).then(function (audio) {
      return window.sendToLine({
        action: 'voicemail',
        email: email,
        over18: over18.checked,
        agreed: agree.checked,
        updates: updates.checked,
        seconds: Math.round(seconds),
        mimeType: mime,
        audio: audio,
        page: location.pathname,
        website: stepEmail.website.value
      });
    }).then(function () {
      stepEmail.hidden = true; stepConsent.hidden = true; stepRecord.hidden = true;
      stepThanks.hidden = false; stepThanks.focus();
    }).catch(function (err) {
      sendBtn.disabled = false; redoBtn.disabled = false;
      msg.textContent = err && err.message === 'not-connected'
        ? 'The line isn’t connected yet. Please check back in a few days.'
        : 'Something went wrong on my end and the message didn’t go through. Could you try sending it again?';
    });
  });

  window.addEventListener('resize', function () { if (!stepRecord.hidden) { sizeCanvas(); if (!(recorder && recorder.state === 'recording')) drawIdle(); } });
})();
