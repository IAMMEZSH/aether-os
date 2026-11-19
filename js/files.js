/* ============================================================
   AETHER FILES · 本机目录 / 手机存储桥接 / AETHER 空间
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, el = document) => (el || document).querySelector(s);
  const FS_DB = 'aether-file-access-v1';
  const FS_STORE = 'roots';
  const BLOCKED_NAMES = new Set(['.aether_token', '.tsowner', 'aether_token']);
  const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'css', 'js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'c', 'h', 'cpp', 'hpp', 'cc', 'java', 'rs', 'go', 'php', 'asm', 's', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'log', 'yaml', 'yml', 'ini', 'conf', 'cfg', 'sql', 'toml', 'csv', 'tsv', 'tex', 'license', 'readme']);
  const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif', 'heic', 'heif', 'svg', 'ico']);
  const AUDIO_EXT = new Set(['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac', 'opus']);
  const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'mkv']);
  const OFFICE_EXT = new Set(['pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'tsv', 'ods', 'pptx', 'ppt', 'rtf']);
  const MIME_MAP = {
    txt: 'text/plain', md: 'text/markdown', json: 'application/json', xml: 'application/xml',
    html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
    ts: 'text/plain', py: 'text/x-python', c: 'text/x-c', h: 'text/x-c', cpp: 'text/x-c++', java: 'text/x-java',
    rs: 'text/x-rust', go: 'text/x-go', php: 'application/x-httpd-php', asm: 'text/x-asm', sh: 'text/x-shellscript',
    pdf: 'application/pdf', csv: 'text/csv', tsv: 'text/tab-separated-values',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
  };

  const extOf = name => {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  };
  const mimeOf = name => MIME_MAP[extOf(name)] || 'application/octet-stream';
  const blockedName = name => BLOCKED_NAMES.has(String(name || '').toLowerCase());
  const isText = item => TEXT_EXT.has(extOf(item.name)) || /^text\//.test(item.mime || '') || /json|xml|javascript/.test(item.mime || '');
  const isImage = item => IMAGE_EXT.has(extOf(item.name)) || /^image\//.test(item.mime || '');
  const isAudio = item => AUDIO_EXT.has(extOf(item.name)) || /^audio\//.test(item.mime || '');
  const isVideo = item => VIDEO_EXT.has(extOf(item.name)) || /^video\//.test(item.mime || '');
  const isPdf = item => extOf(item.name) === 'pdf' || item.mime === 'application/pdf';
  const isOffice = item => OFFICE_EXT.has(extOf(item.name));

  function fmtWhen(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function decodeText(buffer) {
    let bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
    let text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const bad = (text.match(/\uFFFD/g) || []).length;
    if (bad > 3 && bad / Math.max(1, text.length) > 0.008) {
      try {
        const alt = new TextDecoder('gb18030', { fatal: false }).decode(bytes);
        if ((alt.match(/\uFFFD/g) || []).length < bad) text = alt;
      } catch (e) {}
    }
    return text;
  }

  function saveBlob(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function friendlyError(err) {
    if (!err) return '未知错误';
    const name = err.name || '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return '浏览器没有获得此位置的读写授权';
    if (name === 'NotFoundError') return '文件已被移动或删除';
    if (name === 'InvalidModificationError') return '文件夹不是空的';
    if (name === 'NotReadableError' || name === 'IOError') return '存储设备或文件不可读取';
    return err.message || String(err);
  }

  function validName(name) {
    const value = String(name || '').trim();
    if (!value || value === '.' || value === '..' || value.length > 180) return '';
    if (/[\\/\x00\r\n]/.test(value) || blockedName(value)) return '';
    return value;
  }

  function openHandleDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('浏览器不支持保存目录授权'));
      const req = indexedDB.open(FS_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(FS_STORE)) db.createObjectStore(FS_STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('无法打开目录授权数据库'));
    });
  }
  async function fsRootsLoad() {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readonly');
      const req = tx.objectStore(FS_STORE).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error || new Error('读取目录授权失败'));
    });
  }
  async function fsRootSave(record) {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readwrite');
      tx.objectStore(FS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存目录授权失败'));
    });
  }
  async function fsRootDelete(id) {
    const db = await openHandleDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FS_STORE, 'readwrite');
      tx.objectStore(FS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('移除目录授权失败'));
    });
  }

  async function ensurePermission(handle, request) {
    try {
      if (typeof handle.queryPermission !== 'function') return true;
      const opts = { mode: 'readwrite' };
      let state = await handle.queryPermission(opts);
      if (state === 'granted') return true;
      if (state === 'prompt' && request && typeof handle.requestPermission === 'function') {
        state = await handle.requestPermission(opts);
      }
      return state === 'granted';
    } catch (e) {
      return false;
    }
  }

  async function mapLimit(list, limit, fn) {
    let index = 0;
    const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (index < list.length) {
        const i = index++;
        await fn(list[i], i);
      }
    });
    await Promise.all(workers);
  }

  async function handleExists(dir, name) {
    try { await dir.getFileHandle(name); return true; } catch (e) {
      if (e && e.name !== 'NotFoundError' && e.name !== 'TypeMismatchError') throw e;
    }
    try { await dir.getDirectoryHandle(name); return true; } catch (e) {
      if (e && e.name !== 'NotFoundError' && e.name !== 'TypeMismatchError') throw e;
      return false;
    }
  }

  async function writeHandle(handle, blob) {
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
  }

  const ICON = {
    folder: '<path d="M3 6.5h6.2l2 2.2H21v9.8H3z"/><path d="M3 8.7h18"/>',
    file: '<path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4"/><path d="M9 12h6M9 15.2h6"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9" r="1.5"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
    pdf: '<path d="M6 2.8h8l4 4V21H6z"/><path d="M14 2.8V7h4"/><text x="12" y="17" text-anchor="middle" font-size="6.4" font-weight="700" font-family="monospace" fill="currentColor" stroke="none">PDF</text>',
    sheet: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 9v11M15 9v11M3 14.5h18"/>',
    slides: '<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M12 17v4M8 21h8M7 9h10M7 12h6"/>',
    archive: '<path d="M5 3h14v18H5z"/><path d="M10 3v3h4V3M10 9h4M10 12h4M10 15h4M10 18h4"/>',
    audio: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    video: '<rect x="3" y="5.5" width="13" height="13" rx="2.5"/><path d="M16 10l5-3v10l-5-3z"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    text: '<path d="M5 3h14v18H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    phone: '<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 5h4M11 18.5h2"/>',
    app: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5"/>',
    left: '<path d="M15 4l-8 8 8 8"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.7"/>',
    dl: '<path d="M12 3v12M7.5 10.5L12 15l4.5-4.5M4.5 20h15"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="M15.8 15.8L21 21"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5M10 11v6M14 11v6"/>',
    edit: '<path d="M4 20h4.5L20 8.5 15.5 4 4 15.5z"/><path d="M13 6.5l4.5 4.5"/>',
    share: '<path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v8.5h14V12"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ICON.file}</svg>`;
  function fileIcon(item) {
    if (item.type === 'folder') return svg('folder');
    const ext = extOf(item.name);
    if (IMAGE_EXT.has(ext)) return svg('image');
    if (ext === 'pdf') return svg('pdf');
    if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) return svg('sheet');
    if (['pptx', 'ppt', 'odp'].includes(ext)) return svg('slides');
    if (['zip', '7z', 'rar', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return svg('archive');
    if (AUDIO_EXT.has(ext)) return svg('audio');
    if (VIDEO_EXT.has(ext)) return svg('video');
    if (['js', 'mjs', 'ts', 'tsx', 'jsx', 'py', 'c', 'h', 'cpp', 'hpp', 'java', 'rs', 'go', 'php', 'asm', 's', 'sh'].includes(ext)) return svg('code');
    if (TEXT_EXT.has(ext)) return svg('text');
    return svg('file');
  }

  function bridgeConfig() {
    const cfg = Aether.store.get('bridge', null);
    if (!cfg || !cfg.endpoint || !cfg.token) return null;
    return { ...cfg, endpoint: String(cfg.endpoint).replace(/\/+$/, '') };
  }

  Aether.registerApp({
    id: 'files',
    name: '文件',
    sub: '本机目录 · 手机存储 · AETHER 空间',
    icon: 'files',
    accent: '#7ad7ff',
    order: 60,
    flush: true,
    render(root, api) {
      const fsSupported = typeof window.showDirectoryPicker === 'function';
      const opfsSupported = !!(navigator.storage && navigator.storage.getDirectory);
      const native = { roots: [], activeId: '', stack: [], loading: false, ready: null, error: '' };
      const space = { root: null, stack: [], loading: false };
      const bridge = { cfg: bridgeConfig(), roots: [], rootId: '', path: '', note: '', mode: '', loaded: false, loading: false, rootLabel: '', writable: true };
      let source = bridge.cfg ? 'bridge' : (fsSupported ? 'native' : 'bridge');
      let items = [];
      let view = { kind: 'loading' };
      let note = '';
      let filter = '';
      let visibleLimit = 300;
      let showHidden = Aether.store.get('filesHidden', false) === true;
      let loading = false;
      let destroyed = false;
      let refreshSeq = 0;
      let renderedItems = [];
      let viewerState = null;
      let viewerUrls = [];
      let overlayEls = new Set();

      root.innerHTML = `
        <div class="files-shell">
          <div class="files-head">
            <div class="files-sources" id="fsSources" role="tablist" aria-label="文件来源"></div>
            <div class="files-tools">
              <button class="files-tool" id="fsUpload" title="上传文件">${svg('up')}<span>上传</span></button>
              <button class="files-tool" id="fsNew" title="新建">${svg('plus')}<span>新建</span></button>
              <button class="files-tool" id="fsRefresh" title="刷新">${svg('refresh')}<span>刷新</span></button>
            </div>
          </div>
          <div class="files-roots" id="fsRoots"></div>
          <div class="files-pathbar">
            <button class="files-iconbtn" id="fsBack" aria-label="上一级" title="上一级">${svg('left')}</button>
            <div class="files-crumbs" id="fsCrumbs"></div>
            <button class="files-iconbtn fs-eye" id="fsHidden" aria-label="显示隐藏文件" title="显示隐藏文件">${svg('eye')}</button>
            <button class="files-iconbtn" id="fsManage" aria-label="目录授权管理" title="目录授权管理">${svg('more')}</button>
          </div>
          <div class="files-filterrow">
            <span class="fs-searchicon">${svg('search')}</span>
            <input id="fsFilter" type="search" placeholder="筛选当前文件夹" autocomplete="off" spellcheck="false">
            <span class="files-count" id="fsCount"></span>
          </div>
          <div class="files-list" id="fsList"></div>
          <div class="files-note" id="fsNote"></div>
          <input type="file" id="fsUploadInput" class="hidden" multiple>
          <div class="files-viewer" id="fsViewer" hidden></div>
        </div>
      `;
      const els = {
        sources: root.querySelector('#fsSources'),
        tools: root.querySelector('.files-tools'),
        upload: root.querySelector('#fsUpload'),
        newBtn: root.querySelector('#fsNew'),
        refresh: root.querySelector('#fsRefresh'),
        roots: root.querySelector('#fsRoots'),
        back: root.querySelector('#fsBack'),
        crumbs: root.querySelector('#fsCrumbs'),
        hidden: root.querySelector('#fsHidden'),
        manage: root.querySelector('#fsManage'),
        filter: root.querySelector('#fsFilter'),
        count: root.querySelector('#fsCount'),
        list: root.querySelector('#fsList'),
        note: root.querySelector('#fsNote'),
        uploadInput: root.querySelector('#fsUploadInput'),
        viewer: root.querySelector('#fsViewer'),
      };

      const sourceLabel = () => source === 'native' ? '本机目录' : source === 'bridge' ? '手机存储' : 'AETHER 空间';
      const handleState = () => source === 'space' ? space : native;
      const topDir = () => {
        const state = handleState();
        return state.stack.length ? state.stack[state.stack.length - 1] : null;
      };
      const bridgeRoot = () => bridge.roots.find(r => r.id === bridge.rootId) || null;
      const bridgeJoin = (dir, name) => String(dir || '').replace(/\/+$/, '') ? (String(dir).replace(/\/+$/, '') + '/' + name) : name;
      const bridgePathFor = item => item.path || bridgeJoin(bridge.path, item.name);

      async function nativeRootsReady() {
        if (!fsSupported) return;
        if (!native.ready) {
          native.ready = (async () => {
            try {
              native.loading = true;
              native.roots = await fsRootsLoad();
              native.loading = false;
            } catch (err) {
              native.loading = false;
              native.error = friendlyError(err);
            }
          })();
        }
        await native.ready;
      }

      function renderSources() {
        const defs = [];
        if (fsSupported) defs.push({ id: 'native', label: '本机目录', icon: 'app' });
        defs.push({ id: 'bridge', label: '手机存储', icon: 'phone' });
        defs.push({ id: 'space', label: 'AETHER 空间', icon: 'file' });
        els.sources.innerHTML = '';
        defs.forEach(def => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'files-source' + (source === def.id ? ' on' : '');
          b.dataset.source = def.id;
          b.setAttribute('role', 'tab');
          b.setAttribute('aria-selected', source === def.id ? 'true' : 'false');
          b.innerHTML = svg(def.icon);
          const span = document.createElement('span');
          span.textContent = def.label;
          b.appendChild(span);
          els.sources.appendChild(b);
        });
      }

      function renderRoots() {
        els.roots.innerHTML = '';
        if (source === 'native') {
          if (!fsSupported) { els.roots.hidden = true; return; }
          native.roots.forEach(rec => {
            const b = document.createElement('button');
            b.className = 'files-root' + (native.activeId === rec.id ? ' on' : '');
            b.dataset.nativeRoot = rec.id;
            b.textContent = rec.name || rec.handle.name || '目录';
            b.title = '打开已授权目录';
            els.roots.appendChild(b);
          });
          const add = document.createElement('button');
          add.className = 'files-root add';
          add.dataset.addNative = '1';
          add.innerHTML = svg('plus') + '<span>添加文件夹</span>';
          els.roots.appendChild(add);
        } else if (source === 'space') {
          const b = document.createElement('span');
          b.className = 'files-root on';
          b.textContent = 'AETHER 私有空间';
          els.roots.appendChild(b);
        } else {
          if (!bridge.cfg) {
            const b = document.createElement('span');
            b.className = 'files-root';
            b.textContent = '未连接';
            els.roots.appendChild(b);
          } else if (bridge.loading && !bridge.loaded) {
            const b = document.createElement('span');
            b.className = 'files-root';
            b.textContent = '连接中…';
            els.roots.appendChild(b);
          } else {
            bridge.roots.forEach(root => {
              const b = document.createElement('button');
              b.className = 'files-root' + (bridge.rootId === root.id ? ' on' : '');
              b.dataset.bridgeRoot = root.id;
              b.textContent = root.label || root.id;
              b.title = root.path || '';
              els.roots.appendChild(b);
            });
            if (!bridge.roots.length) {
              const b = document.createElement('span');
              b.className = 'files-root';
              b.textContent = bridge.loaded ? '没有可用目录' : '未连接';
              els.roots.appendChild(b);
            }
          }
        }
        els.roots.hidden = els.roots.children.length === 0;
      }

      function renderCrumbs() {
        els.crumbs.innerHTML = '';
        const addCrumb = (label, attrs, disabled) => {
          const b = document.createElement('button');
          b.className = 'files-crumb';
          b.textContent = label;
          b.disabled = !!disabled;
          Object.entries(attrs || {}).forEach(([k, v]) => b.dataset[k] = v);
          els.crumbs.appendChild(b);
        };
        if (source === 'bridge') {
          if (!bridge.rootId) {
            const s = document.createElement('span');
            s.className = 'files-crumb current';
            s.textContent = '手机存储';
            els.crumbs.appendChild(s);
          } else {
            addCrumb(bridgeRoot() ? bridgeRoot().label : '根目录', { bridgeDepth: '0' }, false);
            const parts = bridge.path ? bridge.path.split('/').filter(Boolean) : [];
            parts.forEach((part, i) => {
              addCrumb(part, { bridgeDepth: String(i + 1) }, i === parts.length - 1);
            });
          }
        } else {
          const state = handleState();
          if (!state.stack.length) {
            const s = document.createElement('span');
            s.className = 'files-crumb current';
            s.textContent = source === 'space' ? 'AETHER 空间' : '选择一个已授权目录';
            els.crumbs.appendChild(s);
          } else {
            state.stack.forEach((entry, i) => addCrumb(entry.name, { handleDepth: String(i) }, i === state.stack.length - 1));
          }
        }
        els.crumbs.scrollLeft = els.crumbs.scrollWidth;
      }

      function canOperate() {
        if (loading) return false;
        if (source === 'bridge') return !!(bridge.cfg && bridge.rootId);
        return !!topDir();
      }

      function updateChrome() {
        renderSources();
        renderRoots();
        renderCrumbs();
        els.upload.disabled = !canOperate();
        els.newBtn.disabled = !canOperate();
        els.refresh.disabled = loading;
        els.back.disabled = loading || (source === 'bridge' ? !bridge.path : handleState().stack.length <= 1);
        els.filter.disabled = loading;
        els.hidden.classList.toggle('on', showHidden);
        els.hidden.setAttribute('aria-pressed', showHidden ? 'true' : 'false');
        els.manage.hidden = source !== 'native';
        els.note.textContent = note || '';
        els.note.title = note || '';
        const where = source === 'bridge'
          ? (bridge.rootId ? (bridgeRoot() ? bridgeRoot().label : '') + (bridge.path ? ' / ' + bridge.path : '') : '')
          : (topDir() ? handleState().stack.map(x => x.name).slice(source === 'space' ? 1 : 0).join(' / ') : '');
        api.setSub('文件 · ' + sourceLabel() + (where ? ' · ' + where : ''));
      }

      function makeStateCard(opts) {
        const card = document.createElement('div');
        card.className = 'files-state';
        const ic = document.createElement('div');
        ic.className = 'files-state-icon';
        ic.innerHTML = svg(opts.icon || 'file');
        card.appendChild(ic);
        const h = document.createElement('h3');
        h.textContent = opts.title || '';
        card.appendChild(h);
        if (opts.body) {
          const p = document.createElement('p');
          p.textContent = opts.body;
          card.appendChild(p);
        }
        if (opts.steps) {
          const pre = document.createElement('pre');
          pre.className = 'files-steps';
          pre.textContent = opts.steps;
          card.appendChild(pre);
        }
        if (opts.actions && opts.actions.length) {
          const row = document.createElement('div');
          row.className = 'files-state-actions';
          opts.actions.forEach(def => {
            const b = document.createElement('button');
            b.className = 'btn ' + (def.primary ? 'solid' : 'ghost') + ' sm';
            b.textContent = def.label;
            b.addEventListener('click', () => { try { def.run(); } catch (err) { api.toast(friendlyError(err), 'bad'); } });
            row.appendChild(b);
          });
          card.appendChild(row);
        }
        return card;
      }

      function renderList() {
        els.list.innerHTML = '';
        els.count.textContent = '';
        if (loading || view.kind === 'loading') {
          const wrap = document.createElement('div');
          wrap.className = 'files-skeleton';
          for (let i = 0; i < 7; i++) {
            const row = document.createElement('div');
            row.className = 'files-skel-row';
            row.innerHTML = '<i></i><span></span><b></b>';
            wrap.appendChild(row);
          }
          els.list.appendChild(wrap);
          return;
        }
        if (view.kind === 'bridgeSetup') {
          els.list.appendChild(makeStateCard({
            icon: 'phone',
            title: '连接手机自带文件功能',
            body: 'AETHER 不能绕过系统权限。Android 上由 Termux 桥接直接读写共享存储；iPhone 上 iSH 可管理它可见的目录，系统文件选择器负责导入/导出。',
            steps: 'Termux 首次使用：\ntermux-setup-storage\ncd ~/aether-os\npython3 bridge/server.py\n\n然后把终端显示的地址与令牌填入 AETHER「设置 → 真 Linux 接入」。',
            actions: [
              { label: '打开设置配置', primary: true, run: () => Aether.openApp('settings') },
              { label: '复制 Termux 命令', run: () => {
                Aether.copyText('termux-setup-storage\npkg install -y python\ncd ~/aether-os\npython3 bridge/server.py').then(ok => api.toast(ok ? '命令已复制' : '复制失败', ok ? 'ok' : 'bad'));
              } },
              { label: '改用 AETHER 空间', run: () => setSource('space') },
            ],
          }));
          return;
        }
        if (view.kind === 'nativeSetup') {
          els.list.appendChild(makeStateCard({
            icon: 'app',
            title: '授权一个真实文件夹',
            body: '浏览器会弹出系统目录选择器。授权后，AETHER 文件里看到、上传、重命名和删除的，都是该目录中的真实文件。',
            actions: [
              { label: '选择文件夹', primary: true, run: pickNativeFolder },
              { label: '了解限制', run: () => api.toast('目录授权由浏览器/系统控制；不同浏览器支持不同。手机端建议使用「手机存储」桥接。', '') },
            ],
          }));
          return;
        }
        if (view.kind === 'permission') {
          const rec = view.record;
          els.list.appendChild(makeStateCard({
            icon: 'app',
            title: '需要重新授权目录',
            body: '浏览器会保留目录句柄，但出于安全要求，重新打开页面后必须由你再次确认读写权限。',
            actions: [
              { label: '授权并打开', primary: true, run: async () => {
                if (!rec) return;
                if (await ensurePermission(rec.handle, true)) {
                  native.activeId = rec.id;
                  native.stack = [{ name: rec.name || rec.handle.name, handle: rec.handle }];
                  await refreshList();
                } else api.toast('未获得目录授权', 'bad');
              } },
              { label: '移除授权', run: () => removeNativeRoot(rec.id) },
              { label: '添加其他文件夹', run: pickNativeFolder },
            ],
          }));
          return;
        }
        if (view.kind === 'error') {
          els.list.appendChild(makeStateCard({
            icon: 'file',
            title: view.title || '无法列出文件',
            body: view.body || '',
            actions: [
              { label: '重试', primary: true, run: () => refreshList() },
              { label: '打开设置', run: () => Aether.openApp('settings') },
              { label: 'AETHER 空间', run: () => setSource('space') },
            ],
          }));
          return;
        }
        const q = filter.trim().toLocaleLowerCase();
        const filtered = q ? items.filter(it => it.name.toLocaleLowerCase().includes(q)) : items;
        renderedItems = filtered.slice(0, visibleLimit);
        els.count.textContent = q ? (filtered.length + ' / ' + items.length + ' 项') : (items.length + ' 项');
        if (!items.length) {
          els.list.appendChild(makeStateCard({
            icon: 'folder',
            title: '这个文件夹是空的',
            body: source === 'bridge' ? '可以从本机选择文件上传，或新建文件夹/文本文件。' : '上传文件、新建文件夹或文本文件，增删改会直接写入当前位置。',
            actions: [
              { label: '上传文件', primary: true, run: pickUpload },
              { label: '新建文件夹', run: () => createNew('folder') },
              { label: '新建文本', run: () => createNew('text') },
            ],
          }));
          return;
        }
        if (!filtered.length) {
          els.list.appendChild(makeStateCard({
            icon: 'search',
            title: '没有匹配项',
            body: '当前文件夹里没有名称包含「' + filter.trim() + '」的项目。',
            actions: [{ label: '清除筛选', primary: true, run: () => { filter = ''; els.filter.value = ''; renderList(); updateChrome(); } }],
          }));
          return;
        }
        const box = document.createElement('div');
        box.className = 'files-rows';
        renderedItems.forEach((item, idx) => {
          const row = document.createElement('div');
          row.className = 'files-row';
          row.dataset.index = String(idx);
          row.tabIndex = 0;
          row.setAttribute('role', 'button');
          row.setAttribute('aria-label', item.name + (item.type === 'folder' ? '，文件夹' : '，文件'));
          const ic = document.createElement('div');
          ic.className = 'files-row-icon' + (item.type === 'folder' ? ' folder' : '');
          ic.innerHTML = fileIcon(item);
          const main = document.createElement('div');
          main.className = 'files-row-main';
          const name = document.createElement('div');
          name.className = 'files-row-name';
          name.textContent = item.name;
          const meta = document.createElement('div');
          meta.className = 'files-row-meta';
          const bits = [];
          if (item.type === 'folder') bits.push('文件夹');
          else bits.push(extOf(item.name) ? extOf(item.name).toUpperCase() : '文件');
          if (item.type !== 'folder' && item.size != null) bits.push(Aether.fmtBytes(item.size));
          if (item.mtime) bits.push(fmtWhen(item.mtime));
          if (item.link) bits.push('链接');
          meta.textContent = bits.join(' · ');
          main.append(name, meta);
          const more = document.createElement('button');
          more.className = 'files-more';
          more.dataset.more = String(idx);
          more.setAttribute('aria-label', '更多操作');
          more.innerHTML = svg('more');
          row.append(ic, main, more);
          box.appendChild(row);
        });
        els.list.appendChild(box);
        if (filtered.length > renderedItems.length) {
          const more = document.createElement('button');
          more.className = 'btn ghost sm files-loadmore';
          more.textContent = '显示更多（剩余 ' + (filtered.length - renderedItems.length) + ' 项）';
          more.addEventListener('click', () => { visibleLimit += 300; renderList(); });
          els.list.appendChild(more);
        }
      }

      function makeOverlay(className) {
        const mask = document.createElement('div');
        mask.className = 'files-mask ' + className;
        root.appendChild(mask);
        overlayEls.add(mask);
        return mask;
      }
      function closeOverlay(mask) {
        if (!mask) return;
        overlayEls.delete(mask);
        mask.remove();
      }

      function askText(opts) {
        return new Promise(resolve => {
          const mask = makeOverlay('files-dialog-mask');
          const form = document.createElement('form');
          form.className = 'files-dialog';
          const title = document.createElement('h3');
          title.textContent = opts.title || '输入名称';
          form.appendChild(title);
          if (opts.message) {
            const p = document.createElement('p');
            p.textContent = opts.message;
            form.appendChild(p);
          }
          const input = document.createElement('input');
          input.type = 'text';
          input.value = opts.value || '';
          input.placeholder = opts.placeholder || '';
          input.autocomplete = 'off';
          input.spellcheck = false;
          input.maxLength = 180;
          form.appendChild(input);
          const row = document.createElement('div');
          row.className = 'files-dialog-actions';
          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.className = 'btn ghost sm';
          cancel.textContent = '取消';
          const ok = document.createElement('button');
          ok.type = 'submit';
          ok.className = 'btn solid sm';
          ok.textContent = opts.confirm || '确定';
          row.append(cancel, ok);
          form.appendChild(row);
          mask.appendChild(form);
          const done = value => { closeOverlay(mask); resolve(value); };
          cancel.addEventListener('click', () => done(null));
          form.addEventListener('submit', e => {
            e.preventDefault();
            const value = validName(input.value);
            if (!value) { api.toast('名称无效：不能为空、不能包含 / \\ 或受保护名称', 'bad'); input.focus(); return; }
            done(value);
          });
          mask.addEventListener('click', e => { if (e.target === mask) done(null); });
          setTimeout(() => { input.focus(); input.select(); }, 30);
        });
      }

      function askConfirm(opts) {
        return new Promise(resolve => {
          const mask = makeOverlay('files-dialog-mask');
          const box = document.createElement('div');
          box.className = 'files-dialog';
          const h = document.createElement('h3');
          h.textContent = opts.title || '请确认';
          const p = document.createElement('p');
          p.textContent = opts.message || '';
          const row = document.createElement('div');
          row.className = 'files-dialog-actions';
          const cancel = document.createElement('button');
          cancel.className = 'btn ghost sm';
          cancel.textContent = '取消';
          const ok = document.createElement('button');
          ok.className = 'btn ' + (opts.danger ? 'danger' : 'solid') + ' sm';
          ok.textContent = opts.confirm || '确定';
          row.append(cancel, ok);
          box.append(h, p, row);
          mask.appendChild(box);
          const done = value => { closeOverlay(mask); resolve(value); };
          cancel.addEventListener('click', () => done(false));
          ok.addEventListener('click', () => done(true));
          mask.addEventListener('click', e => { if (e.target === mask) done(false); });
        });
      }

      function openActions(item) {
        const actions = [];
        if (item.type === 'folder') {
          actions.push({ label: '打开文件夹', icon: 'folder', run: () => openItem(item) });
        } else {
          actions.push({ label: '预览', icon: 'eye', run: () => openViewer(item) });
          if (isText(item)) actions.push({ label: '编辑文本', icon: 'edit', run: () => openViewer(item, { edit: true }) });
          if (isOffice(item) || isText(item)) actions.push({ label: '用办公打开', icon: 'file', run: () => sendToOffice(item) });
          actions.push({ label: '下载到本机', icon: 'dl', run: () => downloadItem(item) });
          if (navigator.share) actions.push({ label: '系统分享 / 打开方式', icon: 'share', run: () => shareItem(item) });
        }
        actions.push({ label: '重命名', icon: 'edit', run: () => renameItem(item) });
        actions.push({ label: '删除', icon: 'trash', danger: true, run: () => deleteItem(item) });

        const mask = makeOverlay('files-sheet-mask');
        const sheet = document.createElement('div');
        sheet.className = 'files-sheet';
        const grab = document.createElement('div');
        grab.className = 'files-grab';
        const h = document.createElement('h3');
        h.textContent = item.name;
        sheet.append(grab, h);
        actions.forEach(def => {
          const b = document.createElement('button');
          b.className = 'files-action' + (def.danger ? ' danger' : '');
          const icon = document.createElement('span');
          icon.innerHTML = svg(def.icon || 'file');
          const label = document.createElement('span');
          label.textContent = def.label;
          b.append(icon, label);
          b.addEventListener('click', () => {
            closeOverlay(mask);
            setTimeout(() => { try { def.run(); } catch (err) { api.toast(friendlyError(err), 'bad'); } }, 20);
          });
          sheet.appendChild(b);
        });
        const cancel = document.createElement('button');
        cancel.className = 'files-action cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', () => closeOverlay(mask));
        sheet.appendChild(cancel);
        mask.appendChild(sheet);
        mask.addEventListener('click', e => { if (e.target === mask) closeOverlay(mask); });
      }

      function pickUpload() {
        if (!canOperate()) { api.toast('先选择一个可写文件夹', ''); return; }
        els.uploadInput.value = '';
        els.uploadInput.click();
      }

      function pickNativeFolder() {
        if (!fsSupported) { api.toast('此浏览器不支持真实目录授权，请使用手机存储桥接或 AETHER 空间', 'bad'); return; }
        (async () => {
          try {
            const handle = await window.showDirectoryPicker({ id: 'aether-files', mode: 'readwrite' });
            if (!(await ensurePermission(handle, true))) {
              api.toast('未获得该目录的读写授权', 'bad');
              return;
            }
            const rec = {
              id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
              name: handle.name || '已授权目录',
              handle,
              added: Date.now(),
            };
            try { await fsRootSave(rec); }
            catch (err) { api.toast('目录可用，但浏览器未能持久记住授权：' + friendlyError(err), 'bad'); }
            native.roots.push(rec);
            native.activeId = rec.id;
            native.stack = [{ name: rec.name, handle: rec.handle }];
            source = 'native';
            await refreshList();
          } catch (err) {
            if (err && err.name === 'AbortError') return;
            api.toast('选择文件夹失败：' + friendlyError(err), 'bad');
          }
        })();
      }

      async function removeNativeRoot(id) {
        const rec = native.roots.find(r => r.id === id);
        if (!rec) return;
        const ok = await askConfirm({ title: '移除目录授权？', message: '只会让 AETHER 忘记「' + rec.name + '」的访问权限，不会删除真实文件。', confirm: '移除授权', danger: true });
        if (!ok) return;
        try { await fsRootDelete(id); } catch (e) {}
        native.roots = native.roots.filter(r => r.id !== id);
        if (native.activeId === id) {
          native.activeId = '';
          native.stack = [];
        }
        await refreshList();
        api.toast('已移除目录授权', 'ok');
      }

      function openManage() {
        if (source === 'bridge') {
          const mask = makeOverlay('files-sheet-mask');
          const sheet = document.createElement('div');
          sheet.className = 'files-sheet';
          const h = document.createElement('h3');
          h.textContent = '手机存储桥接';
          const p = document.createElement('p');
          p.className = 'files-sheet-note';
          p.textContent = bridge.note || '桥接由你在 Termux / iSH 中启动，网页无法自行安装。';
          const b1 = document.createElement('button');
          b1.className = 'files-action';
          b1.innerHTML = svg('refresh');
          const s1 = document.createElement('span'); s1.textContent = '重新读取目录';
          b1.appendChild(s1);
          b1.addEventListener('click', () => { closeOverlay(mask); bridge.loaded = false; bridge.roots = []; refreshList(); });
          const b2 = document.createElement('button');
          b2.className = 'files-action';
          b2.innerHTML = svg('close');
          const s2 = document.createElement('span'); s2.textContent = '断开桥接配置';
          b2.appendChild(s2);
          b2.addEventListener('click', async () => {
            closeOverlay(mask);
            if (!(await askConfirm({ title: '断开桥接？', message: '只会清除本页保存的桥接地址与令牌，不会停止 Termux/iSH 中的服务。', confirm: '断开', danger: true }))) return;
            Aether.store.del('bridge');
            bridge.cfg = null;
            bridge.loaded = false;
            bridge.roots = [];
            bridge.rootId = '';
            bridge.path = '';
            await refreshList();
          });
          const cancel = document.createElement('button');
          cancel.className = 'files-action cancel';
          cancel.textContent = '取消';
          cancel.addEventListener('click', () => closeOverlay(mask));
          sheet.append(h, p, b1, b2, cancel);
          mask.appendChild(sheet);
          return;
        }
        if (source !== 'native') return;
        const mask = makeOverlay('files-sheet-mask');
        const sheet = document.createElement('div');
        sheet.className = 'files-sheet';
        const h = document.createElement('h3');
        h.textContent = '目录授权管理';
        sheet.appendChild(h);
        if (!native.roots.length) {
          const p = document.createElement('p');
          p.className = 'files-sheet-note';
          p.textContent = '还没有已授权的真实目录。';
          sheet.appendChild(p);
        }
        native.roots.forEach(rec => {
          const b = document.createElement('button');
          b.className = 'files-action';
          b.innerHTML = svg('folder');
          const s = document.createElement('span');
          s.textContent = rec.name;
          b.appendChild(s);
          b.addEventListener('click', () => { closeOverlay(mask); removeNativeRoot(rec.id); });
          sheet.appendChild(b);
        });
        const add = document.createElement('button');
        add.className = 'files-action';
        add.innerHTML = svg('plus');
        const sa = document.createElement('span'); sa.textContent = '添加文件夹';
        add.appendChild(sa);
        add.addEventListener('click', () => { closeOverlay(mask); pickNativeFolder(); });
        const cancel = document.createElement('button');
        cancel.className = 'files-action cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', () => closeOverlay(mask));
        sheet.append(add, cancel);
        mask.appendChild(sheet);
        mask.addEventListener('click', e => { if (e.target === mask) closeOverlay(mask); });
      }

      async function loadHandleDir(dir) {
        const entries = [];
        let truncated = false;
        if (dir && typeof dir.entries === 'function') {
          for await (const [name, handle] of dir.entries()) {
            if (blockedName(name)) continue;
            if (!showHidden && name.startsWith('.')) continue;
            if (entries.length >= 3000) { truncated = true; break; }
            entries.push({ name, handle });
          }
        } else if (dir && typeof dir.keys === 'function') {
          for await (const name of dir.keys()) {
            if (blockedName(name)) continue;
            if (!showHidden && name.startsWith('.')) continue;
            let handle = null;
            try { handle = await dir.getFileHandle(name); } catch (e) {
              try { handle = await dir.getDirectoryHandle(name); } catch (e2) {}
            }
            if (handle) entries.push({ name, handle });
            if (entries.length >= 3000) { truncated = true; break; }
          }
        }
        const list = entries.map(entry => ({
          name: entry.name,
          type: entry.handle.kind === 'directory' ? 'folder' : 'file',
          handle: entry.handle,
          size: null,
          mtime: 0,
          mime: entry.handle.kind === 'directory' ? 'inode/directory' : mimeOf(entry.name),
          ext: extOf(entry.name),
          link: false,
        }));
        await mapLimit(list.filter(x => x.type === 'file'), 10, async item => {
          try {
            const file = await item.handle.getFile();
            item.size = file.size;
            item.mtime = file.lastModified;
            item.mime = file.type || item.mime;
          } catch (e) {}
        });
        list.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'zh-CN') : (a.type === 'folder' ? -1 : 1)));
        return { items: list, truncated };
      }

      function setNativePermissionView(record) {
        items = [];
        view = { kind: 'permission', record };
        note = '浏览器保留了目录句柄，但需要你再次确认读写权限。';
      }

      async function collectNative() {
        if (!fsSupported) {
          items = [];
          view = { kind: 'error', title: '此浏览器不支持目录授权', body: 'Safari/Firefox 等浏览器不提供 File System Access API。请使用「手机存储」桥接，或先把文件导入 AETHER 空间。' };
          return;
        }
        await nativeRootsReady();
        if (!native.roots.length) {
          items = [];
          view = { kind: 'nativeSetup' };
          note = native.error || '选择手机或电脑上的真实文件夹；读写由浏览器系统授权，AETHER 不会上传文件。';
          return;
        }
        let rec = native.roots.find(r => r.id === native.activeId);
        if (!rec) {
          rec = native.roots[0];
          native.activeId = rec.id;
          native.stack = [];
        }
        if (!(await ensurePermission(rec.handle, false))) {
          setNativePermissionView(rec);
          return;
        }
        if (!native.stack.length || native.stack[0].handle !== rec.handle) {
          native.stack = [{ name: rec.name || rec.handle.name, handle: rec.handle }];
        }
        try {
          const top = native.stack[native.stack.length - 1];
          const result = await loadHandleDir(top.handle);
          items = result.items;
          view = { kind: 'list' };
          note = '文件直接来自「' + native.stack.map(x => x.name).join(' / ') + '」这份本机目录。增删改会写入真实文件；浏览器不会显示绝对路径。' + (result.truncated ? ' 项目过多，仅列出前 3000 项。' : '');
        } catch (err) {
          if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
            setNativePermissionView(rec);
            return;
          }
          items = [];
          view = { kind: 'error', title: '无法读取这个文件夹', body: friendlyError(err) };
          note = '';
        }
      }

      async function collectSpace() {
        if (!opfsSupported) {
          items = [];
          view = { kind: 'error', title: '此浏览器不支持私有文件系统', body: '请使用现代 Chrome、Edge 或 Safari，或连接手机存储桥接。' };
          return;
        }
        try {
          if (!space.root) space.root = await navigator.storage.getDirectory();
          if (!space.stack.length) space.stack = [{ name: 'AETHER 空间', handle: space.root }];
          const result = await loadHandleDir(space.stack[space.stack.length - 1].handle);
          items = result.items;
          view = { kind: 'list' };
          note = 'AETHER 空间是浏览器为本应用提供的持久私有文件系统（OPFS），可自由增删改查、导入导出；不经过网络，也不会显示在系统相册中。' + (result.truncated ? ' 项目过多，仅列出前 3000 项。' : '');
        } catch (err) {
          items = [];
          view = { kind: 'error', title: '无法打开 AETHER 空间', body: friendlyError(err) };
          note = '';
        }
      }

      async function bridgeRequest(path, options = {}, timeout = 15000) {
        const cfg = bridgeConfig();
        if (!cfg) throw new Error('未连接手机存储桥接');
        bridge.cfg = cfg;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeout);
        try {
          const res = await fetch(cfg.endpoint + path, {
            ...options,
            cache: 'no-store',
            signal: ctl.signal,
            headers: { 'x-aether-token': cfg.token, ...(options.headers || {}) },
          });
          return res;
        } catch (err) {
          if (err && err.name === 'AbortError') throw new Error('桥接请求超时（' + Math.round(timeout / 1000) + ' 秒）');
          throw new Error('无法连接桥接：' + (err && err.message ? err.message : err));
        } finally {
          clearTimeout(timer);
        }
      }
      async function bridgeJson(path, body, timeout = 15000) {
        const res = await bridgeRequest(path, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        }, timeout);
        let data = {};
        try { data = await res.json(); } catch (e) {}
        if (!res.ok) {
          const err = new Error(data.error || ('桥接 HTTP ' + res.status));
          err.code = res.status;
          throw err;
        }
        return data;
      }
      async function bridgeRead(item, timeout = 30000) {
        const res = await bridgeRequest('/api/files/read?root=' + encodeURIComponent(bridge.rootId) + '&path=' + encodeURIComponent(bridgePathFor(item)), {}, timeout);
        if (!res.ok) {
          let data = {};
          try { data = await res.json(); } catch (e) {}
          const err = new Error(data.error || ('读取失败 HTTP ' + res.status));
          err.code = res.status;
          throw err;
        }
        return res.blob();
      }
      async function bridgeWrite(item, blob) {
        const res = await bridgeRequest('/api/files/write?root=' + encodeURIComponent(bridge.rootId) + '&path=' + encodeURIComponent(bridgePathFor(item)) + '&overwrite=1', {
          method: 'POST',
          headers: { 'content-type': blob.type || 'application/octet-stream' },
          body: blob,
        }, 120000);
        let data = {};
        try { data = await res.json(); } catch (e) {}
        if (!res.ok) {
          const err = new Error(data.error || ('写入失败 HTTP ' + res.status));
          err.code = res.status;
          throw err;
        }
        return data;
      }

      async function loadBridgeRootList() {
        bridge.loading = true;
        bridge.loaded = false;
        try {
          const data = await bridgeJson('/api/files/roots', undefined, 12000);
          bridge.roots = data.roots || [];
          bridge.mode = data.mode || '';
          bridge.note = data.note || '';
          bridge.loaded = true;
          if (!bridge.roots.length) {
            bridge.rootId = '';
            bridge.path = '';
          } else if (!bridge.roots.find(r => r.id === bridge.rootId)) {
            bridge.rootId = bridge.roots[0].id;
            bridge.path = '';
          }
        } finally {
          bridge.loading = false;
        }
      }

      async function collectBridge() {
        bridge.cfg = bridgeConfig();
        if (!bridge.cfg) {
          items = [];
          bridge.loaded = false;
          bridge.rootId = '';
          bridge.roots = [];
          view = { kind: 'bridgeSetup' };
          note = '未连接手机存储。配置 Termux/iSH 桥接后，可在这里直接增删改查手机共享存储中的真实文件。';
          return;
        }
        try {
          if (!bridge.loaded) await loadBridgeRootList();
          if (!bridge.roots.length) {
            items = [];
            view = { kind: 'error', title: '桥接没有可访问的目录', body: '桥接已连接，但没有找到共享存储或用户目录。Android 请先在 Termux 运行 termux-setup-storage。' };
            note = bridge.note || '';
            return;
          }
          if (!bridge.rootId) bridge.rootId = bridge.roots[0].id;
          const query = '/api/files/list?root=' + encodeURIComponent(bridge.rootId) + '&path=' + encodeURIComponent(bridge.path) + '&hidden=' + (showHidden ? '1' : '0');
          const data = await bridgeJson(query, undefined, 15000);
          items = (data.items || []).map(it => ({
            name: it.name,
            type: it.type === 'folder' ? 'folder' : 'file',
            path: it.path,
            size: it.size,
            mtime: it.mtime,
            mime: it.mime || mimeOf(it.name),
            ext: it.ext || extOf(it.name),
            link: !!it.link,
          }));
          bridge.rootLabel = data.rootLabel || '';
          bridge.writable = data.writable !== false;
          if (data.note) bridge.note = data.note;
          view = { kind: 'list' };
          note = bridge.note || '已连接手机共享存储；所有操作会直接作用于真实文件。';
        } catch (err) {
          items = [];
          if (err.code === 404) {
            view = { kind: 'error', title: '桥接版本过旧', body: '当前桥接没有文件接口。请更新项目里的 bridge 目录并重新启动 python3 bridge/server.py。' };
          } else if (err.code === 401) {
            view = { kind: 'error', title: '桥接令牌无效', body: '请在「设置 → 真 Linux 接入」重新检测桥接，更新地址与令牌。' };
          } else {
            view = { kind: 'error', title: '无法读取手机存储', body: friendlyError(err) };
          }
          note = '';
        }
      }

      async function collect() {
        items = [];
        note = '';
        if (source === 'bridge') await collectBridge();
        else if (source === 'native') await collectNative();
        else await collectSpace();
      }

      async function refreshList() {
        if (destroyed) return;
        const seq = ++refreshSeq;
        loading = true;
        view = { kind: 'loading' };
        visibleLimit = 300;
        updateChrome();
        renderList();
        try {
          await collect();
          if (seq !== refreshSeq || destroyed) return;
        } catch (err) {
          if (seq !== refreshSeq || destroyed) return;
          items = [];
          view = { kind: 'error', title: '操作失败', body: friendlyError(err) };
          note = '';
        } finally {
          if (seq === refreshSeq && !destroyed) {
            loading = false;
            renderList();
            updateChrome();
          }
        }
      }

      function setSource(next) {
        if (next === source) return;
        if (next === 'native' && !fsSupported) {
          api.toast('当前浏览器不支持目录授权，请使用手机存储或 AETHER 空间', 'bad');
          return;
        }
        source = next;
        filter = '';
        els.filter.value = '';
        visibleLimit = 300;
        refreshList();
      }

      function openItem(item) {
        if (item.type === 'folder') {
          if (source === 'bridge') {
            bridge.path = bridgePathFor(item);
          } else {
            handleState().stack.push({ name: item.name, handle: item.handle });
          }
          filter = '';
          els.filter.value = '';
          visibleLimit = 300;
          refreshList();
          return;
        }
        openViewer(item);
      }

      async function getBlob(item) {
        if (item.handle) return item.handle.getFile();
        return bridgeRead(item);
      }

      async function createNew(kind) {
        if (!canOperate()) { api.toast('先选择一个可写文件夹', ''); return; }
        const suggested = kind === 'folder' ? '新建文件夹' : '新建文本.txt';
        const name = await askText({ title: kind === 'folder' ? '新建文件夹' : '新建文本文件', value: suggested, placeholder: '输入名称', confirm: '创建' });
        if (!name) return;
        try {
          if (source === 'bridge') {
            if (kind === 'folder') {
              await bridgeJson('/api/files/mkdir', { root: bridge.rootId, path: bridgeJoin(bridge.path, name) });
            } else {
              const blob = new Blob([''], { type: 'text/plain;charset=utf-8' });
              const res = await bridgeRequest('/api/files/write?root=' + encodeURIComponent(bridge.rootId) + '&path=' + encodeURIComponent(bridgeJoin(bridge.path, name)) + '&overwrite=0', {
                method: 'POST', headers: { 'content-type': 'text/plain' }, body: blob,
              }, 30000);
              let data = {};
              try { data = await res.json(); } catch (e) {}
              if (!res.ok) { const err = new Error(data.error || '创建失败'); err.code = res.status; throw err; }
            }
          } else {
            const dir = topDir().handle;
            if (await handleExists(dir, name)) throw new Error('同名项目已存在');
            if (kind === 'folder') await dir.getDirectoryHandle(name, { create: true });
            else {
              const handle = await dir.getFileHandle(name, { create: true });
              await writeHandle(handle, new Blob([''], { type: 'text/plain;charset=utf-8' }));
            }
          }
          await refreshList();
          api.toast(kind === 'folder' ? '文件夹已创建' : '文本文件已创建', 'ok');
          if (kind === 'text') {
            const created = items.find(it => it.name === name);
            if (created) openViewer(created, { edit: true });
          }
        } catch (err) {
          api.toast('创建失败：' + friendlyError(err), 'bad');
        }
      }

      async function uploadFiles(files) {
        if (!files || !files.length) return;
        if (!canOperate()) { api.toast('先选择一个可写文件夹', ''); return; }
        let done = 0;
        let failed = 0;
        for (const file of files) {
          const name = validName(file.name);
          if (!name) { failed++; continue; }
          api.setSub('文件 · 上传 ' + (done + failed + 1) + '/' + files.length);
          try {
            if (source === 'bridge') {
              if (file.size > 64 * 1024 * 1024) throw new Error('桥接单文件上限 64 MB');
              const path = bridgeJoin(bridge.path, name);
              let res = await bridgeRequest('/api/files/write?root=' + encodeURIComponent(bridge.rootId) + '&path=' + encodeURIComponent(path) + '&overwrite=0', {
                method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file,
              }, 120000);
              if (res.status === 409) {
                const ok = await askConfirm({ title: '同名文件已存在', message: '覆盖「' + name + '」？原文件内容会被替换。', confirm: '覆盖', danger: true });
                if (!ok) continue;
                res = await bridgeRequest('/api/files/write?root=' + encodeURIComponent(bridge.rootId) + '&path=' + encodeURIComponent(path) + '&overwrite=1', {
                  method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file,
                }, 120000);
              }
              if (!res.ok) {
                let data = {};
                try { data = await res.json(); } catch (e) {}
                throw new Error(data.error || ('HTTP ' + res.status));
              }
            } else {
              const dir = topDir().handle;
              if (await handleExists(dir, name)) {
                const ok = await askConfirm({ title: '同名文件已存在', message: '覆盖「' + name + '」？原文件内容会被替换。', confirm: '覆盖', danger: true });
                if (!ok) continue;
              }
              const handle = await dir.getFileHandle(name, { create: true });
              await writeHandle(handle, file);
            }
            done++;
          } catch (err) {
            failed++;
            api.toast('「' + name + '」上传失败：' + friendlyError(err), 'bad');
          }
        }
        await refreshList();
        if (done) api.toast('已写入 ' + done + ' 个文件' + (failed ? '，失败 ' + failed + ' 个' : ''), failed ? 'bad' : 'ok');
      }

      async function renameItem(item) {
        if (!canOperate()) return;
        const name = await askText({ title: '重命名', message: item.type === 'folder' ? '文件夹内的内容会保留。' : '', value: item.name, confirm: '重命名' });
        if (!name || name === item.name) return;
        try {
          if (source === 'bridge') {
            await bridgeJson('/api/files/rename', { root: bridge.rootId, path: bridgePathFor(item), name });
          } else {
            const dir = topDir().handle;
            if (await handleExists(dir, name)) throw new Error('同名项目已存在');
            if (typeof item.handle.move === 'function') {
              try {
                await item.handle.move(name);
              } catch (err) {
                if (err && (err.name === 'NotSupportedError' || err.name === 'TypeError')) {
                  await copyThenRemove(dir, item, name);
                } else throw err;
              }
            } else {
              await copyThenRemove(dir, item, name);
            }
          }
          await refreshList();
          api.toast('已重命名', 'ok');
        } catch (err) {
          api.toast('重命名失败：' + friendlyError(err), 'bad');
        }
      }

      async function copyThenRemove(dir, item, newName) {
        try {
          if (item.type === 'file') {
            const src = await item.handle.getFile();
            const dst = await dir.getFileHandle(newName, { create: true });
            await writeHandle(dst, src);
            await dir.removeEntry(item.name);
            return;
          }
          const dstDir = await dir.getDirectoryHandle(newName, { create: true });
          await copyDir(item.handle, dstDir);
          await dir.removeEntry(item.name, { recursive: true });
        } catch (err) {
          try { await dir.removeEntry(newName, { recursive: true }); } catch (cleanupErr) {}
          throw err;
        }
      }
      async function copyDir(srcDir, dstDir) {
        for await (const [name, handle] of srcDir.entries()) {
          if (handle.kind === 'directory') {
            const child = await dstDir.getDirectoryHandle(name, { create: true });
            await copyDir(handle, child);
          } else {
            const file = await handle.getFile();
            const child = await dstDir.getFileHandle(name, { create: true });
            await writeHandle(child, file);
          }
        }
      }

      async function deleteItem(item) {
        if (!canOperate()) return;
        const first = await askConfirm({
          title: '删除「' + item.name + '」？',
          message: item.type === 'folder' ? '将删除这个真实文件夹。若里面有内容，会再次向你确认。' : '这是真实文件，删除后无法从 AETHER 恢复。',
          confirm: '删除',
          danger: true,
        });
        if (!first) return;
        try {
          try {
            if (source === 'bridge') {
              await bridgeJson('/api/files/delete', { root: bridge.rootId, path: bridgePathFor(item), recursive: false });
            } else {
              await topDir().handle.removeEntry(item.name, { recursive: false });
            }
          } catch (err) {
            const notEmpty = source === 'bridge' ? (err.code === 409 || /不为空/.test(err.message || '')) : err.name === 'InvalidModificationError';
            if (!notEmpty) throw err;
            const second = await askConfirm({
              title: '文件夹不为空',
              message: '连同「' + item.name + '」内的全部内容永久删除？此操作不可恢复。',
              confirm: '递归删除',
              danger: true,
            });
            if (!second) return;
            if (source === 'bridge') {
              await bridgeJson('/api/files/delete', { root: bridge.rootId, path: bridgePathFor(item), recursive: true });
            } else {
              await topDir().handle.removeEntry(item.name, { recursive: true });
            }
          }
          await refreshList();
          api.toast('已删除', 'ok');
        } catch (err) {
          api.toast('删除失败：' + friendlyError(err), 'bad');
        }
      }

      async function downloadItem(item) {
        try {
          api.toast('正在读取文件…', '');
          const blob = await getBlob(item);
          saveBlob(item.name, blob.type ? blob : new Blob([blob], { type: item.mime || mimeOf(item.name) }));
          api.toast('已开始下载', 'ok');
        } catch (err) {
          api.toast('下载失败：' + friendlyError(err), 'bad');
        }
      }

      async function shareItem(item) {
        try {
          const blob = await getBlob(item);
          const file = new File([blob], item.name, { type: blob.type || item.mime || mimeOf(item.name) });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: item.name });
          } else if (navigator.share) {
            await navigator.share({ title: item.name, text: item.name });
          } else {
            saveBlob(item.name, file);
            api.toast('此设备不支持分享面板，已改为下载', '');
          }
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          api.toast('分享失败：' + friendlyError(err), 'bad');
        }
      }

      async function sendToOffice(item) {
        try {
          api.toast('正在交给办公打开…', '');
          const blob = await getBlob(item);
          const file = new File([blob], item.name, { type: blob.type || item.mime || mimeOf(item.name) });
          if (typeof Aether.openOfficeFile !== 'function') throw new Error('办公模块尚未加载');
          Aether.openOfficeFile(file);
        } catch (err) {
          api.toast('无法用办公打开：' + friendlyError(err), 'bad');
        }
      }

      function cleanupViewer() {
        viewerUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        viewerUrls = [];
        els.viewer.hidden = true;
        els.viewer.innerHTML = '';
        viewerState = null;
      }
      function viewerUrl(blob) {
        const u = URL.createObjectURL(blob);
        viewerUrls.push(u);
        return u;
      }

      function openViewer(item, opts = {}) {
        cleanupViewer();
        const state = { item, blob: null, text: '', edit: !!opts.edit };
        viewerState = state;
        const v = els.viewer;
        v.hidden = false;
        v.innerHTML = `
          <div class="fv-head">
            <button class="fv-close" id="fvClose" aria-label="关闭">${svg('close')}</button>
            <div class="fv-title"><strong id="fvName"></strong><span id="fvSub"></span></div>
            <div class="fv-tools">
              <button class="fv-tool" id="fvDownload" title="下载">${svg('dl')}</button>
              <button class="fv-tool" id="fvShare" title="系统分享">${svg('share')}</button>
              <button class="fv-tool" id="fvOffice" title="用办公打开">${svg('file')}</button>
            </div>
          </div>
          <div class="fv-stage" id="fvStage"></div>
          <div class="fv-foot" id="fvFoot"></div>
        `;
        v.querySelector('#fvName').textContent = item.name;
        v.querySelector('#fvSub').textContent = (extOf(item.name) || 'FILE').toUpperCase() + ' · ' + (item.size != null ? Aether.fmtBytes(item.size) : '');
        v.querySelector('#fvFoot').textContent = source === 'bridge' ? '手机存储 · 真实文件' : source === 'native' ? '本机授权目录 · 真实文件' : 'AETHER 私有空间';
        v.querySelector('#fvClose').addEventListener('click', cleanupViewer);
        const shareBtn = v.querySelector('#fvShare');
        shareBtn.hidden = !navigator.share;
        shareBtn.addEventListener('click', () => shareItem(item));
        v.querySelector('#fvDownload').addEventListener('click', () => downloadItem(item));
        const officeBtn = v.querySelector('#fvOffice');
        officeBtn.hidden = !(isOffice(item) || isText(item));
        officeBtn.addEventListener('click', () => sendToOffice(item));
        loadViewer(state);
      }

      async function loadViewer(state) {
        const v = els.viewer;
        if (!viewerState || viewerState !== state) return;
        const stage = v.querySelector('#fvStage');
        const item = state.item;
        stage.innerHTML = '<div class="fv-loading"><span class="of-spin"></span><p>正在读取真实文件…</p></div>';
        let blob;
        try {
          blob = await getBlob(item);
        } catch (err) {
          if (!viewerState || viewerState !== state) return;
          stage.innerHTML = '';
          stage.appendChild(makeStateCard({ icon: 'file', title: '无法读取文件', body: friendlyError(err), actions: [{ label: '下载试试', primary: true, run: () => downloadItem(item) }] }));
          return;
        }
        if (!viewerState || viewerState !== state) return;
        state.blob = blob;
        v.querySelector('#fvSub').textContent = (extOf(item.name) || 'FILE').toUpperCase() + ' · ' + Aether.fmtBytes(blob.size) + (blob.type ? ' · ' + blob.type : '');
        stage.innerHTML = '';

        if (isText(item)) {
          if (blob.size > 4 * 1024 * 1024) {
            stage.appendChild(makeStateCard({ icon: 'text', title: '文本文件较大', body: '超过 4 MB，浏览器内编辑会明显卡顿。可以下载后用外部编辑器处理，或使用办公打开。', actions: [{ label: '用办公打开', primary: true, run: () => sendToOffice(item) }, { label: '下载', run: () => downloadItem(item) }] }));
            return;
          }
          try {
            const buf = await blob.arrayBuffer();
            if (!viewerState || viewerState !== state) return;
            state.text = decodeText(buf);
            renderTextViewer(state);
          } catch (err) {
            stage.appendChild(makeStateCard({ icon: 'text', title: '无法解码文本', body: friendlyError(err), actions: [{ label: '下载', primary: true, run: () => downloadItem(item) }] }));
          }
          return;
        }
        if (isImage(item) && !/svg/i.test(item.name)) {
          const url = viewerUrl(blob);
          const img = document.createElement('img');
          img.className = 'fv-image';
          img.alt = item.name;
          img.src = url;
          img.addEventListener('error', () => {
            stage.innerHTML = '';
            stage.appendChild(makeStateCard({ icon: 'image', title: '此图片无法预览', body: '浏览器不支持该编码，可以下载后交给系统相册/图片查看器。', actions: [{ label: '下载原图', primary: true, run: () => downloadItem(item) }] }));
          });
          stage.appendChild(img);
          return;
        }
        if (isPdf(item)) {
          const url = viewerUrl(blob);
          const frame = document.createElement('iframe');
          frame.className = 'fv-frame';
          frame.title = item.name;
          frame.src = url + '#toolbar=0&navpanes=0&view=FitH';
          stage.appendChild(frame);
          const hint = document.createElement('p');
          hint.className = 'fv-hint';
          hint.textContent = 'PDF 由浏览器内置查看器渲染。若空白，请下载或点右上角用办公打开。';
          stage.appendChild(hint);
          return;
        }
        if (isAudio(item)) {
          const url = viewerUrl(blob);
          const box = document.createElement('div');
          box.className = 'fv-media-card';
          const icon = document.createElement('div');
          icon.className = 'fv-media-icon';
          icon.innerHTML = svg('audio');
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = url;
          box.append(icon, audio);
          stage.appendChild(box);
          return;
        }
        if (isVideo(item)) {
          const url = viewerUrl(blob);
          const video = document.createElement('video');
          video.className = 'fv-video';
          video.controls = true;
          video.playsInline = true;
          video.src = url;
          stage.appendChild(video);
          return;
        }
        if (isOffice(item)) {
          const card = document.createElement('div');
          card.className = 'fv-doc-card';
          card.innerHTML = `<div class="fv-doc-icon">${fileIcon(item)}</div>`;
          const h = document.createElement('h3');
          h.textContent = item.name;
          const p = document.createElement('p');
          p.textContent = '这是真实的 ' + (extOf(item.name) || '办公').toUpperCase() + ' 文件。浏览器不会在本页假装完整排版；请交给 AETHER 办公打开、编辑并保存副本。';
          const row = document.createElement('div');
          row.className = 'files-state-actions';
          const open = document.createElement('button');
          open.className = 'btn solid sm';
          open.textContent = '用办公打开';
          open.addEventListener('click', () => sendToOffice(item));
          const dl = document.createElement('button');
          dl.className = 'btn ghost sm';
          dl.textContent = '下载原文件';
          dl.addEventListener('click', () => downloadItem(item));
          const share = document.createElement('button');
          share.className = 'btn ghost sm';
          share.textContent = '系统分享';
          share.addEventListener('click', () => shareItem(item));
          row.append(open, dl, share);
          card.append(h, p, row);
          stage.appendChild(card);
          return;
        }
        const buf = await blob.slice(0, 512).arrayBuffer();
        const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(' ');
        const card = document.createElement('div');
        card.className = 'fv-doc-card';
        card.innerHTML = `<div class="fv-doc-icon">${svg('file')}</div>`;
        const h = document.createElement('h3');
        h.textContent = item.name;
        const p = document.createElement('p');
        p.textContent = '没有对应的预览器。文件本身未被修改；可下载、分享或用办公打开。';
        const pre = document.createElement('pre');
        pre.className = 'fv-hex';
        pre.textContent = hex;
        const row = document.createElement('div');
        row.className = 'files-state-actions';
        const dl = document.createElement('button');
        dl.className = 'btn solid sm';
        dl.textContent = '下载原文件';
        dl.addEventListener('click', () => downloadItem(item));
        const sh = document.createElement('button');
        sh.className = 'btn ghost sm';
        sh.textContent = '系统分享';
        sh.addEventListener('click', () => shareItem(item));
        row.append(dl, sh);
        card.append(h, p, pre, row);
        stage.appendChild(card);
      }

      function renderTextViewer(state) {
        const v = els.viewer;
        if (!viewerState || viewerState !== state) return;
        const stage = v.querySelector('#fvStage');
        stage.innerHTML = '';
        if (state.edit) {
          const wrap = document.createElement('div');
          wrap.className = 'fv-editor';
          const ta = document.createElement('textarea');
          ta.value = state.text;
          ta.spellcheck = false;
          wrap.appendChild(ta);
          const bar = document.createElement('div');
          bar.className = 'fv-editbar';
          const info = document.createElement('span');
          info.textContent = '以 UTF-8 覆盖保存到原文件';
          const cancel = document.createElement('button');
          cancel.className = 'btn ghost sm';
          cancel.textContent = '取消';
          cancel.addEventListener('click', () => { state.edit = false; renderTextViewer(state); });
          const save = document.createElement('button');
          save.className = 'btn solid sm';
          save.textContent = '保存';
          save.addEventListener('click', async () => {
            save.disabled = true;
            try {
              const blob = new Blob([ta.value], { type: blobTypeFor(state.item) });
              if (source === 'bridge') await bridgeWrite(state.item, blob);
              else {
                if (state.item.handle) await writeHandle(state.item.handle, blob);
                else throw new Error('文件句柄不可用');
              }
              state.text = ta.value;
              state.blob = blob;
              state.edit = false;
              if (state.item.size != null) state.item.size = blob.size;
              state.item.mtime = Date.now();
              v.querySelector('#fvSub').textContent = (extOf(state.item.name) || 'FILE').toUpperCase() + ' · ' + Aether.fmtBytes(blob.size) + (blob.type ? ' · ' + blob.type : '');
              api.toast('已写回原文件', 'ok');
              renderTextViewer(state);
              refreshList();
            } catch (err) {
              api.toast('保存失败：' + friendlyError(err), 'bad');
              save.disabled = false;
            }
          });
          bar.append(info, cancel, save);
          wrap.appendChild(bar);
          stage.appendChild(wrap);
          setTimeout(() => ta.focus(), 30);
          return;
        }
        const pre = document.createElement('pre');
        pre.className = 'fv-text';
        pre.textContent = state.text;
        stage.appendChild(pre);
        const row = document.createElement('div');
        row.className = 'fv-textbar';
        const info = document.createElement('span');
        info.textContent = state.text.length.toLocaleString('zh-CN') + ' 字符 · ' + (state.text.split(/\r?\n/).length) + ' 行';
        const edit = document.createElement('button');
        edit.className = 'btn ghost sm';
        edit.textContent = '编辑';
        edit.addEventListener('click', () => { state.edit = true; renderTextViewer(state); });
        row.append(info, edit);
        stage.appendChild(row);
      }

      function blobTypeFor(item) {
        const ext = extOf(item.name);
        if (ext === 'json') return 'application/json;charset=utf-8';
        if (ext === 'html' || ext === 'htm') return 'text/html;charset=utf-8';
        if (ext === 'css') return 'text/css;charset=utf-8';
        if (ext === 'js' || ext === 'mjs') return 'text/javascript;charset=utf-8';
        return (item.mime && /^text\//.test(item.mime) ? item.mime.split(';')[0] : 'text/plain') + ';charset=utf-8';
      }

      els.sources.addEventListener('click', e => {
        const b = e.target.closest('[data-source]');
        if (b) setSource(b.dataset.source);
      });
      els.roots.addEventListener('click', e => {
        const add = e.target.closest('[data-add-native]');
        if (add) { pickNativeFolder(); return; }
        const nr = e.target.closest('[data-native-root]');
        if (nr) {
          const rec = native.roots.find(r => r.id === nr.dataset.nativeRoot);
          if (!rec) return;
          (async () => {
            if (!(await ensurePermission(rec.handle, true))) { api.toast('未获得目录授权', 'bad'); return; }
            native.activeId = rec.id;
            native.stack = [{ name: rec.name || rec.handle.name, handle: rec.handle }];
            filter = '';
            els.filter.value = '';
            await refreshList();
          })();
          return;
        }
        const br = e.target.closest('[data-bridge-root]');
        if (br) {
          bridge.rootId = br.dataset.bridgeRoot;
          bridge.path = '';
          filter = '';
          els.filter.value = '';
          refreshList();
        }
      });
      els.crumbs.addEventListener('click', e => {
        const hc = e.target.closest('[data-handle-depth]');
        if (hc) {
          const depth = Number(hc.dataset.handleDepth);
          const state = handleState();
          if (Number.isInteger(depth) && depth >= 0 && depth < state.stack.length) {
            state.stack = state.stack.slice(0, depth + 1);
            filter = '';
            els.filter.value = '';
            refreshList();
          }
          return;
        }
        const bc = e.target.closest('[data-bridge-depth]');
        if (bc) {
          const depth = Number(bc.dataset.bridgeDepth);
          if (depth === 0) bridge.path = '';
          else {
            const parts = bridge.path.split('/').filter(Boolean).slice(0, depth);
            bridge.path = parts.join('/');
          }
          filter = '';
          els.filter.value = '';
          refreshList();
        }
      });
      els.back.addEventListener('click', () => {
        if (source === 'bridge') {
          if (!bridge.path) return;
          const parts = bridge.path.split('/').filter(Boolean);
          parts.pop();
          bridge.path = parts.join('/');
        } else {
          const state = handleState();
          if (state.stack.length <= 1) return;
          state.stack.pop();
        }
        filter = '';
        els.filter.value = '';
        refreshList();
      });
      els.refresh.addEventListener('click', () => refreshList());
      els.upload.addEventListener('click', pickUpload);
      els.newBtn.addEventListener('click', () => {
        if (!canOperate()) { api.toast('先选择一个可写文件夹', ''); return; }
        const mask = makeOverlay('files-sheet-mask');
        const sheet = document.createElement('div');
        sheet.className = 'files-sheet';
        const h = document.createElement('h3');
        h.textContent = '新建';
        sheet.appendChild(h);
        [
          { label: '新建文件夹', icon: 'folder', run: () => createNew('folder') },
          { label: '新建文本文件', icon: 'text', run: () => createNew('text') },
          { label: '上传已有文件', icon: 'up', run: pickUpload },
        ].forEach(def => {
          const b = document.createElement('button');
          b.className = 'files-action';
          b.innerHTML = svg(def.icon);
          const span = document.createElement('span'); span.textContent = def.label;
          b.appendChild(span);
          b.addEventListener('click', () => { closeOverlay(mask); setTimeout(def.run, 30); });
          sheet.appendChild(b);
        });
        const cancel = document.createElement('button');
        cancel.className = 'files-action cancel';
        cancel.textContent = '取消';
        cancel.addEventListener('click', () => closeOverlay(mask));
        sheet.appendChild(cancel);
        mask.appendChild(sheet);
        mask.addEventListener('click', e => { if (e.target === mask) closeOverlay(mask); });
      });
      els.hidden.addEventListener('click', () => {
        showHidden = !showHidden;
        Aether.store.set('filesHidden', showHidden);
        refreshList();
      });
      els.manage.addEventListener('click', openManage);
      els.filter.addEventListener('input', () => {
        filter = els.filter.value;
        visibleLimit = 300;
        renderList();
        updateChrome();
      });
      els.uploadInput.addEventListener('change', () => {
        const files = [...(els.uploadInput.files || [])];
        els.uploadInput.value = '';
        uploadFiles(files);
      });
      els.list.addEventListener('click', e => {
        const more = e.target.closest('[data-more]');
        if (more) {
          const item = renderedItems[Number(more.dataset.more)];
          if (item) openActions(item);
          return;
        }
        const row = e.target.closest('.files-row');
        if (row) {
          const item = renderedItems[Number(row.dataset.index)];
          if (item) openItem(item);
        }
      });
      els.list.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const row = e.target.closest('.files-row');
        if (!row) return;
        e.preventDefault();
        const item = renderedItems[Number(row.dataset.index)];
        if (item) openItem(item);
      });
      root.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          const masks = [...overlayEls];
          if (masks.length) { e.stopPropagation(); closeOverlay(masks[masks.length - 1]); return; }
          if (!els.viewer.hidden) { e.stopPropagation(); cleanupViewer(); return; }
        }
      });

      api.onClose(() => {
        destroyed = true;
        refreshSeq++;
        cleanupViewer();
        overlayEls.forEach(el => { try { el.remove(); } catch (e) {} });
        overlayEls.clear();
      });

      renderSources();
      renderCrumbs();
      updateChrome();
      refreshList();
    },
  });
})();
