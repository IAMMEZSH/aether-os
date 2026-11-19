/* ============================================================
   AETHER APPS · 电话 / 短信 / 微信 / QQ
   本机系统桥接：tel: / sms: / weixin:// / mqq:// / Web Share
   ============================================================ */
(() => {
  'use strict';

  // 旧版里的会话与通话记录全部是演示数据，升级后统一清除。
  ['phone.calls', 'messages.threads', 'wechat.threads', 'qq.threads'].forEach(k => Aether.store.del(k));

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const normalizePhone = s => String(s || '').replace(/[^\d+*#]/g, '').slice(0, 32);
  const isPhone = s => /^\+?[0-9*#]{2,31}$/.test(s) && /\d/.test(s);
  const phoneForUri = s => normalizePhone(s).replace(/#/g, '%23');

  // iOS 的 sms: body 参数使用 &，Android 使用 ?；不保证所有短信 App 都预填正文。
  function smsUri(number, body) {
    const n = phoneForUri(number);
    if (!body) return 'sms:' + n;
    return 'sms:' + n + (isIOS ? '&' : '?') + 'body=' + encodeURIComponent(body);
  }

  function launch(uri, label, api, note) {
    try {
      const a = document.createElement('a');
      a.href = uri;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 1200);
      api.toast(note || '已请求打开' + label + '；若未跳转，请确认设备已安装对应 App');
      return true;
    } catch (err) {
      api.toast('无法唤起' + label);
      return false;
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  async function pickContact(api) {
    if (!navigator.contacts || typeof navigator.contacts.select !== 'function') {
      api.toast('此浏览器不支持通讯录选择，请手动输入号码');
      return null;
    }
    try {
      const picked = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (!picked || !picked.length) return null;
      const tel = (picked[0].tel || []).find(Boolean);
      if (!tel) { api.toast('该联系人没有电话号码'); return null; }
      return {
        name: (picked[0].name || [])[0] || '',
        number: normalizePhone(tel)
      };
    } catch (err) {
      if (err && err.name === 'AbortError') return null;
      api.toast('无法读取通讯录，请检查浏览器权限');
      return null;
    }
  }

  async function shareText(text, api, appName) {
    if (!text) { api.toast('先输入要分享的文字'); return; }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'AETHER OS', text });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      await copyText(text);
      api.toast('系统分享不可用，已复制草稿，可粘贴到' + appName);
    } catch (err) {
      api.toast('系统分享不可用，请手动复制');
    }
  }

  /* ===================== 电话 ===================== */
  Aether.registerApp({
    id: 'phone',
    name: '电话',
    sub: 'SYSTEM TELEPHONY · 系统电话',
    icon: 'phone',
    accent: '#5dffb0',
    order: 20,
    flush: true,
    render(root, api) {
      root.classList.add('dialer');
      let number = '';
      let contactName = '';

      root.innerHTML = `
        <div class="dialer-display">
          <div class="dialer-number" id="dialNum"></div>
          <div class="dialer-hint" id="dialHint">SYSTEM TELEPHONY · 拨号交给系统电话 App</div>
        </div>
        <div class="dialer-quick">
          <button class="native-chip" id="dialPick" type="button">${Aether.icon('phone')} 从通讯录选择</button>
          <button class="native-chip" id="dialCopy" type="button">${Aether.icon('copy')} 复制号码</button>
        </div>
        <div class="dialer-grid" id="dialGrid"></div>
        <div class="dialer-actions">
          <button class="dialer-back" id="dialBack" type="button" aria-label="退格">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l-7 7 7 7M3 12h18"/></svg>
          </button>
          <button class="call-btn" id="dialCall" type="button" aria-label="用系统电话拨号">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h3.2l1.6 4-2.1 1.6a13 13 0 0 0 5.2 5.2l1.6-2.1 4 1.6V17a2.5 2.5 0 0 1-2.7 2.5C9.2 19.1 4.9 14.8 4.5 8.2A2.5 2.5 0 0 1 5 3.5z"/></svg>
          </button>
          <span style="width:50px"></span>
        </div>
        <div class="dialer-recent">
          <div class="native-inline">
            <span class="dot"></span>
            <p>网页无法读取系统通话记录。实际拨号、挂断、录音、双卡与运营商线路由系统电话 App 管理。</p>
          </div>
        </div>
      `;
      const numEl = root.querySelector('#dialNum');
      const hintEl = root.querySelector('#dialHint');
      const grid = root.querySelector('#dialGrid');

      const keys = [
        ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
        ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
        ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
        ['*', ''], ['0', '+'], ['#', '']
      ];
      keys.forEach(([k, l]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = `${k}<small>${l}</small>`;
        b.addEventListener('click', () => {
          number = (number + k).slice(0, 32);
          contactName = '';
          renderNumber();
        });
        grid.appendChild(b);
      });

      function renderNumber() {
        numEl.textContent = number || '输入号码';
        numEl.style.opacity = number ? '1' : '.35';
        hintEl.textContent = contactName ? contactName + ' · 拨号交给系统电话 App' : 'SYSTEM TELEPHONY · 拨号交给系统电话 App';
      }

      function dial() {
        if (!isPhone(number)) {
          api.toast(number ? '号码格式不正确' : '请先输入号码');
          return;
        }
        launch('tel:' + phoneForUri(number), '系统电话', api);
      }

      root.querySelector('#dialBack').addEventListener('click', () => {
        number = number.slice(0, -1);
        contactName = '';
        renderNumber();
      });
      root.querySelector('#dialCall').addEventListener('click', dial);
      root.querySelector('#dialPick').addEventListener('click', async () => {
        const c = await pickContact(api);
        if (!c) return;
        number = c.number;
        contactName = c.name;
        renderNumber();
        api.toast(c.name ? '已选择 ' + c.name : '已填入联系人号码');
      });
      root.querySelector('#dialCopy').addEventListener('click', () => {
        if (!number) { api.toast('请先输入号码'); return; }
        copyText(number).then(() => api.toast('号码已复制')).catch(() => api.toast('复制失败'));
      });

      renderNumber();
    }
  });

  /* ===================== 短信 ===================== */
  Aether.registerApp({
    id: 'messages',
    name: '短信',
    sub: 'SYSTEM SMS BRIDGE · 系统短信',
    icon: 'message',
    accent: '#4dc3ff',
    order: 30,
    render(root, api) {
      root.innerHTML = `
        <div class="native-wrap">
          <div class="native-hero compact">
            <div class="native-hero-icon" style="--hero-a:#4dc3ff;--hero-b:#7a5cff">${Aether.icon('message')}</div>
            <div class="native-hero-copy">
              <span class="native-kicker">SYSTEM SMS BRIDGE</span>
              <h3>交给系统短信</h3>
              <p>通过 <span class="mono">sms:</span> 打开手机短信 App，可预填号码与正文；AETHER 不读取或保存系统短信。</p>
            </div>
          </div>
          <div class="card native-card">
            <div class="native-label">收件人</div>
            <div class="field">
              ${Aether.icon('phone')}
              <input id="smsNumber" type="tel" inputmode="tel" autocomplete="tel" placeholder="输入手机号码">
            </div>
            <div class="native-actions">
              <button class="btn sm ghost" id="smsPick" type="button">从通讯录选择</button>
              <button class="btn sm ghost" id="smsInbox" type="button">打开系统短信</button>
              <button class="btn sm ghost" id="smsCopy" type="button">复制正文</button>
            </div>
            <div class="native-label">正文 <span id="smsCount">0 / 480</span></div>
            <textarea class="native-textarea" id="smsText" maxlength="480" placeholder="输入短信正文（可选）"></textarea>
            <button class="btn solid native-block" id="smsSend" type="button">${Aether.icon('send')} 打开系统短信并预填</button>
            <p class="note">正文是否自动填入取决于系统短信 App；若未预填，可复制正文后粘贴。</p>
          </div>
          <div class="native-inline">
            <span class="dot"></span>
            <p>网页无法读取系统收件箱、发送记录或送达回执。发送动作由系统短信 App 完成。</p>
          </div>
        </div>
      `;
      const numberEl = root.querySelector('#smsNumber');
      const textEl = root.querySelector('#smsText');
      const countEl = root.querySelector('#smsCount');

      function syncCount() {
        countEl.textContent = textEl.value.length + ' / 480';
      }

      function openComposer() {
        const number = normalizePhone(numberEl.value);
        if (!isPhone(number)) {
          api.toast('请输入有效号码');
          numberEl.focus();
          return;
        }
        launch(smsUri(number, textEl.value.trim()), '系统短信', api);
      }

      numberEl.addEventListener('input', () => { numberEl.value = normalizePhone(numberEl.value); });
      textEl.addEventListener('input', syncCount);
      root.querySelector('#smsPick').addEventListener('click', async () => {
        const c = await pickContact(api);
        if (!c) return;
        numberEl.value = c.number;
        api.toast(c.name ? '已选择 ' + c.name : '已填入联系人号码');
      });
      root.querySelector('#smsInbox').addEventListener('click', () => launch('sms:', '系统短信', api));
      root.querySelector('#smsCopy').addEventListener('click', () => {
        if (!textEl.value.trim()) { api.toast('请先输入短信正文'); return; }
        copyText(textEl.value.trim()).then(() => api.toast('正文已复制')).catch(() => api.toast('复制失败'));
      });
      root.querySelector('#smsSend').addEventListener('click', openComposer);
      syncCount();
    }
  });

  /* ===================== 微信 / QQ 原生入口 ===================== */
  function makeNativeApp(cfg) {
    return {
      id: cfg.id,
      name: cfg.name,
      sub: cfg.sub,
      icon: cfg.icon,
      accent: cfg.accent,
      order: cfg.order,
      render(root, api) {
        root.innerHTML = `
          <div class="native-wrap">
            <div class="native-hero">
              <div class="native-hero-icon" style="--hero-a:${cfg.accent};--hero-b:${cfg.accent2}">${Aether.icon(cfg.icon)}</div>
              <span class="native-kicker">NATIVE APP LINK</span>
              <h3>${esc(cfg.title)}</h3>
              <p>${esc(cfg.description)}</p>
            </div>
            <div class="card native-card">
              <button class="btn solid native-block" id="openNative" type="button">${Aether.icon('external')} 打开官方${esc(cfg.name)}</button>
              <a class="btn ghost native-block" href="${cfg.website}" target="_blank" rel="noopener noreferrer">未安装？打开${esc(cfg.name)}官网</a>
              <div class="native-divider"><span>或通过系统分享发送文字</span></div>
              <textarea class="native-textarea" id="shareDraft" maxlength="600" placeholder="输入要分享的文字（不会发送或保存）"></textarea>
              <div class="native-actions">
                <button class="btn sm ghost" id="shareBtn" type="button">${Aether.icon('send')} 调用系统分享</button>
                <button class="btn sm ghost" id="copyDraft" type="button">${Aether.icon('copy')} 复制草稿</button>
              </div>
              <p class="note">系统分享面板由手机提供，可选择已安装的${esc(cfg.name)}。网页无法读取聊天记录、选择具体聊天或代发消息。</p>
            </div>
            <div class="native-inline">
              <span class="dot"></span>
              <p>AETHER 不是${esc(cfg.name)}客户端，也不连接腾讯服务；此页面只负责唤起官方 App 或调用系统分享。</p>
            </div>
          </div>
        `;
        const wrap = root.querySelector('.native-wrap');
        wrap.style.setProperty('--acc', cfg.accent);
        wrap.style.setProperty('--acc2', cfg.accent2);
        root.querySelector('#openNative').addEventListener('click', () => {
          launch(cfg.scheme, '官方' + cfg.name, api);
        });
        root.querySelector('#shareBtn').addEventListener('click', () => {
          shareText(root.querySelector('#shareDraft').value.trim(), api, cfg.name);
        });
        root.querySelector('#copyDraft').addEventListener('click', () => {
          const text = root.querySelector('#shareDraft').value.trim();
          if (!text) { api.toast('先输入要分享的文字'); return; }
          copyText(text).then(() => api.toast('草稿已复制')).catch(() => api.toast('复制失败'));
        });
      }
    };
  }

  function makeAlipayApp() {
    return {
      id: 'alipay',
      name: '支付宝',
      sub: 'NATIVE APP LINK · 官方支付宝',
      icon: 'alipay',
      accent: '#1677ff',
      order: 55,
      render(root, api) {
        root.innerHTML = `
          <div class="native-wrap">
            <div class="native-hero compact">
              <div class="native-hero-icon" style="--hero-a:#1677ff;--hero-b:#4fd1ff">${Aether.icon('alipay')}</div>
              <div class="native-hero-copy">
                <span class="native-kicker">NATIVE APP LINK</span>
                <h3>支付宝在系统里</h3>
                <p>网页无法登录或代付。此入口会唤起已安装的官方支付宝 App。</p>
              </div>
            </div>
            <div class="card native-card">
              <button class="btn solid native-block" id="alipayOpen" type="button">${Aether.icon('external')} 打开官方支付宝</button>
              <button class="btn sm ghost native-block" id="alipayScan" type="button">${Aether.icon('search')} 尝试打开扫一扫（实验）</button>
              <a class="btn ghost native-block" href="https://www.alipay.com/" target="_blank" rel="noopener noreferrer">未安装？打开支付宝官网</a>
              <div class="native-divider"><span>打开后可使用</span></div>
              <div class="alipay-tools">
                <div class="alipay-tool"><b>扫一扫</b><span>SCAN</span></div>
                <div class="alipay-tool"><b>付款码</b><span>PAY</span></div>
                <div class="alipay-tool"><b>收款码</b><span>COLLECT</span></div>
                <div class="alipay-tool"><b>转账</b><span>TRANSFER</span></div>
                <div class="alipay-tool"><b>账单</b><span>BILLS</span></div>
                <div class="alipay-tool"><b>出行</b><span>TRANSIT</span></div>
              </div>
              <p class="note">扫一扫快捷链接为实验性入口，可能随支付宝版本失效；若未跳转，请在支付宝 App 内手动打开。网页不读取余额、账单、订单或支付结果，也不能代付。</p>
            </div>
            <div class="native-inline">
              <span class="dot"></span>
              <p>AETHER 不是支付宝客户端，也不连接支付宝或蚂蚁集团服务；此页面只负责唤起官方 App。</p>
            </div>
          </div>
        `;
        const wrap = root.querySelector('.native-wrap');
        wrap.style.setProperty('--acc', '#1677ff');
        wrap.style.setProperty('--acc2', '#4fd1ff');
        root.querySelector('#alipayOpen').addEventListener('click', () => {
          launch('alipays://', '官方支付宝', api);
        });
        root.querySelector('#alipayScan').addEventListener('click', () => {
          launch('alipayqr://platformapi/startapp?saId=10000007', '支付宝扫一扫', api, '已请求打开支付宝扫一扫；该入口为实验性，若未跳转请在支付宝内手动打开');
        });
      }
    };
  }

  Aether.registerApp(makeNativeApp({
    id: 'wechat',
    name: '微信',
    sub: 'NATIVE APP LINK · 官方微信',
    icon: 'wechat',
    accent: '#2fe07a',
    accent2: '#9dff6a',
    order: 40,
    scheme: 'weixin://',
    website: 'https://weixin.qq.com/',
    title: '微信在系统里',
    description: '网页版无法直接登录或代发微信消息。此入口会唤起已安装的官方微信 App；也可以通过系统分享把文字交给微信。'
  }));

  Aether.registerApp(makeNativeApp({
    id: 'qq',
    name: 'QQ',
    sub: 'NATIVE APP LINK · 官方 QQ',
    icon: 'qq',
    accent: '#3fa9ff',
    accent2: '#8a5bff',
    order: 50,
    scheme: 'mqq://',
    website: 'https://im.qq.com/',
    title: 'QQ 在系统里',
    description: '网页版无法直接登录或代发 QQ 消息。此入口会唤起已安装的官方 QQ App；也可以通过系统分享把文字交给 QQ。'
  }));

  Aether.registerApp(makeAlipayApp());
})();
