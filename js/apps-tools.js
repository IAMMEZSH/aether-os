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
  const bridgeCfg = () => {
    const cfg = Aether.store.get('bridge', null);
    if (!cfg || !cfg.endpoint || !cfg.token) return null;
    return { ...cfg, endpoint: String(cfg.endpoint).replace(/\/+$/, '') };
  };
  const bridgeDistro = cfg => (cfg && cfg.distro) || 'ubuntu';
  async function bridgeRaw(cfg, path, options = {}, timeout = 20000) {
    if (!cfg) throw new Error('未连接本机桥接');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    try {
      const res = await fetch(cfg.endpoint + path, { ...options, signal: ctl.signal, cache: 'no-store' });
      return res;
    } catch (err) {
      if (err && err.name === 'AbortError') throw new Error('桥接请求超时（' + Math.round(timeout / 1000) + ' 秒）');
      throw new Error('无法连接桥接：' + (err && err.message ? err.message : err));
    } finally {
      clearTimeout(timer);
    }
  }
  async function bridgeJson(cfg, path, body, timeout = 20000) {
    const res = await bridgeRaw(cfg, path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        'x-aether-token': cfg.token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }, timeout);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('桥接 HTTP ' + res.status));
    return data;
  }
  async function bridgeBlob(cfg, id, timeout = 16000) {
    const res = await bridgeRaw(cfg, '/api/gallery/file?id=' + encodeURIComponent(id), {
      headers: { 'x-aether-token': cfg.token },
    }, timeout);
    if (!res.ok) {
      let message = '图片读取失败';
      try { const data = await res.json(); message = data.error || message; } catch (e) { /* binary error */ }
      throw new Error(message);
    }
    return res.blob();
  }

  /* ============================================================
     代码工作室
     ============================================================ */
  const LANG_DEFS = [
    { id: 'js', name: 'JavaScript', runtime: 'Node / 浏览器', sample: '// AETHER Code Studio · JavaScript' },
    { id: 'py', name: 'Python', runtime: 'CPython / Pyodide', sample: '# AETHER Code Studio · Python' },
    { id: 'html', name: 'HTML', runtime: 'HTML5 / 沙盒 iframe', sample: '<!-- AETHER Code Studio · HTML5 -->' },
    { id: 'css', name: 'CSS', runtime: 'CSS3 / 示例页面', sample: '/* AETHER Code Studio · CSS3 */' },
    { id: 'c', name: 'C', runtime: 'GCC · C17', sample: '/* AETHER Code Studio · C17 */' },
    { id: 'cpp', name: 'C++', runtime: 'G++ · C++17', sample: '/* AETHER Code Studio · C++17 */' },
    { id: 'java', name: 'Java', runtime: 'JDK · javac', sample: '/* AETHER Code Studio · Java */' },
    { id: 'kotlin', name: 'Kotlin', runtime: 'kotlinc · JVM 命令行', sample: '// AETHER Code Studio · Kotlin' },
    { id: 'swift', name: 'Swift', runtime: 'swiftc · 命令行', sample: '// AETHER Code Studio · Swift' },
    { id: 'rust', name: 'Rust', runtime: 'rustc', sample: '/* AETHER Code Studio · Rust */' },
    { id: 'go', name: 'Go', runtime: 'Go toolchain', sample: '/* AETHER Code Studio · Go */' },
    { id: 'php', name: 'PHP', runtime: 'PHP CLI', sample: '/* AETHER Code Studio · PHP */' },
    { id: 'asm', name: 'Assembly', runtime: 'NASM / GNU as', sample: '; AETHER Code Studio · Assembly' },
  ];
  const CODE_SAMPLES = {
    js: [
      '// AETHER Code Studio · JavaScript',
      'const y = 2;',
      'function f(x) {',
      '  const z = x + y;',
      '  console.log("z =", z);',
      '}',
      '',
      'f(1);',
      '',
      '// 把断点行设为 4，点击「调试」可停在这里。',
    ].join('\n'),
    py: [
      '# AETHER Code Studio · Python',
      'x = 1',
      'y = 2',
      'z = x + y',
      'print("z =", z)',
      '',
      '# 把断点行设为 4，点击「调试」可停在这里。',
    ].join('\n'),
    html: [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <title>AETHER HTML 预览</title>',
      '  <style>',
      '    body { margin: 0; min-height: 100vh; display: grid; place-items: center;',
      '      background: radial-gradient(circle at 50% 0%, #123 0, #02060a 70%);',
      '      color: #c9f4ff; font-family: system-ui, sans-serif; }',
      '    .card { padding: 28px 32px; border: 1px solid rgba(120,220,255,.25);',
      '      border-radius: 18px; background: rgba(8,18,28,.8);',
      '      box-shadow: 0 0 60px rgba(120,220,255,.12); text-align: center; }',
      '    h1 { margin: 0 0 8px; font-size: 26px; letter-spacing: .06em; }',
      '    button { margin-top: 14px; padding: 9px 18px; border: 1px solid #78dcff;',
      '      border-radius: 999px; background: transparent; color: #78dcff;',
      '      font-size: 14px; cursor: pointer; }',
      '    button:hover { background: rgba(120,220,255,.12); }',
      '  </style>',
      '</head>',
      '<body>',
      '  <main class="card">',
      '    <h1>AETHER HTML 预览</h1>',
      '    <p>这是真实沙盒 iframe 渲染的页面。</p>',
      '    <button id="go">点击测试脚本</button>',
      '    <p id="out"></p>',
      '  </main>',
      '  <script>',
      '    document.getElementById("go").onclick = () => {',
      '      document.getElementById("out").textContent = "脚本已运行 · " +',
      '        new Date().toLocaleTimeString("zh-CN", { hour12: false });',
      '    };',
      '  <\/script>',
      '</body>',
      '</html>',
    ].join('\n'),
    css: [
      '/* AETHER CSS 预览 · 规则作用于下方示例页面 */',
      ':root {',
      '  --bg: #02060a;',
      '  --ink: #c9f4ff;',
      '  --acc: #78dcff;',
      '}',
      'body {',
      '  margin: 0;',
      '  min-height: 100vh;',
      '  display: grid;',
      '  place-items: center;',
      '  background: radial-gradient(circle at 50% 0%, #123 0, var(--bg) 70%);',
      '  color: var(--ink);',
      '  font-family: system-ui, sans-serif;',
      '}',
      '.card {',
      '  padding: 30px 34px;',
      '  border: 1px solid rgba(120, 220, 255, .28);',
      '  border-radius: 20px;',
      '  background: rgba(8, 18, 28, .82);',
      '  box-shadow: 0 0 70px rgba(120, 220, 255, .14);',
      '  text-align: center;',
      '}',
      'h1 {',
      '  margin: 0 0 8px;',
      '  font-size: 26px;',
      '  letter-spacing: .08em;',
      '}',
      'p { color: #8fb8c8; }',
      '.btn {',
      '  margin-top: 12px;',
      '  padding: 9px 20px;',
      '  border: 1px solid var(--acc);',
      '  border-radius: 999px;',
      '  background: transparent;',
      '  color: var(--acc);',
      '  font-size: 14px;',
      '  cursor: pointer;',
      '}',
      '.btn:hover { background: rgba(120, 220, 255, .12); }',
    ].join('\n'),
    c: [
      '#include <stdio.h>',
      '',
      'int main(void) {',
      '    int x = 1;',
      '    int y = 2;',
      '    int z = x + y;',
      '    printf("z = %d\\n", z);',
      '    return 0;',
      '}',
    ].join('\n'),
    cpp: [
      '#include <iostream>',
      '',
      'int main() {',
      '    int x = 1;',
      '    int y = 2;',
      '    int z = x + y;',
      '    std::cout << "z = " << z << "\\n";',
      '    return 0;',
      '}',
    ].join('\n'),
    java: [
      'public class Main {',
      '    public static void main(String[] args) {',
      '        int x = 1;',
      '        int y = 2;',
      '        int z = x + y;',
      '        System.out.println("z = " + z);',
      '    }',
      '}',
    ].join('\n'),
    kotlin: [
      '// AETHER Code Studio · Kotlin（JVM 命令行，不是 Android APK）',
      'fun main() {',
      '    val x = 1',
      '    val y = 2',
      '    val z = x + y',
      '    println("z = $z")',
      '}',
    ].join('\n'),
    swift: [
      '// AETHER Code Studio · Swift（命令行程序，不是 iOS App）',
      'let x = 1',
      'let y = 2',
      'let z = x + y',
      'print("z = \\(z)")',
    ].join('\n'),
    rust: [
      'fn main() {',
      '    let x = 1;',
      '    let y = 2;',
      '    let z = x + y;',
      '    println!("z = {}", z);',
      '}',
    ].join('\n'),
    go: [
      'package main',
      '',
      'import "fmt"',
      '',
      'func main() {',
      '    x := 1',
      '    y := 2',
      '    z := x + y',
      '    fmt.Println("z =", z)',
      '}',
    ].join('\n'),
    php: [
      '<?php',
      '$x = 1;',
      '$y = 2;',
      '$z = $x + $y;',
      'echo "z = $z\\n";',
    ].join('\n'),
  };
  function asmSample(platform, arch) {
    const kind = (() => {
      if (platform === 'windows' || (!platform && /Windows/i.test(navigator.userAgent))) return 'win64';
      if (arch === 'aarch64' || arch === 'arm64') return 'aarch64';
      if (arch === 'armv7l' || arch === 'arm') return 'armv7';
      if (arch === 'i386' || arch === 'i686') return 'i386';
      if (!platform && /iPhone|iPad|Android/i.test(navigator.userAgent)) return 'aarch64';
      return 'linux64';
    })();
    if (kind === 'win64') {
      return [
        '; Windows x64 · Microsoft ABI（rcx/rdx + 32 字节影子空间）',
        'global main',
        'extern printf',
        'section .data',
        'fmt: db "%d", 10, 0',
        'section .text',
        'main:',
        '    push rbp',
        '    mov rbp, rsp',
        '    sub rsp, 32',
        '    lea rcx, [rel fmt]',
        '    mov rdx, 3',
        '    xor eax, eax',
        '    call printf',
        '    add rsp, 32',
        '    xor eax, eax',
        '    pop rbp',
        '    ret',
      ].join('\n');
    }
    if (kind === 'aarch64') {
      return [
        '; Linux ARM64 · GNU as',
        '.section .rodata',
        'fmt: .asciz "%d\\n"',
        '.text',
        '.global main',
        'main:',
        '    stp x29, x30, [sp, -16]!',
        '    mov x29, sp',
        '    adrp x0, fmt',
        '    add x0, x0, :lo12:fmt',
        '    mov x1, #3',
        '    bl printf',
        '    mov w0, #0',
        '    ldp x29, x30, [sp], 16',
        '    ret',
      ].join('\n');
    }
    if (kind === 'armv7') {
      return [
        '; Linux ARMv7 · GNU as · 原始系统调用',
        '.section .rodata',
        'msg: .asciz "AETHER ASM\\n"',
        '.text',
        '.global _start',
        '.global main',
        '_start:',
        'main:',
        '    mov r0, #1',
        '    ldr r1, =msg',
        '    mov r2, #11',
        '    mov r7, #4',
        '    svc #0',
        '    mov r0, #0',
        '    mov r7, #1',
        '    svc #0',
      ].join('\n');
    }
    if (kind === 'i386') {
      return [
        '; Linux i386 · GNU as · 原始系统调用',
        '.section .rodata',
        'msg: .ascii "AETHER ASM\\n"',
        'len = . - msg',
        '.text',
        '.global _start',
        '.global main',
        '_start:',
        'main:',
        '    movl $4, %eax',
        '    movl $1, %ebx',
        '    movl $msg, %ecx',
        '    movl $len, %edx',
        '    int $0x80',
        '    movl $1, %eax',
        '    xorl %ebx, %ebx',
        '    int $0x80',
      ].join('\n');
    }
    return [
      '; Linux x86-64 · NASM · System V ABI',
      'global main',
      'extern printf',
      'section .data',
      'fmt: db "%d", 10, 0',
      'section .text',
      'main:',
      '    push rbp',
      '    mov rbp, rsp',
      '    mov rsi, 3',
      '    lea rdi, [rel fmt]',
      '    xor eax, eax',
      '    call printf',
      '    xor eax, eax',
      '    pop rbp',
      '    ret',
    ].join('\n');
  }
  function sampleFor(lang, probe) {
    if (lang === 'asm') return asmSample(probe && probe.platform, probe && probe.arch);
    return CODE_SAMPLES[lang] || '';
  }
  function suggestedBp(lang, probe) {
    if (lang === 'asm') {
      const sample = sampleFor('asm', probe);
      const lines = sample.split('\n');
      const idx = lines.findIndex(line => /call printf|bl printf|svc #0|int \$0x80/.test(line));
      return idx >= 0 ? idx + 1 : 1;
    }
    return { js: 4, py: 4, c: 7, cpp: 7, java: 6, kotlin: 5, swift: 4, rust: 5, go: 9, php: 5 }[lang] || 1;
  }
  function lineColumn(text, index) {
    const before = text.slice(0, index);
    const line = before.split('\n').length;
    return { line, column: index - before.lastIndexOf('\n') };
  }
  function checkHtmlTags(code) {
    const diags = [];
    const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
    const OPTIONAL = new Set(['p', 'li', 'dt', 'dd', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'option', 'optgroup', 'colgroup', 'caption', 'rt', 'rp']);
    const masked = code
      .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, tag, body, close) => open + body.replace(/[^\n]/g, ' ') + close);
    const re = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
    const stack = [];
    let m;
    while ((m = re.exec(masked))) {
      const closing = m[1] === '/';
      const tag = m[2].toLowerCase();
      const attrs = m[3] || '';
      if (!closing && (VOID.has(tag) || /\/\s*$/.test(attrs))) continue;
      const at = lineColumn(masked, m.index);
      if (closing) {
        let idx = stack.length - 1;
        while (idx >= 0 && stack[idx].tag !== tag) idx--;
        if (idx < 0) {
          diags.push({ ...at, severity: 'error', message: '多余的结束标签 </' + tag + '>，没有对应的开始标签' });
          continue;
        }
        stack.splice(idx + 1).filter(e => !OPTIONAL.has(e.tag)).forEach(e => {
          diags.push({ line: e.line, column: e.column, severity: 'warning', message: '<' + e.tag + '> 未显式闭合，浏览器会自动补全' });
        });
        stack.pop();
      } else {
        stack.push({ tag, ...at });
      }
    }
    stack.filter(e => !OPTIONAL.has(e.tag)).forEach(e => {
      diags.push({ line: e.line, column: e.column, severity: 'error', message: '<' + e.tag + '> 没有结束标签' });
    });
    return diags.slice(0, 20);
  }
  function checkCssSyntax(code) {
    const diags = [];
    const pairs = { '{': '}', '(': ')', '[': ']' };
    const stack = [];
    let inComment = false;
    let inString = null;
    let line = 1;
    let column = 1;
    let i = 0;
    while (i < code.length) {
      const ch = code[i];
      const next = code[i + 1];
      if (inComment) {
        if (ch === '*' && next === '/') { inComment = false; i += 2; column += 2; continue; }
        if (ch === '\n') { line += 1; column = 1; } else column += 1;
        i += 1;
        continue;
      }
      if (inString) {
        if (ch === '\\') { i += 2; column += 2; continue; }
        if (ch === inString) { inString = null; i += 1; column += 1; continue; }
        if (ch === '\n') {
          diags.push({ line, column, severity: 'error', message: '字符串没有闭合' });
          inString = null;
          line += 1;
        }
        i += 1;
        column = 1;
        continue;
      }
      if (ch === '/' && next === '*') { inComment = true; i += 2; column += 2; continue; }
      if (ch === '"' || ch === "'") { inString = ch; i += 1; column += 1; continue; }
      if (ch === '{' || ch === '(' || ch === '[') { stack.push({ ch, line, column }); i += 1; column += 1; continue; }
      if (ch === '}' || ch === ')' || ch === ']') {
        const open = stack.pop();
        if (!open) diags.push({ line, column, severity: 'error', message: '多余的 ' + ch });
        else if (pairs[open.ch] !== ch) diags.push({ line, column, severity: 'error', message: ch + ' 与第 ' + open.line + ' 行的 ' + open.ch + ' 不匹配' });
        i += 1;
        column += 1;
        continue;
      }
      if (ch === '\n') { line += 1; column = 1; i += 1; continue; }
      i += 1;
      column += 1;
    }
    if (inString) diags.push({ line, column, severity: 'error', message: '字符串没有闭合' });
    if (inComment) diags.push({ line, column, severity: 'warning', message: '注释没有闭合' });
    stack.slice(0, 10).forEach(open => {
      diags.push({ line: open.line, column: open.column, severity: 'error', message: open.ch + ' 没有闭合' });
    });
    return diags.slice(0, 20);
  }

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
    sub: 'HTML · CSS · JS · PYTHON · C · C++ · JAVA · KOTLIN · SWIFT · RUST · GO · PHP · ASM',
    icon: 'code',
    accent: '#a97bff',
    order: 80,
    flush: true,
    render(root, api) {
      root.classList.add('code-root');
      let lang = Aether.store.get('code.lang', 'js');
      if (!LANG_DEFS.some(item => item.id === lang)) lang = 'js';
      const savedCode = {};
      LANG_DEFS.forEach(item => { savedCode[item.id] = Aether.store.get('code.' + item.id, ''); });
      let pyodide = null;
      let pyLoading = false;
      let probe = null;
      let probing = false;
      let busy = false;
      let ticker = null;

      root.innerHTML = `
        <div class="code-top">
          <select id="langSel" class="ts-select" style="width:auto;flex:0 0 auto">
            ${LANG_DEFS.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}
          </select>
          <span class="tag code-bridge-tag" id="bridgeTag">检测中</span>
          <button class="btn sm ghost" id="helpBtn" style="margin-left:auto">说明</button>
          <button class="btn sm ghost" id="bridgeBtn">桥接</button>
        </div>
        <div class="code-tools">
          <button class="btn sm solid" id="runBtn">▶ 运行</button>
          <button class="btn sm ghost" id="debugBtn">◉ 调试</button>
          <label class="code-bp">断点 <input id="bpInput" type="number" min="1" inputmode="numeric"></label>
          <button class="btn sm ghost" id="clearBtn" style="margin-left:auto">清屏</button>
        </div>
        <div class="code-hint" id="codeHint"></div>
        <div class="code-bridge-panel hidden" id="bridgePanel">
          <div class="code-bridge-grid">
            <div class="field"><input id="bridgeEndpoint" placeholder="http://127.0.0.1:8787"></div>
            <div class="field"><input id="bridgeToken" type="password" placeholder="桥接令牌" autocomplete="off"></div>
            <select id="bridgeDistro" class="ts-select">
              <option value="ubuntu">ubuntu</option>
              <option value="kali">kali</option>
              <option value="deepin">deepin</option>
              <option value="alpine">alpine (iSH)</option>
            </select>
          </div>
          <div class="code-bridge-actions">
            <button class="btn sm solid" id="bridgeSave">保存并检测</button>
            <button class="btn sm ghost" id="bridgeOff">断开</button>
          </div>
          <p class="note">令牌在本机桥接启动时显示，只保存在当前设备。Android 用 Termux/proot，iPhone 用 iSH。</p>
        </div>
        <div class="code-help-panel hidden" id="helpPanel">
          <div class="code-help-head">
            <strong>支持 13 种语言 · DEBUG 说明</strong>
            <button class="btn sm ghost" id="helpClose">收起</button>
          </div>
          <p class="code-help-lead">共 13 种：JavaScript、Python、HTML、CSS、C、C++、Java、Kotlin、Swift、Rust、Go、PHP、汇编（Assembly）。JavaScript、Python、HTML、CSS 可在浏览器沙盒直接运行；其余 9 种必须连接本机桥接调用已安装的编译器。Kotlin 编译 JVM 命令行程序，不构建 Android APK；Swift 编译命令行程序，不构建 iOS App。</p>
          <div class="code-help-grid">
            <section class="code-lang-card"><h4>JavaScript <em>可浏览器运行</em></h4><p class="rt">Node.js / 浏览器引擎</p><p class="dbg"><b>调试：</b>node inspect（需 Node.js；浏览器沙盒无断点）</p></section>
            <section class="code-lang-card"><h4>Python <em>可浏览器运行</em></h4><p class="rt">CPython / Pyodide</p><p class="dbg"><b>调试：</b>pdb（桥接）；Pyodide 首次运行需联网加载</p></section>
            <section class="code-lang-card"><h4>HTML <em>可浏览器运行</em></h4><p class="rt">HTML5 / 沙盒 iframe</p><p class="dbg"><b>检查：</b>标签配对；「运行」渲染完整页面，无程序断点</p></section>
            <section class="code-lang-card"><h4>CSS <em>可浏览器运行</em></h4><p class="rt">CSS3 / 示例页面</p><p class="dbg"><b>检查：</b>括号与字符串配对；预览作用于内置示例页面</p></section>
            <section class="code-lang-card"><h4>C <em>需桥接</em></h4><p class="rt">GCC · C17</p><p class="dbg"><b>调试：</b>gdb，断点停在指定源码行</p></section>
            <section class="code-lang-card"><h4>C++ <em>需桥接</em></h4><p class="rt">G++ · C++17</p><p class="dbg"><b>调试：</b>gdb，断点停在指定源码行</p></section>
            <section class="code-lang-card"><h4>Java <em>需桥接</em></h4><p class="rt">JDK · javac / java</p><p class="dbg"><b>调试：</b>jdb，按类与行号设置断点</p></section>
            <section class="code-lang-card"><h4>Kotlin <em>需桥接</em></h4><p class="rt">kotlinc · JVM 命令行</p><p class="dbg"><b>调试：</b>暂未接入自动断点；「调试」编译运行并定位错误行列，可在宿主机用 jdb 手动调试。不构建 Android APK</p></section>
            <section class="code-lang-card"><h4>Swift <em>需桥接</em></h4><p class="rt">swiftc · 命令行</p><p class="dbg"><b>调试：</b>暂未接入自动断点；「调试」编译运行并定位错误行列，可在宿主机用 lldb 手动调试。不构建 iOS App，iSH 不能安装官方 Swift 工具链</p></section>
            <section class="code-lang-card"><h4>Rust <em>需桥接</em></h4><p class="rt">rustc</p><p class="dbg"><b>调试：</b>gdb，调试构建关闭优化</p></section>
            <section class="code-lang-card"><h4>Go <em>需桥接</em></h4><p class="rt">Go toolchain</p><p class="dbg"><b>调试：</b>gdb，以入口函数为断点定位</p></section>
            <section class="code-lang-card"><h4>PHP <em>需桥接</em></h4><p class="rt">PHP CLI</p><p class="dbg"><b>调试：</b>phpdbg，断点停在指定行</p></section>
            <section class="code-lang-card"><h4>汇编 Assembly <em>需桥接</em></h4><p class="rt">NASM（x86-64）/ GNU as + ld</p><p class="dbg"><b>调试：</b>gdb；Windows NASM 无行号表，只能停在入口；模板按桥接架构生成，Termux ARM64 不能运行 x86 汇编</p></section>
          </div>
          <div class="code-debug-box">
            <h4>DEBUG 用来做什么</h4>
            <p><b>断点暂停：</b>在「断点」填入行号（点源码行号可先定位），再点「调试」。程序会由 pdb / node inspect / jdb / phpdbg / gdb 真实执行，运行到该行后暂停，并输出调用栈与局部变量。</p>
            <p><b>精确定位错误：</b>编译与运行错误会被解析为「文件 · 行 · 列 · 级别 · 消息」。控制台中的诊断项可点击，直接跳到并选中出错源码行；无行列信息时如实显示原始输出。</p>
            <p><b>HTML / CSS：</b>没有程序断点，「检查」会做标签或括号、字符串配对检查并标出错误行列；「运行」打开沙盒预览。CSS 预览作用于内置示例页面，完整页面请写 HTML 并内嵌样式。iframe 不读取本系统令牌，也不与主页面同源。</p>
            <p><b>Kotlin / Swift：</b>「调试」当前会编译并直接运行，再解析错误行列；交互断点需在宿主机用 jdb / lldb 手动进行。Kotlin 只面向 JVM 命令行，Swift 只面向命令行程序；本系统不包含 Android SDK / Gradle，也不包含 Xcode，不能在这里构建 APK 或 iOS App。</p>
            <p><b>不是：</b>不是完整 IDE 或 gdb 图形前端，不支持反向调试、热改变量后继续执行；工具链或调试器未安装时，「调试」会退回普通运行并仍尝试定位错误行。</p>
          </div>
        </div>
        <div class="code-editor-wrap">
          <div class="code-lines" id="codeLines"></div>
          <textarea class="code-editor" id="codeEditor" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
        </div>
        <div class="code-console">
          <div class="code-console-head"><span>OUTPUT · DIAGNOSTICS</span><span id="codeStatus">READY</span></div>
          <div class="code-diags" id="codeDiags"></div>
          <pre id="codeOut"></pre>
        </div>
        <div class="code-preview hidden" id="codePreview">
          <div class="code-preview-bar">
            <strong id="previewTitle">预览</strong>
            <span>沙盒 iframe · 与系统隔离 · 不读取令牌</span>
            <button class="btn sm ghost" id="previewClose">关闭</button>
          </div>
          <iframe id="previewFrame" sandbox="allow-scripts" title="HTML / CSS 沙盒预览"></iframe>
        </div>
      `;
      const sel = root.querySelector('#langSel');
      const editor = root.querySelector('#codeEditor');
      const lines = root.querySelector('#codeLines');
      const out = root.querySelector('#codeOut');
      const status = root.querySelector('#codeStatus');
      const diagsEl = root.querySelector('#codeDiags');
      const hintEl = root.querySelector('#codeHint');
      const tagEl = root.querySelector('#bridgeTag');
      const bpInput = root.querySelector('#bpInput');
      const bridgePanel = root.querySelector('#bridgePanel');
      const helpPanel = root.querySelector('#helpPanel');
      const previewEl = root.querySelector('#codePreview');
      const previewFrame = root.querySelector('#previewFrame');
      const previewTitle = root.querySelector('#previewTitle');
      const runBtn = root.querySelector('#runBtn');
      const debugBtn = root.querySelector('#debugBtn');
      let lastLineCount = -1;

      const cfg = () => bridgeCfg();
      const langDef = () => LANG_DEFS.find(item => item.id === lang) || LANG_DEFS[0];

      function write(text, cls = '') {
        const span = document.createElement('span');
        if (cls) span.className = cls;
        span.textContent = String(text).endsWith('\n') ? String(text) : String(text) + '\n';
        out.appendChild(span);
        while (out.childNodes.length > 500) out.removeChild(out.firstChild);
        out.scrollTop = out.scrollHeight;
      }
      function divider(label) { write('── ' + label + ' ──', 'dim'); }
      function updateLines(force = false) {
        const n = editor.value.split('\n').length;
        if (force || n !== lastLineCount) {
          lines.innerHTML = Array.from({ length: n }, (_, i) => `<span class="cl" data-line="${i + 1}">${i + 1}</span>`).join('');
          lastLineCount = n;
        }
        lines.scrollTop = editor.scrollTop;
        applyBpMark();
      }
      function lineOffsets(value) {
        const starts = [0];
        for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 10) starts.push(i + 1);
        return starts;
      }
      function jumpTo(line, column) {
        if (!line) return;
        const starts = lineOffsets(editor.value);
        const idx = Math.max(1, Math.min(Number(line) || 1, starts.length));
        const start = starts[idx - 1];
        const end = idx < starts.length ? starts[idx] - 1 : editor.value.length;
        const col = column ? Math.max(0, Math.min(Number(column) - 1, end - start)) : 0;
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(start + col, end);
        const lh = parseFloat(getComputedStyle(editor).lineHeight) || 19;
        editor.scrollTop = Math.max(0, (idx - 4) * lh);
        lines.scrollTop = editor.scrollTop;
      }
      function clearMarks() {
        lines.querySelectorAll('.cl.err,.cl.warn,.cl.bp,.cl.hit').forEach(el => el.classList.remove('err', 'warn', 'bp', 'hit'));
      }
      function markLine(line, cls) {
        const el = lines.querySelector('.cl[data-line="' + line + '"]');
        if (el) el.classList.add(cls);
      }
      function applyBpMark() {
        if (lang === 'html' || lang === 'css') return;
        clearMarks();
        const bp = parseInt(bpInput.value, 10);
        if (bp > 0) markLine(bp, 'bp');
      }
      function saveCode() {
        Aether.store.set('code.lang', lang);
        Aether.store.set('code.' + lang, editor.value);
        const bp = parseInt(bpInput.value, 10);
        if (bp > 0) Aether.store.set('code.bp.' + lang, bp);
      }
      const saveSoon = debounce(saveCode, 300);

      function renderDiagnostics(diags, action) {
        diagsEl.innerHTML = '';
        applyBpMark();
        const items = (diags || []).filter(item => item && (item.line || item.message));
        items.forEach(item => {
          if (!item.line) return;
          markLine(item.line, item.severity === 'error' ? 'err' : item.severity === 'warning' ? 'warn' : 'hit');
        });
        if (!items.length) {
          if (action === 'debug') {
            diagsEl.innerHTML = '<div class="diag-empty">调试器已启动，但没有返回可解析的源码行。请查看下方原始输出。</div>';
          }
          return;
        }
        items.slice(0, 10).forEach(item => {
          const btn = document.createElement('button');
          btn.className = 'diag-item ' + (item.severity || 'info');
          const loc = item.line
            ? '第 ' + item.line + ' 行' + (item.column ? ' 第 ' + item.column + ' 列' : '')
            : '全局';
          btn.innerHTML = `<span class="diag-loc">${loc}</span><span class="diag-msg"></span>`;
          btn.querySelector('.diag-msg').textContent = (item.severity === 'error' ? '错误：' : item.severity === 'warning' ? '警告：' : '') + (item.message || '');
          btn.addEventListener('click', () => jumpTo(item.line, item.column));
          diagsEl.appendChild(btn);
        });
        const firstError = items.find(item => item.severity === 'error') || items.find(item => item.line);
        if (firstError && firstError.line) jumpTo(firstError.line, firstError.column);
      }

      function updateHint() {
        const conf = cfg();
        const def = langDef();
        if (lang === 'html' || lang === 'css') {
          hintEl.textContent = (lang === 'html' ? 'HTML' : 'CSS') + '：浏览器沙盒直接预览；「检查」做基础配对检查并定位行列，无程序断点。';
          return;
        }
        if (!conf) {
          hintEl.textContent = '未连接桥接：JavaScript / Python / HTML / CSS 可在浏览器沙盒运行；C/C++/Java/Kotlin/Swift/Rust/Go/PHP/汇编和断点调试需要本机桥接。';
          return;
        }
        if (!probe) {
          hintEl.textContent = probing ? '正在探测桥接工具链…' : '桥接已配置，但尚未连接。点击右上角「桥接」检查地址与令牌。';
          return;
        }
        if (probe.available === false) {
          hintEl.textContent = probe.error || '桥接没有可用的代码执行环境。';
          return;
        }
        const langs = probe.langs || {};
        const debug = probe.debug || {};
        if (langs[lang] === false) {
          hintEl.textContent = `${def.name} 工具链未安装：${def.runtime}。在桥接环境安装后重新检测。`;
        } else if (debug[lang] === false) {
          hintEl.textContent = `${def.name} 可运行，但未检测到调试器；「调试」会退回普通运行并定位错误行。`;
        } else {
          hintEl.textContent = `${probe.platform.toUpperCase()} · ${probe.arch} · ${def.runtime} · 调试器就绪`;
        }
      }

      function updateTag(text, cls) {
        tagEl.textContent = text;
        tagEl.classList.remove('ok', 'warn', 'err');
        if (cls) tagEl.classList.add(cls);
      }

      async function probeBridge() {
        const conf = cfg();
        probe = null;
        if (!conf) {
          updateTag('浏览器沙盒');
          updateHint();
          return;
        }
        probing = true;
        updateTag('检测中');
        updateHint();
        try {
          const data = await bridgeJson(conf, '/api/studio', {
            action: 'probe', distro: bridgeDistro(conf),
          }, 7000);
          probe = data;
          if (data.available === false) {
            updateTag('受限', 'warn');
          } else {
            updateTag(`${data.platform || 'bridge'} · ${data.arch || ''}`, 'ok');
            if (lang === 'asm' && !savedCode.asm) {
              editor.value = sampleFor('asm', probe);
              updateLines(true);
            }
          }
        } catch (err) {
          updateTag('离线', 'err');
          probe = null;
          hintEl.textContent = err.message + '。点击右上角「桥接」检查地址与令牌。';
        } finally {
          probing = false;
          if (probe) updateHint();
        }
      }

      function currentLine() {
        const pos = editor.selectionStart;
        return editor.value.slice(0, pos).split('\n').length;
      }

      function syncLangChrome() {
        const markup = lang === 'html' || lang === 'css';
        bpInput.disabled = markup;
        bpInput.closest('.code-bp').style.display = markup ? 'none' : '';
        debugBtn.textContent = markup ? '◉ 检查' : '◉ 调试';
      }

      function loadLang(next) {
        saveCode();
        lang = next;
        sel.value = next;
        editor.value = savedCode[next] || sampleFor(next, probe);
        const bp = Aether.store.get('code.bp.' + next, suggestedBp(next, probe));
        bpInput.value = bp;
        syncLangChrome();
        updateLines(true);
        diagsEl.innerHTML = '';
        saveSoon();
        api.setSub(langDef().name + ' · ' + langDef().runtime);
        updateHint();
      }

      editor.addEventListener('input', () => { updateLines(); saveSoon(); });
      editor.addEventListener('scroll', () => { lines.scrollTop = editor.scrollTop; }, { passive: true });
      editor.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = editor.selectionStart, end = editor.selectionEnd;
          editor.value = editor.value.slice(0, start) + '  ' + editor.value.slice(end);
          editor.selectionStart = editor.selectionEnd = start + 2;
          updateLines(); saveSoon();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          requestRun(e.shiftKey ? 'debug' : 'run');
        }
      });
      lines.addEventListener('click', e => {
        const el = e.target.closest('.cl');
        if (el) jumpTo(el.dataset.line, 1);
      });
      bpInput.addEventListener('input', () => { applyBpMark(); saveSoon(); });
      sel.addEventListener('change', () => loadLang(sel.value));
      root.querySelector('#clearBtn').addEventListener('click', () => {
        out.textContent = '';
        diagsEl.innerHTML = '';
        status.textContent = 'READY';
        applyBpMark();
      });

      root.querySelector('#helpBtn').addEventListener('click', () => {
        helpPanel.classList.toggle('hidden');
        if (!helpPanel.classList.contains('hidden')) bridgePanel.classList.add('hidden');
      });
      root.querySelector('#helpClose').addEventListener('click', () => helpPanel.classList.add('hidden'));
      root.querySelector('#bridgeBtn').addEventListener('click', () => {
        bridgePanel.classList.toggle('hidden');
        if (!bridgePanel.classList.contains('hidden')) {
          helpPanel.classList.add('hidden');
          const conf = cfg();
          root.querySelector('#bridgeEndpoint').value = (conf && conf.endpoint) || location.origin;
          root.querySelector('#bridgeToken').value = (conf && conf.token) || '';
          root.querySelector('#bridgeDistro').value = (conf && conf.distro) || 'ubuntu';
        }
      });
      root.querySelector('#bridgeSave').addEventListener('click', async () => {
        const endpoint = root.querySelector('#bridgeEndpoint').value.trim().replace(/\/+$/, '');
        const token = root.querySelector('#bridgeToken').value.trim();
        let distro = root.querySelector('#bridgeDistro').value;
        if (!endpoint || !token) { api.toast('请填写桥接地址和令牌', 'err'); return; }
        updateTag('保存中');
        try {
          const temp = { endpoint, token, distro };
          const health = await bridgeJson(temp, '/api/health', undefined, 6000);
          temp.mode = health.mode === 'ish' ? 'ish' : health.mode === 'termux' ? 'termux' : undefined;
          if (!temp.mode) delete temp.mode;
          if (health.mode === 'ish') { distro = 'alpine'; temp.distro = 'alpine'; root.querySelector('#bridgeDistro').value = 'alpine'; }
          Aether.store.set('bridge', temp);
          bridgePanel.classList.add('hidden');
          api.toast('桥接已连接', 'ok');
          await probeBridge();
        } catch (err) {
          updateTag('失败', 'err');
          api.toast(err.message, 'err');
          hintEl.textContent = '连接失败：' + err.message;
        }
      });
      root.querySelector('#bridgeOff').addEventListener('click', () => {
        Aether.store.del('bridge');
        probe = null;
        updateTag('浏览器沙盒');
        updateHint();
        bridgePanel.classList.add('hidden');
        api.toast('已断开桥接');
      });

      async function getPyodide() {
        if (pyodide) return pyodide;
        if (pyLoading) { write('Pyodide 正在加载中，请稍候…', 'dim'); return null; }
        pyLoading = true;
        write('正在加载 Pyodide（首次运行需联网，约十几 MB）…', 'dim');
        await loadScript('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
        pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
        pyLoading = false;
        write('Pyodide 就绪。', 'dim');
        return pyodide;
      }

      function cssPreviewDoc(code) {
        return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<title>CSS 预览</title><style>' + code + '</style></head><body>' +
          '<main class="card"><h1>AETHER CSS 预览</h1>' +
          '<p>选择器作用于这个示例页面。</p><button class="btn">按钮</button></main>' +
          '</body></html>';
      }
      function openPreview(code) {
        if (lang === 'html') {
          previewTitle.textContent = 'HTML 预览 · 沙盒 iframe';
          previewFrame.srcdoc = code;
        } else {
          previewTitle.textContent = 'CSS 预览 · 示例页面';
          previewFrame.srcdoc = cssPreviewDoc(code);
        }
        previewEl.classList.remove('hidden');
      }
      root.querySelector('#previewClose').addEventListener('click', () => {
        previewEl.classList.add('hidden');
        previewFrame.srcdoc = '';
      });

      async function runBrowser(code, action) {
        if (lang === 'html' || lang === 'css') {
          const label = lang === 'html' ? 'HTML' : 'CSS';
          const diags = lang === 'html' ? checkHtmlTags(code) : checkCssSyntax(code);
          const errors = diags.filter(d => d.severity === 'error');
          renderDiagnostics(diags, action);
          diags.forEach(d => {
            write('· ' + (d.severity === 'error' ? '错误' : '提示') + '：第 ' + d.line + ' 行' +
              (d.column ? ' 第 ' + d.column + ' 列' : '') + ' — ' + d.message,
              d.severity === 'error' ? 'err' : 'dim');
          });
          if (action !== 'debug') openPreview(code);
          if (errors.length) {
            status.textContent = 'CHECK FAILED';
            write('· 基础检查发现 ' + errors.length + ' 个问题。' + (action === 'debug' ? '' : '浏览器仍会容错渲染，预览已打开。'), 'err');
          } else {
            status.textContent = action === 'debug' ? 'CHECKED' : 'PREVIEW';
            write(action === 'debug' ? '· 基础配对检查通过。' : '· 基础配对检查通过，预览已在沙盒 iframe 中渲染。', 'dim');
          }
          api.setSub(label + ' · 浏览器沙盒预览');
          return;
        }
        if (action === 'debug') {
          const msg = '浏览器沙盒不能提供真实断点。请连接本机桥接，然后使用「调试」。';
          write(msg, 'err');
          hintEl.textContent = msg;
          status.textContent = 'NO DEBUGGER';
          return;
        }
        const t0 = performance.now();
        if (lang === 'js') {
          const fakeConsole = {
            log: (...a) => write(a.map(x => {
              if (typeof x === 'object') { try { return JSON.stringify(x); } catch (e) { return String(x); } }
              return String(x);
            }).join(' ')),
            info: (...a) => fakeConsole.log(...a),
            warn: (...a) => write(a.map(String).join(' ') + '  [warn]', 'warn'),
            error: (...a) => write(a.map(String).join(' ') + '  [error]', 'err'),
          };
          try {
            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            await new AsyncFunction('console', code)(fakeConsole);
            write('· 完成，用时 ' + Math.round(performance.now() - t0) + ' ms', 'dim');
            status.textContent = 'DONE';
          } catch (err) {
            const stack = String(err && err.stack || err);
            write(stack, 'err');
            const m = stack.match(/(?:<anonymous>|main\.js):(\d+):(\d+)/);
            const line = m ? Math.max(1, Number(m[1]) - 2) : null;
            renderDiagnostics([{
              line, column: m ? Number(m[2]) : null, severity: 'error', file: 'main.js',
              message: (err && err.message) || String(err),
            }], 'run');
            status.textContent = 'ERROR';
          }
          return;
        }
        if (lang === 'py') {
          try {
            const py = await getPyodide();
            if (!py) { status.textContent = 'LOADING'; return; }
            py.setStdout({ batched: s => write(s) });
            py.setStderr({ batched: s => write(s, 'err') });
            await py.runPythonAsync(code);
            write('· 完成，用时 ' + Math.round(performance.now() - t0) + ' ms', 'dim');
            status.textContent = 'DONE';
          } catch (err) {
            const text = String(err && err.message || err);
            write(String(err && err.stack || err), 'err');
            const m = text.match(/line\s+(\d+)/i);
            renderDiagnostics([{
              line: m ? Number(m[1]) : null, column: null, severity: 'error', file: 'main.py',
              message: text.split('\n').pop() || 'Python 运行错误',
            }], 'run');
            status.textContent = 'ERROR';
          }
          return;
        }
        const msg = '浏览器沙盒不能编译 ' + langDef().name + '。请连接本机桥接（Termux/proot、iSH 或 Windows）。';
        write(msg, 'err');
        hintEl.textContent = msg;
        status.textContent = 'NO BRIDGE';
      }

      function startTicker(label) {
        clearInterval(ticker);
        const t0 = Date.now();
        status.textContent = label;
        ticker = setInterval(() => {
          if (!busy) { clearInterval(ticker); return; }
          status.textContent = label + ' ' + Math.floor((Date.now() - t0) / 1000) + 's';
        }, 800);
      }

      async function runNative(code, action, bp) {
        const conf = cfg();
        busy = true;
        runBtn.disabled = true;
        debugBtn.disabled = true;
        diagsEl.innerHTML = '';
        startTicker(action === 'debug' ? '调试中' : '编译运行');
        divider((action === 'debug' ? 'DEBUG' : 'RUN') + ' · ' + langDef().name + ' · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }));
        try {
          const data = await bridgeJson(conf, '/api/studio', {
            lang, code, action,
            breakpoint: action === 'debug' ? bp : null,
            distro: bridgeDistro(conf),
          }, action === 'debug' ? 30000 : 25000);
          if (data.output) write(data.output);
          if (Array.isArray(data.notes) && data.notes.length) {
            data.notes.forEach(note => write('· ' + note, 'dim'));
          }
          if (data.debugger) write('· 调试器：' + data.debugger, 'dim');
          renderDiagnostics(data.diagnostics, action);
          if (data.timed_out) {
            status.textContent = 'TIMEOUT';
            write('· 执行超时，已中止。', 'err');
          } else if (data.success) {
            status.textContent = action === 'debug' ? 'PAUSED' : 'DONE';
            if (action === 'debug') {
              const stop = (data.diagnostics || []).find(item => item.line);
              write('· 断点停在 ' + (stop ? '第 ' + stop.line + ' 行' : '调试器位置'), 'ok');
            } else {
              write('· 完成，用时 ' + (data.ms || 0) + ' ms', 'dim');
            }
          } else {
            status.textContent = 'FAILED';
            const first = (data.diagnostics || []).find(item => item.severity === 'error') || (data.diagnostics || [])[0];
            if (first && first.line) {
              write('· 错误定位：' + data.source + ' 第 ' + first.line + ' 行' + (first.column ? ' 第 ' + first.column + ' 列' : '') + ' — ' + first.message, 'err');
            } else if (!(data.diagnostics || []).length) {
              write('· 没有可解析的源码位置，请查看上方原始输出。', 'dim');
            }
          }
          api.setSub(langDef().name + ' · ' + (data.platform || 'bridge') + ' · ' + (data.debugger || 'runner'));
        } catch (err) {
          status.textContent = 'ERROR';
          write(err.message, 'err');
          hintEl.textContent = err.message;
        } finally {
          busy = false;
          runBtn.disabled = false;
          debugBtn.disabled = false;
          clearInterval(ticker);
        }
      }

      async function requestRun(action) {
        if (busy) return;
        const code = editor.value;
        if (!code.trim()) { api.toast('请先写点代码'); return; }
        saveCode();
        const markup = lang === 'html' || lang === 'css';
        let bp = null;
        if (action === 'debug' && !markup) {
          bp = parseInt(bpInput.value, 10);
          if (!bp || bp < 1) { bp = currentLine(); bpInput.value = bp; }
          if (!cfg()) {
            hintEl.textContent = '调试需要本机桥接。点击右上角「桥接」填写地址与令牌。';
            api.toast('调试需要连接桥接', 'err');
            bridgePanel.classList.remove('hidden');
            return;
          }
        }
        applyBpMark();
        if (markup || !cfg()) {
          await runBrowser(code, action);
          return;
        }
        await runNative(code, action, bp);
      }
      runBtn.addEventListener('click', () => requestRun('run'));
      debugBtn.addEventListener('click', () => requestRun('debug'));

      sel.value = lang;
      editor.value = savedCode[lang] || sampleFor(lang, probe);
      bpInput.value = Aether.store.get('code.bp.' + lang, suggestedBp(lang, probe));
      syncLangChrome();
      updateLines(true);
      api.setSub(langDef().name + ' · ' + langDef().runtime);
      updateHint();
      divider('CODE STUDIO READY');
      write('十三种语言：JavaScript · Python · HTML · CSS · C · C++ · Java · Kotlin · Swift · Rust · Go · PHP · 汇编（Assembly）。点顶部「说明」查看每种语言的运行与调试条件；Kotlin / Swift 只编译命令行程序，不构建 APK 或 iOS App。', 'dim');
      write('连接桥接后「调试」会直接停在断点并标出源码行列；运行错误也会自动跳到对应行。HTML/CSS 用「检查」验证配对，「运行」打开沙盒预览。', 'dim');
      probeBridge();
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
        link.href = 'vendor/leaflet/leaflet.css';
        document.head.appendChild(link);
      }
      const s = document.createElement('script');
      s.src = 'vendor/leaflet/leaflet.js';
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
          <div class="map-searchwrap">
            <div class="field map-search">
              <span class="mono" style="font-size:9px;color:var(--dim-2)">⌕</span>
              <input id="mapQuery" placeholder="搜索地点、地址、商铺（全球）" autocomplete="off">
              <button id="mapClear" class="map-inline hidden" aria-label="清空">${Aether.icon('x')}</button>
            </div>
            <div class="map-results hidden" id="mapResults"></div>
            <div class="map-status" id="mapStatus"></div>
          </div>
          <button class="map-fab" id="mapSearchBtn" title="搜索">${Aether.icon('search')}</button>
          <button class="map-fab" id="mapLocate" title="定位">${Aether.icon('location')}</button>
        </div>
        <div class="map-hud map-bottom">
          <div class="map-coords" id="mapCoords">LAT --.----<br>LNG --.----<br>ZOOM --</div>
          <div class="map-actions">
            <button class="map-fab" id="mapReset" title="清除标记与路线">${Aether.icon('refresh')}</button>
          </div>
        </div>
        <section class="map-sheet hidden" id="mapSheet">
          <div class="ms-handle"></div>
          <header class="ms-head">
            <div class="ms-headtext">
              <span class="ms-cat" id="msCat">地点</span>
              <h3 id="msName">--</h3>
              <p id="msAddr">--</p>
            </div>
            <button class="icon-btn" id="msClose" aria-label="关闭">${Aether.icon('x')}</button>
          </header>
          <div class="ms-modes" id="msModes">
            <button class="ms-mode" data-mode="driving">${Aether.icon('route')}<span>驾车</span></button>
            <button class="ms-mode" data-mode="walking">${Aether.icon('route')}<span>步行</span></button>
            <button class="ms-mode" data-mode="cycling">${Aether.icon('route')}<span>骑行</span></button>
          </div>
          <div class="ms-body" id="msBody"></div>
        </section>
      `;
      const P = Aether.places;
      const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const dial = n => (Aether.hotlines ? Aether.hotlines.dial(n) : String(n || '').replace(/[^\d+]/g, ''));
      const safeUrl = u => { try { const x = new URL(String(u), location.href); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
      const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
      const coordsEl = root.querySelector('#mapCoords');
      const resultsEl = root.querySelector('#mapResults');
      const queryEl = root.querySelector('#mapQuery');
      const clearEl = root.querySelector('#mapClear');
      const statusEl = root.querySelector('#mapStatus');
      const sheetEl = root.querySelector('#mapSheet');
      const msName = root.querySelector('#msName');
      const msCat = root.querySelector('#msCat');
      const msAddr = root.querySelector('#msAddr');
      const msBody = root.querySelector('#msBody');
      const msModes = root.querySelector('#msModes');
      const locateBtn = root.querySelector('#mapLocate');
      let map = null, userMarker = null, accCircle = null, targetMarker = null;
      let routeLayers = [], userLL = null, userSource = '', searchSeq = 0;
      let currentPlace = null, currentDetail = null, currentMode = 'driving';
      let detailSeq = 0, routeSeq = 0, cleaned = false, pendingStarted = false;
      let last = Aether.store.get('map.view', [31.2304, 121.4737, 12]);
      let mapReadyResolve;
      const mapReady = new Promise(r => { mapReadyResolve = r; });

      function setStatus(msg, kind = '') {
        if (!msg) { statusEl.className = 'map-status'; statusEl.textContent = ''; return; }
        statusEl.className = 'map-status show ' + kind;
        statusEl.textContent = msg;
      }
      function setCoords(lat, lng, zoom) {
        coordsEl.innerHTML = `LAT <b>${lat.toFixed(5)}</b><br>LNG <b>${lng.toFixed(5)}</b><br>ZOOM <b>${zoom}</b>`;
      }
      function fallback(msg) {
        const fb = document.createElement('div');
        fb.className = 'map-fallback';
        fb.innerHTML = `<div class="mf-orb">${Aether.icon('map')}</div><div class="note" style="max-width:280px">${esc(msg)}</div><p class="note">请检查网络后重新打开地图；索引仍可离线使用。</p>`;
        root.appendChild(fb);
        setStatus('地图引擎加载失败', 'err');
      }
      function openSheet() {
        sheetEl.classList.remove('hidden');
        root.classList.add('sheet-open');
        if (map) setTimeout(() => { if (map) map.invalidateSize(); }, 80);
      }
      function closeSheet() {
        sheetEl.classList.add('hidden');
        root.classList.remove('sheet-open');
      }
      function clearRoute() {
        routeLayers.forEach(layer => { try { layer.remove(); } catch (e) {} });
        routeLayers = [];
      }
      function applyUser(lat, lng, accuracy, source) {
        userLL = [lat, lng];
        userSource = source;
        Aether.setGPS(lat, lng, source);
        if (!map) { setCoords(lat, lng, 15); return; }
        if (userMarker) userMarker.remove();
        if (accCircle) accCircle.remove();
        userMarker = L.marker([lat, lng], {
          icon: L.divIcon({ className: '', html: '<div class="user-marker"><i></i></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
        }).addTo(map);
        if (accuracy) {
          accCircle = L.circle([lat, lng], { radius: Math.min(accuracy, 500), color: '#36e6ff', weight: 1, fillOpacity: .06 }).addTo(map);
        }
        const zoom = Math.max(map.getZoom() || 12, source === 'ip' ? 11 : 15);
        map.flyTo([lat, lng], zoom, { duration: 1.1 });
        setCoords(lat, lng, zoom);
      }
      async function ipFallback(reason) {
        setStatus('GPS 不可用（' + reason + '），正在尝试 IP 粗略定位…', 'warn');
        try {
          const ip = await P.ipLocate();
          if (cleaned) return null;
          applyUser(ip.lat, ip.lon, null, 'ip');
          const where = [ip.city, ip.region, ip.country].filter(Boolean).join(' · ');
          setStatus('已用 IP 定位' + (where ? '：' + where : '') + '（城市级精度，仅供搜索与路线起点参考）', 'warn');
          api.toast('已改用 IP 粗略定位');
          return userLL;
        } catch (err) {
          if (!cleaned) {
            setStatus('定位失败：' + reason + '。请检查系统定位权限与网络。', 'err');
            api.toast('定位失败：' + reason, 'err');
          }
          return null;
        }
      }
      function locate(silent) {
        locateBtn.classList.add('on');
        setStatus('正在获取 GPS 定位…');
        return new Promise(resolve => {
          const finish = value => { locateBtn.classList.remove('on'); resolve(value); };
          if (!navigator.geolocation) { ipFallback('浏览器不支持 GPS').then(finish); return; }
          navigator.geolocation.getCurrentPosition(pos => {
            if (cleaned) { finish(null); return; }
            const lat = pos.coords.latitude, lng = pos.coords.longitude, acc = pos.coords.accuracy || 0;
            applyUser(lat, lng, acc, 'gps');
            setStatus('GPS 定位成功' + (acc ? '，精度约 ' + Math.round(acc) + ' m' : ''), 'ok');
            if (!silent) api.toast('已获取 GPS 定位', 'ok');
            finish(userLL);
          }, err => {
            if (cleaned) { finish(null); return; }
            const reason = err.code === 1 ? '权限被拒绝' : err.code === 2 ? '位置不可用' : err.code === 3 ? '定位超时' : (err.message || '未知错误');
            ipFallback(reason).then(finish);
          }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 });
        });
      }
      async function ensureOrigin() {
        if (userLL) return userLL;
        return await locate(true);
      }
      function emergencyHtml(place) {
        if (!Aether.hotlines) return '';
        const h = Aether.hotlines.byCode(place.countrycode);
        if (!h) return '';
        const rows = [];
        if (h.u) rows.push(['紧急', h.u]);
        if (h.p) rows.push(['报警', h.p]);
        if (h.f) rows.push(['消防', h.f]);
        if (h.a) rows.push(['急救', h.a]);
        const uniq = [];
        rows.forEach(row => { if (!uniq.some(x => x[1] === row[1])) uniq.push(row); });
        return `<div class="ms-emergency"><b>${esc(h.n)}当地紧急电话</b><div class="ms-emg-row">${uniq.map(([label, num]) => `<a href="tel:${esc(dial(num))}"><span>${label}</span><strong>${esc(num)}</strong></a>`).join('')}</div></div>`;
      }
      function renderInfo() {
        if (!currentPlace) return;
        const p = currentPlace;
        const d = currentDetail || {};
        const tags = [`<span class="ms-tag">${esc(p.category || '地点')}</span>`];
        if (p.distance != null) tags.push(`<span class="ms-tag">直线 ${P.fmtDistance(p.distance)}</span>`);
        if (p.country) tags.push(`<span class="ms-tag">${esc(p.country)}</span>`);
        const rows = [];
        if (d.address) rows.push(`<div class="ms-row"><span class="ms-label">地址</span><div class="ms-value">${esc(d.address)}</div></div>`);
        if (d.phones && d.phones.length) {
          rows.push(`<div class="ms-row"><span class="ms-label">电话</span><div class="ms-value ms-phones">${d.phones.map(n => `<a href="tel:${esc(dial(n))}">${Aether.icon('phone')}${esc(n)}</a>`).join('')}</div></div>`);
        } else if (d.source === 'osm') {
          rows.push('<div class="ms-row"><span class="ms-label">电话</span><div class="ms-value dim">OSM 未收录电话</div></div>');
        }
        if (d.hours) rows.push(`<div class="ms-row"><span class="ms-label">营业</span><div class="ms-value">${esc(d.hours)}</div></div>`);
        const site = d.website ? safeUrl(d.website) : '';
        if (site) rows.push(`<div class="ms-row"><span class="ms-label">网站</span><div class="ms-value"><a href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(site))}</a></div></div>`);
        if (d.operator) rows.push(`<div class="ms-row"><span class="ms-label">运营</span><div class="ms-value">${esc(d.operator)}</div></div>`);
        if (d.error) rows.push(`<div class="ms-hint">详情源暂时不可达（${esc(d.error)}），地址与坐标仍可用。</div>`);
        if (!rows.length) rows.push('<div class="ms-hint">正在获取地址与联系方式…</div>');
        const coords = p.lat.toFixed(5) + ', ' + p.lon.toFixed(5);
        msBody.innerHTML = `
          <div class="ms-tags">${tags.join('')}</div>
          <div class="ms-rows">${rows.join('')}</div>
          ${emergencyHtml(p)}
          <button class="ms-copy" id="msCopy">${Aether.icon('copy')}复制坐标 ${esc(coords)}</button>
          <p class="ms-fine">地点数据 © OpenStreetMap 贡献者 · 电话与营业时间以商家公布为准</p>
        `;
        const copyBtn = msBody.querySelector('#msCopy');
        if (copyBtn) copyBtn.addEventListener('click', async () => {
          const ok = await Aether.copyText(coords);
          api.toast(ok ? '坐标已复制' : '复制失败', ok ? 'ok' : 'err');
        });
      }
      async function selectPlace(place) {
        if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
          api.toast('地点坐标无效', 'err');
          return;
        }
        currentPlace = place;
        currentDetail = null;
        currentMode = 'driving';
        const seq = ++detailSeq;
        routeSeq++;
        clearRoute();
        queryEl.value = place.name || '';
        clearEl.classList.remove('hidden');
        resultsEl.classList.add('hidden');
        msName.textContent = place.name || '未命名地点';
        msCat.textContent = place.category || '地点';
        msAddr.textContent = place.label || place.address || place.country || '';
        msModes.querySelectorAll('.ms-mode').forEach(b => b.classList.toggle('on', b.dataset.mode === currentMode));
        msBody.innerHTML = `<div class="ms-tags"><span class="ms-tag">${esc(place.category || '地点')}</span>${place.distance != null ? `<span class="ms-tag">直线 ${P.fmtDistance(place.distance)}</span>` : ''}</div><div class="ms-hint">正在获取地址、电话与营业时间…</div>${emergencyHtml(place)}`;
        openSheet();
        if (map) {
          if (targetMarker) targetMarker.remove();
          targetMarker = L.marker([place.lat, place.lon], {
            icon: L.divIcon({ className: '', html: '<div class="target-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8] })
          }).addTo(map);
          const zoom = Math.max(map.getZoom() || 12, 15);
          map.flyTo([place.lat, place.lon], zoom, { duration: 1.0 });
          setCoords(place.lat, place.lon, zoom);
        } else {
          setCoords(place.lat, place.lon, 15);
        }
        setStatus('已选中：' + (place.name || '未命名地点'), 'ok');
        try {
          const detail = await P.details(place);
          if (cleaned || seq !== detailSeq || currentPlace !== place) return;
          currentDetail = detail;
          renderInfo();
        } catch (err) {
          if (seq !== detailSeq) return;
          currentDetail = { error: String(err.message || err) };
          renderInfo();
        }
      }
      function drawRoute(r) {
        clearRoute();
        if (!map || !r.geometry.length) return;
        const glow = L.polyline(r.geometry, { color: '#36e6ff', weight: 14, opacity: .14, lineJoin: 'round' }).addTo(map);
        const line = L.polyline(r.geometry, { color: '#63f5dd', weight: 5, opacity: .95, lineJoin: 'round', lineCap: 'round' }).addTo(map);
        routeLayers = [glow, line];
        map.fitBounds(line.getBounds(), { paddingTopLeft: [30, 90], paddingBottomRight: [30, 300] });
      }
      function renderRoute(r) {
        const originLabel = userSource === 'ip' ? 'IP 粗略起点' : 'GPS 起点';
        const steps = r.steps.map((s, i) => `<li class="ms-step" data-i="${i}"><span class="ms-step-idx">${i + 1}</span><div><p>${esc(s.text)}</p><em>${P.fmtDistance(s.distance)}${i === r.steps.length - 1 ? '' : ' · ' + P.fmtDuration(s.duration)}</em></div></li>`).join('');
        msBody.innerHTML = `
          <div class="ms-route-head">
            <div><strong>${esc(P.modeName(r.mode))} ${P.fmtDistance(r.distance)}</strong><span>约 ${P.fmtDuration(r.duration)} · ${originLabel}</span></div>
            <button class="ms-clear" id="msClearRoute" aria-label="返回地点详情">${Aether.icon('x')}</button>
          </div>
          <ol class="ms-steps" id="msSteps">${steps}</ol>
          <p class="ms-fine">路线 © OSRM / FOSSGIS · 不含实时路况与限行，请以现场标识为准</p>
        `;
        const back = msBody.querySelector('#msClearRoute');
        if (back) back.addEventListener('click', () => { routeSeq++; clearRoute(); renderInfo(); });
        const list = msBody.querySelector('#msSteps');
        if (list) list.addEventListener('click', e => {
          const li = e.target.closest('.ms-step');
          if (!li || !map) return;
          const step = r.steps[Number(li.dataset.i)];
          if (step && step.location) map.flyTo(step.location, Math.max(map.getZoom(), 16), { duration: .7 });
        });
      }
      async function routeTo(mode) {
        if (!currentPlace) return;
        if (!map) { api.toast('地图尚未就绪', 'err'); return; }
        currentMode = mode;
        msModes.querySelectorAll('.ms-mode').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
        const seq = ++routeSeq;
        clearRoute();
        msBody.innerHTML = `<div class="ms-loading"><i></i>正在确认起点并规划${P.modeName(mode)}路线…</div>`;
        const origin = await ensureOrigin();
        if (cleaned || seq !== routeSeq) return;
        if (!origin) {
          renderInfo();
          setStatus('无法确定起点：请允许定位，或保持联网以使用 IP 定位', 'err');
          return;
        }
        try {
          const r = await P.route(origin, [currentPlace.lat, currentPlace.lon], mode);
          if (cleaned || seq !== routeSeq) return;
          drawRoute(r);
          renderRoute(r);
          setStatus(P.modeName(mode) + '路线已生成 · ' + P.fmtDistance(r.distance) + ' · 约 ' + P.fmtDuration(r.duration), 'ok');
        } catch (err) {
          if (seq !== routeSeq) return;
          renderInfo();
          const msg = String(err.message || err);
          setStatus('路线规划失败：' + msg, 'err');
          api.toast('路线规划失败：' + msg, 'err');
        }
      }
      async function search() {
        const q = queryEl.value.trim();
        if (!q) { api.toast('请输入地点、地址或商铺名称'); return; }
        if (!map) { api.toast('地图尚未就绪，请稍候', 'err'); return; }
        const seq = ++searchSeq;
        resultsEl.classList.remove('hidden');
        resultsEl.innerHTML = '<button disabled>搜索中…</button>';
        setStatus('正在搜索「' + q + '」…');
        const bias = userLL || [map.getCenter().lat, map.getCenter().lng];
        try {
          const found = await P.search(q, { lat: bias[0], lon: bias[1], limit: 40 });
          if (cleaned || seq !== searchSeq) return;
          const list = found.slice(0, 20);
          if (!list.length) {
            resultsEl.innerHTML = '<button disabled>没有匹配地点，试试城市名 + 地点名</button>';
            setStatus('没有结果：可补充城市或换用英文名称', 'warn');
            return;
          }
          resultsEl.innerHTML = '';
          list.forEach(place => {
            const b = document.createElement('button');
            b.innerHTML = `<span class="mr-name">${esc(place.name)}</span><span class="mr-meta">${esc(place.category)}${place.distance != null ? ' · ' + P.fmtDistance(place.distance) : ''}</span><span class="mr-sub">${esc(place.label || place.country || '')}</span>`;
            b.addEventListener('click', () => selectPlace(place));
            resultsEl.appendChild(b);
          });
          setStatus('找到 ' + list.length + ' 个地点 · 按相关度与距离排序', 'ok');
        } catch (err) {
          if (cleaned || seq !== searchSeq) return;
          resultsEl.innerHTML = '<button disabled>搜索服务不可达，请检查网络后重试</button>';
          setStatus('搜索失败：' + (err.message || err), 'err');
        }
      }
      async function consumePending() {
        if (pendingStarted) return;
        pendingStarted = true;
        const pending = Aether.store.get('map.pending', null);
        if (!pending || !Number.isFinite(pending.lat) || !Number.isFinite(pending.lon)) return;
        const ok = await mapReady;
        if (!ok || cleaned) return;
        Aether.store.del('map.pending');
        selectPlace(pending);
        if (pending.mode) setTimeout(() => { if (!cleaned) routeTo(pending.mode); }, 900);
      }
      (async () => {
        try {
          await loadLeaflet();
          if (cleaned) return;
          const host = root.querySelector('#leaflet-map');
          host.innerHTML = '';
          map = L.map(host, { zoomControl: true, attributionControl: true, minZoom: 2, maxZoom: 19 });
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
          mapReadyResolve(true);
          consumePending();
          setTimeout(() => { if (!cleaned && !userLL && !currentPlace) locate(true); }, 600);
        } catch (err) {
          leafletOnce = null;
          mapReadyResolve(false);
          fallback('地图引擎未能加载（可能离线或被网络拦截）。' + String(err.message || err));
        }
      })();
      root.querySelector('#mapLocate').addEventListener('click', () => locate(false));
      root.querySelector('#mapSearchBtn').addEventListener('click', search);
      queryEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      queryEl.addEventListener('input', () => { clearEl.classList.toggle('hidden', !queryEl.value); });
      clearEl.addEventListener('click', () => {
        queryEl.value = '';
        clearEl.classList.add('hidden');
        resultsEl.classList.add('hidden');
        setStatus('');
        queryEl.focus();
      });
      msModes.addEventListener('click', e => {
        const b = e.target.closest('.ms-mode');
        if (b && currentPlace) routeTo(b.dataset.mode);
      });
      root.querySelector('#msClose').addEventListener('click', () => closeSheet());
      root.querySelector('#mapReset').addEventListener('click', () => {
        routeSeq++;
        detailSeq++;
        clearRoute();
        if (targetMarker) { targetMarker.remove(); targetMarker = null; }
        currentPlace = null;
        currentDetail = null;
        closeSheet();
        resultsEl.classList.add('hidden');
        clearEl.classList.add('hidden');
        queryEl.value = '';
        setStatus(userSource ? '已清除地点标记；定位仍保留' : '已清除标记');
      });
      api.onClose(() => {
        cleaned = true;
        searchSeq++;
        routeSeq++;
        detailSeq++;
        if (map) { try { map.remove(); } catch (e) {} map = null; }
      });
      api.setSub('GPS / IP 定位 · 真实路线 · 全球地点');
    }
  });

  /* ============================================================
     电话黄页
     ============================================================ */
  Aether.registerApp({
    id: 'yellow',
    name: '黄页',
    sub: '全球地点 · 紧急电话',
    icon: 'book',
    accent: '#ffcf7a',
    order: 95,
    render(root, api) {
      root.classList.add('yp-root');
      root.innerHTML = `
        <div class="yp-tabs" role="tablist">
          <button class="yp-tab on" data-tab="places">地点黄页</button>
          <button class="yp-tab" data-tab="emergency">紧急电话</button>
          <button class="yp-tab" data-tab="services">常用热线</button>
        </div>
        <section class="yp-pane" data-pane="places">
          <div class="yp-search">
            <div class="field"><span class="mono" style="font-size:9px;color:var(--dim-2)">⌕</span><input id="ypQuery" placeholder="搜索全球商户、餐厅、医院、景点" autocomplete="off"></div>
            <button class="yp-btn" id="ypSearchBtn">搜索</button>
          </div>
          <p class="yp-note">OpenStreetMap 全球地点库 · 电话来自公开标签，未收录时可查看当地紧急号码</p>
          <div class="yp-list" id="ypList"><div class="yp-empty">输入城市、街区或店名开始搜索</div></div>
          <section class="yp-detail hidden" id="ypDetail"></section>
        </section>
        <section class="yp-pane hidden" data-pane="emergency">
          <div class="yp-search">
            <div class="field"><span class="mono" style="font-size:9px;color:var(--dim-2)">☎</span><input id="ypCountry" placeholder="搜索国家 / 地区 / 代码（如 日本 或 JP）" autocomplete="off"></div>
            <button class="yp-btn" id="ypDetect">识别我的国家</button>
          </div>
          <div class="yp-chips" id="ypRegions"></div>
          <p class="yp-note" id="ypCountryNote">号码可能调整，以当地官方公布为准；境外拨打需加国际区号。</p>
          <div class="yp-countries" id="ypCountries"></div>
        </section>
        <section class="yp-pane hidden" data-pane="services">
          <p class="yp-note">领事保护、支付、通信、出行、物流与设备支持；境外拨打需加国际区号。</p>
          <div id="ypServices"></div>
        </section>
      `;
      const P = Aether.places;
      const H = Aether.hotlines;
      const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const dial = n => (H ? H.dial(n) : String(n || '').replace(/[^\d+]/g, ''));
      const safeUrl = u => { try { const x = new URL(String(u), location.href); return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : ''; } catch (e) { return ''; } };
      const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
      const queryEl = root.querySelector('#ypQuery');
      const listEl = root.querySelector('#ypList');
      const detailEl = root.querySelector('#ypDetail');
      const countryEl = root.querySelector('#ypCountry');
      const countriesEl = root.querySelector('#ypCountries');
      const countryNote = root.querySelector('#ypCountryNote');
      const regionsEl = root.querySelector('#ypRegions');
      let placeSeq = 0, region = '全部', detected = '';

      root.querySelectorAll('.yp-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          root.querySelectorAll('.yp-tab').forEach(t => t.classList.toggle('on', t === tab));
          root.querySelectorAll('.yp-pane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== tab.dataset.tab));
        });
      });

      function emergencyFor(place) {
        if (!H) return '';
        const c = H.byCode(place.countrycode);
        if (!c) return '';
        const nums = [], seen = new Set();
        const add = (label, num) => {
          const key = String(num);
          if (!num || seen.has(key)) return;
          seen.add(key);
          nums.push(`<a href="tel:${esc(dial(num))}"><span>${label}</span><strong>${esc(num)}</strong></a>`);
        };
        if (c.u) add('统一', c.u);
        if (c.p) add('报警', c.p);
        if (c.f) add('消防', c.f);
        if (c.a) add('急救', c.a);
        return `<div class="ms-emergency"><b>${esc(c.n)}当地紧急电话</b><div class="ms-emg-row">${nums.join('')}</div></div>`;
      }

      function openMap(place, detail, mode) {
        const pending = {
          name: place.name || '未命名地点',
          lat: place.lat,
          lon: place.lon,
          category: place.category || '地点',
          label: place.label || '',
          country: place.country || '',
          countrycode: place.countrycode || '',
          address: detail && detail.address || ''
        };
        if (mode) pending.mode = mode;
        Aether.store.set('map.pending', pending);
        Aether.openApp('map');
      }

      async function selectPlace(place) {
        detailEl.classList.remove('hidden');
        detailEl.innerHTML = `
          <div class="yp-detail-head">
            <div><span class="yp-meta">${esc(place.category || '地点')}${place.distance != null ? ' · ' + P.fmtDistance(place.distance) : ''}</span><h3>${esc(place.name)}</h3><p>${esc(place.label || place.country || '')}</p></div>
            <button class="icon-btn" id="ypDetailClose" aria-label="关闭">${Aether.icon('x')}</button>
          </div>
          <div class="yp-detail-body"><div class="ms-loading"><i></i>正在读取地址、电话与营业时间…</div>${emergencyFor(place)}</div>
        `;
        detailEl.querySelector('#ypDetailClose').addEventListener('click', () => detailEl.classList.add('hidden'));
        detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        let detail = {};
        try { detail = await P.details(place); } catch (err) { detail = { error: String(err.message || err) }; }
        if (!detailEl || detailEl.classList.contains('hidden') || root.querySelector('#ypDetail') === null) return;
        const body = detailEl.querySelector('.yp-detail-body');
        if (!body) return;
        const rows = [];
        if (detail.address) rows.push(`<div class="ms-row"><span class="ms-label">地址</span><div class="ms-value">${esc(detail.address)}</div></div>`);
        if (detail.phones && detail.phones.length) {
          rows.push(`<div class="ms-row"><span class="ms-label">电话</span><div class="ms-value ms-phones">${detail.phones.map(n => `<a href="tel:${esc(dial(n))}">${Aether.icon('phone')}${esc(n)}</a>`).join('')}</div></div>`);
        } else {
          rows.push('<div class="ms-row"><span class="ms-label">电话</span><div class="ms-value dim">OSM 未收录商家电话</div></div>');
        }
        if (detail.hours) rows.push(`<div class="ms-row"><span class="ms-label">营业</span><div class="ms-value">${esc(detail.hours)}</div></div>`);
        if (detail.operator) rows.push(`<div class="ms-row"><span class="ms-label">运营</span><div class="ms-value">${esc(detail.operator)}</div></div>`);
        const site = detail.website ? safeUrl(detail.website) : '';
        if (site) rows.push(`<div class="ms-row"><span class="ms-label">网站</span><div class="ms-value"><a href="${esc(site)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(site))}</a></div></div>`);
        if (detail.error) rows.push(`<div class="ms-hint">详情源暂时不可达（${esc(detail.error)}），坐标仍可用于地图与路线。</div>`);
        body.innerHTML = `
          <div class="ms-tags"><span class="ms-tag">${esc(place.category || '地点')}</span>${place.country ? `<span class="ms-tag">${esc(place.country)}</span>` : ''}</div>
          <div class="ms-rows">${rows.join('')}</div>
          ${emergencyFor(place)}
          <div class="yp-actions">
            <button class="yp-act" id="ypMapView">${Aether.icon('map')}地图查看</button>
            <button class="yp-act primary" id="ypDrive">${Aether.icon('route')}驾车去</button>
          </div>
          <p class="ms-fine">地点数据 © OpenStreetMap 贡献者 · 商家电话与营业时间以官方公布为准</p>
        `;
        body.querySelector('#ypMapView').addEventListener('click', () => openMap(place, detail));
        body.querySelector('#ypDrive').addEventListener('click', () => openMap(place, detail, 'driving'));
      }

      async function searchPlaces() {
        const q = queryEl.value.trim();
        if (!q) { api.toast('请输入城市、街区或商户名称'); return; }
        const seq = ++placeSeq;
        listEl.innerHTML = '<div class="yp-empty">正在全球地点库中搜索…</div>';
        detailEl.classList.add('hidden');
        const view = Aether.store.get('map.view', [31.2304, 121.4737, 12]);
        try {
          const found = await P.search(q, { lat: view[0], lon: view[1], limit: 40 });
          if (seq !== placeSeq) return;
          const list = found.slice(0, 30);
          if (!list.length) {
            listEl.innerHTML = '<div class="yp-empty">没有匹配地点，试试「城市 + 店名」或英文名称</div>';
            return;
          }
          listEl.innerHTML = '';
          list.forEach(place => {
            const card = document.createElement('article');
            card.className = 'yp-place';
            card.innerHTML = `<div class="yp-place-main"><strong>${esc(place.name)}</strong><span class="yp-meta">${esc(place.category)}${place.distance != null ? ' · ' + P.fmtDistance(place.distance) : ''}</span><p>${esc(place.label || place.country || '')}</p></div><button class="yp-go" aria-label="查看详情">${Aether.icon('right')}</button>`;
            card.addEventListener('click', () => selectPlace(place));
            listEl.appendChild(card);
          });
          api.toast('找到 ' + list.length + ' 个地点', 'ok');
        } catch (err) {
          if (seq !== placeSeq) return;
          listEl.innerHTML = '<div class="yp-empty">搜索服务不可达，请检查网络后重试</div>';
          api.toast('搜索失败：' + (err.message || err), 'err');
        }
      }

      root.querySelector('#ypSearchBtn').addEventListener('click', searchPlaces);
      queryEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchPlaces(); } });

      const REGIONS = ['全部', '亚洲', '欧洲', '非洲', '美洲', '大洋洲'];
      regionsEl.innerHTML = REGIONS.map(r => `<button class="yp-chip${r === region ? ' on' : ''}" data-r="${r}">${r}</button>`).join('');
      regionsEl.addEventListener('click', e => {
        const b = e.target.closest('.yp-chip');
        if (!b) return;
        region = b.dataset.r;
        regionsEl.querySelectorAll('.yp-chip').forEach(c => c.classList.toggle('on', c === b));
        renderCountries();
      });

      function countryCard(c) {
        const nums = [], seen = new Set();
        const add = (label, num) => {
          const key = String(num);
          if (!num || seen.has(key)) return;
          seen.add(key);
          nums.push(`<a href="tel:${esc(dial(num))}"><span>${label}</span><strong>${esc(num)}</strong></a>`);
        };
        if (c.u) add('统一', c.u);
        if (c.p) add('报警', c.p);
        if (c.f) add('消防', c.f);
        if (c.a) add('急救', c.a);
        const extra = (c.x || []).map(([label, num]) => `<a href="tel:${esc(dial(num))}">${esc(label)} ${esc(num)}</a>`).join('');
        return `<article class="yp-country${detected && detected === c.c ? ' hit' : ''}" id="yp-c-${esc(c.c)}"><header><div><strong>${esc(c.n)}</strong><span>${esc(c.r)} · ${esc(c.c)}</span></div><span class="yp-code">${esc(c.c)}</span></header><div class="yp-nums">${nums.join('')}</div>${extra ? `<div class="yp-extra">${extra}</div>` : ''}</article>`;
      }

      function renderCountries() {
        const q = (countryEl.value || '').trim().toLowerCase();
        const list = H.emergency.filter(c => (region === '全部' || c.r === region) && (!q || c.n.toLowerCase().indexOf(q) !== -1 || c.c.toLowerCase().indexOf(q) !== -1 || c.r.indexOf(q) !== -1));
        countriesEl.innerHTML = list.length ? list.map(countryCard).join('') : '<div class="yp-empty">没有匹配的国家或地区</div>';
        countryNote.textContent = list.length + ' 个国家/地区 · 点击号码直接拨号；境外拨打需加国际区号，号码以当地官方公布为准。';
      }
      countryEl.addEventListener('input', renderCountries);
      root.querySelector('#ypDetect').addEventListener('click', async () => {
        const btn = root.querySelector('#ypDetect');
        btn.disabled = true;
        const old = btn.textContent;
        btn.textContent = '识别中…';
        try {
          const ip = await P.ipLocate();
          detected = String(ip.country || '').toUpperCase();
          region = '全部';
          regionsEl.querySelectorAll('.yp-chip').forEach(c => c.classList.toggle('on', c.dataset.r === '全部'));
          countryEl.value = '';
          renderCountries();
          const c = H.byCode(detected);
          countryNote.textContent = 'IP 定位：' + [ip.city, ip.region].filter(Boolean).join(' · ') + ' · ' + (c ? c.n : detected) + ' — 已高亮当地紧急号码。';
          const hit = root.querySelector('#yp-c-' + detected);
          if (hit) { hit.scrollIntoView({ behavior: 'smooth', block: 'center' }); api.toast('已定位到 ' + (c ? c.n : detected), 'ok'); }
          else api.toast('IP 定位：' + (c ? c.n : detected), 'ok');
        } catch (err) {
          api.toast('IP 定位失败：' + (err.message || err), 'err');
        } finally {
          btn.disabled = false;
          btn.textContent = old;
        }
      });

      root.querySelector('#ypServices').innerHTML = H.services.map(sec => `
        <section class="yp-sec">
          <h3>${Aether.icon(sec.icon)}<span>${esc(sec.title)}</span></h3>
          <div class="yp-svc">${sec.items.map(it => `<article class="yp-svc-item"><div><strong>${esc(it.n)}</strong><span>${esc(it.d)}</span></div><a href="tel:${esc(dial(it.t))}">${esc(it.t)}</a></article>`).join('')}</div>
        </section>
      `).join('');

      renderCountries();
      api.setSub('地点 · 紧急电话 · 常用热线');
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
  const PHOTO_DB = 'aether-photos-v1';
  const PHOTO_META = 'meta';
  const PHOTO_BLOBS = 'blobs';
  let photoDbPromise = null;
  let photoBridgeCache = null;

  function photoDbOpen() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('当前浏览器不支持 IndexedDB'));
    if (photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(PHOTO_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_META)) db.createObjectStore(PHOTO_META, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(PHOTO_BLOBS)) db.createObjectStore(PHOTO_BLOBS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('无法打开本地相册数据库'));
      req.onblocked = () => reject(new Error('本地相册数据库被其他窗口占用'));
    });
    return photoDbPromise;
  }

  async function photoDbList() {
    const db = await photoDbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_META, 'readonly');
      const req = tx.objectStore(PHOTO_META).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('读取本地相册失败'));
    });
  }

  async function photoDbAdd(record, blob) {
    const db = await photoDbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PHOTO_META, PHOTO_BLOBS], 'readwrite');
      tx.objectStore(PHOTO_META).put(record);
      tx.objectStore(PHOTO_BLOBS).put(blob, record.id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存图片失败'));
      tx.onabort = () => reject(tx.error || new Error('保存图片被中止（可能空间不足）'));
    });
  }

  async function photoDbBlob(id) {
    const db = await photoDbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_BLOBS, 'readonly');
      const req = tx.objectStore(PHOTO_BLOBS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('读取图片失败'));
    });
  }

  async function photoDbDelete(id) {
    const db = await photoDbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PHOTO_META, PHOTO_BLOBS], 'readwrite');
      tx.objectStore(PHOTO_META).delete(id);
      tx.objectStore(PHOTO_BLOBS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('删除图片失败'));
    });
  }

  function photoWhen(ts) {
    const n = Number(ts || 0);
    if (!n) return '';
    try {
      return new Date(n).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function photoSave(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name || 'aether-photo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function photoThumb(blob, max = 560) {
    if (!blob) return null;
    if ('createImageBitmap' in window) {
      try {
        const bmp = await createImageBitmap(blob);
        const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        return { url: c.toDataURL('image/jpeg', .78), revoke: false };
      } catch (e) { /* 交给 <img> 尝试解码（如 HEIC 取决于浏览器） */ }
    }
    const url = URL.createObjectURL(blob);
    return { url, revoke: true };
  }

  Aether.registerApp({
    id: 'photos',
    name: '相册',
    sub: 'SYSTEM GALLERY · LOCAL',
    icon: 'photos',
    accent: '#ffb02e',
    order: 120,
    render(root, api) {
      let nativeItems = [];
      let bridgeItems = [];
      let bridgeInfo = null;
      let bridgeError = '';
      let filter = Aether.store.get('photos.filter', 'all');
      let visibleLimit = 120;
      let dbReady = true;
      let closed = false;
      const thumbs = new Map();
      const objectUrls = new Set();
      let observer = null;

      root.innerHTML = `
        <div class="photo-bar">
          <div class="seg photo-sources" id="photoSources">
            <button data-src="all" class="on">全部</button>
            <button data-src="picked">本机选择</button>
            <button data-src="bridge">桥接相册</button>
          </div>
          <div class="photo-actions">
            <button class="btn ghost sm" id="photoPick">选择图片</button>
            <button class="btn ghost sm" id="photoRefresh">扫描相册</button>
            <input type="file" id="photoFile" accept="image/*" multiple class="hidden">
          </div>
        </div>
        <div class="photo-meta" id="photoMeta">正在读取本机副本…</div>
        <div class="photo-note" id="photoNote" hidden></div>
        <div class="photo-grid" id="photoGrid"></div>
        <div class="photo-empty" id="photoEmpty" hidden></div>
        <div class="photo-more" id="photoMore" hidden><button class="btn ghost sm" id="photoMoreBtn">加载更多</button></div>
        <p class="note photo-foot">浏览器/PWA 不能静默枚举整个系统相册：用「选择图片」调用系统选择器；连接本机桥接后可扫描 DCIM/Pictures（Termux 需先授权存储）。图片不上传，二维码与令牌不会写入日志。</p>
      `;

      const grid = root.querySelector('#photoGrid');
      const empty = root.querySelector('#photoEmpty');
      const more = root.querySelector('#photoMore');
      const meta = root.querySelector('#photoMeta');
      const noteEl = root.querySelector('#photoNote');
      const sources = root.querySelector('#photoSources');
      const pickInput = root.querySelector('#photoFile');

      function allItems() {
        return nativeItems.concat(bridgeItems).sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      }

      function filtered() {
        const all = allItems();
        if (filter === 'picked') return all.filter(it => it.source === 'picked');
        if (filter === 'bridge') return all.filter(it => it.source === 'bridge');
        return all;
      }

      function updateSources() {
        [...sources.querySelectorAll('button')].forEach(btn => {
          const key = btn.dataset.src;
          btn.classList.toggle('on', key === filter);
          if (key === 'picked') btn.textContent = '本机选择 ' + nativeItems.length;
          else if (key === 'bridge') btn.textContent = '桥接相册 ' + bridgeItems.length;
          else btn.textContent = '全部 ' + (nativeItems.length + bridgeItems.length);
        });
      }

      function updateMeta(scanning) {
        updateSources();
        const cfg = bridgeCfg();
        noteEl.hidden = true;
        noteEl.textContent = '';
        if (!cfg) {
          meta.className = 'photo-meta';
          meta.textContent = dbReady
            ? '未连接 Linux 桥接。用「选择图片」从系统相册导入副本；本机桥接运行后可扫描相册文件夹。'
            : '当前环境无法持久保存导入副本（IndexedDB 不可用），仅在本次打开期间保留。';
          return;
        }
        if (scanning) {
          meta.className = 'photo-meta';
          meta.textContent = '正在扫描桥接相册…';
          return;
        }
        if (bridgeError) {
          meta.className = 'photo-meta bad';
          meta.textContent = '桥接扫描失败：' + bridgeError;
          return;
        }
        if (!bridgeInfo) {
          meta.className = 'photo-meta';
          meta.textContent = '桥接已配置，尚未扫描。点「扫描相册」读取相册目录。';
          return;
        }
        const parts = ['桥接 ' + String(bridgeInfo.mode || '').toUpperCase() + ' · ' + bridgeItems.length + ' 张'];
        if (bridgeInfo.cached) parts.push('服务端缓存');
        if (bridgeInfo.limited) parts.push('已达扫描上限');
        meta.className = 'photo-meta ok';
        meta.textContent = parts.join(' · ');
        if (bridgeInfo.note) {
          noteEl.hidden = false;
          noteEl.appendChild(document.createTextNode(bridgeInfo.note));
          if (bridgeInfo.mode === 'termux') {
            const btn = document.createElement('button');
            btn.className = 'btn ghost sm photo-auth';
            btn.textContent = '复制授权命令';
            btn.addEventListener('click', async () => {
              const ok = await Aether.copyText('termux-setup-storage');
              api.toast(ok ? '已复制：termux-setup-storage' : '复制失败，请手动输入', ok ? 'ok' : 'bad');
            });
            noteEl.appendChild(btn);
          }
        }
      }

      function makeThumb(item, img) {
        if (item.thumbUrl) { img.src = item.thumbUrl; return; }
        const key = item.key;
        if (thumbs.has(key)) {
          const hit = thumbs.get(key);
          if (hit && hit.url) { item.thumbUrl = hit.url; img.src = hit.url; return; }
          if (hit && hit.loading) return;
          thumbs.delete(key);
        }
        thumbs.set(key, { loading: true });
        const done = thumb => {
          if (closed) {
            if (thumb && thumb.revoke && thumb.url) URL.revokeObjectURL(thumb.url);
            return;
          }
          thumbs.set(key, thumb || {});
          if (!thumb || !thumb.url) return;
          if (thumb.revoke) objectUrls.add(thumb.url);
          item.thumbUrl = thumb.url;
          if (img.isConnected) img.src = thumb.url;
        };
        (async () => {
          let blob = item.blob || null;
          if (!blob && item.source === 'picked') blob = await photoDbBlob(item.id);
          else if (!blob) {
            const cfg = bridgeCfg();
            if (!cfg) throw new Error('桥接配置已删除');
            blob = await bridgeBlob(cfg, item.id);
          }
          if (!blob) throw new Error('图片不存在');
          done(await photoThumb(blob));
        })().catch(err => {
          thumbs.delete(key);
          if (closed) return;
          img.alt = '无法预览：' + (err && err.message ? err.message : '读取失败');
          img.classList.add('broken');
          const cell = img.closest('.photo-cell');
          if (cell) cell.classList.add('failed');
        });
      }

      function renderGrid(reset = true) {
        if (observer) observer.disconnect();
        if (reset) {
          grid.innerHTML = '';
          visibleLimit = 120;
        }
        const list = filtered();
        const start = reset ? 0 : grid.children.length;
        const shown = list.slice(start, visibleLimit);
        const fragment = document.createDocumentFragment();
        shown.forEach((it, idx) => {
          const cell = document.createElement('div');
          cell.className = 'photo-cell';
          cell.tabIndex = 0;
          cell.setAttribute('role', 'button');
          cell.setAttribute('aria-label', it.name || '图片');
          const img = document.createElement('img');
          img.alt = it.name || '';
          img.decoding = 'async';
          const badge = document.createElement('span');
          badge.className = 'pc-badge';
          badge.textContent = it.source === 'picked' ? '本机' : '桥接';
          const label = document.createElement('span');
          label.className = 'pc-name';
          label.textContent = it.name || '图片';
          cell.append(img, badge, label);
          const open = () => openViewer(it.key);
          cell.addEventListener('click', open);
          cell.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
          });
          fragment.appendChild(cell);
          observe(cell, () => makeThumb(it, img));
        });
        grid.appendChild(fragment);
        const total = list.length;
        empty.hidden = total > 0;
        more.hidden = total <= visibleLimit;
        if (!total) {
          if (filter === 'bridge' && !bridgeCfg()) empty.textContent = '未连接桥接。先在本机启动 bridge/server.py，并在终端「真 Linux」中填入地址与令牌。';
          else if (filter === 'bridge' && bridgeError) empty.textContent = '桥接暂不可用：' + bridgeError;
          else if (filter === 'bridge' && bridgeInfo && bridgeInfo.mode === 'ish') empty.textContent = 'iSH 中还没有可读图片。iOS 不允许 iSH 直接读取「照片」图库；请把照片经「文件」导入 iSH 的 Pictures/Documents/Downloads，再点「扫描相册」。';
          else if (filter === 'bridge' && bridgeInfo && bridgeInfo.mode === 'termux') empty.textContent = '没有扫描到图片。先在 Termux 执行 termux-setup-storage 并允许照片访问，确认 DCIM/Pictures 中有图片后点「扫描相册」。';
          else if (filter === 'picked') empty.textContent = '还没有本机副本。点「选择图片」，从系统相册选择后会持久保存在此设备。';
          else empty.textContent = '相册为空。选择系统相册图片，或扫描已授权的桥接相册目录。';
        }
        updateMeta(false);
      }

      function observe(el, cb) {
        if (!('IntersectionObserver' in window)) { cb(); return; }
        if (!observer) {
          observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
              if (!entry.isIntersecting) return;
              observer.unobserve(entry.target);
              const fn = entry.target._photoLoad;
              if (fn) fn();
            });
          }, { root: root, rootMargin: '500px 0px' });
        }
        el._photoLoad = cb;
        observer.observe(el);
      }

      function openViewer(key) {
        const items = filtered();
        let cur = items.findIndex(it => it.key === key);
        if (cur < 0) cur = 0;
        if (!items.length) return;
        let viewerUrl = null;
        let closedViewer = false;
        const overlay = document.createElement('div');
        overlay.className = 'photo-viewer';
        overlay.tabIndex = -1;
        overlay.innerHTML = `
          <div class="pv-head">
            <div class="pv-title"><strong id="pvName"></strong><span id="pvInfo"></span></div>
            <div class="pv-tools">
              <button class="icon-btn" id="pvSave" title="下载">${Aether.icon('download')}</button>
              <button class="icon-btn" id="pvDelete" title="删除本机副本">${Aether.icon('trash')}</button>
              <button class="icon-btn" id="pvClose" title="关闭">${Aether.icon('close')}</button>
            </div>
          </div>
          <div class="pv-stage"><div class="pv-spin" id="pvSpin">载入中…</div><img id="pvImg" alt=""></div>
          <div class="pv-nav">
            <button id="pvPrev" aria-label="上一张">${Aether.icon('left')}</button>
            <span class="mono" id="pvCount"></span>
            <button id="pvNext" aria-label="下一张">${Aether.icon('right')}</button>
          </div>
        `;
        root.style.overflow = 'hidden';
        root.appendChild(overlay);
        overlay.focus();

        const img = overlay.querySelector('#pvImg');
        const spin = overlay.querySelector('#pvSpin');
        const nameEl = overlay.querySelector('#pvName');
        const infoEl = overlay.querySelector('#pvInfo');
        const countEl = overlay.querySelector('#pvCount');
        const saveBtn = overlay.querySelector('#pvSave');
        const delBtn = overlay.querySelector('#pvDelete');
        let currentBlob = null;
        let drawSeq = 0;

        const release = () => {
          if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
          currentBlob = null;
        };

        async function draw() {
          const it = items[cur];
          if (!it) return;
          const seq = ++drawSeq;
          release();
          img.removeAttribute('src');
          img.classList.remove('ready');
          spin.hidden = false;
          spin.textContent = '载入中…';
          nameEl.textContent = it.name || '图片';
          infoEl.textContent = [photoWhen(it.mtime), it.size ? Aether.fmtBytes(it.size) : '', it.directory || ''].filter(Boolean).join(' · ');
          countEl.textContent = (cur + 1) + ' / ' + items.length;
          delBtn.style.display = it.source === 'picked' ? '' : 'none';
          try {
            let blob = it.blob || null;
            if (!blob && it.source === 'picked') blob = await photoDbBlob(it.id);
            else if (!blob) {
              const cfg = bridgeCfg();
              if (!cfg) throw new Error('桥接配置已删除');
              blob = await bridgeBlob(cfg, it.id, 30000);
            }
            if (!blob) throw new Error('图片文件不存在（可能已被移动或删除）');
            if (seq !== drawSeq || closedViewer) return;
            currentBlob = blob;
            viewerUrl = URL.createObjectURL(blob);
            img.src = viewerUrl;
          } catch (err) {
            if (seq !== drawSeq || closedViewer) return;
            spin.textContent = '无法载入：' + (err && err.message ? err.message : '未知错误');
            spin.hidden = false;
          }
        }

        img.addEventListener('load', () => {
          if (closedViewer) return;
          spin.hidden = true;
          img.classList.add('ready');
        });
        img.addEventListener('error', () => {
          if (closedViewer) return;
          spin.hidden = false;
          spin.textContent = '此格式无法在当前浏览器解码（可下载后用系统应用打开）';
        });

        const go = step => { cur = (cur + step + items.length) % items.length; draw(); };
        overlay.querySelector('#pvPrev').addEventListener('click', () => go(-1));
        overlay.querySelector('#pvNext').addEventListener('click', () => go(1));
        saveBtn.addEventListener('click', () => {
          if (currentBlob) photoSave(currentBlob, items[cur].name);
          else api.toast('图片尚未载入', '');
        });
        delBtn.addEventListener('click', async () => {
          const it = items[cur];
          if (!it || it.source !== 'picked') return;
          if (!confirm('从 AETHER 相册删除这张本机副本？\n系统相册中的原图不会被删除。')) return;
          try {
            await photoDbDelete(it.id);
            nativeItems = nativeItems.filter(x => x.id !== it.id);
            thumbs.delete(it.key);
            close();
            renderGrid(true);
            api.toast('已删除本机副本', 'ok');
          } catch (err) { api.toast('删除失败：' + err.message, 'bad'); }
        });

        let touchX = null;
        const stage = overlay.querySelector('.pv-stage');
        stage.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
        stage.addEventListener('touchend', e => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          touchX = null;
          if (Math.abs(dx) > 55) go(dx < 0 ? 1 : -1);
        }, { passive: true });

        const onKey = e => {
          if (e.key === 'Escape') { e.preventDefault(); close(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        };
        document.addEventListener('keydown', onKey);
        function close() {
          if (closedViewer) return;
          closedViewer = true;
          document.removeEventListener('keydown', onKey);
          release();
          overlay.remove();
          root.style.overflow = '';
        }
        overlay.querySelector('#pvClose').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        draw();
      }

      async function loadNative() {
        try {
          const rows = await photoDbList();
          nativeItems = rows.map(row => ({
            key: 'p:' + row.id,
            id: row.id,
            source: 'picked',
            name: row.name || '图片',
            type: row.type || '',
            size: row.size || 0,
            mtime: row.mtime || row.added || 0,
            directory: '本机副本'
          }));
          dbReady = true;
        } catch (err) {
          dbReady = false;
          nativeItems = [];
          api.toast('本机相册不可用：' + err.message, 'bad');
        }
      }

      async function scanBridge(force = false) {
        const cfg = bridgeCfg();
        if (!cfg) {
          bridgeInfo = null; bridgeItems = []; bridgeError = '';
          renderGrid(true);
          return;
        }
        const cfgKey = cfg.endpoint + '|' + bridgeDistro(cfg);
        if (!force && photoBridgeCache && photoBridgeCache.cfgKey === cfgKey && Date.now() - photoBridgeCache.at < 60000) {
          bridgeInfo = photoBridgeCache.data;
          bridgeItems = photoBridgeCache.items;
          bridgeError = '';
          renderGrid(true);
          return;
        }
        updateMeta(true);
        try {
          const data = await bridgeJson(cfg, '/api/gallery/list' + (force ? '?refresh=1' : ''), undefined, 30000);
          if (!data || !data.ok) throw new Error((data && data.error) || '接口返回异常');
          const items = (data.items || []).map(it => ({
            key: 'b:' + it.id,
            id: it.id,
            source: 'bridge',
            name: it.name || '图片',
            type: it.mime || '',
            size: it.size || 0,
            mtime: Number(it.mtime || 0),
            directory: it.dir || ''
          }));
          bridgeInfo = data;
          bridgeItems = items;
          bridgeError = '';
          photoBridgeCache = { cfgKey, at: Date.now(), data, items };
          renderGrid(true);
        } catch (err) {
          bridgeError = err && err.message ? err.message : '连接失败';
          renderGrid(true);
          api.toast('桥接扫描失败：' + bridgeError, 'bad');
        }
      }

      sources.addEventListener('click', e => {
        const btn = e.target.closest('button[data-src]');
        if (!btn) return;
        filter = btn.dataset.src;
        Aether.store.set('photos.filter', filter);
        renderGrid(true);
      });

      root.querySelector('#photoPick').addEventListener('click', () => pickInput.click());
      root.querySelector('#photoMoreBtn').addEventListener('click', () => {
        visibleLimit += 120;
        renderGrid(false);
      });

      pickInput.addEventListener('change', async e => {
        const files = [...(e.target.files || [])].filter(f => f.type.startsWith('image/') || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(f.name));
        if (!files.length) return;
        let added = 0, failed = 0;
        for (const file of files) {
          if (file.size > 40 * 1024 * 1024) { failed++; continue; }
          const id = (crypto.randomUUID && crypto.randomUUID()) || ('ph-' + Date.now() + '-' + Math.random().toString(36).slice(2));
          const record = {
            id, name: file.name || ('图片-' + id.slice(0, 8)),
            type: file.type || 'application/octet-stream',
            size: file.size, mtime: file.lastModified || Date.now(), added: Date.now()
          };
          try {
            if (dbReady) await photoDbAdd(record, file);
            nativeItems.push({
              key: 'p:' + id, id, source: 'picked', name: record.name, type: record.type,
              size: record.size, mtime: record.mtime, directory: '本机副本',
              thumbUrl: null
            });
            added++;
          } catch (err) {
            if (!dbReady) {
              nativeItems.push({
                key: 'p:' + id, id, source: 'picked', name: record.name, type: record.type,
                size: record.size, mtime: record.mtime, directory: '本机副本（临时）', blob: file
              });
              added++;
            } else failed++;
          }
        }
        pickInput.value = '';
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
        if (added) {
          filter = 'picked';
          Aether.store.set('photos.filter', filter);
          renderGrid(true);
          api.toast('已保存 ' + added + ' 张本机副本' + (failed ? '，' + failed + ' 张失败' : ''), failed ? '' : 'ok');
        } else if (failed) api.toast(failed + ' 张图片保存失败（可能超出设备存储配额）', 'bad');
      });

      root.querySelector('#photoRefresh').addEventListener('click', () => {
        if (!bridgeCfg()) {
          api.toast('请先在终端「真 Linux」配置桥接地址与令牌', '');
          return;
        }
        scanBridge(true);
      });

      (async () => {
        await loadNative();
        if (closed) return;
        renderGrid(true);
        scanBridge(false);
      })();

      api.onClose(() => {
        closed = true;
        if (observer) observer.disconnect();
        thumbs.forEach(t => { if (t && t.revoke && t.url) URL.revokeObjectURL(t.url); });
        objectUrls.forEach(u => URL.revokeObjectURL(u));
        root.style.overflow = '';
      });
      api.setSub('系统选择器 + 桥接扫描 · 本地');
    }
  });

  /* ============================================================
     相机
     ============================================================ */
  function cameraFileName(type) {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    const ext = /png/i.test(type) ? 'png' : /webp/i.test(type) ? 'webp' : 'jpg';
    return 'AETHER-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.' + ext;
  }

  async function cameraDims(blob) {
    if ('createImageBitmap' in window) {
      try {
        const bmp = await createImageBitmap(blob);
        const dims = bmp.width + '×' + bmp.height;
        if (bmp.close) bmp.close();
        return dims;
      } catch (e) {}
    }
    return new Promise(resolve => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { resolve((img.naturalWidth || 0) + '×' + (img.naturalHeight || 0)); URL.revokeObjectURL(url); };
      img.onerror = () => { resolve('无法读取尺寸'); URL.revokeObjectURL(url); };
      img.src = url;
    });
  }

  Aether.registerApp({
    id: 'camera',
    name: '相机',
    sub: 'SYSTEM CAMERA · ORIGINAL BYTES',
    icon: 'camera',
    accent: '#36e6ff',
    order: 110,
    flush: true,
    render(root, api) {
      let stream = null;
      let facing = 'back';
      let zoomCap = null;
      let zoomValue = 1;
      let focusModes = [];
      let reviewBlob = null;
      let reviewName = '';
      let reviewUrl = null;
      let savedId = null;
      let lastChannel = 'viewfinder';
      let closed = false;
      let busy = false;
      let pinch = null;
      let zoomPending = false;

      root.innerHTML = `
        <div class="camera-root">
          <div class="cam-head">
            <span class="cam-chip"><i></i> SYSTEM CAMERA</span>
            <span class="cam-tech mono" id="camTech">NATIVE / VIEWFINDER</span>
          </div>
          <div class="cam-stage" id="camStage">
            <div class="cam-idle" id="camIdle">
              <div class="cam-glyph">${Aether.icon('camera')}</div>
              <h3>系统相机直连</h3>
              <p>原生通道由系统相机拍摄，保存它返回的原始文件，不再压缩。取景器支持连续自动对焦、点按对焦与变焦。</p>
              <div class="cam-choices">
                <button class="btn solid sm" id="camNativeOpen">原生相机 · 原始文件</button>
                <button class="btn ghost sm" id="camViewOpen">取景器 · 对焦 / 变焦</button>
              </div>
              <button class="cam-link" id="camFrontOpen">改用前置原生相机</button>
            </div>
            <video class="cam-video hidden" id="camVideo" autoplay playsinline muted></video>
            <div class="cam-overlay hidden" id="camOverlay">
              <span class="cam-corner tl"></span><span class="cam-corner tr"></span>
              <span class="cam-corner bl"></span><span class="cam-corner br"></span>
              <div class="cam-topline"><span id="camFocusState">自动对焦</span><span id="camResolution"></span></div>
              <button class="cam-flip" id="camFlip" aria-label="切换前后摄像头" title="切换摄像头">${Aether.icon('refresh')}</button>
              <div class="cam-zoompill" id="camZoomPill">1.0×</div>
              <div class="cam-focusring" id="camFocusRing" hidden></div>
              <div class="cam-loading" id="camLoading">正在连接系统相机…</div>
              <div class="cam-hint" id="camHint"></div>
            </div>
            <div class="cam-review hidden" id="camReview">
              <img id="camShotImg" alt="拍摄预览">
              <div class="cam-review-tag" id="camReviewTag"></div>
            </div>
          </div>
          <div class="cam-controls hidden" id="camControls">
            <div class="cam-zoomrow">
              <span class="mono">1×</span>
              <input type="range" id="camZoom" min="1" max="1" step="0.1" value="1" aria-label="镜头变焦">
              <span class="mono" id="camZoomMax">1×</span>
              <span class="cam-zoomval mono" id="camZoomValue">1.0×</span>
            </div>
            <div class="cam-buttons">
              <button class="cam-round" id="camNativeSwitch" title="改用原生相机">原生</button>
              <button class="cam-shutter" id="camShutter" aria-label="拍照"><span></span></button>
              <button class="cam-round" id="camFlip2" title="切换前后摄像头">翻转</button>
            </div>
          </div>
          <div class="cam-reviewbar hidden" id="camReviewBar">
            <button class="btn ghost sm" id="camRetake">重拍</button>
            <button class="btn ghost sm" id="camDownload">下载原图</button>
            <button class="btn ghost sm" id="camShare">分享</button>
            <button class="btn ghost sm" id="camDelete">删除相册副本</button>
          </div>
          <div class="cam-alert" id="camAlert" hidden></div>
          <div class="cam-meta" id="camMeta">原生通道保留系统相机返回的原始字节，不经过 Canvas 重编码。取景器成片分辨率取决于设备与浏览器，可能低于原生相机。</div>
          <input type="file" id="camNativeBack" accept="image/*" capture="environment" class="hidden">
          <input type="file" id="camNativeFront" accept="image/*" capture="user" class="hidden">
        </div>
      `;

      const stage = root.querySelector('#camStage');
      const idle = root.querySelector('#camIdle');
      const video = root.querySelector('#camVideo');
      const overlay = root.querySelector('#camOverlay');
      const loading = root.querySelector('#camLoading');
      const focusRing = root.querySelector('#camFocusRing');
      const focusState = root.querySelector('#camFocusState');
      const resolution = root.querySelector('#camResolution');
      const zoomPill = root.querySelector('#camZoomPill');
      const controls = root.querySelector('#camControls');
      const zoomInput = root.querySelector('#camZoom');
      const zoomMax = root.querySelector('#camZoomMax');
      const zoomValueEl = root.querySelector('#camZoomValue');
      const reviewEl = root.querySelector('#camReview');
      const reviewImg = root.querySelector('#camShotImg');
      const reviewTag = root.querySelector('#camReviewTag');
      const reviewBar = root.querySelector('#camReviewBar');
      const alertEl = root.querySelector('#camAlert');
      const metaEl = root.querySelector('#camMeta');
      const nativeBack = root.querySelector('#camNativeBack');
      const nativeFront = root.querySelector('#camNativeFront');

      const setAlert = msg => {
        alertEl.hidden = !msg;
        alertEl.textContent = msg || '';
      };

      const trackNow = () => {
        if (!stream) return null;
        return stream.getVideoTracks()[0] || null;
      };

      function stopStream() {
        if (stream) {
          stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
          stream = null;
        }
        try { video.srcObject = null; } catch (e) {}
      }

      function showIdle() {
        stopStream();
        idle.classList.remove('hidden');
        video.classList.add('hidden');
        overlay.classList.add('hidden');
        controls.classList.add('hidden');
        reviewEl.classList.add('hidden');
        reviewBar.classList.add('hidden');
        stage.classList.remove('reviewing', 'live');
      }

      function updateZoomUI() {
        if (!zoomCap) {
          zoomInput.disabled = true;
          zoomInput.max = '1';
          zoomInput.value = '1';
          zoomMax.textContent = '—';
          zoomPill.textContent = '变焦不可用';
          zoomValueEl.textContent = '不可用';
          return;
        }
        zoomInput.disabled = false;
        zoomInput.min = String(zoomCap.min || 1);
        zoomInput.max = String(zoomCap.max || 1);
        zoomInput.step = String(zoomCap.step || .1);
        zoomInput.value = String(zoomValue);
        zoomMax.textContent = Number(zoomCap.max).toFixed(1) + '×';
        zoomValueEl.textContent = zoomValue.toFixed(1) + '×';
        zoomPill.textContent = zoomValue.toFixed(1) + '×';
      }

      function applyZoom(value) {
        const track = trackNow();
        if (!track || !zoomCap) return;
        const next = Math.max(zoomCap.min || 1, Math.min(zoomCap.max || 1, Number(value) || 1));
        zoomValue = next;
        updateZoomUI();
        if (zoomPending) return;
        zoomPending = true;
        setTimeout(async () => {
          zoomPending = false;
          if (!trackNow()) return;
          try { await track.applyConstraints({ advanced: [{ zoom: zoomValue }] }); }
          catch (e) { /* 某些实现只允许在启动约束中设置 */ }
        }, 55);
      }

      async function startViewfinder(restart = false) {
        if (busy) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setAlert('浏览器未提供实时相机接口。请使用「原生相机」或升级浏览器。');
          showIdle();
          return;
        }
        busy = true;
        setAlert('');
        lastChannel = 'viewfinder';
        idle.classList.add('hidden');
        reviewEl.classList.add('hidden');
        reviewBar.classList.add('hidden');
        stage.classList.remove('reviewing');
        stage.classList.add('live');
        video.classList.remove('hidden');
        overlay.classList.remove('hidden');
        controls.classList.remove('hidden');
        loading.hidden = false;
        loading.textContent = restart ? '正在切换摄像头…' : '正在连接系统相机…';
        focusState.textContent = '对焦中…';
        resolution.textContent = '';
        stopStream();
        zoomCap = null;
        zoomValue = 1;
        updateZoomUI();
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: facing === 'front' ? { ideal: 'user' } : { ideal: 'environment' },
              width: { ideal: 3840 },
              height: { ideal: 2160 }
            }
          });
          if (closed) { stopStream(); return; }
          video.srcObject = stream;
          await video.play().catch(() => {});
          const track = trackNow();
          if (!track) throw new Error('没有可用的视频轨道');
          const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
          const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
          focusModes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
          if (focusModes.includes('continuous')) {
            try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
            focusState.textContent = '连续自动对焦';
          } else {
            focusState.textContent = '相机自动对焦';
          }
          if (caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > (caps.zoom.min || 1)) {
            zoomCap = caps.zoom;
            zoomValue = Math.max(zoomCap.min || 1, 1);
          } else {
            zoomCap = null;
          }
          updateZoomUI();
          const maxRes = caps.width && caps.height && caps.width.max && caps.height.max
            ? ' · 最高 ' + caps.width.max + '×' + caps.height.max : '';
          resolution.textContent = (settings.width || video.videoWidth || '?') + '×' + (settings.height || video.videoHeight || '?') + maxRes;
          loading.hidden = true;
          metaEl.textContent = zoomCap
            ? '取景器：连续自动对焦 · 点按画面对焦 · 镜头变焦至 ' + Number(zoomCap.max).toFixed(1) + '×。原图字节保存；实际分辨率取决于浏览器与设备。'
            : '取景器：自动对焦 · 当前设备/浏览器未开放镜头变焦，可改用原生相机使用系统双指变焦。原图字节保存。';
        } catch (err) {
          stopStream();
          const name = err && err.name ? err.name : '';
          let msg = '无法打开相机：' + (err && err.message ? err.message : '未知错误');
          if (name === 'NotAllowedError' || name === 'SecurityError') msg = '相机权限被拒绝。请在浏览器站点设置中允许相机，或改用「原生相机」。';
          else if (name === 'NotFoundError' || name === 'OverconstrainedError') msg = '没有找到可用摄像头。请改用「原生相机」或检查设备。';
          else if (location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) msg = '实时相机需要 HTTPS 或 localhost；请改用「原生相机」。';
          setAlert(msg);
          showIdle();
          api.toast('取景器启动失败', 'bad');
        } finally {
          busy = false;
        }
      }

      function showReview(blob, name, channel, sourceNote) {
        stopStream();
        if (reviewUrl) URL.revokeObjectURL(reviewUrl);
        reviewBlob = blob;
        reviewName = name;
        reviewUrl = URL.createObjectURL(blob);
        idle.classList.add('hidden');
        video.classList.add('hidden');
        overlay.classList.add('hidden');
        controls.classList.add('hidden');
        stage.classList.remove('live');
        stage.classList.add('reviewing');
        reviewEl.classList.remove('hidden');
        reviewImg.src = reviewUrl;
        reviewBar.classList.remove('hidden');
        savedId = null;
        reviewTag.classList.remove('ok');
        reviewTag.textContent = '正在保存…';
        (async () => {
          const dims = await cameraDims(blob);
          const record = {
            id: (crypto.randomUUID && crypto.randomUUID()) || ('cam-' + Date.now()),
            name, type: blob.type || 'image/jpeg', size: blob.size,
            mtime: Date.now(), added: Date.now()
          };
          try {
            await photoDbAdd(record, blob);
            if (closed) return;
            savedId = record.id;
            reviewTag.textContent = '已保存到相册';
            reviewTag.classList.add('ok');
            metaEl.textContent = (channel === 'native' ? '原生相机' : '取景器') + ' · ' + dims + ' · ' + Aether.fmtBytes(blob.size) + ' · ' + sourceNote + '。原始字节已写入本机相册，未二次压缩。';
            api.toast('照片已保存到相册', 'ok');
          } catch (err) {
            if (closed) return;
            reviewTag.textContent = '仅本次预览';
            reviewTag.classList.remove('ok');
            metaEl.textContent = (channel === 'native' ? '原生相机' : '取景器') + ' · ' + dims + ' · ' + Aether.fmtBytes(blob.size) + '。相册数据库不可用：' + err.message + '。可立即下载原图。';
            api.toast('未能写入相册，请立即下载', 'bad');
          }
        })();
      }

      async function handleCaptured(file, channel) {
        if (!file) return;
        if (!file.type.startsWith('image/') && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name || '')) {
          api.toast('系统相机没有返回图片文件', 'bad');
          return;
        }
        setAlert('');
        lastChannel = channel === 'native' ? 'native' : 'viewfinder';
        const name = file.name && !/^image\.(jpe?g|png|heic|heif)$/i.test(file.name)
          ? file.name : cameraFileName(file.type);
        showReview(file, name, channel, channel === 'native' ? '系统相机原始文件' : '相机原始帧');
      }

      function openNative(front = false) {
        setAlert('');
        stopStream();
        showIdle();
        lastChannel = 'native';
        const input = front ? nativeFront : nativeBack;
        input.value = '';
        input.click();
      }

      nativeBack.addEventListener('change', e => handleCaptured((e.target.files || [])[0], 'native'));
      nativeFront.addEventListener('change', e => handleCaptured((e.target.files || [])[0], 'native'));

      root.querySelector('#camNativeOpen').addEventListener('click', () => openNative(false));
      root.querySelector('#camFrontOpen').addEventListener('click', () => openNative(true));
      root.querySelector('#camViewOpen').addEventListener('click', () => startViewfinder(false));
      root.querySelector('#camNativeSwitch').addEventListener('click', () => openNative(false));

      const flip = () => {
        facing = facing === 'front' ? 'back' : 'front';
        if (stream) startViewfinder(true);
        else api.toast(facing === 'front' ? '已选择前置摄像头' : '已选择后置摄像头', '');
      };
      root.querySelector('#camFlip').addEventListener('click', flip);
      root.querySelector('#camFlip2').addEventListener('click', flip);

      zoomInput.addEventListener('input', () => applyZoom(zoomInput.value));

      stage.addEventListener('touchstart', e => {
        if (!stream) return;
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinch = { dist: Math.hypot(dx, dy) || 1, zoom: zoomValue };
          e.preventDefault();
        }
      }, { passive: false });
      stage.addEventListener('touchmove', e => {
        if (!pinch || e.touches.length !== 2 || !zoomCap) return;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy) || 1;
        applyZoom(pinch.zoom * (dist / pinch.dist));
        e.preventDefault();
      }, { passive: false });
      stage.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });

      stage.addEventListener('click', async e => {
        if (!stream || busy || e.target.closest('button')) return;
        const track = trackNow();
        if (!track) return;
        const rect = stage.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        focusRing.hidden = false;
        focusRing.style.left = ((e.clientX - rect.left)) + 'px';
        focusRing.style.top = ((e.clientY - rect.top)) + 'px';
        focusRing.classList.remove('pulse');
        void focusRing.offsetWidth;
        focusRing.classList.add('pulse');
        setTimeout(() => { focusRing.hidden = true; }, 850);
        const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
        const hasFocus = Array.isArray(caps.focusMode);
        const hasPoi = Array.isArray(caps.pointsOfInterest);
        if (!hasFocus && !hasPoi) {
          focusState.textContent = '相机自动对焦';
          api.toast('此设备由相机自动对焦', '');
          return;
        }
        try {
          const adv = {};
          if (hasPoi) adv.pointsOfInterest = [{ x, y }];
          if (hasFocus) adv.focusMode = caps.focusMode.includes('single-shot') ? 'single-shot' : 'continuous';
          await track.applyConstraints({ advanced: [adv] });
          focusState.textContent = '已完成点按对焦';
          if (hasFocus && caps.focusMode.includes('continuous')) {
            setTimeout(() => {
              const t = trackNow();
              if (t) t.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
            }, 900);
          }
        } catch (err) {
          focusState.textContent = '相机自动对焦';
          api.toast('该设备不接受点按对焦，已保持自动对焦', '');
        }
      });

      async function takePhoto() {
        if (busy || !stream) return;
        const track = trackNow();
        if (!track) return;
        busy = true;
        const shutter = root.querySelector('#camShutter');
        if (shutter) shutter.disabled = true;
        stage.classList.add('flash');
        let blob = null;
        let note = '';
        try {
          if ('ImageCapture' in window) {
            try {
              const ic = new ImageCapture(track);
              blob = await ic.takePhoto();
              note = '相机原始帧';
            } catch (e) { blob = null; }
          }
          if (!blob) {
            const w = video.videoWidth, h = video.videoHeight;
            if (!w || !h) throw new Error('取景器尚未就绪');
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(video, 0, 0, w, h);
            blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .98));
            if (!blob) throw new Error('浏览器无法生成照片');
            note = '取景器帧 ' + w + '×' + h + '（浏览器上限）';
          }
        } catch (err) {
          api.toast('拍照失败：' + err.message, 'bad');
          busy = false;
          if (shutter) shutter.disabled = false;
          stage.classList.remove('flash');
          return;
        }
        stage.classList.remove('flash');
        if (shutter) shutter.disabled = false;
        busy = false;
        if (closed) return;
        const name = cameraFileName(blob.type);
        showReview(blob, name, 'viewfinder', note);
      }

      root.querySelector('#camShutter').addEventListener('click', takePhoto);

      root.querySelector('#camRetake').addEventListener('click', () => {
        reviewBlob = null;
        savedId = null;
        if (reviewUrl) { URL.revokeObjectURL(reviewUrl); reviewUrl = null; }
        reviewImg.removeAttribute('src');
        reviewEl.classList.add('hidden');
        reviewBar.classList.add('hidden');
        stage.classList.remove('reviewing', 'live');
        if (lastChannel === 'viewfinder') startViewfinder(false);
        else showIdle();
      });

      root.querySelector('#camDownload').addEventListener('click', () => {
        if (reviewBlob) photoSave(reviewBlob, reviewName);
      });

      root.querySelector('#camShare').addEventListener('click', async () => {
        if (!reviewBlob) return;
        const file = new File([reviewBlob], reviewName, { type: reviewBlob.type || 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
          try { await navigator.share({ files: [file], title: reviewName }); }
          catch (e) { if (e && e.name !== 'AbortError') api.toast('系统分享不可用，请下载原图', 'bad'); }
        } else {
          api.toast('此浏览器不支持文件分享，请下载原图', '');
        }
      });

      root.querySelector('#camDelete').addEventListener('click', async () => {
        if (!savedId) {
          api.toast('这张照片没有写入相册', '');
          return;
        }
        if (!confirm('从 AETHER 相册删除这张照片？')) return;
        try {
          await photoDbDelete(savedId);
          savedId = null;
          reviewTag.textContent = '已删除相册副本';
          reviewTag.classList.remove('ok');
          api.toast('已删除相册副本', 'ok');
        } catch (err) { api.toast('删除失败：' + err.message, 'bad'); }
      });

      const onVisibility = () => {
        if (!document.hidden) return;
        if (stream) {
          stopStream();
          if (!reviewBlob) {
            showIdle();
            setAlert('相机已暂停；重新打开取景器即可继续。');
          }
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      api.onClose(() => {
        closed = true;
        document.removeEventListener('visibilitychange', onVisibility);
        stopStream();
        if (reviewUrl) URL.revokeObjectURL(reviewUrl);
        root.style.overflow = '';
      });
      api.setSub('系统相机 · 自动对焦 / 变焦 · 原图');
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

        <div class="sheet-title">电池与省电 <span class="tag" id="powerTag">--</span></div>
        <div class="card">
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('battery')}</span>
            <div class="sr-main"><strong>省电模式</strong><span id="powerState">读取中…</span></div>
            <span class="tag" id="powerBat">--</span>
          </div>
          <div class="seg" id="powerSeg" style="margin:11px 0 6px">
            <button data-power-policy="auto">自动</button>
            <button data-power-policy="on">开启</button>
            <button data-power-policy="off">关闭</button>
          </div>
          <p class="note" id="powerNote"></p>
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

        <div class="sheet-title">系统更新 <span class="tag" id="updateTag">--</span></div>
        <div class="card">
          <div class="settings-row">
            <span class="sr-ico">${Aether.icon('refresh')}</span>
            <div class="sr-main"><strong>当前版本 ${Aether.version}</strong><span id="updateStatus">等待检查 GitHub / GitCode…</span></div>
            <button class="btn ghost sm" id="checkUpdate">检查</button>
          </div>
          <div class="settings-row" style="align-items:flex-start">
            <span class="sr-ico">${Aether.icon('download')}</span>
            <div class="sr-main"><strong>更新来源</strong><span>两平台都可以检查；选定来源后刷新即可，不需要重新安装应用</span>
              <div class="seg" id="updateSourceSeg" style="margin-top:8px">
                <button data-update-pref="github">GitHub</button>
                <button data-update-pref="gitcode">GitCode</button>
              </div>
            </div>
          </div>
          <p class="note" id="updateDetail">更新会清除旧缓存并重新加载当前安装地址；若应用部署在对应平台的 Pages，则直接获取该平台的新版本。</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
            <button class="btn solid sm" id="applyUpdate" disabled>刷新到新版本</button>
            <a class="btn ghost sm" id="updateRelease" target="_blank" rel="noopener">打开发布页</a>
          </div>
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
          <p><b>真实能力：</b>PWA 安装与离线；代码工作室 13 种语言（JS / Python / HTML / CSS 在浏览器沙盒中运行或预览，C / C++ / Java / Kotlin / Swift / Rust / Go / PHP / 汇编经本机桥接编译、运行并定位错误；Kotlin / Swift 为命令行程序，不构建 APK / iOS App）；文件管理器（系统目录授权、AETHER 空间、Termux/iSH 桥接，增删改查）；办公文档 DOCX / XLSX / PPTX / PDF 查看与修改；相机、相册调用系统能力；地图定位；音视频；备忘录；真实省电渲染策略；Termux/iSH 真 Linux 桥接与 Termux / iSH 主机命令通道（需自行部署）。</p>
          <p><b>演示模拟：</b>电话、短信、微信、QQ、支付宝界面（按钮跳转手机原生应用）；Wi-Fi/数据概念开关；信号格装饰；启动动画。</p>
          <p><b>不存在的能力：</b>在 iPhone 上安装自研内核或运行 App Store 之外的系统；让安卓免解锁刷入通用 ROM；由网页直接控制射频、CPU 频率或屏幕亮度；在本系统内运行真实微信/QQ 客户端。</p>
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

      const updateNote = '更新会清除旧缓存并重新加载当前安装地址；若应用部署在对应平台的 Pages，则直接获取该平台的新版本。';
      const updateTag = root.querySelector('#updateTag');
      const updateStatus = root.querySelector('#updateStatus');
      const updateDetail = root.querySelector('#updateDetail');
      const applyUpdateBtn = root.querySelector('#applyUpdate');
      const updateRelease = root.querySelector('#updateRelease');
      function refreshUpdateUI() {
        const u = Aether.updates;
        const st = u.state;
        const srcs = st.sources || {};
        root.querySelectorAll('[data-update-pref]').forEach(b => b.classList.toggle('on', b.dataset.updatePref === u.preferred));
        const parts = ['github', 'gitcode'].map(key => {
          const name = key === 'github' ? 'GitHub' : 'GitCode';
          const s = srcs[key];
          if (!s) return name + ' 待检查';
          if (!s.ok) return name + ' 不可达';
          return name + ' ' + s.version + (u.available(key) ? ' 可更新' : ' 最新');
        });
        if (st.checking) {
          updateTag.textContent = 'CHECK';
          updateTag.className = 'tag';
          updateStatus.textContent = '正在检查两个平台…';
          updateDetail.textContent = 'GitHub 与 GitCode 并行检查，单个来源失败不会阻塞另一个。';
        } else if (st.remote) {
          updateTag.textContent = st.remote.version;
          updateTag.className = 'tag acc';
          updateStatus.textContent = '发现新版本 · 选择来源后刷新，无需重装';
          updateDetail.textContent = (st.remote.notes ? '新版本说明：' + st.remote.notes + ' ' : '') + parts.join(' · ');
        } else {
          updateTag.textContent = Aether.version;
          updateTag.className = 'tag';
          updateStatus.textContent = st.error || '已是最新版本';
          updateDetail.textContent = parts.join(' · ') + '。' + updateNote;
        }
        const preferred = u.preferred;
        const target = u.available(preferred) ? preferred : (st.remote && st.remote.key);
        applyUpdateBtn.disabled = !target;
        applyUpdateBtn.dataset.target = target || '';
        updateRelease.href = u.releaseUrl;
      }
      refreshUpdateUI();
      const onUpdate = () => refreshUpdateUI();
      document.addEventListener('aether:update', onUpdate);
      api.onClose(() => document.removeEventListener('aether:update', onUpdate));
      root.querySelector('#updateSourceSeg').addEventListener('click', e => {
        const btn = e.target.closest('[data-update-pref]');
        if (!btn) return;
        Aether.updates.setPreferred(btn.dataset.updatePref);
        refreshUpdateUI();
        api.toast('更新来源已选择：' + (btn.dataset.updatePref === 'github' ? 'GitHub' : 'GitCode'), 'ok');
      });
      root.querySelector('#checkUpdate').addEventListener('click', async e => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = '检查中';
        updateStatus.textContent = '正在检查两个平台…';
        await Aether.updates.check(true);
        btn.disabled = false;
        btn.textContent = '检查';
        refreshUpdateUI();
        const st = Aether.updates.state;
        if (st.remote) api.toast('发现新版本 ' + st.remote.version, 'ok');
        else if (st.error) api.toast(st.error, 'err');
        else api.toast('当前已是最新版本', 'ok');
      });
      root.querySelector('#applyUpdate').addEventListener('click', e => {
        const target = e.currentTarget.dataset.target;
        if (target) Aether.updates.apply(target);
      });
      updateRelease.addEventListener('click', e => {
        e.preventDefault();
        const url = Aether.updates.releaseUrl;
        if (url) window.open(url, '_blank', 'noopener');
      });

      function refreshPowerUI() {
        const p = Aether.power || {};
        const policy = ['auto', 'on', 'off'].includes(Aether.settings.powerPolicy) ? Aether.settings.powerPolicy : 'auto';
        root.querySelectorAll('[data-power-policy]').forEach(b => b.classList.toggle('on', b.dataset.powerPolicy === policy));
        const tag = root.querySelector('#powerTag');
        tag.textContent = p.enabled ? '省电中' : (policy === 'auto' ? 'AUTO' : (policy === 'on' ? 'ON' : 'OFF'));
        tag.className = 'tag' + (p.enabled ? ' acc' : '');
        const hasLevel = Number.isFinite(p.level);
        const bat = root.querySelector('#powerBat');
        bat.textContent = hasLevel ? Math.round(p.level) + '%' + (p.charging ? ' ⚡' : '') : '无电池 API';
        bat.title = p.batteryApi ? '浏览器 Battery Status API 实时读数' : '此浏览器不提供电池读数';
        const state = root.querySelector('#powerState');
        state.textContent = p.enabled
          ? '已开启 · 粒子/背景动画/模糊与渲染循环已暂停'
          : (policy === 'auto' ? '待机 · 低于阈值时自动开启' : '未开启');
        const note = root.querySelector('#powerNote');
        if (!p.batteryApi && policy === 'auto') {
          note.textContent = '此浏览器未提供 Battery Status API（iOS Safari 常见），自动触发不可用；切到「开启」可立即执行真实省电渲染策略。浏览器无权调整屏幕亮度或 CPU 频率。';
        } else if (policy === 'auto') {
          note.textContent = '真实自动策略：电量 ≤20% 且未充电时开启；充电或电量恢复后自动退出。开启时暂停粒子、背景动画、模糊与过渡，并停止不必要的渲染循环；浏览器无权调整屏幕亮度或 CPU 频率。';
        } else if (policy === 'on') {
          note.textContent = '手动开启：忽略当前电量，立即暂停粒子、背景动画、模糊与渲染循环，直到你切回自动或关闭。';
        } else {
          note.textContent = '已强制关闭：即使电量很低也不会自动开启，直到你切回自动或手动开启。';
        }
      }
      refreshPowerUI();
      const onPowerChange = () => refreshPowerUI();
      document.addEventListener('aether:power', onPowerChange);
      api.onClose(() => document.removeEventListener('aether:power', onPowerChange));

      root.addEventListener('click', async e => {
        const pol = e.target.closest('[data-power-policy]');
        if (pol) {
          Aether.setPowerPolicy(pol.dataset.powerPolicy);
          refreshPowerUI();
          const names = { auto: '自动', on: '开启', off: '关闭' };
          api.toast('省电策略已切换为「' + names[pol.dataset.powerPolicy] + '」', 'ok');
          return;
        }
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
