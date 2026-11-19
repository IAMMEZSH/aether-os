/* ============================================================
   AETHER OS · 内核层（启动、桌面、状态、窗口、图标、存储）
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, el = document) => (el || document).querySelector(s);
  const $$ = (s, el = document) => [...(el || document).querySelectorAll(s)];

  /* ---------- 图标 ---------- */
  const I = {
    terminal: '<rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M7 9l3 3-3 3M12.5 15H17"/>',
    phone: '<path d="M5 3.5h3.2l1.6 4-2.1 1.6a13 13 0 0 0 5.2 5.2l1.6-2.1 4 1.6V17a2.5 2.5 0 0 1-2.7 2.5C9.2 19.1 4.9 14.8 4.5 8.2A2.5 2.5 0 0 1 5 3.5z"/>',
    message: '<rect x="3" y="4.5" width="18" height="13" rx="3"/><path d="M7.5 17.5V21l4-3.5"/><path d="M8 9.5h8M8 12.5h5"/>',
    wechat: '<path d="M21 11.3c0 3.6-3.4 6.5-7.6 6.5-.9 0-1.8-.1-2.6-.4L7 19.5l.6-3A6.1 6.1 0 0 1 5.8 11.3C5.8 7.7 9.2 4.8 13.4 4.8S21 7.7 21 11.3z"/><path d="M13 14.5c.6 2.6 3 4.5 5.8 4.5.7 0 1.4-.1 2-.3l2 1.3-.5-2.3c.9-1 1.4-2.2 1.4-3.5 0-2.3-1.6-4.3-3.9-5"/><circle cx="10.8" cy="10.2" r=".9" fill="currentColor" stroke="none"/><circle cx="16" cy="10.2" r=".9" fill="currentColor" stroke="none"/>',
    qq: '<circle cx="12" cy="11" r="7.4"/><circle cx="9.4" cy="10" r=".95" fill="currentColor" stroke="none"/><circle cx="14.6" cy="10" r=".95" fill="currentColor" stroke="none"/><path d="M9.2 14.2c1.7 1.3 3.9 1.3 5.6 0"/><path d="M7 17.8c-.6 1.2-.8 2.4-.4 2.7.4.3 1.2-.4 1.8-1.5M17 17.8c.6 1.2.8 2.4.4 2.7-.4.3-1.2-.4-1.8-1.5"/>',
    alipay: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><text x="12" y="16.6" text-anchor="middle" font-size="12" font-weight="700" font-family="Microsoft YaHei,PingFang SC,Noto Sans CJK SC,sans-serif" fill="currentColor" stroke="none">支</text>',
    office: '<path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4"/><path d="M9 12h6M9 15.2h6M9 18h4"/>',
    files: '<path d="M3 6.5h6.2l2 2.2H21v9.8H3z"/><path d="M3 8.7h18"/><path d="M7.2 12.3h4.2M7.2 15h6.2"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    map: '<path d="M9 4 3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
    media: '<circle cx="12" cy="12" r="9"/><path d="M10 8.8l6 3.2-6 3.2z"/>',
    photos: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
    camera: '<path d="M4 7.5h3.2L9 5h6l1.8 2.5H20a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5z"/><circle cx="12" cy="13" r="4"/><circle cx="18.2" cy="10.3" r=".8" fill="currentColor" stroke="none"/>',
    notes: '<path d="M5 3h11l4 4v14H5z"/><path d="M16 3v4h4"/><path d="M8.5 12h7M8.5 15.5h5"/>',
    browser: '<circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"/>',
    wifi: '<path d="M2 8.8C7.6 3.7 16.4 3.7 22 8.8"/><path d="M5.2 12.4c4-3.6 9.6-3.6 13.6 0"/><path d="M8.5 15.9c2.2-2 4.8-2 7 0"/><circle cx="12" cy="19.3" r="1.1" fill="currentColor" stroke="none"/>',
    signal: '<path d="M4 20v-4M9.3 20v-7M14.6 20v-10M20 20V7"/>',
    battery: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M21.5 10.5v3"/><rect x="5" y="9.5" width="9" height="5" rx="1" fill="currentColor" stroke="none"/>',
    gps: '<path d="M12 21.5s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z"/><circle cx="12" cy="10.3" r="2.4"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="M15.8 15.8L21 21"/>',
    send: '<path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5M10 11v6M14 11v6"/>',
    play: '<path d="M8 5.5l11 6.5-11 6.5z"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    prev: '<path d="M18.5 5.5l-9 6.5 9 6.5zM5.5 5v14"/>',
    next: '<path d="M5.5 5.5l9 6.5-9 6.5zM18.5 5v14"/>',
    volume: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9.3a4 4 0 0 1 0 5.4M18 7a7 7 0 0 1 0 10"/>',
    download: '<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M4.5 20h15"/>',
    external: '<path d="M14 4h6v6M20 4l-8 8"/><path d="M18.5 13.5V20H4V5.5h6.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3H5.5A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>',
    check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    left: '<path d="M15 4l-8 8 8 8"/>',
    right: '<path d="M9 4l8 8-8 8"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5"/>',
    shield: '<path d="M12 2.8l7.5 3v6.7c0 4.6-3.2 7.7-7.5 8.7-4.3-1-7.5-4.1-7.5-8.7V5.8z"/><path d="M8.7 12l2.3 2.3 4.3-4.6"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2.5"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    edit: '<path d="M4 20h4.5L20 8.5 15.5 4 4 15.5z"/><path d="M13 6.5l4.5 4.5"/>',
    install: '<path d="M12 3v11M7.5 9.5L12 14l4.5-4.5"/><path d="M4 15v4.5h16V15"/>',
    music: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    video: '<rect x="3" y="5.5" width="13" height="13" rx="2.5"/><path d="M16 10l5-3v10l-5-3z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    location: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    home: '<path d="M3.5 11L12 3.5 20.5 11"/><path d="M6 9.5V20h12V9.5"/>'
  };

  const Aether = {
    version: '1.1.0',
    build: '2026.11.19',
    apps: new Map(),
    store: {
      get(k, fb) {
        try { const v = localStorage.getItem('aether.' + k); return v === null ? fb : JSON.parse(v); }
        catch (e) { return fb; }
      },
      set(k, v) { try { localStorage.setItem('aether.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
      del(k) { try { localStorage.removeItem('aether.' + k); } catch (e) {} },
      usage() {
        let bytes = 0;
        try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('aether.')) bytes += (localStorage.getItem(k) || '').length * 2; } } catch (e) {}
        return bytes;
      }
    },
    registerApp(def) { this.apps.set(def.id, def); },
    icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${I[name] || I.settings}</svg>`; },
    toast(msg, type = '') {
      const box = $('#toasts'); if (!box) return;
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.textContent = msg;
      box.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2600);
      while (box.children.length > 3) box.firstElementChild.remove();
    },
    fmtBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
      return (n / 1048576).toFixed(1) + ' MB';
    },
    download(filename, content, mime = 'text/plain') {
      const blob = new Blob([content], { type: mime + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
    async copyText(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (e) {
        try {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
          return true;
        } catch (e2) { return false; }
      }
    },
    isStandalone() {
      return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    },
    install() {
      if (Aether._installEvt) {
        Aether._installEvt.prompt();
        Aether._installEvt.userChoice.then(r => {
          if (r.outcome === 'accepted') Aether.toast('正在安装 AETHER OS…', 'ok');
          Aether._installEvt = null;
        });
      } else if (Aether.isStandalone()) {
        Aether.toast('已是独立应用模式', 'ok');
      } else {
        Aether.toast('Android 用 Chrome 菜单「安装应用」；iPhone 用 Safari 分享→「添加到主屏幕」');
      }
    },
    setGPS(lat, lng) {
      const hud = $('#hudgps');
      if (hud) {
        hud.textContent = lat.toFixed(4) + ', ' + lng.toFixed(4);
        const sub = hud.parentElement && hud.parentElement.querySelector('em');
        if (sub) sub.textContent = 'REAL GEOLOCATION';
      }
    }
  };
  window.Aether = Aether;

  /* ---------- 双平台更新检查 ---------- */
  const updateSources = {
    github: {
      name: 'GitHub',
      manifest: 'https://raw.githubusercontent.com/IAMMEZSH/aether-os/main/version.json',
      release: 'https://github.com/IAMMEZSH/aether-os/releases/latest'
    },
    gitcode: {
      name: 'GitCode',
      api: true,
      manifest: 'https://api.gitcode.com/api/v5/repos/gcw_So3EkhfR/aether-os/contents/version.json?ref=main',
      release: 'https://gitcode.com/gcw_So3EkhfR/aether-os/releases'
    }
  };
  const updateState = {
    checking: false,
    lastCheck: 0,
    remote: null,
    sources: {},
    error: ''
  };

  function cmpVersion(a, b) {
    const pa = String(a || '').replace(/^v/i, '').split(/[^\d]+/).filter(Boolean).map(Number);
    const pb = String(b || '').replace(/^v/i, '').split(/[^\d]+/).filter(Boolean).map(Number);
    const n = Math.max(pa.length, pb.length);
    for (let i = 0; i < n; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  async function readUpdateSource(key) {
    const src = updateSources[key];
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const url = src.manifest + (src.manifest.includes('?') ? '&' : '?') + '_=' + Date.now();
      const res = await fetch(url, {
        cache: 'no-store',
        signal: ctl.signal,
        headers: { Accept: src.api ? 'application/json' : 'text/plain' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let text;
      if (src.api) {
        const data = await res.json();
        const raw = String(data.content || '').replace(/\s+/g, '');
        if (!raw) throw new Error('empty manifest');
        const bin = atob(raw);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        text = new TextDecoder().decode(bytes);
      } else {
        text = await res.text();
      }
      const manifest = JSON.parse(text);
      if (!manifest || !manifest.version) throw new Error('missing version');
      return {
        ok: true,
        name: src.name,
        version: String(manifest.version),
        build: String(manifest.build || ''),
        notes: String(manifest.notes || ''),
        release: String((manifest.platforms && manifest.platforms[key]) || src.release)
      };
    } catch (err) {
      return { ok: false, name: src.name, error: err && err.name === 'AbortError' ? '超时' : String(err && err.message || err) };
    } finally {
      clearTimeout(timer);
    }
  }

  function preferredSource() {
    const saved = Aether.store.get('updates.source', '');
    return updateSources[saved] ? saved : 'github';
  }

  function ensureUpdateBar() {
    let bar = $('#updatebar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'updatebar';
    bar.className = 'updatebar hidden';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<div class="ub-main"><strong>发现新版本 <b id="ubver"></b></strong><span>选择 GitHub 或 GitCode，刷新后生效，无需重装。</span></div>' +
      '<div class="ub-actions"><button type="button" data-update-source="github">GitHub</button><button type="button" data-update-source="gitcode">GitCode</button><button type="button" class="ub-x" id="ubdismiss" aria-label="稍后提醒">×</button></div>';
    bar.addEventListener('click', e => {
      const src = e.target.closest('[data-update-source]');
      if (src) { Aether.updates.apply(src.dataset.updateSource); return; }
      if (e.target.closest('#ubdismiss')) Aether.updates.dismiss();
    });
    document.body.appendChild(bar);
    return bar;
  }

  function renderUpdateBar(show) {
    const bar = ensureUpdateBar();
    if (!show || !updateState.remote) { bar.classList.add('hidden'); return; }
    $('#ubver', bar).textContent = updateState.remote.version;
    bar.querySelectorAll('[data-update-source]').forEach(btn => {
      const s = updateState.sources[btn.dataset.updateSource];
      btn.disabled = !(s && s.ok && cmpVersion(s.version, Aether.version) > 0);
      btn.title = s && s.ok ? s.name + ' · ' + s.version : '当前不可达';
    });
    bar.classList.remove('hidden');
  }

  function emitUpdate() {
    document.dispatchEvent(new CustomEvent('aether:update', {
      detail: { current: Aether.version, remote: updateState.remote, sources: updateState.sources, checking: updateState.checking, error: updateState.error }
    }));
  }

  async function checkUpdates(force = false) {
    if (updateState.checking) return updateState;
    const last = Number(Aether.store.get('updates.lastCheck', 0)) || 0;
    if (!force && Date.now() - last < 30 * 60 * 1000) return updateState;
    if (!navigator.onLine) {
      updateState.error = '当前离线，未检查更新';
      emitUpdate();
      return updateState;
    }
    updateState.checking = true;
    updateState.error = '';
    emitUpdate();
    const keys = Object.keys(updateSources);
    const results = await Promise.all(keys.map(async key => Object.assign({ key }, await readUpdateSource(key))));
    updateState.sources = {};
    results.forEach(r => { updateState.sources[r.key] = r; });
    const available = results.filter(r => r.ok && cmpVersion(r.version, Aether.version) > 0);
    available.sort((a, b) => cmpVersion(b.version, a.version));
    const best = available[0] || null;
    updateState.remote = best;
    updateState.lastCheck = Date.now();
    updateState.checking = false;
    Aether.store.set('updates.lastCheck', updateState.lastCheck);
    if (!results.some(r => r.ok)) updateState.error = 'GitHub 与 GitCode 均不可达';
    if (best) {
      const dismissed = Aether.store.get('updates.dismissed', '');
      renderUpdateBar(force || dismissed !== best.version);
    } else {
      renderUpdateBar(false);
    }
    emitUpdate();
    return updateState;
  }

  async function applyUpdate(sourceKey) {
    const key = updateSources[sourceKey] ? sourceKey : preferredSource();
    const src = updateSources[key];
    Aether.store.set('updates.source', key);
    renderUpdateBar(false);
    Aether.toast('已选择 ' + src.name + ' · 正在刷新，无需重装', 'ok');
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          const worker = reg.waiting || reg.installing;
          if (worker) worker.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) {}
    setTimeout(() => location.reload(), 650);
  }

  Aether.updates = {
    get state() { return updateState; },
    get preferred() { return preferredSource(); },
    get releaseUrl() { return (updateState.remote && updateState.remote.release) || updateSources[preferredSource()].release; },
    check: checkUpdates,
    apply: applyUpdate,
    available(key) {
      const s = updateState.sources[key];
      return !!(s && s.ok && cmpVersion(s.version, Aether.version) > 0);
    },
    dismiss() {
      if (updateState.remote) Aether.store.set('updates.dismissed', updateState.remote.version);
      renderUpdateBar(false);
    },
    setPreferred(key) {
      if (!updateSources[key]) return;
      Aether.store.set('updates.source', key);
      emitUpdate();
    }
  };

  /* ---------- 设置 ---------- */
  const settings = Aether.settings = Object.assign({
    accent: 'cyan', wall: 'aurora', wifi: true, data: true, powerPolicy: 'auto'
  }, Aether.store.get('settings', {}));
  function applyLook() {
    document.body.dataset.accent = settings.accent;
    document.body.dataset.wall = settings.wall;
  }
  applyLook();

  /* ---------- 状态 ---------- */
  const state = {
    openApp: null,
    closeFns: [],
    cleanup: null,
    booted: false,
    unlocked: false,
    installEvt: null,
    battery: null,
    charging: false,
    batteryApi: false,
    powerSaver: false,
    gps: null
  };
  Aether.state = state;

  /* ---------- 启动 ---------- */
  const bootLines = [
    ['AETHER CORE v1.1.0 · WEB COMPOSITOR', 'dim'],
    ['mount /dev/aether/vfs ............ OK', 'ok'],
    ['init terminal bridge multiplexer ... OK', 'ok'],
    ['load neon ui compositor ............ OK', 'ok'],
    ['calibrate grid + particles ......... OK', 'ok'],
    ['probe sensors / gps ................ OPTIONAL', 'sys'],
    ['restore local session .............. OK', 'ok'],
    ['system ready. welcome back, pilot.', 'ok']
  ];
  function boot() {
    const bootEl = $('#boot'), logEl = $('#bootlog'), bar = $('#bootbar'), pct = $('#bootpct');
    let i = 0, finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      bar.style.width = '100%';
      pct.textContent = '100%';
      setTimeout(() => {
        bootEl.classList.add('done');
        showLock();
      }, 420);
    }
    function step() {
      if (finished) return;
      if (i >= bootLines.length) return finish();
      const [text, cls] = bootLines[i++];
      const line = document.createElement('div');
      line.className = 'term-line ' + (cls || '');
      line.textContent = '› ' + text;
      logEl.appendChild(line);
      while (logEl.children.length > 7) logEl.firstElementChild.remove();
      const p = Math.round((i / bootLines.length) * 100);
      bar.style.width = p + '%';
      pct.textContent = p + '%';
      setTimeout(step, 180 + Math.random() * 160);
    }
    setTimeout(step, 350);
    $('#bootskip').addEventListener('click', finish);
    bootEl.addEventListener('click', e => { if (e.target.closest('#bootskip')) return; });
  }

  function tickClock(force) {
    const now = new Date();
    const key = now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate() + '-' + now.getHours() + '-' + now.getMinutes();
    if (!force && key === tickClock._key) return now;
    tickClock._key = key;
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const clock = hh + ':' + mm;
    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
    const lc = $('#lockclock'), ld = $('#lockdate'), sc = $('#sbclock');
    if (lc) lc.textContent = clock;
    if (ld) ld.textContent = dateStr;
    if (sc) sc.textContent = clock;
    return now;
  }

  function showLock() {
    state.booted = true;
    $('#lock').classList.remove('hidden');
    tickClock();
    applyNetworkUI();
  }

  function unlock() {
    if (state.unlocked) return;
    state.unlocked = true;
    $('#lock').classList.add('hidden');
    $('#home').classList.remove('hidden');
    $('#statusbar').classList.remove('hidden');
    tickClock(true);
    renderHome();
    applyNetworkUI();
    if (!updateState.bootChecked) {
      updateState.bootChecked = true;
      setTimeout(() => checkUpdates(false), 2500);
    }
  }

  function wireLock() {
    const lock = $('#lock'), btn = $('#unlock');
    let startY = null;
    btn.addEventListener('click', unlock);
    lock.addEventListener('click', e => {
      if (e.target.closest('.lock-hint')) return;
      unlock();
    });
    lock.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
    lock.addEventListener('touchend', e => {
      if (startY !== null) {
        const dy = e.changedTouches[0].clientY - startY;
        if (dy < -50) unlock();
        startY = null;
      }
    }, { passive: true });
    window.addEventListener('keydown', e => { if (e.key === 'Enter' && !state.unlocked) unlock(); });
  }

  /* ---------- 图标 / 桌面 ---------- */
  function buildTile(def) {
    const btn = document.createElement('button');
    btn.className = 'app-tile';
    btn.style.setProperty('--tc', def.accent || '#36e6ff');
    btn.setAttribute('aria-label', def.name);
    const icon = document.createElement('span');
    icon.className = 'tile-icon';
    icon.innerHTML = Aether.icon(def.icon);
    const name = document.createElement('span');
    name.className = 'tile-name';
    name.textContent = def.name;
    btn.appendChild(icon); btn.appendChild(name);
    btn.addEventListener('click', () => openApp(def.id));
    return btn;
  }

  function renderHome() {
    const grid = $('#appgrid'), dock = $('#dock');
    if (!grid) return;
    grid.innerHTML = ''; dock.innerHTML = '';
    const defs = [...Aether.apps.values()].filter(d => !d.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));
    defs.forEach(d => grid.appendChild(buildTile(d)));
    const dockIds = ['phone', 'messages', 'wechat', 'browser', 'terminal'];
    dockIds.forEach(id => {
      const d = Aether.apps.get(id);
      if (d) dock.appendChild(buildTile(d));
    });
    $('#appcount').textContent = defs.length + ' APPS';
  }
  Aether.refreshHome = renderHome;

  /* ---------- 网络 / 电量 UI ---------- */
  function cellGeneration() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const map = { 'slow-2g': '2G', '2g': '2G', '3g': '3G', '4g': '4G', '5g': '5G' };
    if (conn && map[conn.effectiveType]) return map[conn.effectiveType];
    return '蜂窝';
  }
  function applyNetworkUI() {
    const online = navigator.onLine;
    const bothOff = !settings.wifi && !settings.data;
    const barsOn = online && !bothOff ? 5 : 1;
    const gen = cellGeneration();
    $$('#sbsignal i').forEach((b, idx) => b.classList.toggle('on', idx < barsOn));
    const wifiEl = $('#sbwifi');
    if (wifiEl) wifiEl.classList.toggle('off', !(settings.wifi && online));
    const linkEl = $('#sblink');
    if (linkEl) {
      linkEl.title = '跟随手机当前蜂窝网络：' + gen + '（浏览器 Network Information API 报告，iOS 可能不提供）';
      if (!online || bothOff) linkEl.textContent = 'OFF';
      else linkEl.textContent = gen;
    }
    const chipNet = $('#lockchip-net');
    if (chipNet) chipNet.innerHTML = `<i class="dot"></i> ${online ? (settings.wifi ? 'WiFi LINK' : (settings.data ? 'CELLULAR LINK' : 'OFFLINE')) : 'OFFLINE'}`;
    const hud = $('#hudnet');
    if (hud) hud.textContent = online ? (bothOff ? '离线（概念开关）' : (settings.wifi ? 'WiFi 在线' : '数据网络在线')) : '离线';
    const hudSub = $('#hudnet-sub');
    if (hudSub) hudSub.textContent = online && !bothOff ? (gen + ' · ' + (settings.wifi ? 'WiFi 链路' : '蜂窝链路')) : 'offline';
    Aether._net = { online, bothOff };
  }
  Aether.applyNetworkUI = applyNetworkUI;

  function applyBatteryUI() {
    const has = Number.isFinite(state.battery);
    const pct = has ? Math.round(state.battery) : null;
    const label = has ? pct + '%' + (state.charging ? ' ⚡' : '') : '--';
    const sb = $('#sbbattery b');
    if (sb) sb.textContent = has ? pct : '--';
    const chip = $('#lockchip-bat');
    if (chip) chip.textContent = label;
    const hud = $('#hudbat');
    if (hud) hud.textContent = label;
    const icon = document.querySelector('.sb-battery i');
    if (icon) {
      icon.style.setProperty('--batf', String(has ? Math.max(0, Math.min(1, pct / 100)) : 0));
      icon.style.borderColor = has && pct <= 20 ? '#ff5f7a' : '';
      icon.title = has ? ('电池 ' + label + ' · ' + (state.batteryApi ? 'Battery Status API' : '装饰值')) : '浏览器未提供电池信息';
    }
  }

  /* ---------- 省电模式（Battery Status API 自动策略 + 手动开关） ---------- */
  function powerPayload(source) {
    return {
      policy: settings.powerPolicy,
      enabled: state.powerSaver,
      level: state.battery,
      charging: state.charging,
      batteryApi: state.batteryApi,
      source
    };
  }
  function applyPowerSaver(source) {
    const policy = ['auto', 'on', 'off'].includes(settings.powerPolicy) ? settings.powerPolicy : 'auto';
    settings.powerPolicy = policy;
    const low = state.batteryApi && Number.isFinite(state.battery) && !state.charging && state.battery <= 20;
    const on = policy === 'on' || (policy === 'auto' && low);
    state.powerSaver = on;
    Aether.powerSaver = on;
    document.body.classList.toggle('power-saver', on);
    const chip = $('#sbsaver');
    if (chip) {
      chip.classList.toggle('hidden', !on);
      chip.title = '省电模式已开启：粒子、背景动画与模糊效果已暂停';
    }
    Aether.power = powerPayload(source);
    document.dispatchEvent(new CustomEvent('aether:power', { detail: Aether.power }));
  }
  Aether.setPowerPolicy = function (policy) {
    if (!['auto', 'on', 'off'].includes(policy)) return false;
    settings.powerPolicy = policy;
    Aether.store.set('settings', settings);
    applyPowerSaver('manual');
    return true;
  };
  Aether.refreshPowerSaver = function () { applyPowerSaver('refresh'); };
  Aether.power = powerPayload('boot');

  function initBattery() {
    applyBatteryUI();
    applyPowerSaver('boot');
    if (navigator.getBattery) {
      state.batteryApi = true;
      navigator.getBattery().then(b => {
        const update = () => {
          state.battery = b.level * 100;
          state.charging = !!b.charging;
          applyBatteryUI();
          applyPowerSaver('battery');
        };
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      }).catch(() => {
        state.batteryApi = false;
        applyBatteryUI();
        applyPowerSaver('battery-unavailable');
      });
    } else {
      state.batteryApi = false;
      applyBatteryUI();
      applyPowerSaver('battery-unavailable');
    }
  }

  /* ---------- 窗口 ---------- */
  function openApp(id) {
    const def = Aether.apps.get(id);
    if (!def) { Aether.toast('应用不存在'); return; }
    if (state.cleanup) { try { state.cleanup(); } catch (e) {} state.cleanup = null; }
    state.closeFns = [];
    const body = $('#app-body'), actions = $('#app-actions');
    body.className = 'app-body' + (def.flush ? ' app-flush' : '') + (def.bodyClass ? ' ' + def.bodyClass : '');
    body.innerHTML = '';
    actions.innerHTML = '';
    $('#app-title').textContent = def.name;
    $('#app-sub').textContent = def.sub || 'AETHER OS';
    const api = {
      close: closeApp,
      toast: Aether.toast,
      setSub: t => { $('#app-sub').textContent = t; },
      addAction: (iconName, label, fn) => {
        const b = document.createElement('button');
        b.className = 'icon-btn'; b.title = label; b.setAttribute('aria-label', label);
        b.innerHTML = Aether.icon(iconName);
        b.addEventListener('click', fn);
        actions.appendChild(b);
        return b;
      },
      onClose: fn => { if (typeof fn === 'function') state.closeFns.push(fn); },
      state
    };
    state.cleanup = () => {
      state.closeFns.forEach(fn => { try { fn(); } catch (e) {} });
      state.closeFns = [];
    };
    try { def.render(body, api); }
    catch (err) {
      console.error(err);
      body.innerHTML = `<div class="card"><p class="note warn">应用「${def.name}」渲染失败</p><pre class="mono" style="font-size:10px;margin-top:8px;white-space:pre-wrap">${String(err && err.stack || err)}</pre></div>`;
    }
    const layer = $('#app-layer');
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    state.openApp = id;
    document.dispatchEvent(new CustomEvent('aether:app-state', { detail: { open: true, id } }));
    body.scrollTop = 0;
  }

  function closeApp() {
    if (!state.openApp) return;
    const layer = $('#app-layer');
    layer.classList.remove('open');
    layer.setAttribute('aria-hidden', 'true');
    state.openApp = null;
    document.dispatchEvent(new CustomEvent('aether:app-state', { detail: { open: false } }));
    const cleanup = state.cleanup;
    state.cleanup = null;
    setTimeout(() => {
      try { if (cleanup) cleanup(); } catch (e) {}
      if (!state.openApp) {
        $('#app-body').innerHTML = '';
        $('#app-actions').innerHTML = '';
      }
    }, 400);
  }
  Aether.openApp = openApp;
  Aether.closeApp = closeApp;

  function wireAppWindow() {
    $('#app-close').addEventListener('click', closeApp);
    $('#app-home').addEventListener('click', closeApp);
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.openApp) closeApp();
    });
  }

  /* ---------- 粒子背景 ---------- */
  function initParticles() {
    const canvas = $('#particles');
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = Math.min(devicePixelRatio || 1, 1.5), pts = [], raf = 0;
    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(46, Math.round(w / 26));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .16, vy: (Math.random() - .5) * .16,
        r: Math.random() * 1.4 + .5
      }));
    }
    function draw() {
      if (state.powerSaver) { raf = 0; return; }
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,225,255,.5)'; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < 110 * 110) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(90,200,255,' + (0.12 * (1 - d2 / 12100)).toFixed(3) + ')';
            ctx.lineWidth = .6; ctx.stroke();
          }
        }
      }
      raf = state.powerSaver ? 0 : requestAnimationFrame(draw);
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
    function start() {
      stop();
      if (state.powerSaver || state.openApp || document.hidden) return;
      raf = requestAnimationFrame(draw);
    }
    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });
    document.addEventListener('aether:power', e => {
      if (e.detail && e.detail.enabled) stop(); else start();
    });
    document.addEventListener('aether:app-state', e => {
      if (e.detail && e.detail.open) stop(); else start();
    });
  }

  /* ---------- PWA ---------- */
  function initPWA() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      Aether._installEvt = e;
    });
    (window.Aether).canInstall = () => !!Aether._installEvt;
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW register failed', err));
      });
    }
  }

  /* ---------- 启动绑定 ---------- */
  function init() {
    wireLock();
    wireAppWindow();
    initBattery();
    initParticles();
    initPWA();
    tickClock(true);
    function scheduleTick() {
      const now = new Date();
      const wait = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 40;
      setTimeout(() => {
        tickClock(true);
        if (state.unlocked) applyNetworkUI();
        scheduleTick();
      }, wait);
    }
    scheduleTick();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { tickClock(true); applyNetworkUI(); }
    });

    window.addEventListener('online', () => { applyNetworkUI(); Aether.toast('网络已连接', 'ok'); checkUpdates(false); });
    window.addEventListener('offline', () => { applyNetworkUI(); Aether.toast('网络已断开', 'err'); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdates(false); });
    setInterval(() => checkUpdates(false), 6 * 60 * 60 * 1000);

    const start = () => {
      renderHome();
      // 开发预览：可用 ?skip=1 跳过启动与锁屏
      const q = new URLSearchParams(location.search);
      if (q.get('skip') === '1') {
        $('#boot').classList.add('done');
        state.booted = true;
        unlock();
        const app = q.get('app');
        if (app && Aether.apps.has(app)) setTimeout(() => openApp(app), 450);
      } else {
        boot();
      }
    };
    if (document.readyState === 'complete') start();
    else document.addEventListener('DOMContentLoaded', start);
  }
  init();
})();
