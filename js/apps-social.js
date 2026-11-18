/* ============================================================
   AETHER APPS · 电话 / 短信 / 微信 / QQ
   ============================================================ */
(() => {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  const fmtClock = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const fmtList = ts => {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return fmtClock(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ===================== 电话 ===================== */
  Aether.registerApp({
    id: 'phone',
    name: '电话',
    sub: 'SIMULATED TELEPHONY · 概念通话',
    icon: 'phone',
    accent: '#5dffb0',
    order: 20,
    flush: true,
    render(root, api) {
      root.classList.add('dialer');
      let calls = Aether.store.get('phone.calls', [
        { name: '林晓', number: '138 0000 1234', duration: 132, ts: Date.now() - 3600e3, dir: 'in' },
        { name: '未知号码', number: '010 5555 9021', duration: 0, ts: Date.now() - 86400e3, dir: 'missed' }
      ]);
      const contacts = { '13800001234': '林晓', '01055559021': '未知号码' };
      let number = '';
      let callTimer = null;

      root.innerHTML = `
        <div class="dialer-display">
          <div class="dialer-number" id="dialNum"></div>
          <div class="dialer-hint">SIMULATED DIALER · 本机演示，不发起真实通话</div>
        </div>
        <div class="dialer-grid" id="dialGrid"></div>
        <div class="dialer-actions">
          <button class="dialer-back" id="dialBack" aria-label="退格">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l-7 7 7 7M3 12h18"/></svg>
          </button>
          <button class="call-btn" id="dialCall" aria-label="拨号">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h3.2l1.6 4-2.1 1.6a13 13 0 0 0 5.2 5.2l1.6-2.1 4 1.6V17a2.5 2.5 0 0 1-2.7 2.5C9.2 19.1 4.9 14.8 4.5 8.2A2.5 2.5 0 0 1 5 3.5z"/></svg>
          </button>
          <span style="width:50px"></span>
        </div>
        <div class="dialer-recent" id="dialRecent"></div>
      `;
      const numEl = root.querySelector('#dialNum');
      const grid = root.querySelector('#dialGrid');
      const recent = root.querySelector('#dialRecent');

      const keys = [
        ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
        ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
        ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
        ['*', ''], ['0', '+'], ['#', '']
      ];
      keys.forEach(([k, l]) => {
        const b = el('button');
        b.type = 'button';
        b.innerHTML = `${k}<small>${l}</small>`;
        b.addEventListener('click', () => {
          number = (number + k).slice(0, 18);
          renderNumber();
        });
        grid.appendChild(b);
      });

      function renderNumber() {
        numEl.textContent = number || '输入号码';
        numEl.style.opacity = number ? '1' : '.35';
      }
      function renderRecent() {
        recent.innerHTML = '';
        const title = el('div', 'sheet-title');
        title.innerHTML = '<span>CALL RECORDS</span><span class="mono">' + calls.length + '</span>';
        recent.appendChild(title);
        if (!calls.length) { recent.appendChild(el('div', 'empty', '暂无通话记录')); return; }
        calls.slice(0, 6).forEach(c => {
          const row = el('div', 'list-row');
          const av = el('span', 'avatar', (c.name || '?').slice(0, 1));
          av.style.setProperty('--av-a', '#5dffb0');
          av.style.setProperty('--av-b', '#21d4c2');
          const main = el('div', 'list-main');
          main.appendChild(el('strong', '', c.name || c.number));
          const meta = el('span', '', (c.dir === 'missed' ? '未接 · ' : c.dir === 'out' ? '呼出 · ' : '呼入 · ') + c.number);
          main.appendChild(meta);
          const side = el('div', 'list-side');
          side.appendChild(el('time', '', fmtList(c.ts)));
          const dur = el('time', '', c.duration ? Math.floor(c.duration / 60) + 'm ' + (c.duration % 60) + 's' : '');
          side.appendChild(dur);
          row.append(av, main, side);
          row.addEventListener('click', () => {
            number = c.number.replace(/\s/g, '');
            renderNumber();
          });
          recent.appendChild(row);
        });
      }
      function saveCalls() { Aether.store.set('phone.calls', calls); }

      function startCall() {
        const digits = number.replace(/\s/g, '');
        if (!digits) { api.toast('请先输入号码'); return; }
        const name = contacts[digits] || '未知号码';
        const started = Date.now();
        const overlay = el('div', 'call-overlay');
        overlay.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            <span class="co-status">SIMULATED CALL · 概念通话</span>
            <div class="co-orb"><span class="co-avatar">${esc(name.slice(0, 1))}</span></div>
            <div class="co-name">${esc(name)}</div>
            <div class="co-num">${esc(number)}</div>
            <div class="co-timer" id="callTimer">00:00</div>
            <div class="note mono" style="color:var(--dim-2)">不会真正占用运营商线路</div>
          </div>
          <div class="co-actions">
            <button class="co-btn" id="callMute" title="静音">${Aether.icon('volume')}</button>
            <button class="co-btn end" id="callEnd" title="挂断">${Aether.icon('phone')}</button>
            <button class="co-btn" id="callSpk" title="扬声器">${Aether.icon('signal')}</button>
          </div>
        `;
        root.appendChild(overlay);
        const timerEl = overlay.querySelector('#callTimer');
        let seconds = 0;
        const statusEl = overlay.querySelector('.co-status');
        setTimeout(() => { if (document.body.contains(overlay)) statusEl.textContent = 'CONNECTED · 概念通话中'; }, 1800);
        callTimer = setInterval(() => {
          seconds++;
          timerEl.textContent = pad(Math.floor(seconds / 60)) + ':' + pad(seconds % 60);
        }, 1000);
        const endBtn = overlay.querySelector('#callEnd');
        overlay.querySelector('#callSpk').addEventListener('click', e => { e.currentTarget.classList.toggle('end'); api.toast('扬声器（模拟）'); });
        overlay.querySelector('#callMute').addEventListener('click', () => api.toast('已静音（模拟）'));
        endBtn.addEventListener('click', () => {
          clearInterval(callTimer); callTimer = null;
          const dur = Math.floor((Date.now() - started) / 1000);
          calls.unshift({ name, number, duration: dur, ts: Date.now(), dir: 'out' });
          saveCalls();
          overlay.remove();
          renderRecent();
          api.toast('通话已结束 · 已加入记录');
        });
      }

      root.querySelector('#dialBack').addEventListener('click', () => { number = number.slice(0, -1); renderNumber(); });
      root.querySelector('#dialCall').addEventListener('click', startCall);

      renderNumber();
      renderRecent();
      api.onClose(() => { if (callTimer) { clearInterval(callTimer); callTimer = null; } });
    }
  });

  /* ===================== 短信 ===================== */
  const SMS_SEED = [
    {
      id: 'sms-1', name: '林晓', number: '+86 138 0000 1234', unread: 1,
      av: ['#4dc3ff', '#7a5cff'],
      msgs: [
        { me: false, text: '今晚的观测站灯光秀几点开始？', ts: Date.now() - 5400e3 },
        { me: true, text: '八点整，我在北门等你。', ts: Date.now() - 5200e3 },
        { me: false, text: '好，带上你的望远镜。', ts: Date.now() - 4900e3 }
      ]
    },
    {
      id: 'sms-2', name: '运营商通知', number: '10086', unread: 0,
      av: ['#ffcf6d', '#ff8a3c'],
      msgs: [
        { me: false, text: '【AETHER 概念通信】您本月套餐余量充足。（模拟短信）', ts: Date.now() - 86400e3 }
      ]
    },
    {
      id: 'sms-3', name: '快递小哥', number: '+86 139 0000 8866', unread: 0,
      av: ['#9dff6a', '#21d4c2'],
      msgs: [
        { me: false, text: '您的包裹已放至前台，取件码 73-936。', ts: Date.now() - 172800e3 }
      ]
    }
  ];

  Aether.registerApp({
    id: 'messages',
    name: '短信',
    sub: 'SMS CENTER · 本机模拟',
    icon: 'message',
    accent: '#4dc3ff',
    order: 30,
    flush: true,
    render(root, api) {
      let threads = Aether.store.get('messages.threads', SMS_SEED);
      let current = null;
      root.innerHTML = `
        <div class="chat-app">
          <div class="chat-scroll chat-list" id="smsList"></div>
          <div class="chat-thread" id="smsThread">
            <div class="thread-head">
              <button id="smsBack">${Aether.icon('left')}</button>
              <div class="thread-name"><strong id="smsName"></strong><span id="smsNum"></span></div>
              <span class="tag">SIM</span>
            </div>
            <div class="thread-body" id="smsBody"></div>
            <div class="composer">
              <div class="field"><input id="smsInput" placeholder="输入短信（仅本机模拟）" maxlength="300"></div>
              <button class="send-btn" id="smsSend">${Aether.icon('send')}</button>
            </div>
          </div>
        </div>
      `;
      const appEl = root.querySelector('.chat-app');
      const listEl = root.querySelector('#smsList');
      const bodyEl = root.querySelector('#smsBody');
      const inputEl = root.querySelector('#smsInput');

      function save() { Aether.store.set('messages.threads', threads); }

      function renderList() {
        listEl.innerHTML = '';
        const brand = el('div', 'chat-brand');
        brand.innerHTML = '<span class="dot" style="background:var(--acc);box-shadow:0 0 8px var(--acc)"></span>SMS CENTER · 模拟短信 <span class="tag">SIMULATED</span>';
        listEl.appendChild(brand);
        const compose = el('div', 'card');
        compose.style.padding = '10px';
        compose.style.marginBottom = '10px';
        compose.innerHTML = `<div class="field"><input id="smsNewNumber" placeholder="新短信：输入号码" inputmode="tel"><button class="btn sm solid" id="smsNewBtn">发短信</button></div>`;
        listEl.appendChild(compose);
        compose.querySelector('#smsNewBtn').addEventListener('click', () => {
          const val = compose.querySelector('#smsNewNumber').value.trim();
          if (!val) { api.toast('请输入号码'); return; }
          let t = threads.find(x => x.number.replace(/\s/g, '') === val.replace(/\s/g, ''));
          if (!t) {
            t = { id: 'sms-' + Date.now(), name: val, number: val, unread: 0, av: ['#4dc3ff', '#7a5cff'], msgs: [] };
            threads.unshift(t);
            save();
            renderList();
          }
          openThread(t);
        });
        if (!threads.length) listEl.appendChild(el('div', 'empty', '暂无会话'));
        threads.forEach(t => {
          const row = el('div', 'list-row');
          const av = el('span', 'avatar', (t.name || '?').slice(0, 1));
          av.style.setProperty('--av-a', t.av[0]);
          av.style.setProperty('--av-b', t.av[1]);
          const main = el('div', 'list-main');
          main.appendChild(el('strong', '', t.name));
          const last = t.msgs[t.msgs.length - 1];
          main.appendChild(el('span', '', last ? ((last.me ? '我：' : '') + last.text) : '（暂无消息）'));
          const side = el('div', 'list-side');
          side.appendChild(el('time', '', last ? fmtList(last.ts) : ''));
          if (t.unread) {
            const b = el('span', 'badge', String(t.unread));
            b.style.display = 'inline-grid';
            b.style.marginTop = '4px';
            side.appendChild(b);
          }
          row.append(av, main, side);
          row.addEventListener('click', () => openThread(t));
          listEl.appendChild(row);
        });
      }

      function renderThread() {
        if (!current) return;
        bodyEl.innerHTML = '';
        current.msgs.forEach(m => {
          const wrap = el('div', 'msg' + (m.me ? ' own' : ''));
          if (!m.me) {
            const av = el('span', 'mini-av', (current.name || '?').slice(0, 1));
            av.style.setProperty('--av-a', current.av[0]);
            av.style.setProperty('--av-b', current.av[1]);
            wrap.appendChild(av);
          }
          const bubble = el('div', 'bubble');
          bubble.appendChild(document.createTextNode(m.text));
          bubble.appendChild(el('time', '', fmtClock(m.ts)));
          wrap.appendChild(bubble);
          bodyEl.appendChild(wrap);
        });
        bodyEl.scrollTop = bodyEl.scrollHeight;
      }

      function openThread(t) {
        current = t;
        t.unread = 0;
        save();
        root.querySelector('#smsName').textContent = t.name;
        root.querySelector('#smsNum').textContent = t.number + ' · 本机模拟，不真实发送';
        appEl.classList.add('in-thread');
        renderThread();
        renderList();
      }

      function closeThread() {
        appEl.classList.remove('in-thread');
        current = null;
        renderList();
      }

      function send() {
        if (!current) return;
        const text = inputEl.value.trim();
        if (!text) return;
        current.msgs.push({ me: true, text, ts: Date.now() });
        inputEl.value = '';
        save();
        renderThread();
        renderList();
        const target = current;
        api.toast('已模拟发送');
        const replies = ['收到，我这边没问题。', '稍等，我查一下再回你。', '好，晚点电话聊。', 'OK，已记录。'];
        const replyTimer = setTimeout(() => {
          if (!target.msgs) return;
          target.msgs.push({ me: false, text: replies[Math.floor(Math.random() * replies.length)], ts: Date.now() });
          save();
          if (current === target) renderThread();
          renderList();
        }, 1200 + Math.random() * 1400);
        timeouts.push(replyTimer);
      }
      const timeouts = [];
      root.querySelector('#smsBack').addEventListener('click', closeThread);
      root.querySelector('#smsSend').addEventListener('click', send);
      inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

      renderList();
      api.onClose(() => timeouts.forEach(t => clearTimeout(t)));
    }
  });

  /* ===================== 微信 / QQ 共用引擎 ===================== */
  function makeChatApp(cfg) {
    return {
      id: cfg.id,
      name: cfg.name,
      sub: cfg.sub,
      icon: cfg.icon,
      accent: cfg.accent,
      order: cfg.order,
      flush: true,
      render(root, api) {
        let threads = Aether.store.get(cfg.storeKey, cfg.seed);
        let current = null;
        const timeouts = [];
        root.style.setProperty('--acc', cfg.accent);
        root.style.setProperty('--acc2', cfg.accent2);
        root.innerHTML = `
          <div class="chat-app ${cfg.theme}">
            <div class="chat-scroll chat-list" id="ctList"></div>
            <div class="chat-thread" id="ctThread">
              <div class="thread-head">
                <button id="ctBack">${Aether.icon('left')}</button>
                <div class="thread-name"><strong id="ctName"></strong><span id="ctSub"></span></div>
                <span class="tag">SIM</span>
              </div>
              <div class="thread-body" id="ctBody"></div>
              <div class="composer">
                <div class="field"><input id="ctInput" placeholder="输入消息（仅本机模拟）" maxlength="400"></div>
                <button class="send-btn" id="ctSend">${Aether.icon('send')}</button>
              </div>
            </div>
          </div>
        `;
        const appEl = root.querySelector('.chat-app');
        const listEl = root.querySelector('#ctList');
        const bodyEl = root.querySelector('#ctBody');
        const inputEl = root.querySelector('#ctInput');
        const nameEl = root.querySelector('#ctName');
        const subEl = root.querySelector('#ctSub');

        const save = () => Aether.store.set(cfg.storeKey, threads);

        function renderList() {
          listEl.innerHTML = '';
          const brand = el('div', 'chat-brand');
          brand.innerHTML = `<span class="dot"></span>${esc(cfg.brand)} <span class="tag">概念模拟 · 非官方客户端</span>`;
          listEl.appendChild(brand);
          threads.forEach(t => {
            const row = el('div', 'list-row');
            const av = el('span', 'avatar', (t.name || '?').slice(0, 1));
            av.style.setProperty('--av-a', t.av[0]);
            av.style.setProperty('--av-b', t.av[1]);
            const main = el('div', 'list-main');
            main.appendChild(el('strong', '', t.name));
            const last = t.msgs[t.msgs.length - 1];
            main.appendChild(el('span', '', last ? (last.me ? '我：' : '') + last.text : '（暂无消息）'));
            const side = el('div', 'list-side');
            side.appendChild(el('time', '', last ? fmtList(last.ts) : ''));
            if (t.unread) {
              const b = el('span', 'badge', String(t.unread));
              b.style.marginTop = '4px';
              side.appendChild(b);
            }
            row.append(av, main, side);
            row.addEventListener('click', () => openThread(t));
            listEl.appendChild(row);
          });
        }

        function renderThread() {
          if (!current) return;
          bodyEl.innerHTML = '';
          current.msgs.forEach(m => {
            const wrap = el('div', 'msg' + (m.me ? ' own' : ''));
            if (!m.me) {
              const av = el('span', 'mini-av', (current.name || '?').slice(0, 1));
              av.style.setProperty('--av-a', current.av[0]);
              av.style.setProperty('--av-b', current.av[1]);
              wrap.appendChild(av);
            }
            const bubble = el('div', 'bubble');
            bubble.appendChild(document.createTextNode(m.text));
            bubble.appendChild(el('time', '', fmtClock(m.ts)));
            wrap.appendChild(bubble);
            bodyEl.appendChild(wrap);
          });
          bodyEl.scrollTop = bodyEl.scrollHeight;
        }

        function openThread(t) {
          current = t;
          t.unread = 0;
          save();
          nameEl.textContent = t.name;
          subEl.textContent = cfg.onlineLabel;
          appEl.classList.add('in-thread');
          renderThread();
          renderList();
        }

        function closeThread() {
          appEl.classList.remove('in-thread');
          current = null;
          renderList();
        }

        function send() {
          if (!current) return;
          const text = inputEl.value.trim();
          if (!text) return;
          current.msgs.push({ me: true, text, ts: Date.now() });
          inputEl.value = '';
          save();
          renderThread();
          renderList();
          const target = current;
          const typing = el('div', 'msg typing');
          const bubble = el('div', 'bubble', '· · ·');
          typing.appendChild(bubble);
          bodyEl.appendChild(typing);
          bodyEl.scrollTop = bodyEl.scrollHeight;
          const replyTimer = setTimeout(() => {
            if (typing.parentNode) typing.remove();
            target.msgs.push({ me: false, text: cfg.replies[Math.floor(Math.random() * cfg.replies.length)], ts: Date.now() });
            save();
            if (current === target) renderThread();
            renderList();
          }, 1500 + Math.random() * 1600);
          timeouts.push(replyTimer);
        }

        root.querySelector('#ctBack').addEventListener('click', closeThread);
        root.querySelector('#ctSend').addEventListener('click', send);
        inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
        renderList();
        api.onClose(() => timeouts.forEach(t => clearTimeout(t)));
      }
    };
  }

  Aether.registerApp(makeChatApp({
    id: 'wechat',
    name: '微信',
    sub: 'WECHAT 概念模拟 · 本地聊天',
    brand: 'WECHAT · 概念模拟',
    icon: 'wechat',
    accent: '#2fe07a',
    accent2: '#9dff6a',
    order: 40,
    theme: 'wechat',
    storeKey: 'wechat.threads',
    onlineLabel: '概念模拟 · 消息只存在本机',
    replies: ['收到～', '哈哈哈哈，确实。', '我看看日程，回头跟你说。', '好，晚点聊。'],
    seed: [
      {
        id: 'wx-1', name: '文件传输助手', av: ['#2fe07a', '#21d4c2'], unread: 0,
        msgs: [
          { me: false, text: '这是 AETHER OS 内置的微信概念界面，仅用于展示，不是官方客户端。', ts: Date.now() - 7200e3 },
          { me: true, text: '明白，消息只保存在本机。', ts: Date.now() - 7100e3 },
          { me: false, text: 'Android 上可接入真 Linux；需要真正的微信请安装官方 App。', ts: Date.now() - 7000e3 }
        ]
      },
      {
        id: 'wx-2', name: '星舰指挥部', av: ['#2fe07a', '#7a5cff'], unread: 2,
        msgs: [
          { me: false, text: '今晚 21:00 的轨道窗口别错过。', ts: Date.now() - 3600e3 },
          { me: false, text: '我带了热成像仪～', ts: Date.now() - 3500e3 },
          { me: true, text: '收到，准时到。', ts: Date.now() - 3400e3 }
        ]
      },
      {
        id: 'wx-3', name: '家族群', av: ['#ffcf6d', '#ff6ad5'], unread: 0,
        msgs: [
          { me: false, text: '周末回家吃饭吗？', ts: Date.now() - 86400e3 },
          { me: true, text: '回，给你们带礼物。', ts: Date.now() - 86000e3 }
        ]
      }
    ]
  }));

  Aether.registerApp(makeChatApp({
    id: 'qq',
    name: 'QQ',
    sub: 'QQ 概念模拟 · 本地聊天',
    brand: 'QQ · 概念模拟',
    icon: 'qq',
    accent: '#3fa9ff',
    accent2: '#8a5bff',
    order: 50,
    theme: 'qq',
    storeKey: 'qq.threads',
    onlineLabel: '概念模拟 · 消息只存在本机',
    replies: ['+1', '开黑等我十分钟', '群公告已看', '这波可以'],
    seed: [
      {
        id: 'qq-1', name: '系统通知', av: ['#3fa9ff', '#8a5bff'], unread: 0,
        msgs: [
          { me: false, text: 'AETHER OS 概念版 QQ 已就绪。此界面仅作演示，不含真实 QQ 服务。', ts: Date.now() - 5400e3 }
        ]
      },
      {
        id: 'qq-2', name: '开黑小队', av: ['#3fa9ff', '#21d4c2'], unread: 3,
        msgs: [
          { me: false, text: '今晚八点，老地方。', ts: Date.now() - 2400e3 },
          { me: false, text: '我玩辅助。', ts: Date.now() - 2300e3 },
          { me: true, text: '等我十分钟。', ts: Date.now() - 2200e3 }
        ]
      },
      {
        id: 'qq-3', name: '班级频道', av: ['#ffcf6d', '#ff6a8a'], unread: 0,
        msgs: [
          { me: false, text: '实验报告周五前提交。', ts: Date.now() - 172800e3 }
        ]
      }
    ]
  }));
})();
