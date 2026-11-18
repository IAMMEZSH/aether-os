"""Generate docs/intro-*.png (1600x900 / 1600x1000) with Pillow."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
ICON = ROOT / "icons" / "icon-1024.png"

REG = "C:/Windows/Fonts/msyh.ttc"
BOLD = "C:/Windows/Fonts/msyhbd.ttc"
LIGHT = "C:/Windows/Fonts/msyhl.ttc"


def font(size, bold=False, light=False):
    return ImageFont.truetype(BOLD if bold else (LIGHT if light else REG), size)


def bg(w, h):
    img = Image.new("RGB", (w, h), "#05070f")
    px = img.load()
    for y in range(h):
        for x in range(w):
            # vertical gradient + radial tints
            v = int(8 + 10 * (y / h))
            r, g, b = v, v + 2, v + 8
            cx1, cy1 = int(w * 0.18), int(h * 0.25)
            cx2, cy2 = int(w * 0.85), int(h * 0.78)
            d1 = ((x - cx1) ** 2 + (y - cy1) ** 2) ** 0.5
            d2 = ((x - cx2) ** 2 + (y - cy2) ** 2) ** 0.5
            t1 = max(0.0, 1 - d1 / (w * 0.42))
            t2 = max(0.0, 1 - d2 / (w * 0.46))
            r += int(10 * t1 * t1 + 18 * t2 * t2)
            g += int(34 * t1 * t1 + 2 * t2 * t2)
            b += int(46 * t1 * t1 + 34 * t2 * t2)
            px[x, y] = (min(r, 255), min(g, 255), min(b, 255))
    grid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(grid)
    for x in range(0, w, 48):
        d.line([(x, 0), (x, h)], fill=(40, 90, 130, 18), width=1)
    for y in range(0, h, 48):
        d.line([(0, y), (w, y)], fill=(40, 90, 130, 18), width=1)
    img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")
    return img


def text(d, xy, s, f, fill, anchor="la", spacing=8):
    if "\n" in s:
        d.multiline_text(xy, s, font=f, fill=fill, anchor=anchor, spacing=spacing)
    else:
        d.text(xy, s, font=f, fill=fill, anchor=anchor)


def glow_layer(size, draw_fn, blur=18):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def pill(d, x, y, label, f, fg, border):
    pad_x, h = 22, 46
    w = d.textlength(label, font=f) + pad_x * 2
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, outline=border + (255,), width=1, fill=(10, 17, 30, 255))
    d.text((x + pad_x, y + h / 2), label, font=f, fill=fg, anchor="lm")
    return x + w


def hero():
    W, H = 1600, 900
    img = bg(W, H).convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([60, 60, W - 60, H - 60], radius=36, outline=(60, 120, 160, 70), width=1)
    d.text((100, 92), "CONCEPT BUILD 2026.11", font=font(20), fill=(110, 220, 255, 210))
    d.text((W - 100, 92), "PWA · WEB CORE", font=font(20), fill=(190, 200, 220, 160), anchor="ra")

    # icon with glow
    icon = Image.open(ICON).convert("RGBA")
    icon = icon.resize((380, 380), Image.LANCZOS)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([150, 250, 590, 690], fill=(30, 180, 230, 60))
    gd.ellipse([260, 360, 540, 640], fill=(240, 40, 200, 45))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(60)))
    region = img.crop((172, 262, 552, 642)).convert("RGB")
    blended = ImageChops.screen(region, icon.convert("RGB"))
    img.paste(blended, (172, 262))

    # right copy
    d = ImageDraw.Draw(img)
    x = 700
    d.text((x, 268), "AETHER OS", font=font(96, bold=True), fill=(240, 248, 255))
    d.text((x + 2, 380), "三壳终端  ·  全场景套件  ·  双端概念系统", font=font(34), fill=(150, 230, 255))
    d.text((x, 452), "一个界面，连接 Web 与真实 Linux。", font=font(30, light=True), fill=(185, 196, 214))
    y = 520
    x2 = pill(d, x, y, "PWA 可安装", font(22), (140, 240, 255), (60, 160, 200))
    x2 = pill(d, x2 + 14, y, "Termux · Ubuntu/Kali", font(22), (255, 170, 240), (200, 70, 170))
    y2 = 584
    pill(d, x, y2, "iSH · Alpine", font(22), (190, 255, 160), (90, 170, 90))
    d.text((x, 690), "真 Linux 终端  ·  真实地图与定位  ·  本地媒体与备忘录", font=font(24), fill=(160, 175, 200))
    d.text((x, 736), "电话 / 短信 / 微信 / QQ 为交互模拟，详见能力边界。", font=font(22, light=True), fill=(130, 145, 170))

    d.text((100, H - 118), "不修改固件  ·  不替换手机系统  ·  不承诺 App Store / Google Play 兼容", font=font(24), fill=(120, 138, 165))
    d.text((W - 100, H - 118), "github.com/IAMMEZSH", font=font(22), fill=(90, 200, 240), anchor="ra")
    img.convert("RGB").save(DOCS / "intro-hero.png", quality=95)
    print("hero ok")


def box(d, rect, title, sub, color, title_size=30, sub_size=20, radius=18):
    x1, y1, x2, y2 = rect
    d.rounded_rectangle(rect, radius=radius, fill=(10, 16, 28, 235), outline=color + (190,), width=2)
    d.rounded_rectangle([x1, y1, x2, y1 + 6], radius=3, fill=color + (255,))
    d.text(((x1 + x2) / 2, y1 + (y2 - y1) * 0.38), title, font=font(title_size, bold=True), fill=(238, 246, 255), anchor="mm")
    if sub:
        d.text(((x1 + x2) / 2, y1 + (y2 - y1) * 0.68), sub, font=font(sub_size, light=True), fill=(160, 176, 198), anchor="mm")


def arrow(d, p1, p2, color=(90, 200, 240), width=3):
    d.line([p1, p2], fill=color + (220,), width=width)
    import math
    ang = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    L, s = 14, 7
    tip = p2
    left = (tip[0] - L * math.cos(ang) + s * math.sin(ang), tip[1] - L * math.sin(ang) - s * math.cos(ang))
    right = (tip[0] - L * math.cos(ang) - s * math.sin(ang), tip[1] - L * math.sin(ang) + s * math.cos(ang))
    d.polygon([tip, left, right], fill=color + (240,))


def architecture():
    W, H = 1600, 1000
    img = bg(W, H).convert("RGBA")
    d = ImageDraw.Draw(img)
    d.text((90, 70), "AETHER OS 架构", font=font(54, bold=True), fill=(240, 247, 255))
    d.text((92, 138), "同一套前端界面，可选接入真实 Linux；无桥接时自动降级为静态演示。", font=font(24, light=True), fill=(155, 175, 200))

    box(d, [390, 210, 1150, 316], "PWA 前端  ·  index.html + js/ + css/", "终端 · 电话 · 短信 · 社交 · 办公 · 地图 · 媒体 · 相册 · 备忘录 · 设置", (80, 200, 255), 34, 20)
    arrow(d, (800, 316), (800, 380))

    box(d, [360, 382, 1180, 500], "本地桥接  bridge/server.py", "127.0.0.1:8787 · Python 标准库 · Token 鉴权 · 25s 超时 · 输出截断", (255, 80, 210), 34, 20)
    arrow(d, (610, 500), (500, 604), (255, 80, 210))
    arrow(d, (990, 500), (1100, 604), (255, 80, 210))

    box(d, [150, 606, 690, 800], "Android · Termux", "proot-distro login <distro>\nUbuntu / Kali 一键安装\ndeepin 可用社区 rootfs 自行加入", (110, 255, 170), 32, 19)
    box(d, [910, 606, 1450, 800], "iPhone · iSH", "Alpine Linux x86 用户态\napk add python3\niOS 后台挂起需保持前台", (255, 190, 90), 32, 19)
    arrow(d, (500, 800), (500, 868), (110, 255, 170))
    arrow(d, (1100, 800), (1100, 868), (255, 190, 90))

    box(d, [150, 870, 690, 944], "真实 shell：bash / 常用 Linux 命令", "第三方工具链取决于所装发行版", (110, 255, 170), 22, 16)
    box(d, [910, 870, 1450, 944], "真实 shell：/bin/sh / ash", "受 iOS 沙盒与后台策略限制", (255, 190, 90), 22, 16)

    # side notes
    d.rounded_rectangle([1200, 210, 1530, 470], radius=18, fill=(10, 17, 30), outline=(255, 190, 90), width=1)
    d.text((1226, 236), "静态模式", font=font(26, bold=True), fill=(255, 205, 120))
    d.text((1226, 282), "直接双击 index.html 或\n任意静态服务器打开：\n终端进入模拟命令模式，\n其余应用照常使用。", font=font(20, light=True), fill=(190, 195, 210), spacing=10)

    d.rounded_rectangle([70, 210, 290, 470], radius=18, fill=(10, 17, 30), outline=(90, 200, 240), width=1)
    d.text((94, 236), "安全默认", font=font(26, bold=True), fill=(120, 220, 255))
    d.text((94, 282), "仅监听回环地址\n随机 Token\n常量时间比较\n拒绝目录穿越\n默认不允许局域网", font=font(19, light=True), fill=(185, 196, 214), spacing=8)

    d.text((90, H - 47), "注：Ubuntu / Kali / deepin 是用户态发行版，不是内核；本项目不修改手机引导链或基带。", font=font(20, light=True), fill=(140, 152, 175))
    img.convert("RGB").save(DOCS / "intro-architecture.png", quality=95)
    print("architecture ok")


def capabilities():
    W, H = 1600, 1000
    img = bg(W, H).convert("RGBA")
    d = ImageDraw.Draw(img)
    d.text((90, 62), "能力边界：真实 / 模拟 / 不可能", font=font(52, bold=True), fill=(240, 247, 255))
    d.text((92, 132), "把每一类能力讲清楚，比模糊承诺更重要。", font=font(24, light=True), fill=(155, 175, 200))

    cols = [
        ("真实可用", (110, 255, 170), [
            "安装为 PWA（Android / iOS）",
            "JavaScript 与 Python（Pyodide）",
            "真实地图瓦片、搜索与 GPS 定位",
            "本地音乐 / 视频 / 图片查看",
            "备忘录本地自动保存",
            "桥接后执行真实 Linux 命令",
            "导出文件到系统下载目录",
            "Office 文档、表格、幻灯片（本地）",
        ]),
        ("交互模拟", (255, 190, 90), [
            "拨号、来电界面与通话状态",
            "短信对话与自动回复",
            "微信 / QQ 会话界面",
            "Wi-Fi 与数据网络开关（概念）",
            "信号、电量、启动与锁屏动画",
            "应用下载引导（不提供商店对接）",
            "实时网速 / 流量统计",
        ]),
        ("技术上不可能", (255, 90, 120), [
            "在零售 iPhone 上启动自研内核",
            "绕过安全启动刷入通用 ROM",
            "把 Ubuntu/Kali/deepin 当内核合并",
            "复刻 Google Play / App Store 兼容层",
            "在本系统内运行真实微信 / QQ 客户端",
            "从手机 USB 启动 U 盘中的系统",
            "接管基带、射频或运营商配置",
        ]),
    ]
    y0, y1 = 210, 880
    x = 90
    for title, color, items in cols:
        w = 470
        d.rounded_rectangle([x, y0, x + w, y1], radius=22, fill=(10, 17, 30), outline=color, width=2)
        d.rounded_rectangle([x, y0, x + w, y0 + 6], radius=3, fill=color)
        d.text((x + 30, y0 + 52), title, font=font(32, bold=True), fill=color, anchor="lm")
        yy = y0 + 118
        for it in items:
            d.ellipse([x + 32, yy + 9, x + 42, yy + 19], fill=color)
            d.text((x + 60, yy), it, font=font(21, light=True), fill=(205, 214, 230))
            yy += 58
        x += w + 40

    d.text((90, H - 62), "AETHER OS 是运行在浏览器 / PWA 中的概念系统与真 Linux 桥接工具，不是手机固件。", font=font(22), fill=(145, 158, 180))
    img.convert("RGB").save(DOCS / "intro-capabilities.png", quality=95)
    print("capabilities ok")


if __name__ == "__main__":
    DOCS.mkdir(exist_ok=True)
    hero()
    architecture()
    capabilities()
