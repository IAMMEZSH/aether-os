/* ============================================================
   AETHER TERMINAL · BASH / CMD / POWERSHELL + REAL LINUX BRIDGE
   ============================================================ */
(() => {
  'use strict';
  const $ = (s, el = document) => (el || document).querySelector(s);

  /* ---------------- 虚拟文件系统 ---------------- */
  const f = c => ({ t: 'f', c });
  const d = c => ({ t: 'd', c });
  const VFS = d({
    home: d({
      aether: d({
        'welcome.txt': f(
          '欢迎来到 AETHER OS 概念终端。\n\n' +
          '· 本终端默认运行在浏览器沙盒中，命令与文件均为模拟。\n' +
          '· 在 Android 上点右上角「真 Linux」，可接入 Termux 里安装的\n' +
          '  Ubuntu 或 Kali 用户空间，执行真实 Linux 命令。\n' +
          '· CMD / PowerShell 为演示 shell，不会调用 Windows。\n\n' +
          '输入 help 查看可用命令，或 open map 启动地图。\n'
        ),
        'notes.md': f('# 终端备忘\n- 试一下 neofetch\n- 试一下 nmap demo.aether.local\n- Android 上连接真 Linux\n'),
        projects: d({
          'aether.txt': f('AETHER OS · 概念系统\nUI：未来科技风 PWA\n后端：Termux + proot-distro（可选）\n')
        })
      })
    }),
    etc: d({
      'aether-release': f('AETHER OS 1.2.0 (concept)\nID=aether\nPRETTY_NAME="AETHER OS 1.2.0 Concept"\nHOME_URL="local://aether"\n'),
      hostname: f('aether\n'),
      'os-release': f('NAME="AETHER OS"\nVERSION="1.2.0 concept"\nID_LIKE="linux"\n')
    }),
    var: d({
      log: d({ 'aether.log': f('[boot] web compositor started\n[net] navigator.onLine watched\n[bridge] optional: termux proot-distro\n') })
    }),
    usr: d({ bin: d({}) }),
    sdcard: d({ DCIM: d({}), Download: d({}) }),
    proc: d({ version: f('web-virtual 1.2.0 (concept-sandbox)\n') })
  });

  const RO_HOME = '/home/aether';

  function resolvePath(cwd, p) {
    if (!p) return cwd;
    if (p === '~') return RO_HOME;
    if (p.startsWith('~/')) p = RO_HOME + p.slice(1);
    const raw = p.startsWith('/') ? p : cwd + '/' + p;
    const out = [];
    raw.split('/').forEach(seg => {
      if (!seg || seg === '.') return;
      if (seg === '..') out.pop();
      else out.push(seg);
    });
    return '/' + out.join('/');
  }
  function nodeAt(p) {
    if (p === '/') return VFS;
    let n = VFS;
    for (const seg of p.split('/').filter(Boolean)) {
      if (!n || n.t !== 'd' || !Object.prototype.hasOwnProperty.call(n.c, seg)) return null;
      n = n.c[seg];
    }
    return n;
  }
  function parentOf(p) {
    const idx = p.lastIndexOf('/');
    return idx <= 0 ? '/' : p.slice(0, idx);
  }
  function baseName(p) { return p.slice(p.lastIndexOf('/') + 1) || '/'; }
  function dirSize(n) {
    if (!n || n.t === 'f') return (n && n.c ? n.c.length : 0);
    return Object.values(n.c).reduce((s, x) => s + (x.t === 'f' ? (x.c || '').length : 0), 0);
  }
  function shortPath(p, shell) {
    if (shell === 'bash' || shell === 'real') {
      if (p === RO_HOME) return '~';
      if (p.startsWith(RO_HOME + '/')) return '~' + p.slice(RO_HOME.length);
      return p;
    }
    return 'C:\\Users\\aether';
  }

  /* ---------------- 命令帮助 ---------------- */
  const HELP = {
    bash: [
      ['help', '显示命令列表'],
      ['ls / cd / pwd', '目录浏览'],
      ['cat / touch / mkdir / rm', '文件操作（虚拟文件系统）'],
      ['grep <关键字> <文件>', '简单文本搜索'],
      ['echo / calc', '输出与计算'],
      ['whoami / hostname / uname -a', '系统信息'],
      ['date / uptime / df -h / free -h / ps', '运行状态'],
      ['neofetch', '系统信息卡片'],
      ['ping / nmap', '沙盒模拟网络工具（不扫描真实目标）'],
      ['apt / sudo / chmod', '演示输出'],
      ['open <app>', '启动应用：terminal phone messages wechat qq alipay browser office code map media photos notes settings'],
      ['history / clear', '历史与清屏'],
      ['shell bash|cmd|pwsh', '切换模拟 shell']
    ],
    cmd: [
      ['help', '显示命令列表'],
      ['dir / cd / cls', '目录浏览'],
      ['type <文件>', '查看文件（同 cat）'],
      ['echo', '输出'],
      ['ver', '版本'],
      ['ipconfig / systeminfo / tasklist', '系统信息（模拟）'],
      ['whoami / hostname / date / time', '基础信息'],
      ['ping', '模拟网络测试'],
      ['shell bash|cmd|pwsh', '切换模拟 shell']
    ],
    pwsh: [
      ['help / Get-Help', '显示命令列表'],
      ['Get-ChildItem / gci', '列目录'],
      ['Get-Location / pwd', '当前目录'],
      ['Set-Location / cd', '切换目录'],
      ['Get-Content <文件>', '查看文件'],
      ['Get-Date', '当前时间'],
      ['Get-Process', '进程（模拟）'],
      ['Get-Command', '可用命令'],
      ['Write-Output <文本>', '输出'],
      ['Clear-Host / cls', '清屏'],
      ['shell bash|cmd|pwsh', '切换模拟 shell']
    ]
  };

  const KALI_NOTE = '# 沙盒模拟输出：不对任何真实主机进行扫描。真实工具请连接 Android 上的 Kali 用户空间。';

  function tokenize(line) {
    const out = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(line))) out.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    return out;
  }

  function safeCalc(expr) {
    if (!/^[\d\s+\-*/().%^]+$/.test(expr)) return null;
    const js = expr.replace(/\^/g, '**');
    try { const v = Function('"use strict";return (' + js + ')')(); return typeof v === 'number' && isFinite(v) ? v : null; }
    catch (e) { return null; }
  }

  function fmtDate(dt) {
    return dt.toLocaleString('zh-CN', { hour12: false });
  }

  /* ---------------- 应用注册 ---------------- */
  Aether.registerApp({
    id: 'terminal',
    name: '终端',
    sub: 'BASH · CMD · POWERSHELL · REAL BRIDGE',
    icon: 'terminal',
    accent: '#36e6ff',
    order: 10,
    flush: true,
    render(root, api) {
      root.classList.add('term-root');
      root.innerHTML = `
        <div class="term-toolbar">
          <div class="term-shell-seg" id="termShellSeg">
            <button data-shell="bash" class="on">BASH</button>
            <button data-shell="cmd">CMD</button>
            <button data-shell="pwsh">PS</button>
          </div>
          <div class="term-shell-seg hidden" id="termRealSeg">
            <button data-channel="linux" class="on">LINUX</button>
            <button data-channel="host" id="termHostBtn">TERMUX</button>
          </div>
          <span class="term-meta" id="termMeta">SIM · WEB VFS</span>
          <button class="btn sm ghost" id="termModeBtn">真 Linux</button>
        </div>
        <div class="term-out" id="termOut"></div>
        <div class="term-input-line">
          <span class="term-prompt" id="termPrompt">aether@aether:~$</span>
          <input class="term-input" id="termInput" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="终端输入">
          <span class="term-hint">TAB</span>
        </div>
      `;
      const out = $('#termOut', root);
      const input = $('#termInput', root);
      const promptEl = $('#termPrompt', root);
      const metaEl = $('#termMeta', root);
      const seg = $('#termShellSeg', root);
      const realSeg = $('#termRealSeg', root);
      const hostBtn = $('#termHostBtn', root);
      const modeBtn = $('#termModeBtn', root);

      const st = {
        shell: 'bash',
        mode: 'sim',
        cwd: RO_HOME,
        realCwd: '/root',
        realHome: '/root',
        hostCwd: null,
        hostHome: null,
        channel: 'linux',
        history: [],
        histIdx: -1,
        busy: false,
        cleanupFns: []
      };
      const bridge = { cfg: Aether.store.get('bridge', null) };

      function printLine(text = '', cls = '') {
        const div = document.createElement('div');
        div.className = 'term-line' + (cls ? ' ' + cls : '');
        div.textContent = text;
        out.appendChild(div);
        out.scrollTop = out.scrollHeight;
        return div;
      }
      function printBlock(text, cls = '') {
        String(text).replace(/\n$/, '').split('\n').forEach(l => printLine(l, cls));
      }
      function shortReal(p, home) {
        return p === home ? '~' : (p.startsWith(home + '/') ? '~' + p.slice(home.length) : p);
      }
      function promptText() {
        if (st.mode === 'real') {
          if (st.channel === 'host') {
            const home = st.hostHome || '/';
            const cwd = st.hostCwd || home;
            const label = bridge.cfg && bridge.cfg.mode === 'ish' ? 'ish@alpine' : 'termux@termux';
            return `<span class="tp-acc">${label}</span>:${shortReal(cwd, home)} $`;
          }
          const home = st.realHome || '/root';
          const short = shortReal(st.realCwd, home);
          return `<span class="tp-acc">aether@${bridge.cfg ? bridge.cfg.distro : 'linux'}</span>:${short} $`;
        }
        if (st.shell === 'bash') return `<span class="tp-acc">aether@aether</span>:${shortPath(st.cwd, 'bash')} $`;
        if (st.shell === 'cmd') return `C:\\Users\\aether&gt;`;
        return `PS C:\\Users\\aether&gt;`;
      }
      function syncPrompt() { promptEl.innerHTML = promptText(); }
      function setMeta() {
        const hostLabel = bridge.cfg && bridge.cfg.mode === 'ish' ? 'ISH' : 'TERMUX';
        hostBtn.textContent = hostLabel;
        if (st.mode === 'real') {
          const kind = bridge.cfg.mode === 'ish' ? 'iSH' : 'proot';
          metaEl.textContent = st.channel === 'host'
            ? 'REAL · ' + (bridge.cfg.mode === 'ish' ? 'iSH · ALPINE' : 'TERMUX HOST')
            : 'REAL · ' + (bridge.cfg.distro || 'linux').toUpperCase() + ' · ' + kind;
        } else {
          metaEl.textContent = 'SIM · WEB VFS';
        }
        seg.classList.toggle('hidden', st.mode === 'real');
        realSeg.classList.toggle('hidden', st.mode !== 'real');
        [...seg.children].forEach(b => b.classList.toggle('on', b.dataset.shell === st.shell && st.mode !== 'real'));
        [...realSeg.children].forEach(b => b.classList.toggle('on', b.dataset.channel === st.channel && st.mode === 'real'));
        syncPrompt();
      }
      function channelHint() {
        if (st.channel === 'host') {
          if (bridge.cfg.mode === 'ish') {
            printLine('iSH 主机 · Alpine：命令直接运行在 iSH 用户空间，可执行 apk update / apk add、ls、uname -a、python3 等。', 'ok');
          } else {
            printLine('Termux 主机：命令直接运行在 Termux，可执行 pkg install、termux-battery-status、termux-toast、am start 等。', 'ok');
            printLine('termux-* 命令需安装 Termux:API App 与 termux-api 包；访问共享存储先运行 termux-setup-storage。', 'dim');
          }
        } else {
          printLine('已进入 ' + (bridge.cfg.distro || 'linux') + ' 用户空间，可执行 apt、uname、ls、编译器等发行版命令。', 'ok');
        }
        printLine('切换上方 LINUX / ' + (bridge.cfg.mode === 'ish' ? 'ISH' : 'TERMUX') + ' 可改变命令执行位置；输入 help 查看示例。', 'dim');
      }
      function banner() {
        printLine('AETHER TERMINAL  v1.2.0  ·  ' + (st.mode === 'real' ? 'REAL LINUX BRIDGE' : 'CONCEPT SANDBOX'), 'sys');
        if (st.mode === 'real') {
          const via = bridge.cfg.mode === 'ish' ? 'iSH · Alpine' : 'proot-distro · ' + bridge.cfg.distro;
          printLine(`已连接 ${via}。命令真实执行，界面由 AETHER OS 提供。`, 'ok');
          channelHint();
          printLine('提示：交互式程序（vim/top 等）不受支持；每条命令独立执行。', 'dim');
        } else {
          printLine('默认沙盒模式：命令、路径、网络输出均为演示，不触碰真实系统。', 'dim');
          printLine('Android 可连 Termux 真 Linux（Ubuntu/Kali）与 Termux 主机，iPhone/iPad 可经 iSH 执行 Alpine 命令。输入 help 查看命令。', 'dim');
        }
        printLine('');
      }

      /* ---------- 模拟 shell 执行 ---------- */
      function execSim(raw) {
        const argv = tokenize(raw);
        if (!argv.length) return;
        const cmd = (st.shell === 'pwsh' ? argv[0].toLowerCase() : argv[0]);
        const args = argv.slice(1);
        const need = n => args.length >= n;
        const cwdNode = nodeAt(st.cwd) || VFS;

        const cmdMap = {
          help() {
            printBlock(`可用命令（${st.shell}）：`, 'sys');
            HELP[st.shell].forEach(([c, desc]) => printLine('  ' + c.padEnd(30, ' ') + desc));
            printLine('');
            printLine('提示：Tab 补全、↑/↓ 历史、Ctrl+L 清屏。', 'dim');
          },
          clear() { out.innerHTML = ''; },
          open() {
            if (!need(1)) return printLine('用法：open <app>', 'warn');
            const app = Aether.apps.get(args[0]);
            if (!app) return printLine(`未找到应用：${args[0]}`, 'err');
            printLine(`启动应用 ${app.name}…`, 'ok');
            setTimeout(() => Aether.openApp(args[0]), 260);
          },
          shell() {
            if (!need(1)) return printLine('用法：shell bash|cmd|pwsh', 'warn');
            const map = { bash: 'bash', cmd: 'cmd', pwsh: 'pwsh', powershell: 'pwsh', ps: 'pwsh' };
            const s = map[args[0].toLowerCase()];
            if (!s) return printLine('未知 shell：' + args[0], 'err');
            st.shell = s;
            setMeta();
            printLine('已切换 shell：' + (s === 'pwsh' ? 'PowerShell' : s), 'ok');
          },
          pwd() { printLine(st.cwd); },
          cd() {
            const target = args[0] || RO_HOME;
            const p = resolvePath(st.cwd, target);
            const n = nodeAt(p);
            if (!n) return printLine(`cd: ${target}: 没有那个文件或目录`, 'err');
            if (n.t !== 'd') return printLine(`cd: ${target}: 不是目录`, 'err');
            st.cwd = p;
            syncPrompt();
          },
          ls() {
            if (args.includes('-l')) {
              const entries = Object.entries(cwdNode.c || {}).sort((a, b) => a[0].localeCompare(b[0]));
              if (!entries.length) return;
              entries.forEach(([name, n]) => {
                const type = n.t === 'd' ? 'drwxr-xr-x' : '-rw-r--r--';
                const size = String(n.t === 'd' ? 4096 : (n.c || '').length).padStart(6, ' ');
                printLine(`${type} aether aether ${size} ${name}${n.t === 'd' ? '/' : ''}`);
              });
              return;
            }
            const target = resolvePath(st.cwd, args.find(a => !a.startsWith('-')) || '.');
            const n = nodeAt(target);
            if (!n) return printLine(`ls: 无法访问 '${target}': 没有那个文件或目录`, 'err');
            if (n.t === 'f') return printLine(baseName(target));
            const names = Object.entries(n.c || {}).sort((a, b) => a[0].localeCompare(b[0]))
              .map(([name, x]) => name + (x.t === 'd' ? '/' : ''));
            printLine(names.join('   ') || '（空目录）');
          },
          dir() {
            printLine(' 驱动器 C 中的卷是 AETHER');
            printLine(' 卷的序列号是 73A3-2026');
            printLine('');
            printLine(' C:\\Users\\TENSAINT 的目录');
            printLine('');
            Object.entries(cwdNode.c || {}).forEach(([name, n]) => {
              printLine(`${fmtDate(new Date(2026, 10, 18, 9, 30))}    ${n.t === 'd' ? '<DIR>          ' : String((n.c || '').length).padStart(14, ' ')} ${name}${n.t === 'd' ? '\\' : ''}`);
            });
            printLine(`               ${Object.keys(cwdNode.c || {}).length} 个文件          ${dirSize(cwdNode)} 字节`);
            printLine('               2 个目录  12,345,678,901 可用字节');
          },
          cls() { out.innerHTML = ''; },
          cat() {
            if (!need(1)) return printLine('用法：cat <文件>', 'warn');
            const p = resolvePath(st.cwd, args[0]);
            const n = nodeAt(p);
            if (!n) return printLine(`cat: ${args[0]}: 没有那个文件或目录`, 'err');
            if (n.t === 'd') return printLine(`cat: ${args[0]}: 是一个目录`, 'err');
            printBlock(n.c);
          },
          type() { cmdMap.cat(); },
          touch() {
            if (!need(1)) return printLine('用法：touch <文件>', 'warn');
            const p = resolvePath(st.cwd, args[0]);
            const parentPath = parentOf(p), parent = nodeAt(parentPath);
            if (!parent || parent.t !== 'd') return printLine('touch: 目标目录不存在', 'err');
            if (!parent.c[baseName(p)]) parent.c[baseName(p)] = f('');
            printLine(`已创建 ${p}`, 'dim');
          },
          mkdir() {
            const target = args.filter(a => !a.startsWith('-'))[0];
            if (!target) return printLine('用法：mkdir <目录>', 'warn');
            const p = resolvePath(st.cwd, target);
            const parent = nodeAt(parentOf(p));
            if (!parent || parent.t !== 'd') return printLine('mkdir: 上级目录不存在', 'err');
            parent.c[baseName(p)] = d({});
            printLine(`已创建目录 ${p}`, 'dim');
          },
          rm() {
            const target = args.filter(a => !a.startsWith('-'))[0];
            const recursive = args.includes('-r') || args.includes('-rf');
            if (!target) return printLine('用法：rm [-r] <文件|目录>', 'warn');
            const p = resolvePath(st.cwd, target);
            if (p === '/' || p === RO_HOME) return printLine('rm: 拒绝删除关键目录（演示保护）', 'warn');
            const parent = nodeAt(parentOf(p));
            const name = baseName(p);
            if (!parent || parent.t !== 'd' || !parent.c[name]) return printLine(`rm: ${target}: 没有那个文件或目录`, 'err');
            if (parent.c[name].t === 'd' && !recursive) return printLine(`rm: ${target}: 是一个目录（使用 -r）`, 'err');
            delete parent.c[name];
            printLine(`已删除 ${p}`, 'dim');
          },
          grep() {
            if (args.length < 2) return printLine('用法：grep <关键字> <文件>', 'warn');
            const p = resolvePath(st.cwd, args[1]);
            const n = nodeAt(p);
            if (!n || n.t !== 'f') return printLine(`grep: ${args[1]}: 文件不存在`, 'err');
            const hits = n.c.split('\n').filter(l => l.includes(args[0]));
            hits.length ? printBlock(hits.join('\n')) : printLine('（无匹配）', 'dim');
          },
          echo() { printLine(args.join(' ')); },
          calc() {
            if (!args.length) return printLine('用法：calc 1+2*3', 'warn');
            const v = safeCalc(args.join(' '));
            v === null ? printLine('calc: 无法计算该表达式', 'err') : printLine('= ' + v, 'ok');
          },
          whoami() { printLine(st.mode === 'real' ? 'root' : 'aether'); },
          hostname() { printLine('aether'); },
          uname() {
            if (args.includes('-a')) printLine('AetherOS 1.2.0 concept web-virtual #1 SMP PREEMPT ' + new Date().toDateString() + ' x86_64 WebRuntime (sandbox)');
            else printLine('AetherOS');
          },
          date() { printLine(fmtDate(new Date())); },
          time() { printLine(new Date().toLocaleTimeString('zh-CN', { hour12: false })); },
          uptime() {
            const s = Math.floor(performance.now() / 1000);
            printLine(` ${new Date().toLocaleTimeString('zh-CN', { hour12: false })} up ${Math.floor(s / 60)} min, 1 user, load average: 0.08, 0.12, 0.09`);
          },
          df() {
            printLine('Filesystem      Size  Used Avail Use% Mounted on', 'dim');
            printLine('aetherfs         64G  4.2G   59G   7% /');
            printLine('tmpfs           2.0G     0  2.0G   0% /proc');
            printLine('sdcard          128G   18G  110G  15% /sdcard', 'dim');
          },
          free() {
            printLine('               total        used        free      shared  buff/cache   available', 'dim');
            printLine('Mem:           8.0Gi       2.1Gi       4.6Gi       0.2Gi       1.3Gi       5.7Gi');
            printLine('Swap:          2.0Gi          0B       2.0Gi');
          },
          ps() {
            printLine('USER       PID  %CPU  %MEM  COMMAND', 'dim');
            printLine('aether     1   0.1   0.8  aether-init');
            printLine('aether   128   1.4   2.2  aether-ui');
            printLine('aether   209   0.3   1.1  aether-term');
            printLine('aether   311   0.0   0.4  bridge-watch (optional)', 'dim');
          },
          top() {
            printLine('top - ' + new Date().toLocaleTimeString('zh-CN', { hour12: false }) + ' up 1 min, load average: 0.08, 0.12, 0.09', 'dim');
            printLine('任务: 4 total, 1 running, 3 sleeping');
            printLine('');
            printLine('  PID  USER      PR  NI    VIRT    RES  S  %CPU  %MEM  COMMAND', 'dim');
            printLine('  128  aether  20   0  512.3m  88.2m  S   1.4   2.2  aether-ui');
            printLine('  209  aether  20   0   64.1m  22.8m  S   0.3   1.1  aether-term');
            printLine('（快照输出，按 Enter 返回）', 'dim');
          },
          neofetch() {
            const logo = [
              '        ______ ',
              '       /  __  \\',
              '      /  /  \\  \\',
              '     |  | A  |  |',
              '      \\  \\__/  /',
              '       \\______/',
              '      AETHER OS'
            ];
            const info = [
              'OS: AETHER OS 1.2.0 concept',
              'Host: Web Runtime (PWA)',
              'Kernel: web-virtual (sandbox)',
              'Shell: ' + (st.shell === 'pwsh' ? 'PowerShell (sim)' : st.shell),
              'DE: Neon Compositor',
              'Terminal: AetherTerm',
              'CPU: Browser JS Engine',
              'Memory: virtual pages',
              'Uptime: ' + Math.floor(performance.now() / 1000) + 's'
            ];
            const n = Math.max(logo.length, info.length);
            for (let i = 0; i < n; i++) {
              const left = (logo[i] || '').padEnd(24, ' ');
              printLine(left + (info[i] || ''), i < logo.length && !info[i] ? 'ascii' : '');
            }
          },
          man() {
            if (!need(1)) return printLine('用法：man <命令>', 'warn');
            const found = HELP[st.shell].find(([c]) => c.split(' / ').some(x => x.startsWith(args[0])));
            found ? printLine(found[0] + ' — ' + found[1]) : printLine(`man: 没有 ${args[0]} 的手册页`, 'warn');
          },
          history() {
            st.history.forEach((h, i) => printLine(String(i + 1).padStart(4) + '  ' + h));
          },
          ping() {
            const host = args[0] || 'aether.local';
            printLine(`PING ${host} (10.73.0.1) 56(84) bytes of data.`, 'dim');
            for (let i = 1; i <= 4; i++) {
              printLine(`64 bytes from ${host}: icmp_seq=${i} ttl=64 time=${(0.18 + Math.random() * 0.5).toFixed(2)} ms`);
            }
            printLine(`--- ${host} ping statistics ---`);
            printLine('4 packets transmitted, 4 received, 0% packet loss (sololilo simulation)'.replace('sololilo', 'sandbox'), 'dim');
          },
          nmap() {
            printLine(KALI_NOTE, 'warn');
            printLine('Starting Nmap 7.95 ( sandbox ) at ' + fmtDate(new Date()), 'dim');
            printLine('Nmap scan report for demo.aether.local (10.73.0.1)');
            printLine('Host is up (0.00042s latency).', 'dim');
            printLine('');
            printLine('PORT     STATE  SERVICE');
            printLine('22/tcp   open   ssh');
            printLine('80/tcp   open   http');
            printLine('443/tcp  open   https');
            printLine('');
            printLine('Nmap done: 1 IP address (0 fake hosts up) scanned in 0.12 seconds', 'dim');
          },
          apt() {
            if (args[0] === 'update') {
              printLine('命中:1 sandbox://aether stable InRelease', 'dim');
              printLine('正在读取软件包列表... 完成');
              printLine('（沙盒演示，未连接真实软件源）', 'warn');
            } else if (args[0] === 'install' && args[1]) {
              printLine(`正在读取软件包列表... 完成`);
              printLine(`将会安装 1 个软件包：${args[1]}（演示）`, 'warn');
              printLine(`成功安装 ${args[1]}，版本 concept-1.0（未真正执行）`, 'ok');
            } else {
              printLine('用法：apt update 或 apt install <包名>（沙盒演示）', 'dim');
            }
          },
          sudo() {
            if (!args.length) return printLine('用法：sudo <命令>', 'warn');
            printLine('[sudo] 密码：沙盒已授予虚拟 root（演示）', 'dim');
            execSim(args.join(' '));
          },
          chmod() { printLine('chmod: 沙盒模式已记录（未真正修改）', 'dim'); },
          ver() { printLine('AETHER OS [Version 1.2.0-concept]'); },
          ipconfig() {
            printLine('');
            printLine('以太网适配器 aether0：');
            printLine('   连接特定的 DNS 后缀 . . . . . . . : aether.local');
            printLine('   IPv4 地址 . . . . . . . . . . . . : 10.73.0.42 (模拟)');
            printLine('   子网掩码  . . . . . . . . . . . . : 255.255.255.0');
            printLine('   默认网关. . . . . . . . . . . . . : 10.73.0.1');
          },
          systeminfo() {
            printLine('主机名:            AETHER');
            printLine('OS 名称:           AETHER OS Concept 1.2.0');
            printLine('OS 版本:           1.2.0 WebRuntime');
            printLine('系统类型:          x64-based terminal (simulated)');
            printLine('处理器:            Browser JS Engine');
            printLine('物理内存总量:      8,192 MB (virtual)');
            printLine('可用的物理内存:    5,842 MB (virtual)');
          },
          tasklist() {
            printLine('映像名称                   PID 会话名          内存使用', 'dim');
            printLine('aether-core.exe            128 Console         88,210 K');
            printLine('aether-terminal.exe        209 Console         22,804 K');
            printLine('bridge-agent.exe           311 Services        12,208 K');
          },
          set() { printLine('AETHER=1\nHOME=C:\\Users\\TENSAINT\nSHELL=cmd (simulated)\nPATH=C:\\Aether\\bin'); },
          gci() { st.shell = st.shell; execSim('ls'); },
          'get-childitem'() { execSim('ls'); },
          'get-location'() { printLine(st.cwd); },
          'get-content'() { execSim('cat ' + args.join(' ')); },
          'set-location'() { execSim('cd ' + args.join(' ')); },
          'get-date'() { printLine(fmtDate(new Date())); },
          'get-process'() { printLine('Handles  NPM(K)  PM(K)  WS(K)  CPU(s)  Id  ProcessName', 'dim'); printLine('    412      22   8204  15212    1.42   128 aether-ui'); printLine('    208      14   5120   8804    0.21   209 aether-term'); },
          'get-help'() { execSim('help'); },
          'get-command'() { printBlock(HELP.pwsh.map(([c]) => 'CommandType   Name  ' + c).join('\n')); },
          'clear-host'() { out.innerHTML = ''; },
          'write-output'() { printLine(args.join(' ')); }
        };
        const fn = cmdMap[cmd] || cmdMap[cmd.toLowerCase()];
        if (fn) { fn(); }
        else printLine(`${cmd}: 未找到命令。输入 help 查看可用命令（当前为模拟 shell）。`, 'err');
      }

      /* ---------- 真实桥接执行 ---------- */
      function realHelp() {
        const host = st.channel === 'host';
        const ish = bridge.cfg.mode === 'ish';
        printLine('REAL 命令示例 · ' + (host ? (ish ? 'iSH · Alpine 主机' : 'Termux 主机') : (bridge.cfg.distro || 'linux') + ' 用户空间'), 'sys');
        const rows = host
          ? (ish
            ? [
              ['apk update / apk add <包>', 'iSH 的 Alpine 包管理器'],
              ['uname -a / ls / cat', 'iSH 用户空间内的真实命令'],
              ['python3 / sh / apk', 'iSH 已安装的工具可直接运行'],
              ['exit', '断开桥接，回到模拟模式'],
            ]
            : [
              ['pkg update / pkg install <包>', 'Termux 包管理器'],
              ['termux-battery-status / termux-toast', 'Termux:API（需安装 App 与 termux-api 包）'],
              ['termux-clipboard-get / termux-open', '剪贴板与打开文件/链接'],
              ['am start -a android.intent.action.VIEW ...', 'Android 系统 Intent（受系统限制）'],
              ['ls ~ /sdcard', '先运行 termux-setup-storage 授权共享存储'],
              ['exit', '断开桥接，回到模拟模式'],
            ])
          : [
            ['apt update / apt install <包>', '当前发行版包管理器'],
            ['uname -a / ls / cat / ps', '真实 Linux 命令'],
            ['python3 / gcc / node', '已安装的工具链可直接调用'],
            ['exit', '断开桥接，回到模拟模式'],
          ];
        rows.forEach(([c, d]) => printLine('  ' + c.padEnd(34, ' ') + d));
        printLine('提示：帮助不会伪造输出；真正执行请直接输入命令。交互式全屏程序不受支持。', 'dim');
      }
      async function realExec(raw) {
        const cmd = raw.trim();
        if (!cmd) return;
        if (cmd === 'clear' || cmd === 'cls') { out.innerHTML = ''; return; }
        if (cmd === 'help' || cmd === '?') { realHelp(); return; }
        if (cmd === 'exit') {
          st.mode = 'sim';
          st.shell = 'bash';
          st.channel = 'linux';
          setMeta();
          printLine('已断开桥接，回到模拟模式。', 'warn');
          return;
        }
        const host = st.channel === 'host';
        const ish = bridge.cfg.mode === 'ish';
        const home = host ? (st.hostHome || '/') : (st.realHome || '/root');
        const cwd = host ? (st.hostCwd || st.hostHome || '/') : st.realCwd;
        const label = host ? (ish ? 'ish@alpine' : 'termux@termux') : 'aether@' + bridge.cfg.distro;
        printLine(label + ':' + shortReal(cwd, home) + ' $ ' + raw, 'cmd');
        st.busy = true;
        input.disabled = true;
        const spin = setInterval(() => {}, 1000);
        try {
          const ctl = new AbortController();
          const timer = setTimeout(() => ctl.abort(), 30000);
          st.cleanupFns.push(() => { clearTimeout(timer); ctl.abort(); });
          const endpoint = bridge.cfg.endpoint.replace(/\/$/, '');
          const res = await fetch(endpoint + '/api/exec', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-aether-token': bridge.cfg.token },
            body: JSON.stringify({ cmd, cwd, distro: bridge.cfg.distro, scope: host ? 'host' : 'distro' }),
            signal: ctl.signal
          });
          clearTimeout(timer);
          let data = null;
          try { data = await res.json(); } catch (e) {}
          if (!res.ok || !data || !data.ok) {
            printLine('桥接错误：' + (data && data.error ? data.error : ('HTTP ' + res.status)), 'err');
            if (res.status === 401) printLine('令牌无效，请重新连接真 Linux。', 'warn');
          } else {
            if (data.out) printBlock(data.out);
            if (typeof data.code === 'number' && data.code !== 0) printLine(`退出码 ${data.code}`, 'warn');
            if (data.cwd) {
              if (host) st.hostCwd = data.cwd;
              else st.realCwd = data.cwd;
            }
            if (data.truncated) printLine('（输出过长已截断）', 'dim');
            if (typeof data.ms === 'number') {
              printLine(`· ${data.ms} ms · ${data.scope === 'host' ? (ish ? 'iSH' : 'Termux') : data.distro}`, 'dim');
            }
          }
        } catch (err) {
          printLine('无法连接桥接服务：' + (err && err.name === 'AbortError' ? '请求超时' : String(err && err.message || err)), 'err');
          printLine('确认 Termux / iSH 中已运行 bridge/server.py，并且地址与令牌正确。', 'dim');
        } finally {
          clearInterval(spin);
          st.busy = false;
          input.disabled = false;
          input.focus();
          syncPrompt();
        }
      }

      /* ---------- 连接面板 ---------- */
      function openSetup() {
        const endpoint = (bridge.cfg && bridge.cfg.endpoint) || location.origin;
        const token = bridge.cfg ? bridge.cfg.token : '';
        const overlay = document.createElement('div');
        overlay.className = 'term-setup';
        overlay.innerHTML = `
          <div class="card">
            <div class="sheet-title" style="margin-top:0">连接真 Linux <span class="tag acc">REAL LINUX BRIDGE</span></div>
            <p class="note" style="margin-bottom:12px">Android：在 Termux 运行 <span class="mono">bash bridge/setup-termux.sh</span>，再运行 <span class="mono">python3 bridge/server.py</span>。iOS：在 iSH 运行 <span class="mono">sh bridge/setup-ios-ish.sh</span>，再启动同一服务。令牌由服务端启动时打印。</p>
            <label class="ts-label">桥接地址</label>
            <div class="field" style="margin-bottom:9px"><input id="tsEndpoint" class="mono" style="font-size:12px" value="${endpoint.replace(/"/g, '&quot;')}" placeholder="http://127.0.0.1:8787"></div>
            <label class="ts-label">访问令牌</label>
            <div class="field" style="margin-bottom:9px"><input id="tsToken" class="mono" style="font-size:12px" type="password" value="${token.replace(/"/g, '&quot;')}" placeholder="server 启动时打印的 token"></div>
            <label class="ts-label">发行版（用户空间）</label>
            <select id="tsDistro" class="ts-select">
              <option value="ubuntu">Ubuntu</option>
              <option value="kali">Kali</option>
              <option value="deepin">deepin（自备 rootfs）</option>
              <option value="alpine">Alpine（iSH）</option>
            </select>
            <div class="ts-status" id="tsStatus"></div>
            <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
              <button class="btn solid" id="tsConnect" style="flex:1">连接并测试</button>
              <button class="btn ghost" id="tsBack">返回模拟</button>
            </div>
            <button class="btn ghost" id="tsClose" style="width:100%;margin-top:8px">关闭</button>
            <p class="note" style="margin-top:10px">连接后可切换两种通道：LINUX 进入 Ubuntu / Kali / Alpine 用户空间；<span class="mono">TERMUX</span>（Android）直接执行 pkg、termux-* 等 Termux 主机命令，<span class="mono">ISH</span>（iPhone/iPad）直接执行 apk 等 iSH Alpine 命令。termux-* 需要 Termux:API App 与 termux-api 包。</p>
            <p class="note" style="margin-top:8px">安全边界：桥接仅监听本机回环地址并校验令牌；它执行的是你手机内 Termux/iSH 用户空间的命令，不涉及 PC 或远程服务器。deepin 需自备 rootfs；桌面浏览器也可打开同一地址。</p>
          </div>
        `;
        root.appendChild(overlay);
        const endEl = $('#tsEndpoint', overlay);
        const tokEl = $('#tsToken', overlay);
        const distroEl = $('#tsDistro', overlay);
        const status = $('#tsStatus', overlay);
        if (bridge.cfg) distroEl.value = bridge.cfg.distro;
        setTimeout(() => tokEl.focus(), 80);

        async function probeBridge() {
          const endpoint = endEl.value.trim().replace(/\/$/, '');
          if (!endpoint) return;
          status.textContent = '正在探测桥接 …';
          status.className = 'ts-status dim';
          try {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), 5000);
            const res = await fetch(endpoint + '/api/health', { signal: ctl.signal });
            clearTimeout(timer);
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || !data.ok) throw new Error('HTTP ' + res.status);
            if (data.mode === 'static') {
              status.textContent = '在线，但当前不是 Termux/iSH，只提供静态界面，无法执行真命令。';
              status.className = 'ts-status warn';
              return;
            }
            const list = Array.isArray(data.installed) ? data.installed : [];
            if (list.length) {
              distroEl.innerHTML = list.map(d => {
                const label = d === 'alpine' ? 'Alpine（iSH）' : d.charAt(0).toUpperCase() + d.slice(1);
                return `<option value="${d}">${label}</option>`;
              }).join('');
              const want = (bridge.cfg && bridge.cfg.distro) || list[0];
              if ([...distroEl.options].some(o => o.value === want)) distroEl.value = want;
              status.textContent = '在线 · ' + (data.mode === 'ish' ? 'iSH / Alpine' : 'Termux / proot') + ' · 已安装：' + list.join(', ');
              status.className = 'ts-status ok';
            } else {
              status.textContent = '在线 · 尚未安装任何 Linux 发行版，请先运行 setup-termux.sh。';
              status.className = 'ts-status warn';
            }
          } catch (err) {
            status.textContent = '未检测到桥接（' + (err && err.name === 'AbortError' ? '超时' : String(err && err.message || err)) + '）。仍可填写后手动连接。';
            status.className = 'ts-status dim';
          }
        }
        setTimeout(probeBridge, 150);

        const close = () => overlay.remove();
        $('#tsClose', overlay).addEventListener('click', close);
        $('#tsBack', overlay).addEventListener('click', () => {
          bridge.cfg = null;
          st.mode = 'sim';
          st.shell = 'bash';
          st.channel = 'linux';
          setMeta();
          close();
          printLine('已切换回模拟模式。', 'warn');
        });
        $('#tsConnect', overlay).addEventListener('click', async () => {
          const endpoint = endEl.value.trim().replace(/\/$/, '');
          const token = tokEl.value.trim();
          const distro = distroEl.value;
          if (!endpoint || !token) { status.textContent = '请填写地址与令牌'; status.className = 'ts-status err'; return; }
          status.textContent = '正在连接 ' + endpoint + ' …';
          status.className = 'ts-status dim';
          try {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), 7000);
            const res = await fetch(endpoint + '/api/health', { headers: { 'x-aether-token': token }, signal: ctl.signal });
            clearTimeout(timer);
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || !data.ok) throw new Error(data && data.error ? data.error : 'HTTP ' + res.status);
            if (data.mode === 'static') throw new Error('该服务运行在非 Termux/iSH 平台，无法执行真命令');
            if (data.auth !== true) throw new Error('访问令牌无效');
            const list = Array.isArray(data.installed) ? data.installed : [];
            if (!list.length) throw new Error('尚未安装 Linux 发行版，请先运行准备脚本');
            if (!list.includes(distro)) throw new Error('该发行版未安装，可选：' + list.join(', '));
            bridge.cfg = { endpoint, token, distro, mode: data.mode === 'ish' ? 'ish' : 'termux' };
            Aether.store.set('bridge', bridge.cfg);
            st.mode = 'real';
            st.shell = 'bash';
            st.channel = 'linux';
            st.realCwd = data.home || '/root';
            st.realHome = data.home || '/root';
            st.hostHome = data.home || '/';
            st.hostCwd = st.hostHome;
            setMeta();
            close();
            printLine('');
            banner();
            printLine('已连接：' + (data.mode === 'ish' ? 'iSH · Alpine' : 'proot · ' + distro) + ' · ' + (data.platform || 'Linux'), 'ok');
            printLine('当前是 Linux 用户空间；点上方 ' + (data.mode === 'ish' ? 'ISH' : 'TERMUX') + ' 可切换到主机命令。', 'dim');
          } catch (err) {
            status.textContent = '连接失败：' + (err && err.name === 'AbortError' ? '超时' : String(err && err.message || err));
            status.className = 'ts-status err';
          }
        });
      }

      /* ---------- 输入处理 ---------- */
      function run(raw) {
        if (st.busy) return;
        if (st.mode === 'real') realExec(raw);
        else execSim(raw);
      }

      function onKey(e) {
        if (e.key === 'Enter') {
          const raw = input.value;
          input.value = '';
          if (!raw.trim()) { syncPrompt(); return; }
          st.history.push(raw);
          st.histIdx = st.history.length;
          if (st.mode !== 'real') printLine(promptEl.textContent + ' ' + raw, 'cmd');
          run(raw);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!st.history.length) return;
          st.histIdx = Math.max(0, (st.histIdx === -1 ? st.history.length : st.histIdx) - 1);
          input.value = st.history[st.histIdx] || '';
          setTimeout(() => input.setSelectionRange(input.value.length, input.value.length), 0);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (!st.history.length) return;
          st.histIdx = Math.min(st.history.length, st.histIdx + 1);
          input.value = st.history[st.histIdx] || '';
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const raw = input.value;
          const parts = raw.split(' ');
          if (parts.length === 1) {
            const names = Object.keys(HELP[st.shell] ? {} : {});
            const all = [...new Set(HELP[st.shell].flatMap(([c]) => c.split(' / ')).concat(['clear', 'open', 'history']))];
            const match = all.filter(c => c.startsWith(raw));
            if (match.length === 1) input.value = match[0] + ' ';
          } else {
            const prefix = parts[parts.length - 1];
            const dir = resolvePath(st.cwd, prefix.includes('/') ? parentOf(prefix) : '.');
            const n = nodeAt(dir);
            if (n && n.t === 'd') {
              const base = prefix.includes('/') ? baseName(prefix) : prefix;
              const matches = Object.keys(n.c).filter(x => x.startsWith(base));
              if (matches.length === 1) {
                const completed = matches[0] + (n.c[matches[0]].t === 'd' ? '/' : '');
                parts[parts.length - 1] = prefix.includes('/') ? parentOf(prefix) + '/' + completed : completed;
                input.value = parts.join(' ');
              }
            }
          }
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault(); out.innerHTML = '';
        } else if (e.key === 'c' && e.ctrlKey) {
          e.preventDefault(); input.value = ''; printLine('^C', 'dim');
        }
      }

      input.addEventListener('keydown', onKey);
      root.addEventListener('click', e => {
        if (!e.target.closest('.term-setup') && !e.target.closest('.term-toolbar')) input.focus();
      });
      seg.addEventListener('click', e => {
        const b = e.target.closest('button[data-shell]');
        if (!b) return;
        if (st.mode === 'real') {
          Aether.toast('真实模式请使用上方 LINUX / ' + (bridge.cfg.mode === 'ish' ? 'ISH' : 'TERMUX') + ' 通道');
          return;
        }
        st.shell = b.dataset.shell;
        setMeta();
        out.innerHTML = '';
        banner();
      });
      realSeg.addEventListener('click', e => {
        const b = e.target.closest('button[data-channel]');
        if (!b || st.mode !== 'real' || b.dataset.channel === st.channel) return;
        st.channel = b.dataset.channel;
        setMeta();
        printLine('');
        printLine('── 已切换到 ' + (st.channel === 'host' ? (bridge.cfg.mode === 'ish' ? 'iSH 主机' : 'Termux 主机') : (bridge.cfg.distro || 'linux') + ' 用户空间') + ' ──', 'sys');
        channelHint();
        printLine('');
        input.focus();
      });
      modeBtn.addEventListener('click', openSetup);

      st.cleanupFns.push(() => { /* placeholders cleared by DOM removal */ });
      api.onClose(() => { st.cleanupFns.forEach(fn => { try { fn(); } catch (e) {} }); st.cleanupFns = []; });

      setMeta();
      banner();
      if (bridge.cfg) {
        printLine('检测到已保存的桥接配置。点右上角「真 Linux」或重新连接以恢复真实模式。', 'dim');
        printLine('');
      }
      setTimeout(() => input.focus(), 250);
    }
  });
})();
