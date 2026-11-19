# AETHER OS 1.1.0 · 发布说明

**版本**：1.1.0  
**构建日期**：2026-11-19  
**类型**：文件系统 / 办公 / 代码 / 相机 / 性能大版本  
**平台**：Android（Chrome + Termux）、iPhone / iPad（Safari + iSH）、桌面浏览器（预览）  
**性质**：PWA 概念系统 + 可选本地 Linux 桥接（非手机固件）

---

## 1. 版本摘要

AETHER OS 1.1.0 把系统从一个可安装的界面壳，扩展为能处理真实文件、真实办公文档、真实代码与真实相机输入的本地工作台：

- 新增**文件管理器**：本机目录授权、手机存储桥接、AETHER 私有空间，支持增删改查；
- **办公套件**改为真实 PDF / DOCX / XLSX / PPTX / CSV 等格式的本地打开、编辑与另存；
- **代码工作室**扩展到 **13 种语言**（新增 Kotlin / Swift），桥接后可真实编译、运行并定位错误行列；
- 新增**相机**：原生相机原始文件通道 + 支持自动对焦 / 点按对焦 / 变焦的取景器；
- **相册**接入系统照片选择器与手机存储桥接扫描；
- 新增**真实省电模式**与渲染优化；
- 新增**双平台更新检查**：自动读取 GitHub / GitCode 的版本清单，发现新版本时提示，可自行选择来源并刷新，无需重装 PWA；
- 应用总数达到 **16 个**，包括终端、电话、短信、微信、QQ、支付宝、浏览器、文件、办公、代码、地图、备忘录、媒体、相册、相机与设置。

> 这不是可刷入的 ROM，也不修改设备内核、引导链、基带或系统分区。电话、短信、微信、QQ、支付宝均只交接官方 App；系统消息接收与电话接听不在网页能力范围内。详见 [README](../README.md) 与 [完整说明书](MANUAL.md)。

---

## 2. 本版新增与变更

### 2.1 文件管理器（新增）

- 三个来源：
  - **本机目录**：File System Access API 目录授权，句柄保存在 IndexedDB，可持久恢复；
  - **手机存储**：Termux / iSH 桥接读写共享存储与用户目录；
  - **AETHER 空间**：浏览器 OPFS 私有文件系统。
- 支持浏览、上传、新建文件夹、新建文本、重命名 / 移动、删除、下载。
- 内置文本、图片、音频、视频、PDF 与办公文件查看入口；办公文件可交给办公应用继续编辑。
- 桥接单文件上限 64 MB，路径限制在授权根目录，拒绝目录穿越、符号链接逃逸与受保护文件名。
- 删除是真实删除，没有回收站；执行前会确认。

### 2.2 办公套件（重写）

- **PDF**：内置查看器；旋转、删除页、后插空白页、加页码；叠加中文批注 / 水印文字层；另存有效 PDF。
- **DOCX**：正文预览与逐段文字编辑；保存时保留包内图片和结构，复杂版式可能被简化；另存 OOXML。
- **XLSX / XLS / CSV / TSV / ODS**：多工作表网格编辑；公式以文本保留；另存 XLSX 或 CSV。
- **PPTX**：文字视图与逐段编辑；保存时保留包内图片资源；不渲染图片、动画和母版。
- **TXT / MD / JSON / XML / HTML / CSS / JS**：纯文本查看与编辑。
- 可新建空白文档、表格、PDF 与文本；单文件上限 80 MB。
- 解析库（pdf-lib、SheetJS、mammoth、JSZip）随项目本地提供，不上传文件。
- 旧版 `.doc` / `.ppt` 明确提示无法无损解析，不伪造编辑能力。

### 2.3 代码工作室（扩展）

