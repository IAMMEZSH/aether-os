<p align="center">
  <img src="docs/intro-hero.png" alt="AETHER OS · 概念系统" width="100%">
</p>

<h1 align="center">AETHER OS · 以太 OS</h1>

<p align="center">
  <b>三壳终端 · 全场景套件 · Android / iPhone 双端可安装</b><br>
  一个运行在浏览器 / PWA 中的未来科技风概念系统，并可选接入手机内的真实 Linux。
</p>

<p align="center">
  版本 1.0.0 · 构建 2026.11.18 · 纯前端 + Python 标准库桥接 · 无构建步骤 · 无后端依赖
</p>

---

> **一句话认识它**
>
> AETHER OS 不是手机固件，也不是可以刷入手机的自研内核。它是一套可以「安装到主屏幕」的未来科技风 PWA 界面，包含终端、电话、短信、微信、QQ、浏览器、办公、代码工作室、地图、备忘录、媒体、相册与设置等 13 个应用；在 Android 的 Termux 或 iPhone 的 iSH 中启动本地桥接后，终端可以执行**真实的 Linux 命令**。
>
> 电话、短信、微信、QQ、Wi-Fi / 数据开关属于**交互模拟**；Android / iOS 的内核、引导链、基带与 App Store / Google Play 生态**不会被修改，也无法被本项目管理**。所有能力边界在本文与[完整说明书](docs/MANUAL.md)中逐项写清。

---

## 目录

