// lookoutlogs.com: the night sky, the welcome player, the route map, and the updates sign-up.
(function () {
  'use strict';

  var CFG = window.LOOKOUT || { stops: [], aired: 0 };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- the sky
  // The range seen from the west: north on the left, south on the right.
  // Ten cones in route order. St. Helens is drawn without its top, and Crater Lake is only a rim.
  var PEAKS = [
    { h: 0.15, w: 0.11 },                        // Baker
    { h: 0.10, w: 0.08 },                        // Glacier Peak
    { h: 0.22, w: 0.17 },                        // Rainier
    { h: 0.13, w: 0.10, cut: 0.66 },             // St. Helens
    { h: 0.16, w: 0.12 },                        // Adams
    { h: 0.16, w: 0.08, sharp: true },           // Hood
    { h: 0.12, w: 0.07, sharp: true },           // Jefferson
    { h: 0.085, w: 0.06, triple: true },         // Three Sisters
    { h: 0.08, w: 0.07 },                        // Bachelor
    { h: 0.075, w: 0.09, cut: 0.5, caldera: true } // Crater Lake
  ];

  function initSky(el) {
    var canvas = el.querySelector('canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var W, H, DPR, S, stars, land, bg, summits, tower, running = false, visible = true, t0 = performance.now();

    function peakX(i, w) { return w * (0.06 + i * 0.098); }

    function cone(dx, p, w) {
      var span = p.w * w;
      var k = Math.abs(dx) / span;
      if (k >= 1) return 0;
      var y = Math.pow(1 - k, p.sharp ? 2.4 : 2) * p.h;
      if (p.cut) {
        var cap = p.h * p.cut;
        if (y > cap) y = cap - (p.caldera ? (y - cap) * 0.35 : (y - cap) * 0.12);
      }
      return y;
    }

    function farProfile(x, w, rnd) {
      var nx = x / w;
      var base = 0.03 * Math.sin(nx * 23 + rnd[0]) + 0.018 * Math.sin(nx * 57 + rnd[1]) + 0.01 * Math.sin(nx * 131 + rnd[2]);
      var top = 0;
      for (var i = 0; i < PEAKS.length; i++) {
        var p = PEAKS[i], cx = peakX(i, w), y;
        if (p.triple) {
          y = Math.max(cone(x - cx + 0.022 * w, p, w), cone(x - cx, { h: p.h * 1.08, w: p.w }, w), cone(x - cx - 0.022 * w, { h: p.h * 0.9, w: p.w }, w));
        } else {
          y = cone(x - cx, p, w);
        }
        if (y > top) top = y;
      }
      // Heights follow the shorter side so phones don't get needles and wide screens don't get walls.
      var hs = Math.min(H, w * 0.75);
      return H * 0.87 - (0.03 + base * 0.6) * hs - top * hs;
    }

    function build() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = el.clientWidth; H = el.clientHeight;
      if (!W || !H) { bg = null; return; }
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      S = Math.max(0.6, Math.min(1.4, H / 820));
      var rnd = seeded(1974);
      var ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];

      // Sky gradient, drawn once.
      bg = document.createElement('canvas'); bg.width = canvas.width; bg.height = canvas.height;
      var b = bg.getContext('2d'); b.scale(DPR, DPR);
      var g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#04070d'); g.addColorStop(0.45, '#0a1220'); g.addColorStop(0.78, '#18253a'); g.addColorStop(1, '#1f2c40');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      var haze = b.createRadialGradient(W * 0.72, H * 0.8, 0, W * 0.72, H * 0.8, W * 0.6);
      haze.addColorStop(0, 'rgba(120,140,170,0.16)'); haze.addColorStop(1, 'rgba(120,140,170,0)');
      b.fillStyle = haze; b.fillRect(0, 0, W, H);

      // Stars.
      var count = Math.min(520, Math.round(W * H / 2600));
      stars = [];
      for (var i = 0; i < count; i++) {
        var y = Math.pow(rnd(), 1.5) * H * 0.78;
        stars.push({ x: rnd() * W, y: y, r: rnd() < 0.06 ? 1.6 : (rnd() < 0.3 ? 1.1 : 0.7), a: 0.25 + rnd() * 0.7, s: 0.4 + rnd() * 1.6, p: rnd() * 6.28 });
      }

      // Land, drawn once into its own layer.
      land = document.createElement('canvas'); land.width = canvas.width; land.height = canvas.height;
      var l = land.getContext('2d'); l.scale(DPR, DPR);
      var step = 3, x;

      // Far range: the volcanoes, lit faintly from above like snow at night.
      var farTop = H;
      l.beginPath(); l.moveTo(0, H);
      for (x = 0; x <= W + step; x += step) {
        var fy = farProfile(x, W, ph);
        if (fy < farTop) farTop = fy;
        l.lineTo(x, fy);
      }
      l.lineTo(W, H); l.closePath();
      var fg = l.createLinearGradient(0, farTop, 0, H * 0.88);
      fg.addColorStop(0, '#53627a'); fg.addColorStop(0.18, '#2e3b51'); fg.addColorStop(0.5, '#1b2638'); fg.addColorStop(1, '#141d2c');
      l.fillStyle = fg; l.fill();

      summits = PEAKS.map(function (p, i) {
        var cx = peakX(i, W), best = H, bx = cx;
        for (var dx = -p.w * W * 0.5; dx <= p.w * W * 0.5; dx += 2) {
          var yy = farProfile(cx + dx, W, ph);
          if (yy < best) { best = yy; bx = cx + dx; }
        }
        if (p.caldera) { bx = cx; best = farProfile(cx, W, ph); }
        return { x: bx, y: best };
      });

      // Middle foothills.
      l.beginPath(); l.moveTo(0, H);
      for (x = 0; x <= W + step; x += step) {
        var nx = x / W;
        var my = 0.905 - 0.03 * Math.sin(nx * 9 + ph[3]) - 0.02 * Math.sin(nx * 27 + ph[4]) - 0.008 * Math.sin(nx * 80 + ph[5]);
        l.lineTo(x, my * H);
      }
      l.lineTo(W, H); l.closePath();
      l.fillStyle = '#0e1522'; l.fill();

      // Near ridge with firs, and a lookout on the knoll.
      var towerX = W * (W < 640 ? 0.2 : 0.14);
      function nearY(px) {
        var nx = px / W;
        var knoll = 0.05 * Math.exp(-Math.pow((px - towerX) / (W * 0.07), 2));
        return (0.955 - 0.02 * Math.sin(nx * 7 + ph[1]) - 0.012 * Math.sin(nx * 31 + ph[2]) - knoll) * H;
      }
      l.beginPath(); l.moveTo(0, H);
      for (x = 0; x <= W + step; x += step) l.lineTo(x, nearY(x));
      l.lineTo(W, H); l.closePath();
      l.fillStyle = '#05080e'; l.fill();

      l.fillStyle = '#05080e';
      for (x = -4; x < W + 10; x += (5 + rnd() * 9) * S) {
        if (Math.abs(x - towerX) < 26 * S) continue;
        var th = (10 + rnd() * 22) * S * (rnd() < 0.15 ? 1.6 : 1);
        var tw = th * (0.22 + rnd() * 0.08);
        var ty = nearY(x) + 2;
        l.beginPath(); l.moveTo(x - tw, ty);
        for (var k = 0; k < 4; k++) {
          var f = k / 4;
          l.lineTo(x - tw * (1 - f) * 0.9, ty - th * f - th * 0.06);
          l.lineTo(x - tw * (1 - f) * 0.45, ty - th * f - th * 0.12);
        }
        l.lineTo(x, ty - th);
        for (k = 3; k >= 0; k--) {
          f = k / 4;
          l.lineTo(x + tw * (1 - f) * 0.45, ty - th * f - th * 0.12);
          l.lineTo(x + tw * (1 - f) * 0.9, ty - th * f - th * 0.06);
        }
        l.lineTo(x + tw, ty); l.closePath(); l.fill();
      }

      // The lookout: a cab on a short tower.
      var gy = nearY(towerX) + 1, u = S;
      l.strokeStyle = '#05080e'; l.lineWidth = 1.6 * u;
      l.beginPath();
      l.moveTo(towerX - 10 * u, gy); l.lineTo(towerX - 6 * u, gy - 30 * u);
      l.moveTo(towerX + 10 * u, gy); l.lineTo(towerX + 6 * u, gy - 30 * u);
      l.moveTo(towerX - 9 * u, gy - 6 * u); l.lineTo(towerX + 7 * u, gy - 20 * u);
      l.moveTo(towerX + 9 * u, gy - 6 * u); l.lineTo(towerX - 7 * u, gy - 20 * u);
      l.stroke();
      l.fillRect(towerX - 13 * u, gy - 32 * u, 26 * u, 2.5 * u);        // catwalk
      l.fillRect(towerX - 10 * u, gy - 46 * u, 20 * u, 14 * u);         // cab
      l.beginPath(); l.moveTo(towerX - 13 * u, gy - 46 * u); l.lineTo(towerX, gy - 53 * u); l.lineTo(towerX + 13 * u, gy - 46 * u); l.closePath(); l.fill();
      tower = { x: towerX - 8 * u, y: gy - 43.5 * u, w: 16 * u, h: 6 * u };
    }

    function lightAt(t) {
      // One light visits each summit in turn, pauses, and moves on. Then a long dark gap.
      var hop = 4.2, rest = 1.8, per = hop + rest, n = summits.length;
      var cycle = per * (n - 1) + 9;
      var tt = ((t % cycle) + cycle) % cycle;
      var i = Math.floor(tt / per), into = tt - i * per;
      if (i >= n - 1) {
        var end = summits[n - 1], sink = Math.min(1, (tt - per * (n - 1)) / 3.5);
        return { x: end.x, y: end.y - 9 * S + sink * 22 * S, a: 1 - sink, i: n - 1 };
      }
      var a = summits[i], b = summits[i + 1];
      var fade = i === 0 ? Math.min(1, tt / 2) : 1;
      if (into < rest) return { x: a.x, y: a.y - 9 * S, a: fade, i: i, resting: true };
      var k = (into - rest) / hop; k = k * k * (3 - 2 * k);
      var lift = Math.min(a.y, b.y) - 44 * S;
      var x = (1 - k) * (1 - k) * a.x + 2 * k * (1 - k) * ((a.x + b.x) / 2) + k * k * b.x;
      var y = (1 - k) * (1 - k) * (a.y - 9 * S) + 2 * k * (1 - k) * lift + k * k * (b.y - 9 * S);
      return { x: x, y: y, a: fade, i: i };
    }

    function glow(x, y, r, a) {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,240,214,' + a + ')');
      g.addColorStop(0.12, 'rgba(255,214,150,' + a * 0.85 + ')');
      g.addColorStop(0.4, 'rgba(242,170,90,' + a * 0.22 + ')');
      g.addColorStop(1, 'rgba(242,170,90,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }

    function frame(now) {
      if (!bg) { running = false; return; }
      var t = (now - t0) / 1000;
      if (reduceMotion) t = 4.2 * 4 + 1.8 * 4 + 0.5;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(t * s.s + s.p);
        ctx.fillStyle = 'rgba(225,232,245,' + (s.a * tw).toFixed(3) + ')';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }

      // Three lights, the second and third a little behind and fainter.
      var trail = [0, 0.7, 1.5];
      for (var j = trail.length - 1; j >= 0; j--) {
        var L = lightAt(t - trail[j]);
        if (L.a <= 0.01) continue;
        var pulse = reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(t * 2.3 + j);
        var size = (j === 0 ? 30 : 18 - j * 3) * S * (L.resting ? 1.15 : 1);
        glow(L.x, L.y, size, L.a * pulse * (j === 0 ? 1 : 0.5 - j * 0.1));
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(land, 0, 0);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      // The lookout window, someone still awake.
      var flick = reduceMotion ? 0.9 : 0.82 + 0.08 * Math.sin(t * 1.7) + 0.04 * Math.sin(t * 7.3);
      ctx.shadowColor = 'rgba(255,190,110,0.9)'; ctx.shadowBlur = 10 * S;
      ctx.fillStyle = 'rgba(255,200,125,' + flick.toFixed(3) + ')';
      ctx.fillRect(tower.x, tower.y, tower.w, tower.h);
      ctx.shadowBlur = 0;

      if (running && !reduceMotion) requestAnimationFrame(frame);
    }

    function start() {
      if (running || !visible) return;
      running = true; requestAnimationFrame(frame);
    }
    function stop() { running = false; }

    build(); frame(performance.now());
    if (!reduceMotion) start();

    var rt, lastW = W, lastH = H;
    function rebuild() {
      if (el.clientWidth === lastW && Math.abs(el.clientHeight - lastH) < 2) return;
      lastW = el.clientWidth; lastH = el.clientHeight;
      clearTimeout(rt);
      rt = setTimeout(function () { build(); frame(performance.now()); if (!reduceMotion) start(); }, 120);
    }
    if ('ResizeObserver' in window) new ResizeObserver(rebuild).observe(el);
    else window.addEventListener('resize', rebuild);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !reduceMotion) start(); else stop();
      }).observe(el);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else if (visible && !reduceMotion) start();
    });
  }

  // ---------------------------------------------------------------- welcome player
  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function initPlayer(el) {
    var audio = new Audio();
    audio.preload = 'metadata';
    var btn = el.querySelector('.player__btn');
    var bars = el.querySelector('.player__bars');
    var time = el.querySelector('.player__time');
    var status = el.querySelector('.player__status');
    var rnd = seeded(70), n = 72, i;
    for (i = 0; i < n; i++) {
      var b = document.createElement('span');
      var env = Math.sin(Math.PI * (i + 0.5) / n) * 0.55 + 0.45;
      b.style.height = Math.round((0.18 + rnd() * 0.82) * env * 100) + '%';
      bars.appendChild(b);
    }
    var spans = bars.children;

    function paint() {
      var k = audio.duration ? audio.currentTime / audio.duration : 0;
      var lit = Math.round(k * n);
      for (var j = 0; j < n; j++) spans[j].classList.toggle('on', j < lit);
      time.textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration || Number(el.dataset.length || 70));
    }

    function unavailable() {
      el.classList.add('is-missing');
      btn.disabled = true;
      status.textContent = 'The recording is still being made. The transcript is below.';
    }

    audio.addEventListener('error', unavailable);
    audio.addEventListener('loadedmetadata', paint);
    audio.addEventListener('timeupdate', paint);
    audio.addEventListener('play', function () { el.classList.add('is-playing'); btn.setAttribute('aria-label', 'Pause the welcome recording'); });
    audio.addEventListener('pause', function () { el.classList.remove('is-playing'); btn.setAttribute('aria-label', 'Play the welcome recording'); });
    audio.addEventListener('ended', function () { audio.currentTime = 0; paint(); });
    audio.src = el.dataset.src;

    btn.addEventListener('click', function () {
      if (audio.paused) audio.play().catch(unavailable); else audio.pause();
    });
    bars.addEventListener('click', function (e) {
      if (!audio.duration) return;
      var r = bars.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    });
    paint();
  }

  // ---------------------------------------------------------------- route map
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function project(lat, lon) {
    // Plain lat and long, with east and west stretched so the range reads as a line of stops.
    return { x: 70 + (lon + 122.5) * 190, y: 40 + (49.0 - lat) * 150 };
  }

  function initRoute(el) {
    var stops = CFG.stops || [], aired = CFG.aired || 0;
    var map = svg('svg', { viewBox: '0 0 460 1000', role: 'img', 'aria-labelledby': 'route-map-title' });
    svg('title', { id: 'route-map-title' }, map).textContent = 'Map of the ten stops from Mount Baker south to Crater Lake. ' + (aired ? aired + ' of 10 visited so far.' : 'None visited yet.');

    // Contour rings around each mountain, uneven like a hand-traced topo sheet.
    var rnd = seeded(1955), topo = svg('g', { class: 'route__topo' }, map);
    stops.forEach(function (s) {
      var c = project(s.lat, s.lon);
      for (var r = 7; r < 46; r += 6.5) {
        var pts = [], m = 28, wob = [rnd() * 6, rnd() * 6, rnd() * 6];
        for (var i = 0; i <= m; i++) {
          var a = (i / m) * Math.PI * 2;
          var rr = r * (1 + 0.16 * Math.sin(a * 2 + wob[0]) + 0.1 * Math.sin(a * 3 + wob[1]) + 0.05 * Math.sin(a * 5 + wob[2]));
          pts.push((c.x + Math.cos(a) * rr * 1.1).toFixed(1) + ',' + (c.y + Math.sin(a) * rr * 0.9).toFixed(1));
        }
        svg('polyline', { points: pts.join(' ') }, topo);
      }
    });

    // The Columbia, for orientation.
    var river = [[-122.8, 45.62], [-122.4, 45.58], [-122.1, 45.55], [-121.9, 45.66], [-121.55, 45.72], [-121.2, 45.62], [-120.9, 45.67], [-120.5, 45.72]]
      .map(function (p) { var q = project(p[1], p[0]); return q.x.toFixed(1) + ',' + q.y.toFixed(1); });
    svg('polyline', { class: 'route__river', points: river.join(' ') }, map);
    svg('text', { class: 'route__region', x: 300, y: 566 }, map).textContent = 'Columbia River';
    svg('text', { class: 'route__state', x: 450, y: 520, 'text-anchor': 'end' }, map).textContent = 'WASHINGTON';
    svg('text', { class: 'route__state', x: 450, y: 592, 'text-anchor': 'end' }, map).textContent = 'OREGON';

    // North arrow.
    var na = svg('g', { class: 'route__north', transform: 'translate(410 70)' }, map);
    svg('circle', { r: 18 }, na);
    svg('path', { d: 'M0 -14 L5 4 L0 0 L-5 4 Z' }, na);
    svg('text', { y: -24, 'text-anchor': 'middle' }, na).textContent = 'N';

    // The route itself, north to south.
    var pts = stops.map(function (s) { return project(s.lat, s.lon); });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ');
    svg('path', { class: 'route__line', d: d }, map);
    if (aired > 1) {
      svg('path', { class: 'route__line route__line--lit', d: pts.slice(0, aired).map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join(' ') }, map);
    }

    var leftLabels = { 4: true, 10: true };
    var list = el.querySelector('.route__list');
    stops.forEach(function (s, i) {
      var p = pts[i], lit = s.n <= aired;
      var g = svg(lit && s.log ? 'a' : 'g', { class: 'route__stop' + (lit ? ' is-lit' : ''), 'data-n': s.n }, map);
      if (lit && s.log) g.setAttribute('href', s.log);
      svg('circle', { class: 'route__halo', cx: p.x, cy: p.y, r: 13 }, g);
      svg('circle', { class: 'route__dot', cx: p.x, cy: p.y, r: 5.5 }, g);
      var left = leftLabels[s.n];
      var tx = svg('text', { x: p.x + (left ? -14 : 14), y: p.y + 4.5, 'text-anchor': left ? 'end' : 'start' }, g);
      tx.textContent = s.name;

      if (list) {
        var li = document.createElement('li');
        li.className = lit ? 'is-lit' : '';
        li.dataset.n = s.n;
        var label = '<span class="route__num">' + ('0' + s.n).slice(-2) + '</span><span class="route__name">' + s.name + '</span>';
        var state = lit ? 'Read the log' : (s.date && s.n === aired + 1 ? s.date : 'Not yet');
        li.innerHTML = lit && s.log
          ? '<a href="' + s.log + '">' + label + '<span class="route__state-tag">' + state + '</span></a>'
          : '<div>' + label + '<span class="route__state-tag">' + state + '</span></div>';
        li.addEventListener('mouseenter', function () { g.classList.add('is-hover'); });
        li.addEventListener('mouseleave', function () { g.classList.remove('is-hover'); });
        list.appendChild(li);
      }
    });

    el.querySelector('.route__map').appendChild(map);
  }

  // ---------------------------------------------------------------- logs index
  function initLogIndex(el) {
    var aired = CFG.aired || 0;
    (CFG.stops || []).forEach(function (s) {
      var li = document.createElement('li');
      var lit = s.n <= aired && s.log;
      li.className = lit ? 'is-lit' : '';
      var inner = '<span class="ledger__num">' + ('0' + s.n).slice(-2) + '</span>' +
        '<span class="ledger__place">' + s.name + '</span>' +
        '<span class="ledger__state">' + (lit ? 'Read the entry' : (s.date && s.n === aired + 1 ? 'Posts ' + s.date : 'Not yet')) + '</span>';
      li.innerHTML = lit ? '<a href="' + s.log + '">' + inner + '</a>' : '<div>' + inner + '</div>';
      el.appendChild(li);
    });
  }

  // ---------------------------------------------------------------- listen links
  function initListen(el) {
    if (!CFG.trailerLive) return;
    el.classList.add('is-live');
    el.querySelectorAll('[data-listen]').forEach(function (a) {
      var url = (CFG.listen || {})[a.dataset.listen];
      if (url) { a.href = url; a.removeAttribute('aria-disabled'); a.classList.remove('is-off'); }
    });
  }

  // ---------------------------------------------------------------- updates list
  window.sendToLine = function (payload) {
    if (!CFG.endpoint) return Promise.reject(new Error('not-connected'));
    return fetch(CFG.endpoint, { method: 'POST', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || 'failed'); return j; });
  };

  function initFollow(form) {
    var msg = form.querySelector('.follow__msg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.email.value.trim();
      if (!form.email.checkValidity()) { msg.textContent = 'That address doesn’t look quite right.'; return; }
      var btn = form.querySelector('button');
      btn.disabled = true; msg.textContent = 'Sending…';
      window.sendToLine({ action: 'subscribe', email: email, source: form.dataset.source || 'site', website: form.website ? form.website.value : '' })
        .then(function () {
          form.classList.add('is-done');
          msg.textContent = 'Thanks. I’ll write when there’s a new log.';
        })
        .catch(function (err) {
          btn.disabled = false;
          msg.textContent = err.message === 'not-connected'
            ? 'Sign-ups aren’t open quite yet. Check back soon.'
            : 'Something went wrong on my end. Could you try again in a minute?';
        });
    });
  }

  // ---------------------------------------------------------------- go
  document.querySelectorAll('[data-sky]').forEach(initSky);
  document.querySelectorAll('[data-player]').forEach(initPlayer);
  document.querySelectorAll('[data-route]').forEach(initRoute);
  document.querySelectorAll('[data-log-index]').forEach(initLogIndex);
  document.querySelectorAll('[data-listen-block]').forEach(initListen);
  document.querySelectorAll('form[data-follow]').forEach(initFollow);
  var y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
