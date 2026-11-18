# AETHER OS 1.0.0 · 发布说明

**版本**：1.0.0  
**构建日期**：2026-11-18  
**类型**：首个公开版本  
**平台**：Android（Chrome + Termux）、iPhone / iPad（Safari + iSH）、桌面浏览器（预览）  
**性质**：PWA 概念系统 + 可选本地 Linux 桥接（非手机固件）

---

## 1. 版本摘要

AETHER OS 1.0.0 是一个可安装到 Android 与 iPhone 主屏幕的未来科技风移动系统概念壳。它包含完整的启动动画、锁屏、桌面、状态栏与 13 个应用，并可通过 Termux（Android）或 iSH（iOS）连接手机内的真实 Linux 用户空间。

> 这不是可刷入的 ROM，也不修改设备内核、引导链、基带或系统分区。电话、短信、微信、QQ、Wi-Fi / 数据开关为交互模拟。详见 [README](../README.md) 与 [完整说明书](MANUAL.md)。

---

## 2. 新增内容

### 2.1 系统外壳

- 未来科技风启动界面：引导日志、六边形 X 徽标、进度与跳过按钮。
- 锁屏：大号时钟、日期、链路与电量、点击 / 上滑解锁。
- 桌面：Hero 卡片、系统状态卡片、13 个应用网格、底部 Dock。
- 应用窗口：滑入 / 淡出、标题栏、动作按钮、返回桌面胶囊。
- 状态栏：信号格、蜂窝代际、Wi-Fi、电量、时钟。
- 主题：4 套主题色、4 套壁纸，设置持久化。
- 背景特效：网格地板、光晕、粒子 Canvas、扫描线、暗角。

### 2.2 应用（13 个）

| 应用 | 能力 |
|---|---|
| 终端 | Linux / CMD / PowerShell 三壳；模拟命令；真 Linux 桥接 |
| 电话 | 拨号盘、联系人、最近通话、通话界面（模拟） |
| 短信 | 会话列表、聊天、发送与自动回复（模拟，localStorage 持久化） |
| 微信 | 会话 / 聊天演示（模拟，localStorage 持久化） |
| QQ | 会话 / 聊天演示（模拟，localStorage 持久化） |
| 浏览器 | 地址栏、快捷书签、iframe、外部打开 |
| 办公 | 文档、表格、幻灯片；HTML / CSV / JSON 导出 |
| 代码工作室 | JavaScript 沙盒；Python（Pyodide）；错误堆栈 |
| 地图 | Esri 暗色瓦片、Photon / Nominatim 搜索、GPS、直线距离 |
| 备忘录 | 新建、编辑、搜索、删除、自动保存 |
| 媒体 | WebAudio 合成音乐；本地音视频播放 |
| 相册 | 6 幅 Canvas 艺术；本地图片导入 |
| 设置 | 主题、网络概念开关、桥接说明、存储管理、能力边界 |

### 2.3 真 Linux 桥接

- `bridge/server.py`：Python 标准库，静态界面 + `/api/exec`。
- Android：Termux + proot-distro，支持 Ubuntu / Kali 及已安装的其他发行版。
- iOS：iSH + Alpine，`/bin/sh` 执行。
- 随机令牌、常量时间比较、Host 校验、请求体 / 输出上限、25 秒超时、2 并发。
- 健康检查公开探测模式；执行接口强制令牌；静态模式返回 501，不伪装执行。
- 命令工作目录通过哨兵标记持久化；输出超限时头尾保留。

### 2.4 PWA

- `manifest.webmanifest`：standalone、主题色、SVG + 192 / 512 / 1024 + maskable 图标。
- 应用快捷方式：终端、地图、备忘录。
- Service Worker：应用壳预缓存、导航网络优先与离线回退、同源 GET stale-while-revalidate。
- 离线可用：桌面、模拟终端、备忘录、办公、相册、设置与本地字体。
- 本地化 Orbitron / Rajdhani 字体，移除 Google Fonts 运行时依赖，改善国内网络与离线体验。

### 2.5 文档与素材