- [1. 这个项目解决了什么](#1-这个项目解决了什么)
- [2. 三个必须先讲清的事实](#2-三个必须先讲清的事实)
- [3. 功能总览](#3-功能总览)
- [4. 界面与截图](#4-界面与截图)
- [5. 系统架构](#5-系统架构)
- [6. 真实 / 模拟 / 不可能](#6-真实--模拟--不可能)
- [7. 快速开始](#7-快速开始)
  - [7.1 电脑上静态预览](#71-电脑上静态预览)
  - [7.2 Android：Termux + proot-distro](#72-androidtermux--proot-distro)
  - [7.3 iPhone / iPad：iSH](#73-iphone--ipadish)
  - [7.4 安装为 PWA 应用](#74-安装为-pwa-应用)
- [8. 真 Linux 桥接](#8-真-linux-桥接)
- [9. 终端使用手册](#9-终端使用手册)
- [10. 逐个应用说明](#10-逐个应用说明)
- [11. 项目结构](#11-项目结构)
- [12. 安全设计](#12-安全设计)
- [13. 已知限制与常见问题](#13-已知限制与常见问题)
- [14. 开发与二次开发](#14-开发与二次开发)
- [15. 测试记录](#15-测试记录)
- [16. 版本与更新日志](#16-版本与更新日志)
- [17. 致谢与第三方组件](#17-致谢与第三方组件)
- [18. 许可](#18-许可)

---

## 1. 这个项目解决了什么

很多「手机装 Linux / 双系统 / 三内核」的设想，会在真正落地时撞上签名引导链、驱动、基带与封闭生态。AETHER OS 走的是另一条可验证、可体验、可发布的路线：

1. **把「未来科技风移动系统」做出来**：启动动画、锁屏、桌面、状态栏、应用窗口、转场、主题色与壁纸，全部是真实可交互的界面，不是视频或静态图。
2. **把「Linux 终端」做真**：在 Android 上用 Termux + proot-distro 安装 Ubuntu / Kali；在 iPhone 上用 iSH 运行 Alpine。网页里的终端通过本地 token 鉴权的桥接执行真实命令，而不是只打印假输出。
3. **把「日用套件」做全**：电话、短信、微信、QQ、浏览器、办公、代码工作室、地图、备忘录、媒体、相册、设置，共 13 个应用，尽量可用、可演示、可扩展。
4. **把「能力边界」说透**：哪些是真的、哪些是模拟的、哪些技术上不可能，逐项列出，避免用「三内核合并」「全平台兼容」这类无法兑现的承诺误导使用者。

它适合：

- 想体验未来科技风移动 UI 与完整应用生态的概念设计者；
- 想在手机浏览器里拥有一个可安装的「桌面环境 / 仪表盘」的极客；
- 想在 Android / iOS 上快速获得一个带 token 鉴权的本地 Linux Web 终端的安全研究者；
- 想学习「PWA + 本地桥接 + 命令执行安全」完整实现的前端 / 全栈开发者。

---

## 2. 三个必须先讲清的事实

### 2.1 Ubuntu、Kali、deepin 不是三个内核

Linux 内核只有一个。Ubuntu、Kali、deepin 都是在 Linux 内核之上构建的**用户态发行版**（不同软件包、桌面、工具集）。所谓「把 Ubuntu + Kali + deepin 合并成三内核」在技术上不存在对应物。

AETHER OS 的做法是：

- Android：Termux 提供终端与 proot-distro，在本机内核上运行 Ubuntu / Kali 的**用户空间**；如能获得兼容的 deepin rootfs，也可按 proot-distro 自定义 rootfs 的方式导入。
- iPhone / iPad：iSH 在 App 沙盒内模拟 x86 用户态，运行 Alpine Linux；**无法运行 Kali、Ubuntu 的完整 rootfs**，更无法接管 iOS 内核。
- 无论哪种方式，**设备内核、引导链、基带、射频与系统分区都不会被修改**。

### 2.2 无法在零售 Android / iPhone 上启动自研系统

- Android：Boot ROM → XBL → ABL 的安全启动链会校验签名；零售机不允许刷入自编译内核或第三方完整固件。USB 大容量存储启动也不在手机 Boot ROM 的支持范围内。
- iPhone：SecureROM → iBoot 的签名链由 Apple 控制，无法加载自研内核或第三方系统。
- 因此，「把系统装进 U 盘再让手机启动」「给 iPhone 装自研系统」这类目标不是本项目的能力范围，也不在任何第三方应用的能力范围内。

### 2.3 不能复刻 App Store / Google Play 兼容

- AETHER OS 不包含、也不能模拟 Android Runtime、iOS 运行时、Google 服务框架或 App Store 签名与分发体系。
- 它不能安装或运行真实的微信 / QQ 原生客户端；内置的微信、QQ、电话、短信是**交互演示**。
- 「从网上下载所有安卓软件并运行」在本项目内不成立。你可以把 AETHER OS 安装到主屏幕，但它的本质是 PWA 应用，不是 Android 系统。

> 这些说明不是功能退让，而是工程诚实。把不可行的部分讲清楚，才能把可行的部分做扎实。

---

## 3. 功能总览

### 3.1 13 个内置应用

| # | 应用 | 能力 | 性质 |
|---|---|---|---|
| 1 | **终端** | Linux / CMD / PowerShell 三种 Shell 模式；模拟命令 + 真实 Linux 桥接 | 模拟 + 真实（需桥接） |
| 2 | **电话** | 拨号盘、联系人、最近通话、来电 / 通话界面 | 交互模拟 |
| 3 | **短信** | 会话列表、聊天线程、发送与自动回复 | 交互模拟 |
| 4 | **微信** | 会话列表、聊天窗口、消息发送 | 交互模拟 |
| 5 | **QQ** | 会话列表、聊天窗口、消息发送 | 交互模拟 |
| 6 | **浏览器** | 地址栏、快捷书签、iframe 网页视图、外部打开 | 真实（受站点 CSP / X-Frame-Options 限制） |
| 7 | **办公** | 文档编辑、表格计算与 CSV 导出、幻灯片预览与 JSON 导出 | 真实（本地） |
| 8 | **代码工作室** | JavaScript 直接运行；Python 由 Pyodide 运行；错误堆栈 | 真实（浏览器沙盒） |
| 9 | **地图** | Esri 暗色瓦片、Photon / OSM 搜索、真实 GPS 定位、直线距离 | 真实（需网络与定位权限） |
| 10 | **备忘录** | 新建、编辑、搜索、删除、自动保存 | 真实（本地 localStorage） |
| 11 | **媒体** | 三段 WebAudio 合成音乐、本地音频 / 视频导入播放 | 真实（本地） |
| 12 | **相册** | 6 幅程序生成艺术、本地图片导入查看 | 真实（本地） |
| 13 | **设置** | 主题色、壁纸、网络概念开关、桥接配置、安装说明、存储清理 | 混合 |

### 3.2 系统级能力

- **PWA 安装**：Android Chrome / iOS Safari「添加到主屏幕」，独立窗口运行。
- **离线应用壳**：Service Worker 预缓存界面、字体与图标；断网仍能打开界面与本地应用。
- **未来科技风格**：启动动画、锁屏、六边形 X 徽标、粒子、扫描线、霓虹渐变、四套主题色、四套壁纸。
- **状态栏**：信号、Wi-Fi、电量、时钟；蜂窝代际跟随浏览器 `Network Information API` 报告的真实类型（4G / 5G；不支持时显示「蜂窝」），不再是手动假切换。
- **深链接**：`?skip=1&app=terminal|map|notes|...` 直接打开指定应用，可用于快捷方式与自动化。
- **本地数据**：备忘录、设置、桥接令牌保存在当前浏览器 localStorage，不上传服务器。

---

## 4. 界面与截图

<table>
  <tr>
    <td width="50%"><img src="docs/shot-home.png" alt="桌面"><br><sub>桌面：13 个应用、系统卡片与状态栏</sub></td>
    <td width="50%"><img src="docs/shot-boot.png" alt="启动"><br><sub>启动：引导日志、进度与 X 徽标</sub></td>
  </tr>
  <tr>
    <td><img src="docs/shot-lock.png" alt="锁屏"><br><sub>锁屏：时钟、日期与上滑解锁</sub></td>
    <td><img src="docs/shot-terminal.png" alt="终端"><br><sub>终端：三壳模式与欢迎信息</sub></td>
  </tr>
  <tr>
    <td><img src="docs/shot-terminal-help.png" alt="终端帮助"><br><sub>终端：help 命令与可用指令</sub></td>
    <td><img src="docs/shot-bridge-setup.png" alt="桥接"><br><sub>桥接：地址、令牌与发行版探测</sub></td>
  </tr>
  <tr>
    <td><img src="docs/shot-map.png" alt="地图"><br><sub>地图：真实瓦片、搜索与定位标记</sub></td>
    <td><img src="docs/shot-media.png" alt="媒体"><br><sub>媒体：合成音乐与本地文件播放</sub></td>
  </tr>
  <tr>
    <td><img src="docs/shot-office.png" alt="办公"><br><sub>办公：本地文档编辑</sub></td>
    <td><img src="docs/shot-code.png" alt="代码"><br><sub>代码工作室：Pyodide 运行 Python</sub></td>
  </tr>
</table>

更多截图：[短信](docs/shot-sms-thread.png)、[微信](docs/shot-wechat-list.png)、[QQ](docs/shot-qq.png)、[表格](docs/shot-office-sheet.png)、[幻灯片](docs/shot-slides.png)、[相册](docs/shot-photos.png)、[备忘录](docs/shot-notes.png)、[浏览器](docs/shot-browser.png)、[设置](docs/shot-settings.png)。

---

## 5. 系统架构

<p align="center"><img src="docs/intro-architecture.png" alt="AETHER OS 架构" width="100%"></p>

### 5.1 三层结构

1. **界面层（PWA）**
   - `index.html` + `css/style.css` + 4 个原生 JS 文件，无打包器、无 npm 依赖。
   - 应用通过 `Aether.registerApp({ id, name, icon, render })` 注册。
   - Service Worker 缓存应用壳；离线可用，API 与跨域请求不拦截。

2. **桥接层（可选）**
   - `bridge/server.py`：Python 标准库实现，默认监听 `127.0.0.1:8787`。
   - 同一个进程既提供静态界面，也提供受保护的 `/api/exec`。
   - 仅接受带 `x-aether-token` 的请求；令牌首次启动随机生成，保存在 `bridge/.aether_token`（权限 600，已 gitignore）。

3. **Linux 用户空间层**
   - Android：Termux → `proot-distro login <distro> -- bash -lc <cmd>`，支持已安装的 Ubuntu / Kali，以及通过自定义 rootfs 导入的发行版。
   - iPhone / iPad：iSH → `/bin/sh -lc <cmd>`，运行 Alpine 用户态。
   - 桥接只执行用户主动输入的命令，不监听远程网络，不提供文件上传接口。

### 5.2 关键设计

- **同源部署**：桥接同时托管 UI，避免 CORS；也可以把 UI 部署在任意静态站点，只把桥接地址填为 `http://127.0.0.1:8787`。
- **静态降级**：如果当前服务运行在非 Termux / iSH 平台（例如 Windows / macOS 预览），健康检查返回 `mode: "static"`，终端自动停留在模拟模式，不会伪装执行真命令。
- **环境探测**：终端连接面板调用公开的 `/api/health` 获取当前模式与已安装发行版，再要求用户粘贴令牌完成鉴权；令牌错误会在「连接并测试」阶段被拒绝。

---

## 6. 真实 / 模拟 / 不可能

<p align="center"><img src="docs/intro-capabilities.png" alt="能力边界" width="100%"></p>

### 6.1 真实可用

- 安装为 PWA（Android Chrome / iOS Safari）。
- JavaScript 与 Python（Pyodide，首次运行需联网加载约十几 MB 运行时）。
- 真实地图瓦片、Photon / OpenStreetMap 搜索、GPS 定位（需 HTTPS 或 localhost 与用户授权）。
- 本地音乐合成、本地音视频播放、本地图片查看。
- 备忘录、设置、桥接配置保存在当前浏览器。
- Office 文档 / 表格 / 幻灯片编辑与导出（HTML / CSV / JSON，自有格式）。
- 接入 Termux / iSH 后执行真实 Linux 命令。
- 导出文件到系统下载目录（浏览器下载行为）。

### 6.2 交互模拟

- 拨号、通话界面、来电状态。
- 短信会话与自动回复。
- 微信 / QQ 会话与消息发送。
- Wi-Fi / 数据网络开关及其状态栏指示灯。
- 信号格数、电量百分比（电量使用 Battery API 时是真实值；无 API 时为演示值）。
- 启动日志、扫描线、粒子和部分系统提示。

### 6.3 技术上不可能（本项目不做承诺）

- 在零售 iPhone 上启动自研内核或第三方完整系统。
- 绕过 Android / iOS 安全启动刷入通用 ROM。
- 把 Ubuntu / Kali / deepin 当作三个内核合并。
- 复刻 Google Play / App Store 的运行时、签名与分发体系。
- 在 PWA 内运行真实微信 / QQ 原生客户端。
- 从手机 USB 启动 U 盘中的系统。
- 接管基带、射频、运营商配置或真实 Wi-Fi / 数据开关。

---

## 7. 快速开始

### 7.1 电脑上静态预览

要求：Python 3.9+（或任意静态服务器）。

```bash
# 进入项目目录
cd aether-os

# 方式 A：直接运行桥接（推荐，Windows / macOS / Linux 均可）
python3 bridge/server.py

# 方式 B：只启动静态服务器（终端为模拟模式）
python3 -m http.server 8787
```

浏览器打开 `http://127.0.0.1:8787`。

- 在电脑上，桥接会以 `static` 模式运行：界面、地图、办公、媒体、备忘录全部可用，终端保持模拟命令。
- 地图定位需要 `localhost` 或 HTTPS；直接双击 `file://` 打开时，Service Worker、定位与安装提示都会受限，建议使用上述服务器。
- 可通过 `http://127.0.0.1:8787/index.html?skip=1` 跳过启动动画，或用 `?skip=1&app=map` 直接打开地图。

### 7.2 Android：Termux + proot-distro

前置条件：

- 从 **F-Droid** 或 Termux GitHub Releases 安装 Termux（Google Play 版本已长期停更，可能缺少 `proot-distro`）。
- 建议预留 2–4 GB 存储空间；Ubuntu + Kali 首次安装需要下载数百 MB。
- Android 7.0 及以上。

步骤：

1. 下载 Release 中的 `aether-os-1.0.0.zip`，解压到用户目录，或直接 `git clone` 本项目。
2. 在 Termux 中准备基础环境：

   ```bash
   pkg update -y
   pkg install -y python unzip
   termux-setup-storage
   ```

3. 进入项目目录并执行准备脚本：

   ```bash
   cd ~/aether-os-1.0.0       # 按实际解压路径调整
   bash bridge/setup-termux.sh
   ```

   脚本会安装 `python`、`proot-distro`，并在缺失时安装 **Ubuntu** 与 **Kali** 用户空间；同时尝试获取 wake lock。

4. 启动桥接：

   ```bash
   python3 bridge/server.py
   ```

   终端会打印：

   - 访问地址：`http://127.0.0.1:8787`
   - 运行模式：`termux`
   - 已安装发行版列表
   - 访问令牌（同时保存在 `bridge/.aether_token`）

5. 在手机浏览器打开 `http://127.0.0.1:8787`，进入「终端」，点右上角「真 Linux」，粘贴令牌，选择发行版，点「连接并测试」。
6. 浏览器菜单选择「添加到主屏幕」，之后可以像普通 App 一样全屏打开。
7. 保持 Termux 存活：下拉通知栏确认 wake lock 已启用；在系统电池设置中把 Termux 设为「不限制 / 允许后台活动」。部分厂商系统仍可能冻结后台进程，此时重新打开 Termux 执行 `python3 bridge/server.py` 即可。

> **可选：deepin**
>
> proot-distro 官方列表不含 deepin。若你自行获得与设备架构兼容的 deepin rootfs，可按 proot-distro 的自定义 rootfs 方式导入，桥接会自动把它列入「已安装」列表供终端选择。本项目不附带 deepin rootfs，也不保证第三方 rootfs 的完整性与合法性。
>
> **可选：更多发行版**
>
> `proot-distro install debian`、`proot-distro install archlinux` 等安装后，重新连接终端即可在发行版下拉框中看到。

### 7.3 iPhone / iPad：iSH

前置条件：

- 从 App Store 安装 **iSH**（x86 用户态模拟器）。
- iSH 运行的是 Alpine Linux，不是 iOS 越狱环境；无法安装 Kali / Ubuntu 的完整 rootfs。
- 建议 iPad 分屏或保持 iSH 前台，避免后台被系统挂起。

步骤：

1. 把项目放入「文件」App，例如 `我的 iPhone/AETHER/aether-os-1.0.0`。
2. 打开 iSH，挂载并进入项目目录（iSH 默认可以访问「文件」中的 iSH 文件夹，也可用 `mount -t ios . /mnt` 挂载其他位置）：

   ```sh
   cd /mnt/aether-os-1.0.0
   ```

3. 准备 Alpine 环境：

   ```sh
   sh bridge/setup-ios-ish.sh
   ```

   脚本会检查 `/etc/alpine-release`、执行 `apk update` 并安装 `python3`。

4. 启动桥接：

   ```sh
   python3 bridge/server.py
   ```

5. 打开 Safari，访问 `http://127.0.0.1:8787`，在终端中连接；或直接在 iSH 中用 `python3 -m http.server` 预览静态界面。
6. 在 Safari 分享菜单选择「添加到主屏幕」。
7. iOS 后台限制：iSH 被切到后台后可能暂停，桥接会随之中断。需要时保持 iSH 前台，或用 iPad 分屏同时显示 iSH 与 Safari。

> iOS 上 `Network Information API` 通常不可用，状态栏会显示「蜂窝」而不是具体 4G/5G；这是浏览器的能力限制，不是系统伪造。

### 7.4 安装为 PWA 应用

**Android Chrome**

1. 用 Chrome 打开 `http://127.0.0.1:8787`。
2. 菜单 →「安装应用」/「添加到主屏幕」。
3. 从主屏幕启动，界面以独立窗口运行。

**iOS Safari**

1. 用 Safari 打开同一地址（必须是 Safari，第三方浏览器不能安装 PWA）。
2. 分享 →「添加到主屏幕」。
3. 从主屏幕启动。

安装后，应用壳与字体在首次加载后被缓存；断网仍可打开桌面、终端（模拟）、备忘录、相册与办公等本地功能。地图瓦片、Photon 搜索、Pyodide 运行时与真实 Linux 命令需要网络或本地桥接。

---

## 8. 真 Linux 桥接

### 8.1 启动与停止

```bash
python3 bridge/server.py
```

- 默认地址：`127.0.0.1:8787`。
- 停止：在运行窗口按 `Ctrl+C`。
- 更换端口：设置环境变量 `AETHER_PORT=9000` 后启动。
- 允许局域网访问（默认关闭，风险自负）：`AETHER_ALLOW_LAN=1 python3 bridge/server.py`。启用后同一 Wi-Fi 下的设备可以访问，务必配合防火墙与可信网络，不要暴露到公网。

### 8.2 令牌

- 首次启动自动生成 32 字符左右的随机令牌（`secrets.token_urlsafe(24)`）。
- 保存在 `bridge/.aether_token`，权限 `0600`；已加入 `.gitignore`，不会随仓库或 Release 分发。
- 如需更换令牌：停止服务，删除 `.aether_token`，重新启动。
- 也可用环境变量 `AETHER_TOKEN` 指定固定令牌（不建议写入脚本或公开位置）。

### 8.3 API

**健康检查（公开，用于探测模式）**

```http
GET /api/health
```

返回示例：

```json
{
  "ok": true,
  "bridge": "aether",
  "version": "1.0.0",
  "mode": "termux",
  "platform": "Linux",
  "installed": ["ubuntu", "kali"],
  "home": "/root",
  "python": "3.12.x",
  "auth": false
}
```

当请求头携带正确令牌时，`auth` 为 `true`；`mode` 可能为 `termux`、`ish` 或 `static`。

**执行命令（需要令牌）**

```http
POST /api/exec
Content-Type: application/json
x-aether-token: <启动时打印的令牌>

{ "cmd": "uname -a", "cwd": "/root", "distro": "ubuntu" }
```

用浏览器控制台或任意脚本调用（示例为 JavaScript，避免依赖 curl）：

```js
const res = await fetch('http://127.0.0.1:8787/api/exec', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-aether-token': '<从 bridge/.aether_token 读取的令牌>'
  },
  body: JSON.stringify({ cmd: 'uname -a', cwd: '/root', distro: 'ubuntu' })
});
console.log(await res.json());
```

返回包含 `ok`、`out`（合并后的 stdout + stderr）、`code`、`cwd`（执行后的工作目录）、`ms`、`distro`、`truncated`、`timed_out` 等字段。具体字段以服务实现为准。

### 8.4 安全护栏

- 仅绑定 `127.0.0.1`（除非显式开启局域网）。
- 请求体大小上限、命令超时 25 秒、输出头尾截断（防止大输出拖垮浏览器）。
- 最多 2 个并发命令。
- 校验 Host 头，阻止 DNS rebinding 类型的跨站访问。
- 静态文件服务拒绝 `..` 与点文件，避免读取 `.aether_token`。
- 令牌使用常量时间比较，减少时序侧信道。
- 桥接不会主动访问互联网、不会上传命令输出。

这些措施降低风险，但**不是完整沙盒**：终端执行的是你本人手机用户空间内的命令，拥有该用户空间的权限。不要粘贴来源不明的命令，不要在启用局域网时使用弱令牌。

---

## 9. 终端使用手册

### 9.1 三种 Shell 模式

终端顶部可切换：

- **Linux / bash**：模拟模式提供 `ls`、`cd`、`cat`、`grep`、`echo`、`calc`、`whoami`、`uname -a`、`neofetch`、`ping`、`nmap` 等命令；连接真 Linux 后执行真实命令。
- **CMD**：模拟 `dir`、`cd`、`cls`、`type`、`echo`、`ver`、`ipconfig`、`systeminfo`、`tasklist` 等。
- **PowerShell**：模拟 `Get-ChildItem`、`Get-Location`、`Set-Location`、`Get-Content`、`Get-Date`、`Get-Process`、`Get-Command`、`Write-Output`、`Clear-Host` 等。

> Windows 命令是交互模拟，不是真实 Windows 二进制。需要运行真实 Windows 程序时，请使用 Windows 电脑或远程桌面；桥接执行的是 Linux 用户空间命令。

### 9.2 常用操作

| 操作 | 说明 |
|---|---|
| 输入 `help` | 查看当前 Shell 可用命令 |
| `open map` / `open terminal` | 从终端启动应用 |
| `shell bash` / `shell cmd` / `shell pwsh` | 切换 Shell 模式 |
| `clear` / `cls` | 清屏 |
| `history` | 查看历史命令 |
| 点击「真 Linux」 | 配置桥接地址、令牌和发行版 |
| 点击「返回模拟」 | 断开真实模式，回到模拟命令 |

### 9.3 在真 Linux 中执行

连接成功后，提示符会变成 `aether@ubuntu:~$`（或对应发行版），直接输入命令即可：

```bash
uname -a
cat /etc/os-release
ls -la
python3 --version
gcc --version
```

能执行哪些命令，取决于对应 rootfs 中安装的软件包。需要编译器时，在 Termux 的 proot 环境中安装：

```bash
proot-distro login ubuntu
apt update && apt install -y build-essential gdb python3
```

汇编、C/C++ 的编译与调试依赖所安装的 `gcc` / `gdb` / `nasm` 等工具；AETHER OS 本身不内置这些工具链。

---

## 10. 逐个应用说明

### 10.1 终端
见第 9 节。支持模拟三壳与真实 Linux；连接状态、发行版与 cwd 会保留在本地存储中。

### 10.2 电话
- 拨号盘、联系人（内置示例）、最近通话。
- 点击绿色拨号键进入通话界面，可挂断；不会发起真实电话。
- 这是界面与交互演示，不访问通话权限、SIM 卡或运营商。

### 10.3 短信
- 会话列表、消息气泡、输入与发送。
- 发送后会在短暂延时内出现自动回复，用于演示对话流。
- 会话保存在 localStorage（`aether.messages.threads`），刷新后保留；清除站点数据后恢复示例。

### 10.4 微信 / QQ
- 会话列表、联系人、聊天窗口、消息发送。
- 聊天内容为本地演示数据，不连接腾讯服务器；会话保存在 localStorage（`aether.wechat.threads` / `aether.qq.threads`）。
- 不包含朋友圈、支付、语音 / 视频通话等真实平台能力。

### 10.5 浏览器
- 输入网址或关键词，Bing 搜索兜底。
- iframe 视图受目标站点 `X-Frame-Options` / CSP 限制，空白属于正常现象。
- 右上角「在系统浏览器中打开」可跳出 iframe 限制。
- 不提供广告拦截、密码管理或下载管理器。

### 10.6 办公
- **文档**：富文本编辑，自动保存在本地；导出 `.html`。
- **表格**：编辑单元格，自动计算数值列合计；导出 `.csv`。
- **幻灯片**：编辑标题与条目，预览版式；导出 `.json`。
- 不是 Microsoft Office 兼容格式，不保证与 Word / Excel / PowerPoint 互操作。

### 10.7 代码工作室
- JavaScript：直接在当前页面沙盒中执行，输出与错误堆栈显示在下方。
- Python：首次运行从 CDN 加载 Pyodide（约十几 MB），随后可离线复用浏览器缓存；支持常用标准库与数学计算。
- 不支持任意原生扩展、文件系统或系统调用；需要完整工具链时请连接真 Linux。
- 调试：错误会显示堆栈；断点请使用浏览器开发者工具。

### 10.8 地图
- 瓦片：Esri Dark Gray Canvas（无需 API Key；遵循 Esri 使用条款）。
- 搜索：Photon 优先，Nominatim 兜底，12 秒超时。
- 定位：调用浏览器 Geolocation API；需要授权与安全上下文（HTTPS / localhost）。
- 选中结果后放置标记；若已定位，绘制到目标的**直线**并显示距离，**不是**转向级导航。
- 需要网络加载瓦片与搜索；离线时只显示已缓存瓦片。

### 10.9 备忘录
- 新建、编辑、搜索、删除。
- 输入后 400 ms 自动保存到 localStorage，关闭应用后仍保留。
- 清除浏览器数据会删除全部备忘录；设置页提供「清除本地数据」按钮。

### 10.10 媒体
- 三段由 WebAudio 实时合成的氛围音乐（不是真实曲目）。
- 导入本地音频（mp3 / m4a / wav / ogg）真实播放；文件不会上传。
- 导入本地视频（mp4 / webm / mov），能否播放取决于浏览器与系统的解码能力。
- 移动端 Safari 对部分容器 / 编码支持有限。

### 10.11 相册
- 内置 6 幅程序生成艺术。
- 导入本地图片查看；图片仅在当前页面内使用，不上传。
- 刷新或关闭页面后，导入的图片不会保留。

### 10.12 设置
- 主题色：青 / 洋红 / 青柠 / 琥珀。
- 壁纸：极光、星云、网格、深空。
- Wi-Fi / 数据网络：概念开关，只影响界面状态，不控制真实射频。
- 真实连接状态：读取浏览器 `navigator.onLine` 与 `Network Information API`。
- 桥接配置：入口在终端「真 Linux」面板；设置页提供说明与部署提示。
- 存储与数据：显示 localStorage 用量，一键清除。
- 能力边界：内置透明说明。

---

## 11. 项目结构

```text
aether-os/
├─ index.html                 # 入口、启动屏、锁屏、状态栏、桌面容器
├─ manifest.webmanifest       # PWA 清单（名称、图标、快捷方式）
├─ sw.js                      # Service Worker：应用壳缓存与离线回退
├─ css/
│  ├─ fonts.css               # 本地字体 @font-face
│  └─ style.css               # 全部界面样式与响应式规则
├─ js/
│  ├─ core.js                 # 系统内核（前端）：注册、窗口、桌面、主题、网络、电池
│  ├─ terminal.js             # 三壳终端 + 真 Linux 桥接客户端
│  ├─ apps-social.js          # 电话、短信、微信、QQ
│  └─ apps-tools.js           # 浏览器、办公、代码、地图、备忘录、媒体、相册、设置
├─ bridge/
│  ├─ server.py               # Python 标准库桥接 / 静态服务器
│  ├─ setup-termux.sh         # Android Termux 一键准备
│  ├─ setup-ios-ish.sh        # iOS iSH 准备
│  └─ .aether_token           # 运行时生成，已 gitignore，不随项目分发
├─ fonts/                     # Orbitron / Rajdhani（SIL OFL 1.1）与许可证
├─ icons/                     # X 徽标：SVG + 192/512/1024 PNG + maskable
├─ docs/                      # 说明书、截图、架构图、发布说明
├─ tools/
│  └─ make_intro_images.py    # 生成 docs/intro-*.png 的脚本
├─ LICENSE                    # MIT
└─ README.md
```

---

## 12. 安全设计

1. **默认回环**：桥接只监听 `127.0.0.1`。手机上的其他设备无法访问；除非显式设置 `AETHER_ALLOW_LAN=1`。
2. **随机令牌**：首次启动生成，不硬编码；支持环境变量覆盖；文件权限 600。
3. **常量时间比较**：`hmac.compare_digest` 验证令牌。
4. **Host 校验**：拒绝非 localhost / 非配置主机的请求，降低 DNS rebinding 风险。
5. **路径保护**：静态文件服务拒绝 `..` 和点文件，避免泄露令牌与源码配置。
6. **资源上限**：请求体大小限制、25 秒超时、128 KB 输出截断、最多 2 个并发命令。
7. **不做的事**：不提供文件上传、不暴露 shell 给公网、不主动连接远程服务器、不收集遥测。
8. **用户责任**：真 Linux 模式下你拥有 Termux / iSH 用户空间的权限；不要执行来源不明的脚本；不要在公共 Wi-Fi 下开启局域网访问。

PWA 前端没有后端账号体系，所有数据在浏览器本地。清除站点数据会删除备忘录、设置与桥接令牌。

---

## 13. 已知限制与常见问题

### Q1：为什么不直接做一个可安装的 Android ROM / iOS 系统？
因为签名引导链、驱动、基带与硬件抽象层由厂商控制，第三方无法在零售设备上安装自编译内核。能做的是 PWA、Termux / iSH 用户空间与本地桥接。

### Q2：能运行真实的微信、QQ、抖音、原神吗？
不能。它们是原生应用，依赖 Android / iOS 运行时与平台服务。本项目中的微信 / QQ 是交互演示。

### Q3：能从 Google Play / App Store 下载应用吗？
不能。AETHER OS 没有应用商店兼容层，也不会绕过平台签名与分发体系。

### Q4：能打电话、发短信、开关 Wi-Fi / 数据吗？
浏览器 PWA 没有这些权限，相关界面是模拟。真实通话、短信、蜂窝数据由手机系统与运营商控制。

### Q5：地图为什么有时没有结果？
搜索依赖 Photon / Nominatim 第三方服务，可能受网络、地区或服务限流影响。已做 12 秒超时与 Nominatim 兜底；失败时会显示提示。瓦片来自 Esri，需要网络。

### Q6：Python 第一次运行很久 / 失败？
Pyodide 首次运行需要从 CDN 下载十几 MB 运行时。网络受限时会较慢或失败；可以稍后重试，或改用真 Linux 中的 Python。加载成功后浏览器会缓存运行时。

### Q7：iOS 上为什么状态栏显示「蜂窝」而不是 5G？
iOS Safari 不提供 `Network Information API`，无法读取真实蜂窝代际。Android Chrome 支持时显示 4G / 5G。AETHER OS 不会伪造。

### Q8：真 Linux 连接失败怎么办？
1）确认 Termux / iSH 中的 `python3 bridge/server.py` 仍在运行；2）确认地址是 `http://127.0.0.1:8787`；3）确认令牌从启动输出或 `bridge/.aether_token` 复制完整；4）确认已安装至少一个发行版（设置面板会探测）；5）iOS 检查 iSH 是否被后台挂起。

### Q9：为什么网页里的浏览器打不开某些网站？
目标站点通过 `X-Frame-Options` / CSP 禁止被嵌入，这是浏览器安全策略，不是本项目可以绕过的。可点右上角用系统浏览器打开。

### Q10：如何更新？
替换项目文件后，提升 `sw.js` 中的 `VERSION` 并刷新页面两次；或先在浏览器开发者工具中注销 Service Worker 并清除缓存。Release 会提供完整 zip 与 SHA256 校验值。

### Q11：会不会上传我的数据？
不会。项目没有遥测、账号或上传接口。地图搜索会将关键词发送给 Photon / Nominatim；瓦片请求发送给 Esri；Pyodide 从 CDN 加载；此外没有外部请求。

### Q12：为什么叫「三壳」而不是「三内核」？
「三壳」指 Linux / CMD / PowerShell 三种 Shell 交互模式。项目明确不宣称三内核，因为 Ubuntu / Kali / deepin 是用户态发行版，不是三个内核。

---

## 14. 开发与二次开发

### 14.1 无构建步骤

所有 JS 为原生 ES2019+，直接由浏览器执行：

```bash
python3 bridge/server.py     # 或 python3 -m http.server 8787
```

修改文件后刷新即可。若 Service Worker 缓存了旧文件，提升 `sw.js` 的 `VERSION`，或注销 SW 后刷新。

### 14.2 添加一个应用

在 `js/apps-tools.js`（或新文件，记得在 `index.html` 中 defer 引入）注册：

```js
Aether.registerApp({
  id: 'hello',
  name: '你好',
  sub: 'HELLO WORLD',
  icon: 'spark',          // 使用内置图标名
  accent: '#36e6ff',
  order: 200,
  render(root, api) {
    root.innerHTML = '<div class="card">Hello, AETHER.</div>';
    api.setSub('本地演示应用');
    api.onClose(() => { /* 清理音频、定时器等 */ });
  }
});
```

`api` 提供 `setSub`、`toast`、`onClose`、`addAction` 等方法；图标集合见 `js/core.js` 的 `ICONS`。

### 14.3 修改主题

- 主题色：`css/style.css` 中的 CSS 变量与 `body[data-accent]`。
- 壁纸：`body[data-wall]` 与 `.wall-*` 规则。
- 字体：`css/fonts.css` 与 `fonts/`。

### 14.4 修改桥接

`bridge/server.py` 仅依赖 Python 标准库。改动后运行：

```bash
python3 -m py_compile bridge/server.py
node --check js/core.js
node --check js/terminal.js
node --check js/apps-social.js
node --check js/apps-tools.js
```

### 14.5 文档图片

```bash
python tools/make_intro_images.py
```

需要 Pillow 与 Windows 微软雅黑字体；生成 `docs/intro-*.png`。截图使用浏览器 510×546 视口拍摄，可自行替换。

---

## 15. 测试记录

本项目在发布前完成了以下手工验证（Chromium 移动视口 + 本地静态桥接）：

- 启动动画、锁屏点击解锁、桌面 13 个应用渲染。
- 终端模拟：`help`、`neofetch`、CMD `dir`、PowerShell `Get-ChildItem`。
- 桥接探测：静态模式提示、发行版列表（无桥接时为静态提示）。
- 电话拨号与通话界面、短信发送与自动回复、微信 / QQ 会话。
- 办公文档、表格合计（611 / 742 / 728 / 912）、幻灯片预览、CSV / JSON 导出逻辑。
- 代码工作室：JavaScript 执行、Python（Pyodide）执行成功并显示输出。
- 地图：Esri 瓦片加载、Photon 搜索「上海外滩」返回结果、标记与缩放。
- 备忘录：新建、编辑、自动保存、列表回显。
- 媒体：合成音乐播放 / 暂停、视频标签切换；相册 6 幅艺术图渲染。
- 浏览器：快捷书签与 iframe 视图。
- 设置：主题色切换、网络开关、状态栏真实网络代际、桥接说明、存储信息。
- PWA：manifest 解析、Service Worker activated、离线壳缓存（含本地字体）。
- 桥接：`/api/health` 公开探测、`/api/exec` 令牌鉴权、静态模式拒绝执行。

---

## 16. 版本与更新日志

当前版本：**1.0.0**（构建 2026.11.18）

完整更新日志见 [docs/RELEASE_NOTES.md](docs/RELEASE_NOTES.md)。

主要里程碑：

- 完整的未来科技风 PWA 外壳与 13 个应用。
- Termux / iSH 双平台真 Linux 桥接与安全模型。
- 本地字体、PWA 离线缓存、X 徽标全套图标。
- 真实网络代际跟随、Photon 地图搜索修复、令牌连接校验修复。

---

## 17. 致谢与第三方组件

- **Leaflet 1.9.4** — BSD-2-Clause，地图交互库。
- **Esri Dark Gray Canvas** — 地图瓦片与标注，遵循 Esri 使用条款。
- **Photon（komoot）** — 地点搜索 API。
- **OpenStreetMap / Nominatim** — 地理数据与兜底搜索；© OpenStreetMap contributors。
- **Pyodide 0.26.4** — MPL-2.0，浏览器中的 Python 运行时。
- **Orbitron / Rajdhani** — SIL Open Font License 1.1，字体许可证见 `fonts/OFL-*.txt`。
- **Termux / proot-distro** — Android 上的终端与用户空间工具。
- **iSH** — iOS 上的 x86 用户态 Linux 模拟器。

AETHER OS 的界面、应用层与桥接代码为本项目原创；第三方组件与数据源遵循各自许可证。

---

## 18. 许可

本项目代码采用 **MIT License**，详见 [LICENSE](LICENSE)。第三方组件、字体、地图瓦片与地理数据遵循各自许可证与使用条款。地图与搜索服务的使用需遵守 Esri / Photon / OpenStreetMap 的相关政策。

---

<p align="center"><sub>AETHER OS · 概念系统 · 不修改固件 · 不替代手机系统 · 不承诺应用商店兼容</sub></p>