- **13 种语言**：JavaScript、Python、HTML、CSS、C、C++、Java、Kotlin、Swift、Rust、Go、PHP、汇编（Assembly）。
- 浏览器内：JavaScript 沙盒运行；Python 通过 Pyodide 运行（首次联网加载）；HTML / CSS 在隔离 sandbox iframe 中预览。
- 桥接后：C / C++ / Java / Kotlin / Swift / Rust / Go / PHP / 汇编调用已安装工具链编译运行。
- 「调试」把断点行发送给 pdb / node inspect / jdb / phpdbg / gdb，真实执行并停在断点，输出调用栈与局部变量；Kotlin / Swift 暂未接入自动交互断点，会编译运行并解析错误行列。
- 编译与运行错误解析为 `{ 行, 列, 严重级别, 消息 }`，编辑器直接定位并高亮错误行列。
- HTML / CSS 的「检查」做标签、括号与字符串配对，报告准确行列，不冒充完整 W3C 校验器。
- 代码、断点按语言分别保存；桥接只接受固定语言白名单，源码在临时目录执行。
- 边界：Kotlin 只编译 JVM 命令行程序，Swift 只编译命令行程序；不含 Android SDK / Gradle / Xcode，不能生成 APK 或 iOS App，iSH 也不能安装官方 Swift 工具链。

### 2.4 相机（新增）

- **原生相机通道**：调用系统相机，保存其返回的原始文件字节，不经过 Canvas 二次压缩，画质与系统相机输出一致。
- **取景器通道**：`getUserMedia` 预览；设备支持时启用连续自动对焦、点按对焦、滑杆与双指变焦、前后摄像头切换。
- 拍照优先使用 `ImageCapture.takePhoto()`；不支持时回退到浏览器画面帧，并明确标注分辨率上限。
- 照片自动保存为 AETHER 相册副本，可下载原图、系统分享或删除副本。
- 不自动写入系统「照片」App；需要时用下载或系统分享保存。

### 2.5 相册（接入真实来源）

- 「选择图片」调用系统照片选择器，副本保存到 IndexedDB，刷新后仍可查看。
- 连接桥接后可扫描：
  - Termux：`DCIM` / `Pictures`（需 `termux-setup-storage`）；
  - iSH：iSH 可见的 `Pictures` / `Documents` / `Downloads`；
  - 桌面：用户「图片」目录，可用 `AETHER_GALLERY_DIRS` 扩展。
- 懒加载缩略图、分页、按来源筛选、全屏查看、下载原图、删除 AETHER 副本。
- 移除旧版内置示例艺术图；相册不再伪造内容。
- iOS 不允许 iSH 读取整个系统照片图库，这是平台边界。

### 2.6 省电与流畅度

- 设置新增真实的**电池与省电**三档策略：
  - 自动：Battery API 电量 ≤ 20% 且未充电时开启，充电或恢复后退出；
  - 开启 / 关闭：手动立即生效。
- 省电时暂停粒子、背景动画、模糊和大部分过渡，并停止不必要的渲染循环；状态栏显示「省电」。
- 打开应用时暂停背景粒子；时钟与网络状态按分钟 / 事件更新；限制 DPR 与粒子数量。
- 无 Battery API 的浏览器显示 `--`，不伪造电量。

### 2.7 双平台更新检查（新增）

- 启动解锁后、回到前台、联网恢复与每 6 小时自动检查；30 分钟内不重复请求。
- 并行读取 GitHub Raw 与 GitCode v5 API 的公开 `version.json`；单来源失败不阻塞，8 秒超时。
- 发现更高版本时顶部出现更新条，列出 GitHub / GitCode 两个来源；设置页可手动检查、选择来源、打开发布页。
- 刷新时清除旧缓存、更新 Service Worker 并重新加载当前安装地址，不要求重新安装 PWA。
- 已安装 PWA 的代码来源仍由安装地址决定；浏览器不能把一个平台的远端文件直接替换进另一个已安装 PWA 的包。部署在平台 Pages 时可直接获取对应平台新版本；本地桥接模式需先更新本地文件。
- 新增根目录 `version.json`，后续发布必须同步提升 `version`、`build`、`notes`。

### 2.8 终端 Termux / iSH 主机通道（新增）