- 详尽中文 README、完整说明书（安装、应用、桥接、安全、FAQ、开发）。
- 品牌头图、架构图、能力边界图。
- 26 张真实界面截图。
- MIT License 与字体 OFL 许可证。

---

## 3. 主要修复与打磨

- **地图搜索**：Photon 不再支持 `lang=zh`，原请求返回 400 导致搜索无结果；已移除该参数，恢复「上海外滩」等中文地点搜索，并保留 Nominatim 兜底与 12 秒超时。
- **地图瓦片**：CARTO 需要 API Key 后，切换为无需 Key 的 Esri Dark Gray Canvas，瓦片与署名正常。
- **电话布局**：修复应用根节点覆盖 `app-body` 类导致拨号按钮溢出屏幕的问题；增加窄高视口媒体查询。
- **应用加载顺序**：修复 defer 脚本尚未注册应用时桌面渲染为 0 APPS 的问题。
- **终端脚本**：修复带连字符的方法名未加引号造成的语法错误，终端应用恢复正常注册。
- **网络代际**：移除了手动 5G / 6G / 7G 假切换；状态栏现在跟随浏览器 `Network Information API` 报告的真实蜂窝类型（4G / 5G），不支持时显示「蜂窝」。
- **桥接连接校验**：健康检查为公开接口，此前错误令牌也能通过「连接并测试」；现在前端强制要求 `auth: true`，错误令牌立即被拒绝。
- **媒体可访问性**：播放 / 暂停按钮的 `aria-label` 随状态更新。
- **文案准确性**：将「真内核」统一改为「真 Linux」，避免把用户空间误称为内核。
- **字体离线化**：本地托管字体并纳入 SW 预缓存，避免 Google Fonts 不可达时丢失未来科技风字形。

---

## 4. 已知问题与限制

1. **不是手机系统**：无法安装到引导分区、替换内核或运行原生 APK / IPA。
2. **无法复刻应用商店**：不兼容 Google Play / App Store 的运行时、签名与分发。
3. **社交 / 电话 / 短信为模拟**：不连接真实运营商或腾讯服务。
4. **Windows 命令为模拟子集**：不是真实 Windows 环境。
5. **地图无转向级导航**：仅位置、搜索、标记与直线距离。
6. **浏览器 iframe 限制**：部分站点禁止嵌入，会显示空白；可通过系统浏览器打开。
7. **Pyodide 首次加载依赖网络**：体积约十几 MB，慢网可能失败，可重试或改用真 Linux。
8. **iOS 后台限制**：iSH 被挂起后桥接中断，建议保持前台或 iPad 分屏。
9. **Android 后台限制**：需 wake lock 与电池白名单；部分厂商仍可能冻结 Termux。
10. **deepin rootfs 不随包提供**：需自行准备兼容 rootfs，且不保证可用性。

---

## 5. 安装

- **Android**：Termux（F-Droid / GitHub）→ `bash bridge/setup-termux.sh` → `python3 bridge/server.py` → 浏览器打开 `http://127.0.0.1:8787`。
- **iPhone / iPad**：iSH → `sh bridge/setup-ios-ish.sh` → `python3 bridge/server.py` → Safari 打开同一地址。
- **桌面预览**：`python3 bridge/server.py`，终端为静态模式。

完整步骤见 [完整说明书 · 第 3 章](MANUAL.md#3-获取校验与安装)。

---

## 6. 校验与资产

Release 附件：

- `aether-os-1.0.0.zip` — 完整项目（含文档与截图，不含 `.aether_token`）。
- `SHA256SUMS.txt` — zip 的 SHA-256。

校验命令：

```bash
sha256sum aether-os-1.0.0.zip
```

```powershell
Get-FileHash .\aether-os-1.0.0.zip -Algorithm SHA256
```

`bridge/.aether_token` 在首次启动时生成，不会出现在仓库或发布包中。

---

## 7. 致谢

Leaflet、Esri、Photon、OpenStreetMap / Nominatim、Pyodide、Orbitron、Rajdhani、Termux、proot-distro、iSH，以及所有开源社区贡献者。第三方组件遵循各自许可证。

---

**AETHER OS 1.0.0 · 概念系统 · 不修改固件 · 不替代手机系统 · 不承诺应用商店兼容**
