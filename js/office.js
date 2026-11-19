/* ============================================================
   AETHER OFFICE · PDF / DOCX / XLSX / PPTX / CSV / TEXT
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, el = document) => (el || document).querySelector(s);
  const EXT = name => {
    const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  };
  const baseName = name => String(name || 'document').replace(/\.([a-z0-9]+)$/i, '');
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const TEXT_EXTS = new Set(['txt', 'md', 'markdown', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'log', 'yaml', 'yml', 'ini', 'conf', 'sh']);
  const ACCEPT = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.tsv,.pptx,.ppt,.odt,.ods,.odp,.rtf,.txt,.md,.json,.xml,.html,.htm,.css,.js,.log,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/*';

  const LIB = {
    pdf: { src: 'vendor/pdf-lib.min.js', global: 'PDFLib' },
    xlsx: { src: 'vendor/xlsx.full.min.js', global: 'XLSX' },
    mammoth: { src: 'vendor/mammoth.browser.min.js', global: 'mammoth' },
    jszip: { src: 'vendor/jszip.min.js', global: 'JSZip' },
  };
  const libPromises = {};

  function ensureLib(key) {
    const def = LIB[key];
    if (!def) return Promise.reject(new Error('未知文档库：' + key));
    if (window[def.global]) return Promise.resolve(window[def.global]);
    if (libPromises[key]) return libPromises[key];
    libPromises[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = def.src;
      s.async = true;
      s.onload = () => window[def.global]
        ? resolve(window[def.global])
        : reject(new Error('文档库加载后未找到入口：' + def.global));
      s.onerror = () => reject(new Error('文档库加载失败：' + def.src));
      document.head.appendChild(s);
      setTimeout(() => {
        if (!window[def.global]) reject(new Error('文档库加载超时：' + def.src));
      }, 15000);
    });
    libPromises[key].catch(() => { delete libPromises[key]; });
    return libPromises[key];
  }

  function saveBlob(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 6000);
  }

  Aether.openOfficeFile = function (file) {
    if (!file) return;
    Aether.pendingOfficeFile = file;
    Aether.openApp('office');
  };

  function sanitizeHtml(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(html || '');
    tpl.content.querySelectorAll('script,iframe,object,embed,link,meta,style,base').forEach(n => n.remove());
    tpl.content.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || '').trim().toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc') el.removeAttribute(attr.name);
        else if ((name === 'href' || name === 'src' || name === 'xlink:href') && (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html'))) el.removeAttribute(attr.name);
        else if (name === 'style' && /expression\s*\(|url\s*\(\s*['"]?\s*javascript:/i.test(value)) el.removeAttribute(attr.name);
      });
    });
    return tpl.innerHTML;
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

  function xmlDoc(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('文档 XML 解析失败');
    return doc;
  }

  function localName(el) {
    return el && (el.localName || String(el.nodeName).split(':').pop());
  }

  function inTable(el) {
    let p = el && el.parentNode;
    while (p) {
      if (localName(p) === 'tbl') return true;
      p = p.parentNode;
    }
    return false;
  }

  function makeTextPng(text, fontSize, mode) {
    return new Promise((resolve, reject) => {
      try {
        const scale = 2;
        const watermark = mode === 'watermark';
        const fontPx = Math.max(8, Number(fontSize) || 24) * scale;
        const pad = (watermark ? 12 : 16) * scale;
        const maxTextWidth = watermark ? 1300 : 1180;
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        const font = '600 ' + fontPx + 'px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif';
        ctx.font = font;
        const lines = [];
        String(text || '').slice(0, 600).split(/\r?\n/).forEach(par => {
          let line = '';
          for (const ch of par) {
            const probe = line + ch;
            if (ctx.measureText(probe).width > maxTextWidth && line) { lines.push(line); line = ch; }
            else line = probe;
          }
          lines.push(line);
        });
        while (lines.length > 1 && !lines[lines.length - 1]) lines.pop();
        const widths = lines.map(l => ctx.measureText(l).width);
        const lineHeight = fontPx * 1.4;
        c.width = Math.max(120, Math.min(maxTextWidth + pad * 2, Math.ceil(Math.max(...widths, 10)) + pad * 2));
        c.height = Math.max(lineHeight + pad * 2, Math.ceil(lines.length * lineHeight) + pad * 2);
        const x = c.getContext('2d');
        if (watermark) {
          x.clearRect(0, 0, c.width, c.height);
        } else {
          x.fillStyle = 'rgba(255,255,255,.93)';
          x.fillRect(0, 0, c.width, c.height);
          x.strokeStyle = 'rgba(20,50,70,.25)';
          x.lineWidth = 2;
          x.strokeRect(1, 1, c.width - 2, c.height - 2);
        }
        x.font = font;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = watermark ? '#4b6475' : '#101b24';
        lines.forEach((line, i) => {
          x.fillText(line, c.width / 2, pad + lineHeight * (i + .5));
        });
        c.toBlob(blob => {
          if (!blob) return reject(new Error('无法生成文字图层'));
          blob.arrayBuffer().then(buf => resolve({
            bytes: new Uint8Array(buf),
            width: c.width / scale,
            height: c.height / scale,
          })).catch(reject);
        }, 'image/png');
      } catch (err) { reject(err); }
    });
  }

  Aether.registerApp({
    id: 'office',
    name: '办公',
    sub: 'PDF · DOCX · XLSX · PPTX · CSV',
    icon: 'office',
    accent: '#ffcf6d',
    order: 70,
    flush: true,
    render(root, api) {
      let current = null;
      let urls = [];
      let busy = false;

      root.innerHTML = `
        <div class="office-shell">
          <div class="office-bar">
            <button class="btn solid sm" id="ofOpen">打开文件</button>
            <div class="of-file"><strong id="ofName">未打开文件</strong><span id="ofKind">PDF · DOCX · XLSX · PPTX</span></div>
            <button class="btn ghost sm" id="ofSave" disabled>保存副本</button>
            <input type="file" id="ofInput" accept="${ACCEPT}" class="hidden">
          </div>
          <div class="office-body" id="ofBody"></div>
        </div>
      `;
      const bodyEl = root.querySelector('#ofBody');
      const nameEl = root.querySelector('#ofName');
      const kindEl = root.querySelector('#ofKind');
      const saveBtn = root.querySelector('#ofSave');
      const fileInput = root.querySelector('#ofInput');

      function revokeUrls() {
        urls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
        urls = [];
      }
      function newUrl(blob) {
        const u = URL.createObjectURL(blob);
        urls.push(u);
        return u;
      }
      function header(name, kind, dirty = false) {
        nameEl.textContent = name || '未打开文件';
        nameEl.title = name || '';
        kindEl.textContent = kind + (dirty ? ' · 已修改' : '');
        saveBtn.disabled = !current;
      }
      function markDirty() {
        if (!current) return;
        current.dirty = true;
        kindEl.textContent = current.kindLabel + ' · 已修改';
      }
      function setSave(fn) {
        if (current) current.save = fn;
      }
      function pick() {
        fileInput.value = '';
        fileInput.click();
      }
      function loading(msg) {
        bodyEl.innerHTML = '<div class="office-loading"><span class="of-spin"></span><p></p></div>';
        bodyEl.querySelector('p').textContent = msg;
      }
      function closeCurrent() {
        if (current && current.dirty && !confirm('当前文件有未下载的修改。打开其他文件会丢失这些修改，继续？')) return false;
        revokeUrls();
        current = null;
        saveBtn.disabled = true;
        return true;
      }

      async function openFile(file) {
        if (!file || busy) return;
        if (file.size > 80 * 1024 * 1024) {
          api.toast('文件超过 80 MB，浏览器内编辑可能耗尽内存', 'bad');
          return;
        }
        if (!closeCurrent()) return;
        busy = true;
        loading('正在读取「' + file.name + '」…');
        nameEl.textContent = file.name;
        nameEl.title = file.name;
        kindEl.textContent = Aether.fmtBytes(file.size);
        try {
          const bytes = await file.arrayBuffer();
          const ext = EXT(file.name);
          const mime = String(file.type || '');
          const base = {
            name: file.name, ext, mime, bytes,
            originalBytes: bytes.slice(0),
            dirty: false,
            kindLabel: ext.toUpperCase() || 'FILE',
          };
          if (ext === 'pdf' || mime === 'application/pdf' || (bytes.byteLength >= 5 && decodeText(new Uint8Array(bytes, 0, 5)) === '%PDF-')) {
            await openPdf(base);
          } else if (ext === 'docx') {
            await openDocx(base);
          } else if (ext === 'pptx') {
            await openPptx(base);
          } else if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) {
            await openSheet(base);
          } else if (ext === 'doc' || ext === 'ppt') {
            openGeneric(base, '旧版二进制 Office 格式（.' + ext + '）无法在浏览器内无损解析。请用桌面 Office/WPS 转存为 .docx/.pptx 后再编辑。');
          } else if (TEXT_EXTS.has(ext) || mime.startsWith('text/') || /json|xml|javascript/.test(mime)) {
            openText(base);
          } else {
            openGeneric(base, '未识别的文件格式。已打开文件信息与预览；不会伪造编辑能力。');
          }
        } catch (err) {
          renderError(file.name, err);
        } finally {
          busy = false;
        }
      }

      function renderStart(msg) {
        current = null;
        saveBtn.disabled = true;
        nameEl.textContent = '未打开文件';
        nameEl.title = '';
        kindEl.textContent = 'PDF · DOCX · XLSX · PPTX';
        bodyEl.innerHTML = `
          <div class="office-start">
            <div class="of-hero-icon">${Aether.icon('office')}</div>
            <h3>打开真实的办公文件</h3>
            <p>在本机解析、编辑并下载副本。文件不会上传；关闭应用后当前文件不保留。</p>
            <div class="of-primary-actions">
              <button class="btn solid" id="ofPick2">打开文件</button>
              <button class="btn ghost" id="ofDropTip">拖入文件（桌面）</button>
            </div>
            <div class="of-formats">
              <span>PDF</span><span>DOCX</span><span>XLSX / XLS</span><span>PPTX</span><span>CSV / TSV</span><span>ODT / ODS / ODP</span><span>TXT / MD / JSON</span>
            </div>
            <div class="of-new">
              <button data-new="docx">＋ 空白文档</button>
              <button data-new="xlsx">＋ 空白表格</button>
              <button data-new="pdf">＋ 空白 PDF</button>
              <button data-new="txt">＋ 空白文本</button>
            </div>
            <div class="of-limits">
              <p><b>PDF：</b>查看，旋转/删除/插入页、加页码，添加中文文字批注与水印。</p>
              <p><b>DOCX：</b>预览与逐段文字编辑，保存时保留原文档图片和结构；复杂版式可能被浏览器简化。</p>
              <p><b>XLSX/XLS/CSV/ODS：</b>多工作表网格编辑，公式以文本保留，另存 XLSX 或 CSV。</p>
              <p><b>PPTX：</b>文字视图与逐段编辑，保存时保留原包内图片资源；图片/动画/母版不在此处渲染。</p>
              <p><b>旧版 .doc/.ppt：</b>不做虚假解析；请先转存为 DOCX/PPTX。</p>
            </div>
            ${msg ? '<div class="of-error">' + '' + '</div>' : ''}
          </div>
        `;
        if (msg) bodyEl.querySelector('.of-error').textContent = msg;
        bodyEl.querySelector('#ofPick2').addEventListener('click', pick);
        bodyEl.querySelector('#ofDropTip').addEventListener('click', () => api.toast('把文件拖到办公窗口即可打开', ''));
        bodyEl.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => createBlank(b.dataset.new)));
        api.setSub('打开/编辑 PDF、DOCX、XLSX、PPTX · 本地');
      }

      function renderError(name, err) {
        current = null;
        saveBtn.disabled = true;
        bodyEl.innerHTML = `
          <div class="office-start">
            <div class="of-hero-icon bad">${Aether.icon('office')}</div>
            <h3>无法打开文件</h3>
            <p class="of-error-name"></p>
            <div class="of-error"></div>
            <div class="of-primary-actions"><button class="btn solid" id="ofErrPick">打开其他文件</button></div>
          </div>
        `;
        bodyEl.querySelector('.of-error-name').textContent = name;
        bodyEl.querySelector('.of-error').textContent = err && err.message ? err.message : String(err);
        bodyEl.querySelector('#ofErrPick').addEventListener('click', pick);
        kindEl.textContent = '打开失败';
      }

      /* ---------------- PDF ---------------- */
      async function openPdf(base) {
        current = base;
        base.kindLabel = 'PDF';
        header(base.name, 'PDF');
        const blob = new Blob([base.bytes], { type: 'application/pdf' });
        base.viewUrl = newUrl(blob);
        renderPdf(base);
        setSave(() => {
          saveBlob(base.name, new Blob([base.bytes], { type: 'application/pdf', name: base.name }));
          base.dirty = false;
          header(base.name, 'PDF');
          api.toast('已下载 PDF 副本', 'ok');
        });
      }

      function renderPdf(base) {
        bodyEl.innerHTML = `
          <div class="pdf-layout">
            <div class="pdf-bar">
              <span class="pdf-pages mono" id="pdfPages">PDF</span>
              <button class="btn ghost sm" id="pdfPanelBtn">编辑 PDF</button>
              <button class="btn ghost sm" id="pdfOpenTab">新窗口</button>
            </div>
            <div class="pdf-frame-wrap"><iframe id="pdfFrame" title="PDF 预览"></iframe></div>
            <div class="pdf-panel hidden" id="pdfPanel">
              <div class="of-row">
                <label>页 <input type="number" id="pdfPage" min="1" value="1" class="of-mini"></label>
                <label class="of-check"><input type="checkbox" id="pdfAll"> 全部页</label>
                <span class="of-hint" id="pdfStatus"></span>
              </div>
              <div class="of-row">
                <input type="text" id="pdfText" placeholder="批注 / 水印文字（支持中文）" maxlength="600">
                <select id="pdfPos" class="of-mini">
                  <option value="top">页顶</option>
                  <option value="bottom" selected>页底</option>
                  <option value="center">页中</option>
                  <option value="watermark">水印</option>
                </select>
                <input type="number" id="pdfSize" value="22" min="8" max="72" class="of-tiny" title="字号">
                <button class="btn ghost sm" id="pdfAddText">添加</button>
              </div>
              <div class="of-row of-wrap">
                <button class="btn ghost sm" id="pdfRotate">旋转 90°</button>
                <button class="btn ghost sm" id="pdfDelete">删除页</button>
                <button class="btn ghost sm" id="pdfInsert">后插空白</button>
                <button class="btn ghost sm" id="pdfNumbers">加页码</button>
                <button class="btn ghost sm" id="pdfReset">重置</button>
              </div>
              <p class="of-panel-note">可修改页面与叠加文字层；PDF 正文的原生排版/文字流编辑需要源文档或桌面编辑器，这里不伪造。</p>
            </div>
          </div>
        `;
        const frame = bodyEl.querySelector('#pdfFrame');
        frame.src = base.viewUrl + '#toolbar=0&navpanes=0&view=FitH';
        bodyEl.querySelector('#pdfOpenTab').addEventListener('click', () => {
          try { window.open(base.viewUrl, '_blank', 'noopener'); }
          catch (e) { api.toast('浏览器阻止了新窗口，请下载副本后用系统 PDF 查看器打开', 'bad'); }
        });
        bodyEl.querySelector('#pdfPanelBtn').addEventListener('click', () => {
          const panel = bodyEl.querySelector('#pdfPanel');
          panel.classList.toggle('hidden');
          if (!panel.classList.contains('hidden')) loadPdfDoc(base);
        });
        const pageInput = bodyEl.querySelector('#pdfPage');
        const allInput = bodyEl.querySelector('#pdfAll');
        const status = bodyEl.querySelector('#pdfStatus');

        function currentPdf() {
          return ensureLib('pdf');
        }
        async function loadPdfDoc(b) {
          status.textContent = '读取页数…';
          try {
            const PDFLib = await currentPdf();
            const doc = await PDFLib.PDFDocument.load(b.bytes.slice(0));
            const n = doc.getPageCount();
            pageInput.max = String(n);
            bodyEl.querySelector('#pdfPages').textContent = 'PDF · ' + n + ' 页';
            status.textContent = '共 ' + n + ' 页';
            return doc;
          } catch (err) {
            status.textContent = '无法编辑：' + err.message;
            api.toast('PDF 无法解析编辑（可能已加密）', 'bad');
            return null;
          }
        }
        async function applyPdf(work, note) {
          const PDFLib = await currentPdf();
          try {
            const doc = await work();
            if (!doc) return;
            const out = await doc.save();
            const buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
            base.bytes = buf;
            base.dirty = true;
            markDirty();
            const old = base.viewUrl;
            base.viewUrl = newUrl(new Blob([buf], { type: 'application/pdf' }));
            frame.src = base.viewUrl + '#toolbar=0&navpanes=0&view=FitH&page=' + (pageInput.value || 1);
            setTimeout(() => { try { URL.revokeObjectURL(old); } catch (e) {} }, 2500);
            const n = doc.getPageCount();
            pageInput.max = String(n);
            bodyEl.querySelector('#pdfPages').textContent = 'PDF · ' + n + ' 页';
            status.textContent = note || '已修改';
            api.toast(note || 'PDF 已修改', 'ok');
          } catch (err) {
            api.toast('PDF 修改失败：' + err.message, 'bad');
          }
        }
        const selectedPages = doc => {
          const n = doc.getPageCount();
          if (allInput.checked) return Array.from({ length: n }, (_, i) => i);
          const page = Math.max(1, Math.min(n, Number(pageInput.value) || 1));
          return [page - 1];
        };

        bodyEl.querySelector('#pdfAddText').addEventListener('click', async () => {
          const text = bodyEl.querySelector('#pdfText').value.trim();
          const pos = bodyEl.querySelector('#pdfPos').value;
          const size = Number(bodyEl.querySelector('#pdfSize').value) || 22;
          if (!text) { api.toast('先输入批注文字', ''); return; }
          const orig = base.bytes.slice(0);
          await applyPdf(async () => {
            const PDFLib = await currentPdf();
            const doc = await PDFLib.PDFDocument.load(orig);
            const png = await makeTextPng(text, size, pos === 'watermark');
            const img = await doc.embedPng(png.bytes);
            selectedPages(doc).forEach(i => {
              const page = doc.getPage(i);
              const pw = page.getWidth(), ph = page.getHeight();
              if (pos === 'watermark') {
                const w = pw * .8;
                const h = png.height * (w / png.width);
                page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h, opacity: .2 });
              } else {
                const maxW = pw * .9;
                const w = Math.min(maxW, png.width);
                const h = png.height * (w / png.width);
                const x = (pw - w) / 2;
                const y = pos === 'top' ? ph - h - 26 : pos === 'center' ? (ph - h) / 2 : 26;
                page.drawImage(img, { x, y, width: w, height: h });
              }
            });
            return doc;
          }, pos === 'watermark' ? '已添加水印' : '已添加文字批注');
        });

        bodyEl.querySelector('#pdfRotate').addEventListener('click', async () => {
          const orig = base.bytes.slice(0);
          await applyPdf(async () => {
            const PDFLib = await currentPdf();
            const doc = await PDFLib.PDFDocument.load(orig);
            selectedPages(doc).forEach(i => {
              const p = doc.getPage(i);
              p.setRotation(PDFLib.degrees((p.getRotation().angle + 90) % 360));
            });
            return doc;
          }, '页面已旋转');
        });

        bodyEl.querySelector('#pdfDelete').addEventListener('click', async () => {
          if (allInput.checked) { api.toast('删除页不能勾选「全部页」', ''); return; }
          const orig = base.bytes.slice(0);
          await applyPdf(async () => {
            const PDFLib = await currentPdf();
            const doc = await PDFLib.PDFDocument.load(orig);
            if (doc.getPageCount() <= 1) throw new Error('PDF 至少保留一页');
            const i = Math.max(0, Math.min(doc.getPageCount() - 1, (Number(pageInput.value) || 1) - 1));
            doc.removePage(i);
            return doc;
          }, '已删除页面');
        });

        bodyEl.querySelector('#pdfInsert').addEventListener('click', async () => {
          const orig = base.bytes.slice(0);
          await applyPdf(async () => {
            const PDFLib = await currentPdf();
            const doc = await PDFLib.PDFDocument.load(orig);
            const i = Math.max(0, Math.min(doc.getPageCount() - 1, (Number(pageInput.value) || 1) - 1));
            const ref = doc.getPage(i);
            doc.insertPage(i + 1, [ref.getWidth(), ref.getHeight()]);
            return doc;
          }, '已插入空白页');
        });

        bodyEl.querySelector('#pdfNumbers').addEventListener('click', async () => {
          const orig = base.bytes.slice(0);
          await applyPdf(async () => {
            const PDFLib = await currentPdf();
            const doc = await PDFLib.PDFDocument.load(orig);
            const font = await doc.embedStandardFont(PDFLib.StandardFonts.Helvetica);
            doc.getPages().forEach((page, i) => {
              page.drawText(String(i + 1), {
                x: page.getWidth() / 2 - 4, y: 18, size: 9,
                font, color: PDFLib.rgb(.35, .4, .45),
              });
            });
            return doc;
          }, '已添加页码');
        });

        bodyEl.querySelector('#pdfReset').addEventListener('click', () => {
          if (!confirm('放弃本次 PDF 的所有修改，恢复打开时的原文件？')) return;
          base.bytes = base.originalBytes.slice(0);
          base.dirty = false;
          const old = base.viewUrl;
          base.viewUrl = newUrl(new Blob([base.bytes], { type: 'application/pdf' }));
          frame.src = base.viewUrl + '#toolbar=0&navpanes=0&view=FitH';
          setTimeout(() => { try { URL.revokeObjectURL(old); } catch (e) {} }, 2500);
          header(base.name, 'PDF');
          status.textContent = '已恢复原文件';
          loadPdfDoc(base);
        });
      }

      /* ---------------- DOCX ---------------- */
      async function openDocx(base) {
        const [mammoth] = await Promise.all([ensureLib('mammoth'), ensureLib('jszip')]);
        let preview = '';
        try {
          const result = await mammoth.convertToHtml({ arrayBuffer: base.bytes.slice(0) });
          preview = sanitizeHtml(result.value);
        } catch (err) {
          preview = '<p class="of-inline-error">预览生成失败：' + String(err.message || err).replace(/[<>&]/g, '') + '</p>';
        }
        base.kindLabel = 'DOCX';
        base.previewHtml = preview;
        current = base;
        header(base.name, 'DOCX');
        setSave(async () => {
          if (base.pendingCommit) await base.pendingCommit(false);
          saveBlob(base.name, new Blob([base.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
          base.dirty = false;
          header(base.name, 'DOCX');
          api.toast('已下载 DOCX 副本', 'ok');
        });
        renderDocx(base, 'preview');
      }

      function renderDocx(base, mode) {
        bodyEl.innerHTML = `
          <div class="docx-layout">
            <div class="docx-bar">
              <div class="seg">
                <button data-mode="preview" class="${mode === 'preview' ? 'on' : ''}">预览</button>
                <button data-mode="edit" class="${mode === 'edit' ? 'on' : ''}">编辑文字</button>
              </div>
              <span class="mono of-muted" id="docxInfo">${mode === 'edit' ? '保留原结构' : '只读预览'}</span>
            </div>
            <div class="docx-scroll" id="docxScroll"></div>
          </div>
        `;
        bodyEl.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.mode === 'edit') renderDocxEdit(base);
          else renderDocx(base, 'preview');
        }));
        if (mode === 'preview') {
          const scroll = bodyEl.querySelector('#docxScroll');
          scroll.innerHTML = '<article class="docx-preview"></article>';
          scroll.querySelector('.docx-preview').innerHTML = base.previewHtml || '<p>空文档</p>';
          api.setSub('DOCX 预览 · 本地');
        } else {
          api.setSub('DOCX 逐段编辑 · 另存副本');
        }
      }

      async function renderDocxEdit(base) {
        const headerHtml = `
          <div class="docx-layout">
            <div class="docx-bar">
              <div class="seg">
                <button data-mode="preview">预览</button>
                <button data-mode="edit" class="on">编辑文字</button>
              </div>
              <button class="btn solid sm" id="docxApply">应用修改</button>
            </div>
            <div class="docx-edit-tools">
              <button class="btn ghost sm" id="docxAdd">＋ 在选中段后插入</button>
              <button class="btn ghost sm" id="docxDel">删除选中段</button>
              <span class="of-hint" id="docxStatus">点选段落进行编辑</span>
            </div>
            <div class="docx-scroll"><div class="docx-edit-list" id="docxList"></div></div>
          </div>
        `;
        bodyEl.innerHTML = headerHtml;
        const list = bodyEl.querySelector('#docxList');
        const status = bodyEl.querySelector('#docxStatus');
        bodyEl.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
          if (b.dataset.mode === 'preview') renderDocx(base, 'preview');
          else renderDocxEdit(base);
        }));
        loading('正在解析 DOCX 段落…');
        let JSZip, doc, ps;
        try {
          JSZip = await ensureLib('jszip');
          if (!base.zip) base.zip = await JSZip.loadAsync(base.bytes.slice(0));
          const xml = await base.zip.file('word/document.xml').async('string');
          doc = xmlDoc(xml);
          ps = [...doc.getElementsByTagNameNS(W_NS, 'p')];
        } catch (err) {
          renderDocx(base, 'preview');
          api.toast('DOCX 结构解析失败：' + err.message, 'bad');
          return;
        }
        if (!ps.length) { api.toast('文档中没有可编辑段落', ''); renderDocx(base, 'preview'); return; }
        if (!base.docxItems || base.docxZipToken !== base.zip) {
          base.docxItems = ps.map(node => ({
            node,
            text: [...node.getElementsByTagNameNS(W_NS, 't')].map(t => t.textContent).join(''),
            table: inTable(node),
            deleted: false,
          }));
          base.docxZipToken = base.zip;
          base.docxSelected = 0;
        }
        const items = base.docxItems;
        let visible = Math.min(300, items.length);
        bodyEl.innerHTML = headerHtml;
        const list2 = bodyEl.querySelector('#docxList');
        const status2 = bodyEl.querySelector('#docxStatus');
        function styleLabel(item) {
          if (item.table) return '表格';
          const pPr = item.node.getElementsByTagNameNS(W_NS, 'pStyle')[0];
          const val = pPr ? pPr.getAttributeNS(W_NS, 'val') || pPr.getAttribute('w:val') || '' : '';
          if (!val && item.node.getElementsByTagNameNS(W_NS, 'numPr').length) return '列表';
          const h = /heading\s*([1-6])/i.exec(val);
          if (h) return 'H' + h[1];
          if (/title/i.test(val)) return '标题';
          return '正文';
        }
        function renderRows() {
          list2.innerHTML = '';
          items.slice(0, visible).forEach((item, i) => {
            if (item.deleted) return;
            const row = document.createElement('div');
            row.className = 'docx-para' + (i === base.docxSelected ? ' sel' : '');
            row.dataset.i = String(i);
            const no = document.createElement('span');
            no.className = 'dp-no';
            no.textContent = String(i + 1).padStart(2, '0');
            const tag = document.createElement('span');
            tag.className = 'dp-style';
            tag.textContent = styleLabel(item);
            const ta = document.createElement('textarea');
            ta.className = 'dp-text';
            ta.rows = 1;
            ta.value = item.text;
            ta.spellcheck = false;
            const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; };
            ta.addEventListener('focus', () => {
              base.docxSelected = i;
              list2.querySelectorAll('.docx-para.sel').forEach(n => n.classList.remove('sel'));
              row.classList.add('sel');
              status2.textContent = '第 ' + (i + 1) + ' 段 · ' + styleLabel(item);
            });
            ta.addEventListener('input', () => {
              item.text = ta.value.replace(/[\r\n]+/g, ' ');
              grow();
              status2.textContent = '第 ' + (i + 1) + ' 段 · 未应用';
            });
            ta.addEventListener('keydown', e => {
              if (e.key === 'Enter') { e.preventDefault(); ta.blur(); }
            });
            row.append(no, tag, ta);
            list2.appendChild(row);
            grow();
          });
          if (visible < items.length) {
            const more = document.createElement('button');
            more.className = 'btn ghost sm of-more';
            more.textContent = '加载更多段落（' + (items.length - visible) + '）';
            more.addEventListener('click', () => { visible = Math.min(items.length, visible + 300); renderRows(); });
            list2.appendChild(more);
          }
          status2.textContent = base.docxSelected != null ? '第 ' + (base.docxSelected + 1) + ' 段已选中' : '点选段落进行编辑';
        }
        renderRows();
        bodyEl.querySelector('#docxAdd').addEventListener('click', () => {
          const idx = Math.max(0, Math.min(items.length - 1, base.docxSelected == null ? items.length - 1 : base.docxSelected));
          const anchor = items[idx];
          const item = { node: null, text: '', table: false, deleted: false, addedAfter: anchor };
          items.splice(idx + 1, 0, item);
          base.docxSelected = idx + 1;
          visible = Math.max(visible, idx + 2);
          renderRows();
          setTimeout(() => {
            const el = list2.querySelector('[data-i="' + (idx + 1) + '"] textarea');
            if (el) el.focus();
          }, 30);
        });
        bodyEl.querySelector('#docxDel').addEventListener('click', () => {
          const idx = base.docxSelected;
          const item = items[idx];
          if (!item) return;
          if (items.filter(x => !x.deleted).length <= 1) { api.toast('至少保留一个段落', ''); return; }
          if (item.table) { api.toast('表格内段落暂不允许整段删除，以免破坏表格结构', ''); return; }
          item.deleted = true;
          const next = items.findIndex(x => !x.deleted);
          base.docxSelected = next;
          renderRows();
        });
        async function apply(renderPreview = true) {
          const doc2 = doc;
          const setPText = (p, text) => {
            const tNodes = [...p.getElementsByTagNameNS(W_NS, 't')];
            if (!tNodes.length) {
              let r = p.getElementsByTagNameNS(W_NS, 'r')[0];
              if (!r) {
                r = doc2.createElementNS(W_NS, 'w:r');
                p.appendChild(r);
              }
              const t = doc2.createElementNS(W_NS, 'w:t');
              t.setAttribute('xml:space', 'preserve');
              t.textContent = text;
              r.appendChild(t);
            } else {
              tNodes[0].textContent = text;
              tNodes[0].setAttribute('xml:space', 'preserve');
              for (let i = 1; i < tNodes.length; i++) tNodes[i].textContent = '';
            }
          };
          const makeParagraph = (text, styleItem) => {
            const p = doc2.createElementNS(W_NS, 'w:p');
            const styleNode = styleItem && styleItem.node;
            if (styleNode) {
              const pPr = styleNode.getElementsByTagNameNS(W_NS, 'pPr')[0];
              if (pPr) p.appendChild(pPr.cloneNode(true));
              const rPr = styleNode.getElementsByTagNameNS(W_NS, 'rPr')[0];
              const r = doc2.createElementNS(W_NS, 'w:r');
              if (rPr) r.appendChild(rPr.cloneNode(true));
              const t = doc2.createElementNS(W_NS, 'w:t');
              t.setAttribute('xml:space', 'preserve');
              t.textContent = text;
              r.appendChild(t);
              p.appendChild(r);
            } else {
              const r = doc2.createElementNS(W_NS, 'w:r');
              const t = doc2.createElementNS(W_NS, 'w:t');
              t.setAttribute('xml:space', 'preserve');
              t.textContent = text;
              r.appendChild(t);
              p.appendChild(r);
            }
            return p;
          };
          let last = null;
          items.forEach(item => {
            if (item.deleted) {
              if (item.node && item.node.parentNode) item.node.parentNode.removeChild(item.node);
              return;
            }
            if (item.node) {
              setPText(item.node, item.text);
              last = item.node;
            } else {
              let anchor = item.addedAfter && !item.addedAfter.deleted ? item.addedAfter.node : null;
              if (!anchor) anchor = last;
              const p = makeParagraph(item.text, item.addedAfter);
              if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(p, anchor.nextSibling);
              else {
                const body = doc2.getElementsByTagNameNS(W_NS, 'body')[0];
                const sect = body && body.getElementsByTagNameNS(W_NS, 'sectPr')[0];
                if (sect) body.insertBefore(p, sect); else if (body) body.appendChild(p);
              }
              item.node = p;
              item.addedAfter = null;
              last = p;
            }
          });
          const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(doc2);
          base.zip.file('word/document.xml', xml);
          const blob = await base.zip.generateAsync({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE',
            compressionOptions: { level: 3 },
          });
          base.bytes = await blob.arrayBuffer();
          base.docxItems = null;
          base.docxZipToken = null;
          try {
            const mammoth = await ensureLib('mammoth');
            const result = await mammoth.convertToHtml({ arrayBuffer: base.bytes.slice(0) });
            base.previewHtml = sanitizeHtml(result.value);
          } catch (e) {}
          base.dirty = true;
          markDirty();
          if (renderPreview) {
            renderDocx(base, 'preview');
            api.toast('修改已应用；预览已更新，记得保存副本', 'ok');
          }
        }
        base.pendingCommit = apply;
        bodyEl.querySelector('#docxApply').addEventListener('click', () => apply(true));
        api.setSub('DOCX 逐段编辑 · 另存副本');
      }

      /* ---------------- XLSX / CSV ---------------- */
      async function openSheet(base) {
        const XLSX = await ensureLib('xlsx');
        const wb = XLSX.read(new Uint8Array(base.bytes.slice(0)), { type: 'array', cellDates: false, cellNF: false, cellText: true });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error('工作簿中没有工作表');
        base.kindLabel = base.ext === 'csv' ? 'CSV' : 'XLSX';
        base.wb = wb;
        base.activeSheet = wb.SheetNames[0];
        current = base;
        header(base.name, base.kindLabel);
        setSave(async () => {
          if (base.ext === 'csv' || base.ext === 'tsv') {
            const csv = XLSX.utils.sheet_to_csv(base.wb.Sheets[base.activeSheet], { FS: base.ext === 'tsv' ? '\t' : ',' });
            saveBlob(base.name, new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
          } else {
            const out = XLSX.write(base.wb, { bookType: 'xlsx', type: 'array', compression: true });
            const name = baseName(base.name) + '.xlsx';
            saveBlob(name, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
          }
          base.dirty = false;
          header(base.name, base.kindLabel);
          api.toast('已下载表格副本', 'ok');
        });
        renderSheet(base);
      }

      function renderSheet(base) {
        const XLSX = window.XLSX;
        const wb = base.wb;
        const tabs = wb.SheetNames;
        let viewRows = base.viewRows || 24;
        let viewCols = base.viewCols || 10;
        const wrap = document.createElement('div');
        wrap.className = 'sheet-layout';
        wrap.innerHTML = `
          <div class="sheet-tabs-row">
            <div class="seg sheet-tabs" id="sheetTabs"></div>
            <div class="sheet-tools">
              <button class="btn ghost sm" id="sheetMoreRows">＋行</button>
              <button class="btn ghost sm" id="sheetMoreCols">＋列</button>
              <button class="btn ghost sm" id="sheetCsv">导出 CSV</button>
            </div>
          </div>
          <div class="sheet-wrap"><table class="sheet-grid" id="sheetGrid"></table></div>
          <div class="sheet-foot"><span id="sheetInfo"></span><span>编辑单元格后点击「保存副本」</span></div>
        `;
        bodyEl.innerHTML = '';
        bodyEl.appendChild(wrap);
        const tabsEl = wrap.querySelector('#sheetTabs');
        const grid = wrap.querySelector('#sheetGrid');
        const info = wrap.querySelector('#sheetInfo');

        function renderTabs() {
          tabsEl.innerHTML = '';
          tabs.forEach(name => {
            const b = document.createElement('button');
            b.textContent = name;
            b.classList.toggle('on', name === base.activeSheet);
            b.addEventListener('click', () => {
              if (name === base.activeSheet) return;
              base.activeSheet = name;
              renderTabs();
              renderGrid();
            });
            tabsEl.appendChild(b);
          });
        }

        function cellDisplay(cell) {
          if (!cell) return '';
          if (cell.f) return '=' + cell.f;
          if (cell.w != null) return String(cell.w);
          if (cell.v == null) return '';
          if (cell.v instanceof Date) return cell.v.toLocaleDateString('zh-CN');
          return String(cell.v);
        }

        function expandRef(ws, r, c) {
          const XLSX2 = window.XLSX;
          let range = { s: { r: 0, c: 0 }, e: { r, c } };
          try {
            if (ws['!ref']) {
              const old = XLSX2.utils.decode_range(ws['!ref']);
              range = { s: { r: Math.min(old.s.r, 0), c: Math.min(old.s.c, 0) }, e: { r: Math.max(old.e.r, r), c: Math.max(old.e.c, c) } };
            }
          } catch (e) {}
          ws['!ref'] = XLSX2.utils.encode_range(range);
        }

        function setCell(ws, addr, value, old) {
          const XLSX2 = window.XLSX;
          const next = Object.assign({}, old || {});
          delete next.f; delete next.w; delete next.r; delete next.h;
          const v = String(value);
          if (!v) {
            if (old && old.s) { next.t = 's'; next.v = ''; ws[addr] = next; }
            else delete ws[addr];
            return;
          }
          if (v.startsWith('=') && v.length > 1) {
            next.t = 'n'; next.f = v.slice(1); delete next.v;
            ws[addr] = next;
            return;
          }
          if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v) && !/^0\d/.test(v)) {
            next.t = 'n'; next.v = Number(v);
          } else if (/^(true|false)$/i.test(v)) {
            next.t = 'b'; next.v = /^true$/i.test(v);
          } else {
            next.t = 's'; next.v = v;
          }
          ws[addr] = next;
          if (!XLSX2) return;
        }

        function renderGrid() {
          const ws = wb.Sheets[base.activeSheet];
          if (!ws) { grid.innerHTML = '<tr><td>工作表不存在</td></tr>'; return; }
          let range = { s: { r: 0, c: 0 }, e: { r: 19, c: 7 } };
          try { if (ws['!ref']) range = XLSX.utils.decode_range(ws['!ref']); } catch (e) {}
          const rows = Math.max(Math.min(viewRows, 200), Math.min(range.e.r + 1, 200));
          const cols = Math.max(Math.min(viewCols, 40), Math.min(range.e.c + 1, 40));
          grid.innerHTML = '';
          const thead = document.createElement('thead');
          const hr = document.createElement('tr');
          const corner = document.createElement('th');
          corner.className = 'sheet-corner';
          corner.textContent = '#';
          hr.appendChild(corner);
          for (let c = 0; c < cols; c++) {
            const th = document.createElement('th');
            th.textContent = XLSX.utils.encode_col(c);
            hr.appendChild(th);
          }
          thead.appendChild(hr);
          grid.appendChild(thead);
          const tbody = document.createElement('tbody');
          const frag = document.createDocumentFragment();
          for (let r = 0; r < rows; r++) {
            const tr = document.createElement('tr');
            const rh = document.createElement('th');
            rh.textContent = String(r + 1);
            tr.appendChild(rh);
            for (let c = 0; c < cols; c++) {
              const td = document.createElement('td');
              const addr = XLSX.utils.encode_cell({ r, c });
              const inp = document.createElement('input');
              inp.value = cellDisplay(ws[addr]);
              inp.setAttribute('aria-label', addr);
              inp.addEventListener('input', () => {
                setCell(ws, addr, inp.value, ws[addr]);
                expandRef(ws, r, c);
                markDirty();
              });
              td.appendChild(inp);
              tr.appendChild(td);
            }
            frag.appendChild(tr);
          }
          tbody.appendChild(frag);
          grid.appendChild(tbody);
          const truncated = (range.e.r + 1 > rows) || (range.e.c + 1 > cols);
          info.textContent = base.activeSheet + ' · 显示 ' + rows + ' 行 × ' + cols + ' 列' + (truncated ? ' · 未显示区域保存时原样保留' : '');
        }

        renderTabs();
        renderGrid();
        wrap.querySelector('#sheetMoreRows').addEventListener('click', () => {
          viewRows = Math.min(200, viewRows + 40);
          base.viewRows = viewRows;
          renderGrid();
        });
        wrap.querySelector('#sheetMoreCols').addEventListener('click', () => {
          viewCols = Math.min(40, viewCols + 8);
          base.viewCols = viewCols;
          renderGrid();
        });
        wrap.querySelector('#sheetCsv').addEventListener('click', () => {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[base.activeSheet]);
          saveBlob(baseName(base.name) + '-' + base.activeSheet.replace(/[\\/:*?"<>|]/g, '_') + '.csv', new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
          api.toast('已导出当前工作表 CSV', 'ok');
        });
        const baseDirty = () => {
          const ws = wb.Sheets[base.activeSheet];
          // 首次编辑时保留原始格样式已在 setCell 中复制
        };
        baseDirty();
        api.setSub('表格 · ' + tabs.length + ' 个工作表 · 本地');
      }

      /* ---------------- PPTX ---------------- */
      async function openPptx(base) {
        const JSZip = await ensureLib('jszip');
        const zip = await JSZip.loadAsync(base.bytes.slice(0));
        const names = Object.keys(zip.files)
          .filter(n => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
          .sort((a, b) => {
            const na = Number((/slide(\d+)\.xml/i.exec(a) || [])[1] || 0);
            const nb = Number((/slide(\d+)\.xml/i.exec(b) || [])[1] || 0);
            return na - nb;
          });
        if (!names.length) throw new Error('PPTX 中没有可读幻灯片');
        const slides = [];
        for (const name of names) {
          const xml = await zip.file(name).async('string');
          const doc = xmlDoc(xml);
          const texts = [...doc.getElementsByTagNameNS(A_NS, 't')].map(node => ({ node, text: node.textContent || '' }));
          slides.push({ name, doc, texts });
        }
        base.kindLabel = 'PPTX';
        base.zip = zip;
        base.slides = slides;
        current = base;
        header(base.name, 'PPTX');
        setSave(async () => {
          if (base.pendingCommit) await base.pendingCommit(false);
          saveBlob(base.name, new Blob([base.bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
          base.dirty = false;
          header(base.name, 'PPTX');
          api.toast('已下载 PPTX 副本', 'ok');
        });
        renderPptx(base);
      }

      function renderPptx(base) {
        const slides = base.slides;
        let visible = base.pptxVisible || 20;
        bodyEl.innerHTML = `
          <div class="pptx-layout">
            <div class="pptx-bar">
              <span class="of-muted mono">文字视图 · 图片/动画/母版不渲染</span>
              <button class="btn solid sm" id="pptxApply">应用修改</button>
            </div>
            <div class="pptx-scroll" id="pptxScroll"></div>
          </div>
        `;
        const scroll = bodyEl.querySelector('#pptxScroll');
        function renderSlides() {
          scroll.innerHTML = '';
          slides.slice(0, visible).forEach((slide, idx) => {
            const card = document.createElement('section');
            card.className = 'pptx-slide';
            const head = document.createElement('header');
            head.innerHTML = '<span class="mono">SLIDE ' + String(idx + 1).padStart(2, '0') + '</span><span class="of-hint">' + slide.texts.length + ' 个文字块</span>';
            const preview = document.createElement('div');
            preview.className = 'pptx-preview';
            const title = document.createElement('h4');
            title.textContent = slide.texts[0] ? slide.texts[0].text : '（无文字）';
            preview.appendChild(title);
            if (slide.texts[1]) {
              const p = document.createElement('p');
              p.textContent = slide.texts[1].text;
              preview.appendChild(p);
            }
            const editor = document.createElement('div');
            editor.className = 'pptx-texts';
            slide.texts.forEach((t, ti) => {
              const ta = document.createElement('textarea');
              ta.value = t.text;
              ta.rows = 1;
              ta.setAttribute('aria-label', '第 ' + (idx + 1) + ' 页文字 ' + (ti + 1));
              ta.addEventListener('input', () => {
                t.text = ta.value.replace(/[\r\n]+/g, ' ');
                if (ti === 0) title.textContent = t.text || '（无文字）';
                if (ti === 1 && preview.querySelector('p')) preview.querySelector('p').textContent = t.text;
                markDirty();
              });
              ta.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ta.blur(); } });
              editor.appendChild(ta);
            });
            card.append(head, preview, editor);
            scroll.appendChild(card);
          });
          if (visible < slides.length) {
            const more = document.createElement('button');
            more.className = 'btn ghost sm of-more';
            more.textContent = '加载更多幻灯片（' + (slides.length - visible) + '）';
            more.addEventListener('click', () => { visible += 20; base.pptxVisible = visible; renderSlides(); });
            scroll.appendChild(more);
          }
        }
        renderSlides();
        const commit = async (notify = true) => {
          try {
            slides.forEach(slide => {
              slide.texts.forEach(t => { t.node.textContent = t.text; });
              base.zip.file(slide.name, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + new XMLSerializer().serializeToString(slide.doc));
            });
            const blob = await base.zip.generateAsync({
              type: 'blob',
              mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              compression: 'DEFLATE',
              compressionOptions: { level: 3 },
            });
            base.bytes = await blob.arrayBuffer();
            base.dirty = true;
            markDirty();
            if (notify) api.toast('PPTX 修改已写入，记得保存副本', 'ok');
          } catch (err) {
            api.toast('PPTX 写入失败：' + err.message, 'bad');
            throw err;
          }
        };
        base.pendingCommit = commit;
        bodyEl.querySelector('#pptxApply').addEventListener('click', () => { commit(true).catch(() => {}); });
        api.setSub('PPTX 文字编辑 · 保留原包资源');
      }

      /* ---------------- 文本 / 通用 ---------------- */
      function openText(base) {
        const text = decodeText(base.bytes);
        base.kindLabel = base.ext ? base.ext.toUpperCase() : 'TEXT';
        base.text = text;
        current = base;
        header(base.name, base.kindLabel);
        bodyEl.innerHTML = `
          <div class="text-layout">
            <div class="text-bar"><span class="mono of-muted">${base.ext ? '.' + base.ext : 'TEXT'} · UTF-8/GB18030 自动识别</span><span class="of-hint" id="textCount"></span></div>
            <textarea id="textEditor" class="office-text" spellcheck="false"></textarea>
          </div>
        `;
        const ed = bodyEl.querySelector('#textEditor');
        const counter = bodyEl.querySelector('#textCount');
        ed.value = text;
        const upd = () => { counter.textContent = ed.value.length + ' 字符'; };
        upd();
        ed.addEventListener('input', () => { base.text = ed.value; markDirty(); upd(); });
        setSave(() => {
          const mime = base.ext === 'json' ? 'application/json' : base.ext === 'html' || base.ext === 'htm' ? 'text/html' : 'text/plain';
          saveBlob(base.name, new Blob([base.text], { type: mime + ';charset=utf-8' }));
          base.dirty = false;
          header(base.name, base.kindLabel);
          api.toast('已下载文本副本', 'ok');
        });
        api.setSub('文本编辑 · 本地');
      }

      function openGeneric(base, message) {
        base.kindLabel = 'FILE';
        current = base;
        header(base.name, 'FILE');
        const sig = [...new Uint8Array(base.bytes.slice(0, 64))].map(b => b.toString(16).padStart(2, '0')).join(' ');
        bodyEl.innerHTML = `
          <div class="office-start">
            <div class="of-hero-icon bad">${Aether.icon('office')}</div>
            <h3>文件已打开</h3>
            <p class="of-error-name"></p>
            <div class="of-error"></div>
            <div class="of-file-info mono"></div>
            <div class="of-primary-actions"><button class="btn solid" id="ofGenericSave">下载原文件</button><button class="btn ghost" id="ofGenericPick">打开其他文件</button></div>
          </div>
        `;
        bodyEl.querySelector('.of-error-name').textContent = base.name;
        bodyEl.querySelector('.of-error').textContent = message;
        bodyEl.querySelector('.of-file-info').textContent = base.bytes.byteLength + ' 字节 · 首 64 字节：' + sig;
        bodyEl.querySelector('#ofGenericSave').addEventListener('click', () => {
          saveBlob(base.name, new Blob([base.bytes], { type: base.mime || 'application/octet-stream' }));
        });
        bodyEl.querySelector('#ofGenericPick').addEventListener('click', pick);
        setSave(() => saveBlob(base.name, new Blob([base.bytes], { type: base.mime || 'application/octet-stream' })));
        api.setSub('通用文件 · 只读');
      }

      /* ---------------- 新建 ---------------- */
      async function createBlank(kind) {
        if (busy) return;
        if (kind === 'txt') {
          openFile(new File([''], 'AETHER-新建文本.txt', { type: 'text/plain' }));
          return;
        }
        loading('正在生成空白文件…');
        try {
          if (kind === 'pdf') {
            const PDFLib = await ensureLib('pdf');
            const pdf = await PDFLib.PDFDocument.create();
            pdf.addPage([PDFLib.PageSizes.A4[0], PDFLib.PageSizes.A4[1]]);
            const bytes = await pdf.save();
            openFile(new File([bytes], 'AETHER-新建文档.pdf', { type: 'application/pdf' }));
          } else if (kind === 'docx') {
            const JSZip = await ensureLib('jszip');
            const zip = new JSZip();
            zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
            zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
            zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">新文档</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>');
            const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            openFile(new File([blob], 'AETHER-新建文档.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
          } else if (kind === 'xlsx') {
            const XLSX = await ensureLib('xlsx');
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet([['项目', '数值', '备注'], ['AETHER', 1, '']]);
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            openFile(new File([out], 'AETHER-新建表格.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
          }
        } catch (err) {
          renderStart('新建失败：' + err.message);
          api.toast('新建失败', 'bad');
        }
      }

      root.querySelector('#ofOpen').addEventListener('click', pick);
      saveBtn.addEventListener('click', async () => {
        if (!current || !current.save) return;
        try { await current.save(); } catch (err) { api.toast('保存失败：' + err.message, 'bad'); }
      });
      fileInput.addEventListener('change', () => {
        const f = (fileInput.files || [])[0];
        if (f) openFile(f);
      });
      root.addEventListener('dragover', e => { e.preventDefault(); root.classList.add('of-dragging'); });
      root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) root.classList.remove('of-dragging'); });
      root.addEventListener('drop', e => {
        e.preventDefault();
        root.classList.remove('of-dragging');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) openFile(f);
      });
      api.onClose(() => {
        revokeUrls();
        root.classList.remove('of-dragging');
      });
      const pending = Aether.pendingOfficeFile;
      Aether.pendingOfficeFile = null;
      if (pending) openFile(pending);
      else renderStart();
    }
  });
})();