- 真机桥接连接后，终端顶部提供 `LINUX` 与 `TERMUX`（Android）/ `ISH`（iPhone、iPad）两个执行位置。
- `LINUX` 仍进入 Ubuntu / Kali / Alpine 用户空间；`TERMUX` 直接使用 Termux 的 `bash -lc`，可运行 `pkg`、`termux-battery-status`、`termux-toast`、`am start` 等主机命令；`ISH` 直接使用 iSH Alpine 的 `/bin/sh -lc`，可运行 `apk` 等命令。
- 两个通道分别维护工作目录；`help` 显示当前通道的真实命令示例，不伪造输出。
- `termux-*` 需要 Termux:API App 与 `termux-api` 包；访问共享存储需先运行 `termux-setup-storage`。主机命令拥有对应 App 用户空间权限，仍受 Android / iOS 系统沙盒限制。

### 2.9 其他

- 应用总数 16 个；数据库与目录授权使用独立 IndexedDB，不与 localStorage 混用。
- 桌面与锁屏不再显示演示电量；终端示例用户改为通用的 `aether`。
- 删除全部旧演示会话、测试笔记、测试截图与测试脚本；发布包不包含令牌。
- 更新全部文档、截图与介绍图片，统一版本号 1.1.0 / 构建 2026.11.19。

---

## 3. 能力边界

1. **电话 / 短信**：网页只能请求系统 App 接管，不能读取通话记录、短信收件箱或送达回执，也不能接听 / 拒接电话。
2. **系统消息**：浏览器 / PWA 无法读取系统短信、微信、QQ、支付宝消息或通知；即使由用户授权，也不存在对应 Web API。本项目不提供伪造的消息接收界面。Android 原生默认拨号器 / 通知监听 App 或可部分实现，iOS 不允许第三方读取这些数据。
3. **Android 原生应用 / 游戏**：PWA 不能安装 APK、加载 DEX / 原生库或运行 Android 游戏；Android 上最多通过系统 Intent 打开已安装应用并离开浏览器，无法枚举全部应用，iOS 不允许此类跳转。
4. **微信 / QQ / 支付宝**：只唤起官方 App 或使用系统分享，不登录、不读取聊天、不代发消息、不查询支付结果。
5. **应用更新来源**：GitHub / GitCode 提供版本清单与发布页，但浏览器不能跨源替换已安装 PWA 的代码包；更新按钮只刷新当前安装地址，另一平台来源需要重新安装或部署到对应 Pages。
6. **文件系统**：浏览器不能绕过系统权限访问整个手机；Android 依赖 Termux 桥接，iPhone 依赖 iSH 可见目录，桌面依赖用户授权目录。删除不可撤销。
7. **办公格式**：PDF 只支持页面与叠加文字层，不编辑原文字流；DOCX / PPTX 只编辑文字层；XLSX 不计算公式；`.doc` / `.ppt` 不解。
8. **相机**：不提供专业参数、RAW、后台录制；取景器画质取决于浏览器与设备；原生通道的实际调用方式由系统文件输入决定。
9. **不修改固件**：不接管基带、射频、运营商配置或系统分区。

---

## 4. 安装与升级

### 4.1 新安装

- **Android**：安装 Termux（F-Droid / GitHub）→ `bash bridge/setup-termux.sh` → `python3 bridge/server.py` → 浏览器打开 `http://127.0.0.1:8787`。
- **iPhone / iPad**：安装 iSH → `sh bridge/setup-ios-ish.sh` → `python3 bridge/server.py` → Safari 打开同一地址。
- **桌面预览**：`python3 bridge/server.py`，终端为静态模式。

### 4.2 从 1.0.x 升级

1. 解压 1.1.0 到新目录，保留自己的 `bridge/.aether_token`。
2. 停止旧桥接，从新目录执行 `python3 bridge/server.py`。
3. 刷新页面，或在设置 →「系统更新」中选择来源并刷新；缓存版本已提升为 `aether-v1.1.0-b3`。若仍显示旧界面，再刷新一次或注销旧 Service Worker。
4. localStorage 中的设置、备忘录、代码与桥接配置会保留；旧演示键会在加载时清除。
5. AETHER 空间（OPFS）、相册副本与目录授权按站点 origin 保留；建议升级前先下载重要文件。

