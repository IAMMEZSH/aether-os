/* ============================================================
   AETHER APPS · 办公 / 代码 / 地图 / 媒体 / 相册 / 备忘录 / 浏览器 / 设置
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, el = document) => (el || document).querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const fmtDate = ts => new Date(ts).toLocaleString('zh-CN', { hour12: false });
  const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const copy = async (text) => {
    const ok = await Aether.copyText(text);
    Aether.toast(ok ? '已复制到剪贴板' : '复制失败，请手动选择', ok ? 'ok' : 'err');
  };

  /* ============================================================
     办公套件
     ============================================================ */
  const DOC_DEFAULT = '<h1>AETHER OS 办公套件</h1><p>这是内置的文档示例。你可以直接编辑、加粗、插入标题与列表，内容自动保存在本机。</p><ul><li>文档、表格、演示三种模式</li><li>支持导出文件</li><li>数据只存储在当前浏览器</li></ul><p><b>提示：</b>真正的 Word/Excel 兼容请使用官方 Office 或 WPS。</p>';
  const SHEET_DEFAULT = [
    ['项目', '一月', '二月', '三月', '四月'],
    ['轨道票务', '120', '180', '160', '220'],
    ['星港餐饮', '86', '92', '105', '130'],
    ['观测站门票', '210', '260', '240', '310'],
    ['周边销售', '45', '60', '58', '72'],
    ['会员订阅', '150', '150', '165', '180'],
    ['总计预测', '', '', '', '']
  ];
  const SLIDES_DEFAULT = [
    { title: 'AETHER OS', body: '未来科技风移动系统概念壳\n三壳终端 · 全场景应用 · 双端可安装' },
    { title: '双端安装', body: 'Android：Chrome 菜单「安装应用」\niPhone：Safari 分享 → 添加到主屏幕' },
    { title: '真 Linux 接入', body: 'Android：Termux + proot-distro（Ubuntu / Kali）\niOS：iSH（Alpine）\nUI 与内核分层，通过本机桥接执行命令' }
  ];

  Aether.registerApp({
    id: 'office',
    name: '办公',
    sub: 'DOCS · SHEETS · SLIDES',
    icon: 'office',
    accent: '#ffcf6d',
    order: 70,
    render(root, api) {
      let tab = Aether.store.get('office.tab', 'doc');
      root.innerHTML = `
        <div class="seg office-tabs" id="officeTabs">
          <button data-tab="doc" class="${tab === 'doc' ? 'on' : ''}">文档</button>
          <button data-tab="sheet" class="${tab === 'sheet' ? 'on' : ''}">表格</button>
          <button data-tab="slides" class="${tab === 'slides' ? 'on' : ''}">演示</button>
        </div>
        <div id="officePane"></div>
      `;
      const pane = root.querySelector('#officePane');
      const tabsEl = root.querySelector('#officeTabs');

      api.addAction('download', '导出当前文件', () => {
        if (tab === 'doc') {
          const html = root.querySelector('#docEditor');
          Aether.download('aether-doc.html', '<!doctype html><meta charset="utf-8"><title>AETHER 文档</title><body style="max-width:720px;margin:40px auto;font-family:sans-serif;line-height:1.8">' + (html ? html.innerHTML : '') + '</body>', 'text/html');
        } else if (tab === 'sheet') {
          const rows = Aether.store.get('office.sheet', SHEET_DEFAULT);
          Aether.download('aether-sheet.csv', rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv');
        } else {
          const slides = Aether.store.get('office.slides', SLIDES_DEFAULT);
          Aether.download('aether-slides.json', JSON.stringify(slides, null, 2), 'application/json');
        }
        api.toast('已导出', 'ok');
      });

      function setTab(t) {
        tab = t;
        Aether.store.set('office.tab', t);
        [...tabsEl.children].forEach(b => b.classList.toggle('on', b.dataset.tab === t));
        if (t === 'doc') renderDoc();
        else if (t === 'sheet') renderSheet();
        else renderSlides();
      }
      tabsEl.addEventListener('click', e => {
        const b = e.target.closest('button[data-tab]');
        if (b) setTab(b.dataset.tab);
      });

      /* ----- 文档 ----- */
      function renderDoc() {
        let html = Aether.store.get('office.doc', DOC_DEFAULT);
        pane.innerHTML = `
          <div class="doc-toolbar" id="docToolbar">
            <button data-cmd="formatBlock" data-val="h1">H1</button>
            <button data-cmd="formatBlock" data-val="h2">H2</button>
            <button data-cmd="formatBlock" data-val="p">P</button>
            <span class="tb-sep"></span>
            <button data-cmd="bold"><b>B</b></button>
            <button data-cmd="italic"><i>I</i></button>
            <button data-cmd="underline"><u>U</u></button>
            <span class="tb-sep"></span>
            <button data-cmd="insertUnorderedList">• 列表</button>
            <button data-cmd="insertOrderedList">1. 列表</button>
            <button data-cmd="formatBlock" data-val="blockquote">引用</button>
            <span class="tb-sep"></span>
            <button data-cmd="undo">撤销</button>
            <button data-cmd="redo">重做</button>
          </div>
          <div class="doc-editor" id="docEditor" contenteditable="true"></div>
          <div class="doc-foot">
            <span id="docCount">0 字符</span>
            <span id="docSaved">本地自动保存</span>
          </div>
        `;
        const editor = pane.querySelector('#docEditor');
        const count = pane.querySelector('#docCount');
        const saved = pane.querySelector('#docSaved');
        editor.innerHTML = html;
        const updateCount = () => { count.textContent = editor.innerText.length + ' 字符'; };
        updateCount();
        const save = debounce(() => {
          Aether.store.set('office.doc', editor.innerHTML);
          saved.textContent = '已保存 · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
        }, 450);
        editor.addEventListener('input', () => { updateCount(); saved.textContent = '输入中…'; save(); });
        const toolbar = pane.querySelector('#docToolbar');
        toolbar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
        toolbar.addEventListener('click', e => {
          const b = e.target.closest('button[data-cmd]');
          if (!b) return;
          editor.focus();
          try {
            if (b.dataset.cmd === 'formatBlock') document.execCommand('formatBlock', false, b.dataset.val);
            else document.execCommand(b.dataset.cmd, false, null);
          } catch (err) { api.toast('浏览器不支持该编辑命令'); }
          updateCount();
          save();
        });
        api.setSub('文档 · 自动保存到本机');
      }

      /* ----- 表格 ----- */
      function renderSheet() {
        const rows = Aether.store.get('office.sheet', SHEET_DEFAULT).map(r => r.slice());
        while (rows.length < 7) rows.push(['', '', '', '', '']);
        pane.innerHTML = `
          <div class="sheet-wrap"><table class="sheet" id="sheetTable"></table></div>
          <div class="doc-foot"><span>自动计算数值列合计</span><span>CSV 可在右上角导出</span></div>
        `;
        const table = pane.querySelector('#sheetTable');
        const save = debounce(() => Aether.store.set('office.sheet', rows), 350);
        const numeric = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
        function renderTable() {
          table.innerHTML = '';
          const thead = document.createElement('thead');
          const hr = document.createElement('tr');
          const corner = document.createElement('th');
          corner.textContent = '#';
          hr.appendChild(corner);
          for (let c = 0; c < 5; c++) {
            const th = document.createElement('th');
            const inp = document.createElement('input');
            inp.value = rows[0][c] || '';
            inp.style.textAlign = 'center';
            inp.style.fontSize = '10px';
            inp.addEventListener('input', () => { rows[0][c] = inp.value; save(); });
            th.appendChild(inp);
            hr.appendChild(th);
          }
          thead.appendChild(hr);
          table.appendChild(thead);
          const tbody = document.createElement('tbody');
          for (let r = 1; r < 7; r++) {
            const tr = document.createElement('tr');
            const idx = document.createElement('td');
            idx.textContent = r;
            tr.appendChild(idx);
            for (let c = 0; c < 5; c++) {
              const td = document.createElement('td');
              const inp = document.createElement('input');
              inp.value = rows[r][c] === undefined ? '' : rows[r][c];
              inp.inputMode = c === 0 ? 'text' : 'decimal';
              inp.addEventListener('input', () => {
                rows[r][c] = inp.value;
                save();
                updateTotals();
              });
              td.appendChild(inp);
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
          }
          table.appendChild(tbody);
          const tfoot = document.createElement('tfoot');
          tfoot.innerHTML = `<tr class="sum" id="sumRow"></tr>`;
          table.appendChild(tfoot);
          updateTotals();
        }
        function updateTotals() {
          const sumRow = pane.querySelector('#sumRow');
          if (!sumRow) return;
          sumRow.innerHTML = '';
          const a = document.createElement('td'); a.textContent = 'Σ'; sumRow.appendChild(a);
          const b = document.createElement('td'); b.textContent = '合计'; sumRow.appendChild(b);
          for (let c = 1; c < 5; c++) {
            let total = 0;
            for (let r = 1; r < 7; r++) total += numeric(rows[r][c]);
            const td = document.createElement('td');
            td.textContent = String(Math.round(total * 100) / 100);
            sumRow.appendChild(td);
          }
        }
        renderTable();
        api.setSub('表格 · 自动合计 · 本地保存');
      }

      /* ----- 演示 ----- */
      function renderSlides() {
        let slides = Aether.store.get('office.slides', SLIDES_DEFAULT).map(s => ({ ...s }));
        const save = debounce(() => Aether.store.set('office.slides', slides), 300);
        pane.innerHTML = `
          <div class="slides-list" id="slidesList"></div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn ghost" id="addSlide" style="flex:1">＋ 新增幻灯片</button>
          </div>
          <p class="note" style="margin-top:10px">点击「预览」进入全屏演示。演示数据保存在本机。</p>
        `;
        const list = pane.querySelector('#slidesList');
        function renderList() {
          list.innerHTML = '';
          slides.forEach((s, i) => {
            const item = document.createElement('div');
            item.className = 'slide-item';
            item.innerHTML = `<span class="slide-no">${pad(i + 1)}</span><span class="si-main"><input class="si-title" value=""><input class="si-sub" value=""></span><button class="btn sm ghost">预览</button><button class="icon-btn" style="width:30px;height:30px" aria-label="删除">${Aether.icon('trash')}</button>`;
            const titleInp = item.querySelector('.si-title');
            const bodyInp = item.querySelector('.si-sub');
            titleInp.value = s.title; bodyInp.value = s.body.replace(/\n/g, ' ');
            titleInp.addEventListener('input', () => { slides[i].title = titleInp.value; save(); });
            bodyInp.addEventListener('input', () => { slides[i].body = bodyInp.value; save(); });
            item.querySelector('.btn').addEventListener('click', () => preview(i));
            item.querySelector('.icon-btn').addEventListener('click', () => {
              if (slides.length <= 1) { api.toast('至少保留一页'); return; }
              slides.splice(i, 1); save(); renderList();
            });
            list.appendChild(item);
          });
        }
        function preview(index) {
          let cur = index;
          const overlay = document.createElement('div');
          overlay.className = 'slide-modal';
          overlay.innerHTML = `
            <div class="pv-head"><span>PRESENTATION · 概念演示</span><button class="icon-btn" id="slideClose">${Aether.icon('close')}</button></div>
            <div class="slide-stage"><h1 id="stTitle"></h1><p id="stBody"></p></div>
            <div class="slide-nav">
              <button class="icon-btn" id="stPrev">${Aether.icon('left')}</button>
              <span class="counter" id="stCounter"></span>
              <button class="icon-btn" id="stNext">${Aether.icon('right')}</button>
            </div>
          `;
          root.appendChild(overlay);
          const draw = () => {
            const s = slides[cur];
            overlay.querySelector('#stTitle').textContent = s.title || '未命名';
            overlay.querySelector('#stBody').textContent = s.body || '';
            overlay.querySelector('#stCounter').textContent = (cur + 1) + ' / ' + slides.length;
          };
          overlay.querySelector('#slideClose').addEventListener('click', () => overlay.remove());
          overlay.querySelector('#stPrev').addEventListener('click', () => { cur = (cur - 1 + slides.length) % slides.length; draw(); });
          overlay.querySelector('#stNext').addEventListener('click', () => { cur = (cur + 1) % slides.length; draw(); });
          draw();
        }
        pane.querySelector('#addSlide').addEventListener('click', () => {
          slides.push({ title: '新幻灯片', body: '在这里输入内容' });
          save(); renderList();
        });
        renderList();
        api.setSub('演示 · 本地保存');
      }

      setTab(tab);
    }
  });

  /* ============================================================
     代码工作室
     ============================================================ */
  const CODE_SAMPLES = {
    js: [
      '// AETHER JS 沙盒 · 支持 console.log / error / warn',
      'const nums = [3, 1, 4, 1, 5, 9, 2, 6];',
      "console.log('sorted:', [...nums].sort((a, b) => a - b).join(', '));",
      "console.log('sum:', nums.reduce((a, b) => a + b, 0));",
      '',
      'function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }',
      "console.log('fib(12) =', fib(12));",
      '',
      '// 试试制造一个错误，查看堆栈：',
      '// JSON.parse("{bad json}");'
    ].join('\n'),
    py: [
      '# AETHER Python · 由 Pyodide 在浏览器中运行',
      'import math',
      'print("AETHER Python", "π =", round(math.pi, 6))',
      '',
      'for i in range(1, 6):',
      '    print(f"line {i} -> {i * i}")',
      '',
      '# 错误示例：print(1 / 0)'
    ].join('\n')
  };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('脚本加载失败：' + src));
      document.head.appendChild(s);
    });
  }

  Aether.registerApp({
    id: 'code',
    name: '代码工作室',
    sub: 'JAVASCRIPT · PYTHON · SANDBOX',
    icon: 'code',
    accent: '#a97bff',
    order: 80,
    flush: true,
    render(root, api) {
      root.classList.add('code-root');
      let lang = Aether.store.get('code.lang', 'js');
      const savedCode = {
        js: Aether.store.get('code.js', CODE_SAMPLES.js),
        py: Aether.store.get('code.py', CODE_SAMPLES.py)
      };
      let pyodide = null;
      let pyLoading = false;
      root.innerHTML = `
        <div class="code-top">
          <select id="langSel" class="ts-select" style="width:auto;flex:0 0 auto">
            <option value="js">JavaScript</option>
            <option value="py">Python</option>
          </select>
          <span class="term-meta mono" style="margin-left:auto;color:var(--dim-2);font-size:8px">SANDBOX</span>
          <button class="btn sm solid" id="runBtn">▶ 运行</button>
          <button class="btn sm ghost" id="clearBtn">清空</button>
        </div>
        <div class="code-editor-wrap">
          <div class="code-lines" id="codeLines"></div>
          <textarea class="code-editor" id="codeEditor" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
        </div>
        <div class="code-console">
          <div class="code-console-head"><span>OUTPUT · SANDBOX</span><span id="codeStatus">READY</span></div>
          <pre id="codeOut"></pre>
        </div>
      `;
      const sel = root.querySelector('#langSel');
      const editor = root.querySelector('#codeEditor');
      const lines = root.querySelector('#codeLines');
      const out = root.querySelector('#codeOut');
      const status = root.querySelector('#codeStatus');
      sel.value = lang;

      function log(text, cls = '') {
        const span = document.createElement('span');
        if (cls) span.className = cls;
        span.textContent = text + '\n';
        out.appendChild(span);
        out.scrollTop = out.scrollHeight;
      }
      function divider(label) {
        log('── ' + label + ' ──', 'dim');
      }
      function updateLines() {
        const n = editor.value.split('\n').length;
        lines.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
        lines.scrollTop = editor.scrollTop;
      }
      function saveCode() {
        Aether.store.set('code.lang', lang);
        Aether.store.set('code.' + lang, editor.value);
      }
      function loadLang(next) {
        saveCode();
        lang = next;
        sel.value = next;
        editor.value = savedCode[next] || CODE_SAMPLES[next];
        updateLines();
        api.setSub(next === 'js' ? 'JavaScript · 浏览器执行' : 'Python · Pyodide 运行时');
      }

      editor.addEventListener('input', () => { updateLines(); saveCode(); });
      editor.addEventListener('scroll', () => { lines.scrollTop = editor.scrollTop; });
      editor.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = editor.selectionStart, end = editor.selectionEnd;
          editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
          updateLines(); saveCode();
        }
      });
      sel.addEventListener('change', () => loadLang(sel.value));
      root.querySelector('#clearBtn').addEventListener('click', () => { out.textContent = ''; status.textContent = 'READY'; });

      async function getPyodide() {
        if (pyodide) return pyodide;
        if (pyLoading) { log('Pyodide 正在加载中，请稍候…', 'dim'); return null; }
        pyLoading = true;
        log('正在加载 Pyodide（首次运行需联网，约十几 MB）…', 'dim');
        await loadScript('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
        pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
        pyLoading = false;
        log('Pyodide 就绪。', 'dim');
        return pyodide;
      }

      async function run() {
        const code = editor.value;
        saveCode();
        if (!code.trim()) { api.toast('请先写点代码'); return; }
        const runBtn = root.querySelector('#runBtn');
        runBtn.disabled = true;
        status.textContent = 'RUNNING';
        divider(lang === 'js' ? 'JS RUN @ ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) : 'PYTHON RUN');
        const t0 = performance.now();
        try {
          if (lang === 'js') {
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const fakeConsole = {
              log: (...a) => log(a.map(x => {
                if (typeof x === 'object') { try { return JSON.stringify(x); } catch (e) { return String(x); } }
                return String(x);
              }).join(' ')),
              info: (...a) => fakeConsole.log(...a),
              warn: (...a) => log(a.map(String).join(' ') + '  [warn]', 'warn'),
              error: (...a) => log(a.map(String).join(' ') + '  [error]', 'err')
            };
            const fn = new AsyncFunction('console', code);
            await fn(fakeConsole);
            log('· 完成，用时 ' + Math.round(performance.now() - t0) + ' ms', 'dim');
            status.textContent = 'DONE';
          } else {
            const py = await getPyodide();
            if (!py) { status.textContent = 'LOADING'; return; }
            py.setStdout({ batched: s => log(s) });
            py.setStderr({ batched: s => log(s, 'err') });
            await py.runPythonAsync(code);
            log('· 完成，用时 ' + Math.round(performance.now() - t0) + ' ms', 'dim');
            status.textContent = 'DONE';
          }
        } catch (err) {
          log(String(err && err.stack || err), 'err');
          status.textContent = 'ERROR';
        } finally {
          runBtn.disabled = false;
        }
      }
      root.querySelector('#runBtn').addEventListener('click', run);

      editor.value = savedCode[lang] || CODE_SAMPLES[lang];
      updateLines();
      divider('SANDBOX READY');
      log('JS 直接执行；Python 由 Pyodide 加载。汇编/C 工具链请接入真 Linux 终端。', 'dim');
      log('调试：错误会显示堆栈；断点请使用浏览器开发者工具。', 'dim');
      api.setSub(lang === 'js' ? 'JavaScript · 浏览器执行' : 'Python · Pyodide 运行时');
    }
  });

  /* ============================================================
     地图
     ============================================================ */
  let leafletOnce = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    if (leafletOnce) return leafletOnce;
    leafletOnce = new Promise((resolve, reject) => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Leaflet 加载失败'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('Leaflet 加载超时')), 9000);
    });
    return leafletOnce;
  }

  Aether.registerApp({
    id: 'map',
    name: '地图',
    sub: 'GPS · OPENSTREETMAP',
    icon: 'map',
    accent: '#37e6c8',
    order: 90,
    flush: true,
    render(root, api) {
      root.classList.add('map-root');
      root.innerHTML = `
        <div id="leaflet-map"></div>
        <div class="map-hud map-top">
          <div style="flex:1">
            <div class="field"><span class="mono" style="font-size:9px;color:var(--dim-2)">⌕</span><input id="mapQuery" placeholder="搜索地点（Photon / OpenStreetMap）"></div>
            <div class="map-results hidden" id="mapResults"></div>
          </div>
          <button class="map-fab" id="mapSearchBtn" title="搜索">${Aether.icon('search')}</button>
        </div>
        <div class="map-hud map-bottom">
          <div class="map-coords" id="mapCoords">LAT --.----<br>LNG --.----<br>ZOOM --</div>
          <div class="map-actions">
            <button class="map-fab" id="mapLocate" title="定位">${Aether.icon('location')}</button>
            <button class="map-fab" id="mapReset" title="清除标记">${Aether.icon('refresh')}</button>
          </div>
        </div>
      `;
      const coordsEl = root.querySelector('#mapCoords');
      const resultsEl = root.querySelector('#mapResults');
      const queryEl = root.querySelector('#mapQuery');
      let map = null, userMarker = null, accCircle = null, targetMarker = null, routeLine = null;
      let userLL = null, abortCtl = null, cleaned = false;
      let last = Aether.store.get('map.view', [31.2304, 121.4737, 12]);

      function setCoords(lat, lng, zoom) {
        coordsEl.innerHTML = `LAT <b>${lat.toFixed(5)}</b><br>LNG <b>${lng.toFixed(5)}</b><br>ZOOM <b>${zoom}</b>`;
      }
      function fallback(msg) {
        const fb = document.createElement('div');
        fb.className = 'map-fallback';
        fb.innerHTML = `<div class="mf-orb">${Aether.icon('map')}</div><div class="note" style="max-width:280px">${msg}</div><p class="note">定位仍可用：点击右下角定位按钮。地图瓦片需要联网。</p>`;
        root.appendChild(fb);
      }

      (async () => {
        try {
          await loadLeaflet();
          if (cleaned) return;
          document.getElementById('leaflet-map').innerHTML = '';
          map = L.map('leaflet-map', { zoomControl: true, attributionControl: true, minZoom: 2, maxZoom: 19 });
          map.setView([last[0], last[1]], last[2]);
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19, maxNativeZoom: 16,
            attribution: 'Tiles &copy; Esri — Esri, DeLorme, NAVTEQ'
          }).addTo(map);
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19, maxNativeZoom: 16
          }).addTo(map);
          setCoords(last[0], last[1], last[2]);
          map.on('moveend', () => {
            const c = map.getCenter();
            setCoords(c.lat, c.lng, map.getZoom());
            Aether.store.set('map.view', [c.lat, c.lng, map.getZoom()]);
          });
          setTimeout(() => { if (map) map.invalidateSize(); }, 250);
        } catch (err) {
          leafletOnce = null;
          fallback('地图引擎未能加载（可能离线或被网络拦截）。' + String(err.message || err));
        }
      })();

      function locate() {
        const btn = root.querySelector('#mapLocate');
        btn.classList.add('on');
        const done = () => btn.classList.remove('on');
        if (!navigator.geolocation) { api.toast('浏览器不支持定位', 'err'); done(); return; }
        navigator.geolocation.getCurrentPosition(pos => {
          done();
          const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy || 50;
          userLL = [lat, lng];
          Aether.setGPS(lat, lng);
          if (map) {
            if (userMarker) userMarker.remove();
            if (accCircle) accCircle.remove();
            userMarker = L.marker([lat, lng], {
              icon: L.divIcon({ className: '', html: '<div class="user-marker"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
            }).addTo(map);
            accCircle = L.circle([lat, lng], { radius: Math.min(acc, 500), color: '#36e6ff', weight: 1, fillOpacity: .06 }).addTo(map);
            map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 1.2 });
            setCoords(lat, lng, Math.max(map.getZoom(), 15));
          } else {
            setCoords(lat, lng, 15);
          }
          api.toast('已获取真实定位（精度约 ' + Math.round(acc) + ' m）', 'ok');
        }, err => {
          done();
          api.toast('定位失败：' + (err.message || '请检查权限'), 'err');
        }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
      }
      root.querySelector('#mapLocate').addEventListener('click', locate);

      root.querySelector('#mapReset').addEventListener('click', () => {
        if (targetMarker) { targetMarker.remove(); targetMarker = null; }
        if (routeLine) { routeLine.remove(); routeLine = null; }
        if (userMarker) { userMarker.remove(); userMarker = null; }
        if (accCircle) { accCircle.remove(); accCircle = null; }
        resultsEl.classList.add('hidden');
        api.toast('已清除标记');
      });

      function haversine(a, b) {
        const R = 6371, rad = x => x * Math.PI / 180;
        const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      }

      async function photonSearch(q, signal) {
        const url = 'https://photon.komoot.io/api/?limit=6&q=' + encodeURIComponent(q);
        const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        return (data.features || []).map(f => {
          const p = f.properties || {};
          const label = [p.name, p.city, p.state, p.country].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' · ');
          return { label: label || '未命名地点', lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
        });
      }

      async function nominatimSearch(q, signal) {
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=zh-CN&q=' + encodeURIComponent(q);
        const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const list = await res.json();
        return list.map(r => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
      }

      async function search() {
        const q = queryEl.value.trim();
        if (!q) { api.toast('请输入地点'); return; }
        if (!map) { api.toast('地图引擎未加载，无法搜索'); return; }
        resultsEl.classList.remove('hidden');
        resultsEl.innerHTML = '<button disabled>搜索中…</button>';
        if (abortCtl) abortCtl.abort();
        abortCtl = new AbortController();
        const signal = abortCtl.signal;
        const timer = setTimeout(() => abortCtl.abort(), 12000);
        let list = [];
        try {
          list = await photonSearch(q, signal);
        } catch (err) {
          if (!signal.aborted) {
            try { list = await nominatimSearch(q, signal); } catch (e2) {}
          }
        }
        clearTimeout(timer);
        try {
          resultsEl.innerHTML = '';
          if (!list.length) { resultsEl.innerHTML = '<button disabled>没有结果</button>'; return; }
          list.forEach(r => {
            const b = document.createElement('button');
            b.textContent = r.label;
            b.addEventListener('click', () => {
              const lat = r.lat, lng = r.lon;
              if (targetMarker) targetMarker.remove();
              targetMarker = L.marker([lat, lng], {
                icon: L.divIcon({ className: '', html: '<div class="target-marker"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
              }).addTo(map);
              if (routeLine) { routeLine.remove(); routeLine = null; }
              if (userLL) {
                routeLine = L.polyline([userLL, [lat, lng]], { color: '#ff3bdc', weight: 2, dashArray: '6 8', opacity: .85 }).addTo(map);
                const km = haversine(userLL, [lat, lng]);
                api.toast('直线距离约 ' + km.toFixed(1) + ' km（非导航路线）', 'ok');
                map.fitBounds([userLL, [lat, lng]], { padding: [40, 40] });
              } else {
                map.flyTo([lat, lng], 15, { duration: 1.2 });
              }
              setCoords(lat, lng, 15);
              resultsEl.classList.add('hidden');
            });
            resultsEl.appendChild(b);
          });
        } catch (err) {
          resultsEl.innerHTML = '<button disabled>搜索失败（网络或服务限制）</button>';
        }
      }
      root.querySelector('#mapSearchBtn').addEventListener('click', search);
      queryEl.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
      api.onClose(() => {
        cleaned = true;
        if (abortCtl) abortCtl.abort();
        if (map) { try { map.remove(); } catch (e) {} map = null; }
      });
      api.setSub('GPS / OSM · 真实地图与定位');
    }
  });

  /* ============================================================
     媒体播放器
     ============================================================ */
  const TRACKS = [
    { name: 'Neon Rain', artist: 'AETHER SYNTH', base: 220, interval: 260, scale: [0, 3, 5, 7, 10, 12, 15] },
    { name: 'Deep Orbit', artist: 'AETHER SYNTH', base: 164.81, interval: 330, scale: [0, 2, 5, 7, 9, 12, 14] },
    { name: 'Grid Runner', artist: 'AETHER SYNTH', base: 261.63, interval: 210, scale: [0, 4, 7, 9, 12, 16, 19] }
  ];

  Aether.registerApp({
    id: 'media',
    name: '媒体',
    sub: 'MUSIC · VIDEO PLAYER',
    icon: 'media',
    accent: '#ff6ad5',
    order: 110,
    render(root, api) {
      root.classList.add('media-root');
      let tab = 'music';
      let trackIdx = 0;
      let playing = false;
      let audioCtx = null, master = null, delayNode = null, seqTimer = null, step = 0;
      const urls = [];
      let audioEl = null, videoEl = null;
      let volume = 0.5;

      root.innerHTML = `
        <div class="seg" id="mediaTabs">
          <button data-tab="music" class="on">音乐</button>
          <button data-tab="video">视频</button>
        </div>
        <div id="mediaPane"></div>
      `;
      const pane = root.querySelector('#mediaPane');
      const tabs = root.querySelector('#mediaTabs');

      function stopSynth() {
        playing = false;
        if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
        updatePlayerUI();
      }
      function ensureAudio() {
        if (audioCtx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
        master = audioCtx.createGain();
        master.gain.value = volume * 0.35;
        delayNode = audioCtx.createDelay(0.6);
        const fb = audioCtx.createGain();
        fb.gain.value = 0.28;
        delayNode.connect(fb); fb.connect(delayNode);
        master.connect(audioCtx.destination);
        master.connect(delayNode);
        delayNode.connect(audioCtx.destination);
      }
      function playStep() {
        if (!audioCtx || !playing) return;
        const t = TRACKS[trackIdx];
        const offset = t.scale[step % t.scale.length] + (step % 11 === 0 ? 12 : 0);
        const freq = t.base * Math.pow(2, offset / 12);
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.32, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        osc.connect(gain); gain.connect(master);
        osc.start(now); osc.stop(now + 0.55);
        step++;
      }
      function playSynth() {
        ensureAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        playing = true;
        step = 0;
        if (seqTimer) clearInterval(seqTimer);
        seqTimer = setInterval(playStep, TRACKS[trackIdx].interval);
        updatePlayerUI();
      }
      function updatePlayerUI() {
        const art = root.querySelector('#albumArt');
        const viz = root.querySelector('#viz');
        const btn = root.querySelector('#playBtn');
        if (!art) return;
        art.classList.toggle('spin', playing);
        viz.classList.toggle('on', playing);
        btn.innerHTML = Aether.icon(playing ? 'pause' : 'play');
        btn.setAttribute('aria-label', playing ? '暂停' : '播放');
        root.querySelectorAll('.track-row').forEach((r, i) => r.classList.toggle('on', i === trackIdx));
      }
      function renderMusic() {
        const t = TRACKS[trackIdx];
        pane.innerHTML = `
          <div class="player-card">
            <div class="album-art" id="albumArt">${Aether.icon('music')}</div>
            <div class="track-title" id="trackName">${t.name}</div>
            <div class="track-sub">${t.artist} · 本地合成音频</div>
            <div class="visualizer" id="viz">${'<i></i>'.repeat(22)}</div>
            <div class="player-controls">
              <button class="pc-btn" id="prevBtn" aria-label="上一首">${Aether.icon('prev')}</button>
              <button class="pc-btn main" id="playBtn" aria-label="播放">${Aether.icon('play')}</button>
              <button class="pc-btn" id="nextBtn" aria-label="下一首">${Aether.icon('next')}</button>
            </div>
            <div class="vol-row">${Aether.icon('volume')}<input type="range" id="vol" min="0" max="100" value="${Math.round(volume * 100)}"></div>
          </div>
          <div class="track-list" id="trackList"></div>
          <div class="card" style="margin-top:12px">
            <div class="sheet-title" style="margin-top:0">本地音频</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn ghost sm" id="pickAudio">导入音频文件</button>
              <span class="note" id="audioName" style="align-self:center">支持 mp3 / m4a / wav / ogg</span>
            </div>
            <input type="file" id="audioFile" accept="audio/*" class="hidden">
            <div id="audioWrap" style="margin-top:10px"></div>
          </div>
          <p class="note" style="margin-top:12px">三段音乐由浏览器 WebAudio 实时合成，并非真实曲目；导入的本地文件可真实播放，且不会上传。</p>
        `;
        const list = pane.querySelector('#trackList');
        TRACKS.forEach((tr, i) => {
          const row = document.createElement('div');
          row.className = 'track-row';
          row.innerHTML = `<span class="tr-ico">${Aether.icon('music')}</span><span class="tr-main"><strong>${tr.name}</strong><span>${tr.artist}</span></span><span class="tag">合成</span>`;
          row.addEventListener('click', () => {
            trackIdx = i;
            if (playing) playSynth(); else { updatePlayerUI(); }
            root.querySelector('#trackName').textContent = tr.name;
          });
          list.appendChild(row);
        });
        pane.querySelector('#playBtn').addEventListener('click', () => { playing ? stopSynth() : playSynth(); });
        pane.querySelector('#prevBtn').addEventListener('click', () => { trackIdx = (trackIdx - 1 + TRACKS.length) % TRACKS.length; renderMusicRefresh(); });
        pane.querySelector('#nextBtn').addEventListener('click', () => { trackIdx = (trackIdx + 1) % TRACKS.length; renderMusicRefresh(); });
        pane.querySelector('#vol').addEventListener('input', e => {
          volume = parseInt(e.target.value, 10) / 100;
          if (master) master.gain.value = volume * 0.35;
        });
        pane.querySelector('#pickAudio').addEventListener('click', () => pane.querySelector('#audioFile').click());
        pane.querySelector('#audioFile').addEventListener('change', e => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (audioEl) { audioEl.pause(); audioEl.remove(); }
          const url = URL.createObjectURL(file);
          urls.push(url);
          stopSynth();
          audioEl = new Audio(url);
          audioEl.controls = true;
          audioEl.style.width = '100%';
          audioEl.autoplay = true;
          pane.querySelector('#audioWrap').innerHTML = '';
          pane.querySelector('#audioWrap').appendChild(audioEl);
          pane.querySelector('#audioName').textContent = file.name + ' · ' + Aether.fmtBytes(file.size);
          api.toast('已载入本地音频', 'ok');
        });
        updatePlayerUI();
        api.setSub('音乐 · WebAudio 合成 + 本地文件');
      }
      function renderMusicRefresh() {
        const wasPlaying = playing;
        if (playing) stopSynth();
        renderMusic();
        if (wasPlaying) playSynth();
      }

      function renderVideo() {
        pane.innerHTML = `
          <div class="video-stage" id="videoStage"><div class="video-empty">未载入视频\n支持 mp4 / webm / mov（系统解码能力决定）</div></div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn ghost sm" id="pickVideo">导入本地视频</button>
            <span class="note" id="videoName" style="align-self:center">视频不会上传</span>
          </div>
          <input type="file" id="videoFile" accept="video/*" class="hidden">
          <p class="note" style="margin-top:12px">浏览器只支持系统可解码的封装与编码；移动端 Safari 对部分格式支持有限。</p>
        `;
        pane.querySelector('#pickVideo').addEventListener('click', () => pane.querySelector('#videoFile').click());
        pane.querySelector('#videoFile').addEventListener('change', e => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          if (videoEl) { videoEl.pause(); }
          const url = URL.createObjectURL(file);
          urls.push(url);
          const stage = pane.querySelector('#videoStage');
          stage.innerHTML = '';
          videoEl = document.createElement('video');
          videoEl.src = url; videoEl.controls = true; videoEl.playsInline = true; videoEl.autoplay = true;
          stage.appendChild(videoEl);
          pane.querySelector('#videoName').textContent = file.name + ' · ' + Aether.fmtBytes(file.size);
          api.toast('已载入本地视频', 'ok');
        });
        if (videoEl) {
          const stage = pane.querySelector('#videoStage');
          stage.innerHTML = '';
          stage.appendChild(videoEl);
        }
        api.setSub('视频 · 本地播放');
      }

      tabs.addEventListener('click', e => {
        const b = e.target.closest('button[data-tab]');
        if (!b) return;
        tab = b.dataset.tab;
        [...tabs.children].forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
        stopSynth();
        if (tab === 'music') renderMusic();
        else renderVideo();
      });

      renderMusic();
      api.onClose(() => {
        if (seqTimer) clearInterval(seqTimer);
        if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
        if (audioEl) audioEl.pause();
        if (videoEl) videoEl.pause();
        urls.forEach(u => URL.revokeObjectURL(u));
      });
    }
  });

  /* ============================================================
     相册
     ============================================================ */
  let artCache = null;
  function generateArt() {
    if (artCache) return artCache;
    const palettes = [
      ['#04121a', '#36e6ff', '#8a5bff'], ['#0b0514', '#ff3bdc', '#6f7dff'],
      ['#120904', '#ffb02e', '#ff5a3c'], ['#020d08', '#9dff6a', '#21d4c2'],
      ['#03050f', '#5c8dff', '#b06aff'], ['#0a0410', '#ff6ad5', '#ffcf6d']
    ];
    const names = ['霓虹沙丘', '轨道电梯', '午夜频道', '像素雨', '深空信标', '网格黎明'];
    artCache = palettes.map((p, i) => {
      const c = document.createElement('canvas');
      c.width = c.height = 520;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 520, 520);
      g.addColorStop(0, p[0]); g.addColorStop(.55, p[1]); g.addColorStop(1, p[2]);
      x.fillStyle = g; x.fillRect(0, 0, 520, 520);
      x.globalAlpha = .22;
      x.fillStyle = '#000'; x.fillRect(0, 300, 520, 220);
      x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1.2;
      const cx = 260 + Math.sin(i * 1.7) * 90, cy = 220 + Math.cos(i * 1.3) * 70;
      for (let r = 40; r < 250; r += 34) {
        x.globalAlpha = .28;
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
      }
      x.globalAlpha = .9;
      x.beginPath(); x.arc(cx, cy, 46, 0, Math.PI * 2);
      x.fillStyle = 'rgba(4,10,16,.6)'; x.fill();
      x.lineWidth = 2; x.strokeStyle = p[1]; x.stroke();
      x.globalAlpha = .5;
      for (let k = 0; k < 26; k++) {
        const yy = 320 + k * 8;
        x.beginPath(); x.moveTo(0, yy); x.lineTo(520, yy);
        x.strokeStyle = 'rgba(255,255,255,.15)'; x.stroke();
      }
      for (let k = 0; k < 6; k++) {
        x.beginPath();
        x.moveTo(0, 380 + k * 22);
        x.lineTo(520, 330 + k * 26);
        x.strokeStyle = 'rgba(255,255,255,.2)';
        x.stroke();
      }
      return { src: c.toDataURL('image/png'), name: names[i] + ' · ' + String(i + 1).padStart(2, '0') };
    });
    return artCache;
  }

  Aether.registerApp({
    id: 'photos',
    name: '相册',
    sub: 'LOCAL IMAGES · GENERATED ART',
    icon: 'photos',
    accent: '#ffb02e',
    order: 120,
    render(root, api) {
      let picked = [];
      const pickedUrls = [];
      root.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <span class="note">内置 6 幅程序生成艺术；可导入本地图片查看。</span>
          <button class="btn ghost sm" id="pickImages">导入图片</button>
          <input type="file" id="imageFile" accept="image/*" multiple class="hidden">
        </div>
        <div class="photo-grid" id="photoGrid"></div>
        <p class="note" style="margin-top:12px">图片只在本地内存中打开，不上传。导入的图片关闭应用后不会保留。</p>
      `;
      const grid = root.querySelector('#photoGrid');
      let items = [];

      function renderGrid() {
        grid.innerHTML = '';
        items.forEach((it, idx) => {
          const cell = document.createElement('div');
          cell.className = 'photo-cell';
          const img = document.createElement('img');
          img.src = it.src; img.alt = it.name; img.loading = 'lazy';
          const label = document.createElement('span');
          label.textContent = it.name;
          cell.append(img, label);
          cell.addEventListener('click', () => openViewer(idx));
          grid.appendChild(cell);
        });
      }

      function openViewer(index) {
        let cur = index;
        root.scrollTop = 0;
        const overlay = document.createElement('div');
        overlay.className = 'photo-viewer';
        overlay.innerHTML = `
          <div class="pv-head"><span id="pvName"></span><button class="icon-btn" id="pvClose">${Aether.icon('close')}</button></div>
          <div class="pv-stage"><img id="pvImg" alt=""></div>
          <div class="pv-nav">
            <button id="pvPrev">${Aether.icon('left')}</button>
            <span class="mono" id="pvCount" style="font-size:9px;color:var(--dim)"></span>
            <button id="pvNext">${Aether.icon('right')}</button>
          </div>
        `;
        root.style.overflow = 'hidden';
        root.appendChild(overlay);
        const img = overlay.querySelector('#pvImg');
        const name = overlay.querySelector('#pvName');
        const count = overlay.querySelector('#pvCount');
        const draw = () => {
          img.src = items[cur].src;
          name.textContent = items[cur].name;
          count.textContent = (cur + 1) + ' / ' + items.length;
        };
        const close = () => { overlay.remove(); root.style.overflow = ''; };
        overlay.querySelector('#pvClose').addEventListener('click', close);
        overlay.querySelector('#pvPrev').addEventListener('click', () => { cur = (cur - 1 + items.length) % items.length; draw(); });
        overlay.querySelector('#pvNext').addEventListener('click', () => { cur = (cur + 1) % items.length; draw(); });
        draw();
      }

      root.querySelector('#pickImages').addEventListener('click', () => root.querySelector('#imageFile').click());
      root.querySelector('#imageFile').addEventListener('change', e => {
        const files = [...(e.target.files || [])];
        files.forEach(file => {
          if (!file.type.startsWith('image/')) return;
          const url = URL.createObjectURL(file);
          pickedUrls.push(url);
          picked.push({ src: url, name: file.name });
        });
        items = generateArt().concat(picked);
        renderGrid();
        if (files.length) api.toast('已导入 ' + files.length + ' 张图片', 'ok');
      });

      items = generateArt().concat(picked);
      renderGrid();
      api.onClose(() => {
        pickedUrls.forEach(u => URL.revokeObjectURL(u));
        root.style.overflow = '';
      });
      api.setSub('本地图片 · 不上传');
    }
  });

  /* ============================================================
     备忘录
     ============================================================ */
  const NOTES_SEED = [
    { id: 'n1', title: '欢迎使用 AETHER 备忘录', body: '这是自动保存的本地笔记。\n\n· 点击右下角新建\n· 支持搜索\n· 数据只保存在当前浏览器 localStorage', updated: Date.now() - 1800e3 }
  ];

  Aether.registerApp({
    id: 'notes',
    name: '备忘录',
    sub: 'NOTES · LOCAL STORAGE',
    icon: 'notes',
    accent: '#9dff6a',
    order: 100,
    flush: true,
    render(root, api) {
      let notes = Aether.store.get('notes.items', NOTES_SEED);
      let editing = null;
      let saveTimer = null;
      root.classList.add('notes-root');
      root.innerHTML = `
        <div class="notes-main" id="notesMain">
          <div class="notes-toolbar">
            <div class="field">${Aether.icon('search')}<input id="noteSearch" placeholder="搜索备忘录"></div>
            <button class="btn solid sm" id="noteNew">＋ 新建</button>
          </div>
          <div class="notes-scroll" id="noteList"></div>
        </div>
        <div class="note-editor hidden" id="noteEditor">
          <div class="note-editor-head">
            <button class="icon-btn" id="noteBack">${Aether.icon('left')}</button>
            <span class="mono" style="font-size:9px;color:var(--dim-2);flex:1" id="noteStatus">自动保存</span>
            <button class="icon-btn" id="noteDelete">${Aether.icon('trash')}</button>
          </div>
          <input class="note-title-input" id="noteTitle" placeholder="标题">
          <textarea class="note-body-input" id="noteBody" placeholder="开始记录…"></textarea>
        </div>
      `;
      const listEl = root.querySelector('#noteList');
      const editorEl = root.querySelector('#noteEditor');
      const titleEl = root.querySelector('#noteTitle');
      const bodyEl = root.querySelector('#noteBody');
      const statusEl = root.querySelector('#noteStatus');
      const searchEl = root.querySelector('#noteSearch');
      const save = () => Aether.store.set('notes.items', notes);
      const sorted = () => [...notes].sort((a, b) => b.updated - a.updated);

      function renderList() {
        const q = searchEl.value.trim().toLowerCase();
        listEl.innerHTML = '';
        const filtered = sorted().filter(n => !q || (n.title + ' ' + n.body).toLowerCase().includes(q));
        if (!filtered.length) { listEl.innerHTML = '<div class="empty">' + (q ? '没有匹配的备忘录' : '暂无备忘录') + '</div>'; return; }
        filtered.forEach(n => {
          const card = document.createElement('button');
          card.className = 'note-card';
          const h = document.createElement('h3'); h.textContent = n.title || '无标题';
          const p = document.createElement('p'); p.textContent = n.body || '（空）';
          const t = document.createElement('time'); t.textContent = fmtDate(n.updated);
          card.append(h, p, t);
          card.addEventListener('click', () => openEditor(n));
          listEl.appendChild(card);
        });
      }

      function openEditor(n) {
        editing = n;
        titleEl.value = n.title; bodyEl.value = n.body;
        editorEl.classList.remove('hidden');
        statusEl.textContent = '自动保存';
        setTimeout(() => titleEl.focus(), 100);
      }
      function closeEditor() {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        if (editing) {
          editing.title = titleEl.value.trim();
          editing.body = bodyEl.value;
          editing.updated = Date.now();
          save();
        }
        editing = null;
        editorEl.classList.add('hidden');
        renderList();
      }
      function touchSave() {
        if (!editing) return;
        statusEl.textContent = '保存中…';
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          editing.title = titleEl.value.trim();
          editing.body = bodyEl.value;
          editing.updated = Date.now();
          save();
          statusEl.textContent = '已保存 · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false });
          saveTimer = null;
        }, 400);
      }
      titleEl.addEventListener('input', touchSave);
      bodyEl.addEventListener('input', touchSave);
      root.querySelector('#noteBack').addEventListener('click', closeEditor);
      root.querySelector('#noteNew').addEventListener('click', () => {
        const n = { id: 'n' + Date.now(), title: '', body: '', updated: Date.now() };
        notes.unshift(n); save(); renderList(); openEditor(n);
      });
      root.querySelector('#noteDelete').addEventListener('click', () => {
        if (!editing) return;
        if (!confirm('删除这条备忘录？')) return;
        notes = notes.filter(n => n.id !== editing.id);
        save();
        editing = null;
        editorEl.classList.add('hidden');
        renderList();
        api.toast('已删除');
      });
      searchEl.addEventListener('input', renderList);
      renderList();
      api.onClose(closeEditor);
      api.setSub('本地保存 · 不上传');
    }
  });

  /* ============================================================
     浏览器
     ============================================================ */
  const BOOKMARKS = [
    ['Bing', 'https://www.bing.com'],
    ['Wikipedia', 'https://zh.wikipedia.org'],
    ['GitHub', 'https://github.com'],
    ['MDN', 'https://developer.mozilla.org/zh-CN/'],
    ['哔哩哔哩', 'https://www.bilibili.com'],
    ['百度', 'https://www.baidu.com']
  ];

  Aether.registerApp({
    id: 'browser',
    name: '浏览器',
    sub: 'EMBEDDED WEB VIEW',
    icon: 'browser',
    accent: '#6f9dff',
    order: 60,
    flush: true,
    render(root, api) {
      root.classList.add('browser-root');
      let currentUrl = '';
      root.innerHTML = `
        <div class="browser-bar">
          <div class="field">${Aether.icon('search')}<input id="brUrl" placeholder="输入网址或搜索内容" autocapitalize="off" spellcheck="false" inputmode="url"></div>
          <button class="icon-btn" id="brGo" aria-label="前往">${Aether.icon('right')}</button>
        </div>
        <div class="browser-frame">
          <div class="browser-start" id="brStart">
            <h3>QUICK ACCESS</h3>
            <div class="bookmark-grid" id="brBookmarks"></div>
            <div class="browser-note">
              概念说明：这是嵌入网页的视图，不是完整浏览器内核。<br>
              许多网站（如 Google、GitHub 登录页）通过 X-Frame-Options / CSP 禁止被嵌入，出现空白属正常。<br>
              右上角按钮可在系统浏览器中打开当前页面。<br>
              不提供广告拦截、密码管理或下载管理器。
            </div>
          </div>
          <iframe id="brFrame" class="hidden" sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" title="网页视图"></iframe>
        </div>
      `;
      const input = root.querySelector('#brUrl');
      const frame = root.querySelector('#brFrame');
      const start = root.querySelector('#brStart');
      const bm = root.querySelector('#brBookmarks');

      BOOKMARKS.forEach(([name, url]) => {
        const b = document.createElement('button');
        b.className = 'bookmark';
        b.innerHTML = '<span class="bm-dot"></span>' + name;
        b.addEventListener('click', () => navigate(url));
        bm.appendChild(b);
      });

      function normalize(v) {
        v = v.trim();
        if (!v) return '';
        if (/^https?:\/\//i.test(v)) return v;
        if (/^[\w-]+(\.[\w-]+)+/.test(v)) return 'https://' + v;
        return 'https://www.bing.com/search?q=' + encodeURIComponent(v);
      }
      function navigate(v) {
        const url = normalize(v);
        if (!url) return;
        currentUrl = url;
        input.value = url;
        start.classList.add('hidden');
        frame.classList.remove('hidden');
        frame.src = url;
        api.setSub(url.length > 52 ? url.slice(0, 52) + '…' : url);
        setTimeout(() => api.toast('若页面空白，该站点禁止嵌入；点右上角「新窗口打开」'), 2400);
      }
      root.querySelector('#brGo').addEventListener('click', () => navigate(input.value));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(input.value); });
      api.addAction('external', '在系统浏览器中打开', () => {
        if (!currentUrl) { api.toast('尚未打开网页'); return; }
        window.open(currentUrl, '_blank', 'noopener');
      });
      api.setSub('网页视图 · 非完整浏览器');
    }
  });

  /* ============================================================
     设置
     ============================================================ */
  Aether.registerApp({
    id: 'settings',
    name: '设置',
    sub: 'SYSTEM & DEPLOYMENT',
    icon: 'settings',
    accent: '#8aa2b8',
    order: 200,
    render(root, api) {
      const settings = Aether.settings;
      const bridge = Aether.store.get('bridge', null);
      const androidCmds = [
        'pkg update -y && pkg install -y python proot-distro',
        'proot-distro install ubuntu',
        'proot-distro install kali',
        'cd ~/aether-os',
        'python3 bridge/server.py'
      ].join('\n');
      const iosCmds = [
        'apk update && apk add python3',
        'cd ~/aether-os',
        'python3 bridge/server.py'
      ].join('\n');

      root.innerHTML = `
        <div class="sheet-title">网络与连接 <span class="tag">概念开关</span></div>
        <div class="card">
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('wifi')}</span>
            <div class="sr-main"><strong>Wi-Fi</strong><span id="setWifiSub">概念开关，不控制真实射频；实际网络以浏览器为准</span></div>
            <span class="switch ${settings.wifi ? 'on' : ''}" data-toggle="wifi"></span>
          </div>
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('signal')}</span>
            <div class="sr-main"><strong>数据网络</strong><span>概念开关；真实连接由系统控制</span></div>
            <span class="switch ${settings.data ? 'on' : ''}" data-toggle="data"></span>
          </div>
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('gps')}</span>
            <div class="sr-main"><strong>真实连接状态</strong><span id="setOnline"></span></div>
            <span class="tag acc" id="setConnType">--</span>
          </div>
        </div>

        <div class="sheet-title">外观与主题</div>
        <div class="card">
          <div class="settings-row" style="align-items:flex-start">
            <span class="sr-ico">${Aether.icon('cpu')}</span>
            <div class="sr-main"><strong>主题色</strong><span>影响强调色、按钮与光效</span>
              <div class="acc-grid" id="accGrid">
                ${[['cyan', '#36e6ff'], ['magenta', '#ff3bdc'], ['lime', '#9dff6a'], ['amber', '#ffb02e']].map(([k, c]) => `<button class="acc-dot ${settings.accent === k ? 'on' : ''}" data-accent="${k}" style="background:${c};color:${c}" aria-label="${k}"></button>`).join('')}
              </div>
            </div>
          </div>
          <div class="settings-row" style="align-items:flex-start">
            <span class="sr-ico">${Aether.icon('photos')}</span>
            <div class="sr-main"><strong>壁纸</strong><span>四套未来风配色</span>
              <div class="wall-grid" id="wallGrid">
                ${[['aurora', 'AURORA'], ['void', 'VOID'], ['ember', 'EMBER'], ['matrix', 'MATRIX']].map(([k, n]) => `<button class="wall-opt wall-${k} ${settings.wall === k ? 'on' : ''}" data-wall="${k}"><i></i><span>${n}</span></button>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="sheet-title">真 Linux 接入 <span class="tag acc">BRIDGE</span></div>
        <div class="card">
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('terminal')}</span>
            <div class="sr-main"><strong>桥接服务</strong><span id="bridgeStatus">检测中…</span></div>
            <span class="tag" id="bridgeTag">--</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
            <button class="btn solid sm" id="openTerm">打开终端</button>
            <button class="btn ghost sm" id="recheckBridge">重新检测</button>
          </div>
          <details class="deploy-box" open>
            <summary>Android · Termux（真 Ubuntu / Kali）</summary>
            <p class="note">在 Phone 上装 Termux（建议 F-Droid 版），把本项目文件夹放到 Termux 主目录（例如 ~/aether-os），然后执行：</p>
            <pre class="deploy-code" id="androidCode">${androidCmds.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
            <button class="btn ghost sm" data-copy="${androidCmds.replace(/"/g, '&quot;')}">复制 Android 命令</button>
            <p class="note">启动后终端打印访问地址与一次性令牌。用 Chrome 打开 http://127.0.0.1:8787，安装为应用，再在终端里点「真 Linux」粘贴令牌。</p>
          </details>
          <details class="deploy-box">
            <summary>iPhone / iPad · iSH（Alpine）</summary>
            <p class="note">iOS 无 proot，但 iSH 提供真实的 Alpine Linux 用户空间（x86 模拟，性能有限）。在 iSH 中：</p>
            <pre class="deploy-code" id="iosCode">${iosCmds.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>
            <button class="btn ghost sm" data-copy="${iosCmds.replace(/"/g, '&quot;')}">复制 iSH 命令</button>
            <p class="note">Safari 打开 http://127.0.0.1:8787。注意：iOS 会挂起后台应用，iSH 与 Safari 不能稳定同时活跃；iPad 分屏体验最好，iPhone 建议直接用 iSH 自带终端。iOS 上没有 Ubuntu/Kali/deepin 的 proot 方案。</p>
          </details>
          <p class="note">deepin：proot-distro 无官方 deepin 插件，只能自备 rootfs 导入或用 Deepin 桌面组件替代。概念系统不再把它列为开箱即用项。</p>
        </div>

        <div class="sheet-title">安装应用</div>
        <div class="card">
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('install')}</span>
            <div class="sr-main"><strong>AETHER OS</strong><span id="installSub">${Aether.isStandalone() ? '已作为独立应用运行' : '安装后可全屏启动、离线打开界面'}</span></div>
            <button class="btn solid sm" id="installBtn">安装</button>
          </div>
          <p class="note">Android：Chrome 菜单 →「安装应用 / 添加到主屏幕」。iPhone：Safari 分享按钮 →「添加到主屏幕」。iOS 的 PWA 不支持推送与后台服务。</p>
        </div>

        <div class="sheet-title">系统信息</div>
        <div class="card">
          <div class="settings-row"><span class="sr-ico">${Aether.icon('shield')}</span><div class="sr-main"><strong>AETHER OS ${Aether.version}</strong><span>构建 ${Aether.build} · 概念系统</span></div><span class="tag">PWA</span></div>
          <div class="settings-row"><span class="sr-ico">${Aether.icon('cpu')}</span><div class="sr-main"><strong>运行环境</strong><span class="mono" style="font-size:9px;word-break:break-all" id="setUA"></span></div></div>
          <div class="settings-row"><span class="sr-ico">${Aether.icon('battery')}</span><div class="sr-main"><strong>显示与设备</strong><span id="setDevice"></span></div></div>
        </div>

        <div class="sheet-title">存储与数据</div>
        <div class="card">
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('trash')}</span>
            <div class="sr-main"><strong>本地数据</strong><span id="storageInfo"></span></div>
            <button class="btn danger sm" id="clearData">清除</button>
          </div>
        </div>

        <div class="sheet-title">能力边界 <span class="tag">透明说明</span></div>
        <div class="card about-box">
          <p><b>真实能力：</b>PWA 安装、JS/Python 运行、真实地图与定位、本地音视频与图片、备忘录、文件导出、Termux/iSH 真 Linux 桥接（需自行部署）。</p>
          <p><b>演示模拟：</b>电话、短信、微信、QQ、Wi-Fi/数据开关、信号与电量装饰、启动动画。</p>
          <p><b>不存在的能力：</b>在 iPhone 上安装自研内核或运行 App Store 之外的系统；让安卓免解锁刷入通用 ROM；在本系统内运行真实微信/QQ 客户端。</p>
          <p style="margin-top:8px">AETHER OS 是概念界面，不是手机固件。它不修改引导、基带或系统分区。</p>
        </div>
      `;

      root.querySelector('#setOnline').textContent = navigator.onLine ? '在线（浏览器真实状态）' : '离线（浏览器真实状态）';
      const conn = navigator.connection;
      root.querySelector('#setConnType').textContent = conn && conn.effectiveType ? conn.effectiveType.toUpperCase() : (navigator.onLine ? 'ONLINE' : 'OFFLINE');
      if (!navigator.onLine) root.querySelector('#setConnType').style.color = 'var(--err)';
      root.querySelector('#setUA').textContent = navigator.userAgent;
      root.querySelector('#setDevice').textContent = `${screen.width} × ${screen.height} @${devicePixelRatio}x · ${navigator.hardwareConcurrency || '?'} 线程 · ${navigator.language}`;
      root.querySelector('#storageInfo').textContent = '已用 ' + Aether.fmtBytes(Aether.store.usage()) + ' · localStorage';

      root.addEventListener('click', async e => {
        const sw = e.target.closest('[data-toggle]');
        if (sw) {
          const key = sw.dataset.toggle;
          Aether.settings[key] = !Aether.settings[key];
          Aether.store.set('settings', Aether.settings);
          sw.classList.toggle('on', Aether.settings[key]);
          Aether.applyNetworkUI();
          api.toast((key === 'wifi' ? 'Wi-Fi' : '数据网络') + (Aether.settings[key] ? ' 概念开关已开启' : ' 概念开关已关闭'));
          return;
        }
        const acc = e.target.closest('[data-accent]');
        if (acc) {
          Aether.settings.accent = acc.dataset.accent;
          Aether.store.set('settings', Aether.settings);
          document.body.dataset.accent = acc.dataset.accent;
          root.querySelectorAll('.acc-dot').forEach(d => d.classList.toggle('on', d === acc));
          return;
        }
        const wall = e.target.closest('[data-wall]');
        if (wall) {
          Aether.settings.wall = wall.dataset.wall;
          Aether.store.set('settings', Aether.settings);
          document.body.dataset.wall = wall.dataset.wall;
          root.querySelectorAll('.wall-opt').forEach(d => d.classList.toggle('on', d === wall));
          return;
        }
        const cp = e.target.closest('[data-copy]');
        if (cp) { copy(cp.dataset.copy); return; }
      });

      root.querySelector('#openTerm').addEventListener('click', () => Aether.openApp('terminal'));
      root.querySelector('#installBtn').addEventListener('click', () => Aether.install());
      root.querySelector('#clearData').addEventListener('click', () => {
        if (!confirm('清除全部 AETHER 本地数据并重启界面？此操作不可恢复。')) return;
        try {
          const keys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('aether.')) keys.push(k);
          }
          keys.forEach(k => localStorage.removeItem(k));
        } catch (e) {}
        location.reload();
      });

      async function checkBridge() {
        const statusEl = root.querySelector('#bridgeStatus');
        const tagEl = root.querySelector('#bridgeTag');
        if (!location.protocol.startsWith('http')) {
          statusEl.textContent = '静态文件模式：未检测桥接。请通过本地服务器打开。';
          tagEl.textContent = 'STATIC';
          return;
        }
        const endpoint = (bridge && bridge.endpoint) || location.origin;
        statusEl.textContent = '正在检测 ' + endpoint + ' …';
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 5000);
          const headers = {};
          if (bridge && bridge.token) headers['x-aether-token'] = bridge.token;
          const res = await fetch(endpoint + '/api/health', { headers, signal: ctl.signal });
          clearTimeout(timer);
          const data = await res.json();
          if (data && data.ok && data.bridge) {
            statusEl.textContent = `在线 · ${data.platform || data.bridge}${Array.isArray(data.installed) && data.installed.length ? ' · ' + data.installed.join(' / ') : ' · 未安装发行版'}`;
            tagEl.textContent = data.proot ? 'READY' : (data.mode === 'ish' ? 'iSH' : 'STATIC');
            tagEl.className = 'tag acc';
          } else {
            statusEl.textContent = '服务在线，但不是 AETHER 桥接';
            tagEl.textContent = 'UNKNOWN';
          }
        } catch (err) {
          statusEl.textContent = '未检测到桥接服务（静态托管模式）';
          tagEl.textContent = 'OFFLINE';
          tagEl.className = 'tag';
        }
      }
      checkBridge();
      root.querySelector('#recheckBridge').addEventListener('click', checkBridge);
      api.setSub('AETHER OS · 概念系统');
    }
  });
})();