完整步骤见 [完整说明书 · 第 3 章](MANUAL.md#3-获取校验与安装)。

---

## 5. 验证与测试

发布前在 Chromium 移动视口 525×553 + 本地桥接（静态模式与 Termux / iSH mock）完成：

- 启动、锁屏、桌面 16 应用与状态栏；
- 终端模拟三壳、桥接健康检查与静态降级；Termux mock 下 LINUX / TERMUX 切换、`pkg update` 走 host scope；iSH mock 下 ISH 按钮、`ish@alpine` 提示符与 `apk update` 走 host scope，`exit` 回到模拟模式；服务端 `scope=host` 分支已在本机以 Termux 模式实际执行；
- 电话 / 短信 / 微信 / QQ / 支付宝原生交接与复制回退；
- 文件：桥接文件 API 15 项测试（根目录、列目录、读写、新建、重命名、删除、越界与符号链接拒绝）；OPFS 与目录授权增删改查；
- 办公：PDF、DOCX、XLSX、PPTX、TXT 的打开与另存有效性；
- 代码：13 种语言说明面板、HTML / CSS 检查、`/api/studio` 探测 / 编译 / 运行 / DEBUG 路由；Kotlin / Swift 完成注册、样例、说明与缺工具提示，诊断解析单测通过；本机未安装 `kotlinc` / `swiftc`，真实编译需在安装工具链的环境复测；
- 相机：原生入口、取景器约束、自动 / 点按对焦与变焦代码路径；真实镜头画质需真机复测；
- 地图、备忘录、媒体、相册与浏览器；
- 省电三档、无 Battery API 回退、粒子暂停与渲染循环优化；
- manifest、Service Worker 激活、离线壳与新缓存清理。

真实 Termux 与 iSH 的命令执行依赖对应设备环境，发布包内的服务端分支与界面通道已按同一协议验证，但未在实体手机上复测；说明书测试表将这几项如实标记为「模拟界面 / 需真机复测」。

详细的逐项记录见 [完整说明书 · 第 13 章](MANUAL.md#13-测试与验收记录)。

---

## 6. 校验与资产

Release 附件：

- `aether-os-1.1.0.zip` — 完整项目（含文档与截图，不含 `.aether_token`、Git 历史、测试产物与个人媒体）。
- `SHA256SUMS.txt` — zip 的 SHA-256。

校验值以 Release 附件中的 `SHA256SUMS.txt` 为准。

```bash
sha256sum aether-os-1.1.0.zip
```

```powershell
Get-FileHash .\aether-os-1.1.0.zip -Algorithm SHA256
```

`bridge/.aether_token` 在首次启动时生成，不会出现在仓库或发布包中。

---

## 7. 版本沿革

- **1.1.0**：文件管理器、真实办公格式、13 语言代码工作室（含 Kotlin / Swift）、Termux / iSH 主机命令通道、相机、相册桥接扫描、真实省电与流畅度优化、16 个应用。
- **1.0.1**：电话 / 短信交接系统 App，微信 / QQ / 支付宝唤起官方 App 与系统分享；删除全部演示会话与测试数据。
- **1.0.0**：未来科技风 PWA 外壳、三壳终端、Termux / iSH 真 Linux 桥接与安全模型、本地字体、PWA 离线缓存、X 徽标全套图标。

---

## 8. 致谢

Leaflet、Esri、Photon、OpenStreetMap / Nominatim、Pyodide、pdf-lib、SheetJS、mammoth、JSZip、Orbitron、Rajdhani、Termux、proot-distro、iSH，以及所有开源社区贡献者。第三方组件遵循各自许可证。

---

**AETHER OS 1.1.0 · 概念系统 · 不修改固件 · 不替代手机系统 · 不承诺应用商店兼容**
