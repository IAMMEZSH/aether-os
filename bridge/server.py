#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AETHER OS 本机桥接服务
=======================
一个零第三方依赖的 HTTP 服务，负责两件事：

1. 把 AETHER OS 的静态界面文件提供给浏览器（默认 http://127.0.0.1:8787）。
2. 提供受令牌保护的 /api/exec，把网页终端的命令送进真 Linux 用户空间：
   - Android/Termux：经由 proot-distro 进入 Ubuntu / Kali（或用户自备的 rootfs）。
   - iOS/iSH：直接在本机 Alpine 用户空间执行。
   - 其他平台（如 Windows 开发机）：只提供静态界面，不执行命令。

安全边界：
- 默认只监听 127.0.0.1（回环），其他设备无法访问。
- /api/exec 必须携带启动时生成的随机令牌（x-aether-token）。
- API 校验 Host，默认拒绝非回环来源，降低 DNS rebinding 风险。
- 命令在用户自己的 Linux 用户空间执行；不涉及远程主机或 PC。
- 令牌保存在 bridge/.aether_token（权限 600），不要把它提交到仓库。
"""

from __future__ import annotations

import json
import os
import platform
import secrets
import shutil
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

import files as file_bridge
import gallery
import studio

VERSION = "1.2.0"
ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = Path(__file__).resolve().parent / ".aether_token"

HOST = (os.environ.get("AETHER_HOST") or "127.0.0.1").strip()
PORT = int(os.environ.get("AETHER_PORT") or "8787")
ALLOW_LAN = os.environ.get("AETHER_ALLOW_LAN", "0") == "1"

MAX_BODY = 16 * 1024
MAX_STUDIO_BODY = 192 * 1024
MAX_FILE_BODY = 64 * 1024 * 1024
MAX_OUTPUT = 128 * 1024
CMD_TIMEOUT = 25
MAX_CONCURRENCY = 2
SEMAPHORE = threading.BoundedSemaphore(MAX_CONCURRENCY)

PREFIX = os.environ.get("PREFIX", "")
HOME = os.path.expanduser("~")


def detect_mode() -> str:
    if shutil.which("proot-distro"):
        return "termux"
    if "com.termux" in PREFIX:
        return "termux"
    if Path("/etc/alpine-release").exists() and not PREFIX:
        return "ish"
    return "static"


MODE = detect_mode()


def load_token() -> str:
    env_token = os.environ.get("AETHER_TOKEN")
    if env_token:
        return env_token.strip()
    try:
        if TOKEN_FILE.exists():
            token = TOKEN_FILE.read_text(encoding="utf-8").strip()
            if token:
                return token
        token = secrets.token_urlsafe(24)
        TOKEN_FILE.write_text(token + "\n", encoding="utf-8")
        try:
            os.chmod(TOKEN_FILE, 0o600)
        except OSError:
            pass
        return token
    except OSError:
        return secrets.token_urlsafe(24)


TOKEN = load_token()


def installed_distros():
    if MODE == "ish":
        return ["alpine"]
    if MODE != "termux":
        return []
    candidates = []
    if PREFIX:
        candidates.append(Path(PREFIX) / "var/lib/proot-distro/installed-rootfs")
    candidates.append(Path("/data/data/com.termux/files/usr/var/lib/proot-distro/installed-rootfs"))
    for base in candidates:
        if base.is_dir():
            try:
                return sorted([p.name for p in base.iterdir() if p.is_dir()])
            except OSError:
                continue
    return []


def shquote(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"


def run_command(distro: str, command: str, cwd: str, timeout: int = None, scope: str = "distro"):
    limit = int(timeout or CMD_TIMEOUT)
    started = time.time()
    marker = "__AETHER_CWD_" + secrets.token_hex(4) + "__"
    safe_cwd = shquote(cwd if cwd.startswith("/") and "\n" not in cwd else HOME)
    script = (
        f"cd {safe_cwd} 2>/dev/null || cd \"$HOME\"\n"
        f"{command}\n"
        f"printf '\\n{marker}%s\\n' \"$PWD\"\n"
    )
    env = dict(os.environ)
    env.setdefault("TERM", "dumb")
    if scope == "host":
        if MODE == "ish":
            argv = ["/bin/sh", "-lc", script]
            distro = "alpine"
        elif MODE == "termux":
            bash = shutil.which("bash") or "/system/bin/sh"
            argv = [bash, "-lc", script]
            distro = "termux"
        else:
            return {"ok": False, "error": "当前环境不是 Termux/iSH，不能执行主机命令", "code": 501}
    elif MODE == "ish":
        if distro != "alpine":
            return {"ok": False, "error": "iSH 只提供 Alpine 用户空间", "code": 400}
        argv = ["/bin/sh", "-lc", script]
    elif MODE == "termux":
        if distro not in installed_distros():
            return {"ok": False, "error": "发行版未安装：%s（已安装：%s）" % (distro, ", ".join(installed_distros()) or "无"), "code": 400}
        argv = ["proot-distro", "login", distro, "--", "bash", "-lc", script]
    else:
        return {"ok": False, "error": "当前环境不是 Termux/iSH，桥接只提供静态界面", "code": 501}

    out = ""
    code = 0
    timed_out = False
    try:
        proc = subprocess.run(
            argv,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=limit,
            env=env,
            cwd=str(ROOT),
        )
        code = proc.returncode
        out = (proc.stdout or b"").decode("utf-8", "replace")
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        code = 124
        raw = exc.output or b""
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", "replace")
        out = raw + "\n[bridge] 命令超过 %d 秒，已中止。\n" % limit
    except FileNotFoundError as exc:
        return {"ok": False, "error": "找不到执行器：%s" % exc, "code": 500}
    except Exception as exc:  # noqa: BLE001 - 边界服务，统一返回错误
        return {"ok": False, "error": "执行失败：%s" % exc, "code": 500}

    new_cwd = cwd
    if marker in out:
        head, _, tail = out.rpartition(marker)
        out = head
        first = tail.strip().splitlines()
        if first:
            new_cwd = first[0].strip()
    out = out.strip("\n")

    truncated = False
    if len(out) > MAX_OUTPUT:
        truncated = True
        half = MAX_OUTPUT // 2
        out = out[:half] + "\n…（输出过长，已截断）…\n" + out[-half:]

    return {
        "ok": True,
        "out": out,
        "cwd": new_cwd,
        "code": code,
        "ms": int((time.time() - started) * 1000),
        "distro": distro,
        "scope": "host" if scope == "host" else "distro",
        "truncated": truncated,
        "timed_out": timed_out,
    }


MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".zip": "application/zip",
    ".wasm": "application/wasm",
    ".sh": "text/plain; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "AetherBridge/" + VERSION

    def log_message(self, fmt, *args):
        sys.stderr.write("[bridge] " + (fmt % args) + "\n")

    # ---------- 基础工具 ----------
    def _host_is_local(self) -> bool:
        host = (self.headers.get("Host") or "").strip().lower()
        if host.startswith("["):
            host = host.split("]")[0].strip("[")
        else:
            host = host.split(":")[0]
        if host in ("127.0.0.1", "localhost", "::1"):
            return True
        return ALLOW_LAN

    def _token_ok(self) -> bool:
        provided = self.headers.get("x-aether-token", "")
        if not provided:
            return False
        try:
            return secrets.compare_digest(provided, TOKEN)
        except (TypeError, ValueError):
            return False

    def _send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-aether-token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _send_file(self, path: Path):
        try:
            data = path.read_bytes()
        except OSError:
            self.send_error(404, "Not found")
            return
        mime = MIME.get(path.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _send_bytes(self, status, data: bytes, mime: str, extra_headers=None, cache="private, max-age=1800"):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", cache)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Access-Control-Allow-Origin", "*")
        for key, value in (extra_headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def _safe_static_path(self):
        parsed = urlparse(self.path)
        rel = unquote(parsed.path)
        if rel in ("", "/"):
            rel = "/index.html"
        parts = [p for p in rel.split("/") if p]
        if any(p == ".." or p.startswith(".") for p in parts):
            return None
        candidate = (ROOT / Path(*parts)).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            return None
        if candidate.is_dir():
            candidate = candidate / "index.html"
        return candidate if candidate.is_file() else None

    # ---------- HTTP 方法 ----------
    def do_OPTIONS(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error(404, "Not found")
            return
        if not self._host_is_local():
            self._send_json(403, {"ok": False, "error": "仅允许本机访问"})
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-aether-token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "600")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            if not self._host_is_local():
                self._send_json(403, {"ok": False, "error": "仅允许本机访问"})
                return
            distros = installed_distros()
            self._send_json(200, {
                "ok": True,
                "bridge": "aether",
                "version": VERSION,
                "mode": MODE,
                "platform": platform.system(),
                "proot": MODE == "termux" and shutil.which("proot-distro") is not None,
                "installed": distros,
                "home": HOME,
                "python": platform.python_version(),
                "studio": True,
                "gallery": True,
                "files": True,
                "hostShell": "termux" if MODE == "termux" else "ish" if MODE == "ish" else "",
                "auth": self._token_ok(),
            })
            return
        if parsed.path in ("/api/files/roots", "/api/files/list", "/api/files/read"):
            if not self._host_is_local():
                self._send_json(403, {"ok": False, "error": "仅允许本机访问"})
                return
            if not self._token_ok():
                self._send_json(401, {"ok": False, "error": "令牌无效或缺失"})
                return
            query = parse_qs(parsed.query)
            if parsed.path == "/api/files/roots":
                self._send_json(200, file_bridge.roots(MODE))
                return
            root_id = (query.get("root") or [""])[0]
            rel = (query.get("path") or [""])[0]
            if parsed.path == "/api/files/list":
                hidden = (query.get("hidden") or ["0"])[0] in ("1", "true", "yes")
                result = file_bridge.list_dir(MODE, root_id, rel, hidden=hidden)
                if not result.get("ok"):
                    status = result.get("code") if isinstance(result.get("code"), int) else 500
                    self._send_json(status, result)
                    return
                self._send_json(200, result)
                return
            result = file_bridge.read_file(MODE, root_id, rel)
            if not result.get("ok"):
                status = result.get("code") if isinstance(result.get("code"), int) else 500
                self._send_json(status, result)
                return
            safe_name = "".join(ch for ch in str(result["name"]) if ch not in '"\r\n\\').strip() or "aether-file"
            ascii_name = safe_name.encode("ascii", "ignore").decode("ascii").strip() or "aether-file"
            self._send_bytes(200, result["data"], result["mime"], {
                "Content-Disposition": "inline; filename=\"%s\"; filename*=UTF-8''%s"
                % (ascii_name, quote(safe_name, safe="")),
            }, cache="no-store")
            return
        if parsed.path in ("/api/gallery/list", "/api/gallery/file"):
            if not self._host_is_local():
                self._send_json(403, {"ok": False, "error": "仅允许本机访问"})
                return
            if not self._token_ok():
                self._send_json(401, {"ok": False, "error": "令牌无效或缺失"})
                return
            query = parse_qs(parsed.query)
            if parsed.path == "/api/gallery/list":
                refresh = (query.get("refresh") or ["0"])[0] in ("1", "true", "yes")
                self._send_json(200, gallery.list_images(MODE, refresh=refresh))
                return
            value = (query.get("id") or [""])[0]
            result = gallery.read_image(MODE, value)
            if not result.get("ok"):
                status = result.get("code") if isinstance(result.get("code"), int) else 500
                self._send_json(status, result)
                return
            safe_name = "".join(ch for ch in str(result["name"]) if ch not in '"\r\n\\')
            ascii_name = safe_name.encode("ascii", "ignore").decode("ascii") or "aether-image"
            self._send_bytes(200, result["data"], result["mime"], {
                "Content-Disposition": "inline; filename=\"%s\"; filename*=UTF-8''%s"
                % (ascii_name, quote(safe_name, safe="")),
            })
            return
        if parsed.path.startswith("/api/"):
            self._send_json(404, {"ok": False, "error": "未知接口"})
            return
        target = self._safe_static_path()
        if not target:
            self.send_error(404, "Not found")
            return
        self._send_file(target)

    def do_HEAD(self):
        if self.path.startswith("/api/"):
            self.send_error(405, "Method not allowed")
            return
        target = self._safe_static_path()
        if not target:
            self.send_error(404, "Not found")
            return
        mime = MIME.get(target.suffix.lower(), "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(target.stat().st_size))
        self.end_headers()

    def _linux_exec_for(self, distro):
        def execute(command, cwd, timeout):
            limit = min(int(timeout or CMD_TIMEOUT) + 10, 180)
            return run_command(distro, command, cwd, timeout=limit)
        return execute

    def _handle_studio(self, body):
        distro = str(body.get("distro") or ("alpine" if MODE == "ish" else "ubuntu")).strip()
        action = str(body.get("action") or "run").strip().lower()
        linux_exec = self._linux_exec_for(distro)
        if action == "probe":
            result = studio.probe_studio(MODE, distro, linux_exec=linux_exec)
            self._send_json(200, result)
            return
        if action not in ("run", "debug"):
            self._send_json(400, {"ok": False, "error": "未知操作：%s" % action})
            return
        if not SEMAPHORE.acquire(blocking=False):
            self._send_json(429, {"ok": False, "error": "并发任务过多，请稍后再试"})
            return
        try:
            result = studio.run_studio(
                body.get("lang"),
                body.get("code"),
                action,
                body.get("breakpoint"),
                MODE,
                distro,
                linux_exec=linux_exec,
                timeout=body.get("timeout") or 90,
            )
        finally:
            SEMAPHORE.release()
        if not result.get("ok"):
            status = result.get("code") if isinstance(result.get("code"), int) and 400 <= result["code"] < 600 else 500
            self._send_json(status, result)
            return
        self._send_json(200, result)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path not in ("/api/exec", "/api/studio", "/api/files/write",
                               "/api/files/mkdir", "/api/files/rename", "/api/files/delete"):
            self._send_json(404, {"ok": False, "error": "未知接口"})
            return
        if not self._host_is_local():
            self._send_json(403, {"ok": False, "error": "仅允许本机访问"})
            return
        if not self._token_ok():
            self._send_json(401, {"ok": False, "error": "令牌无效或缺失"})
            return
        if parsed.path == "/api/files/write":
            try:
                length = int(self.headers.get("Content-Length") or "0")
            except ValueError:
                length = 0
            if length < 0 or length > MAX_FILE_BODY:
                self._send_json(400, {"ok": False, "error": "文件超过 64 MB"})
                return
            try:
                data = self.rfile.read(length)
            except OSError as exc:
                self._send_json(400, {"ok": False, "error": "上传中断：%s" % exc})
                return
            if len(data) != length:
                self._send_json(400, {"ok": False, "error": "上传不完整"})
                return
            query = parse_qs(parsed.query)
            root_id = (query.get("root") or [""])[0]
            rel = (query.get("path") or [""])[0]
            overwrite = (query.get("overwrite") or ["0"])[0] in ("1", "true", "yes")
            result = file_bridge.write_file(MODE, root_id, rel, data, overwrite=overwrite)
            status = 200 if result.get("ok") else (result.get("code") if isinstance(result.get("code"), int) else 500)
            self._send_json(status, result)
            return
        limit = MAX_STUDIO_BODY if parsed.path == "/api/studio" else MAX_BODY
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            length = 0
        if length <= 0 or length > limit:
            self._send_json(400, {"ok": False, "error": "请求体为空或过大"})
            return
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._send_json(400, {"ok": False, "error": "JSON 解析失败"})
            return

        if parsed.path.startswith("/api/files/"):
            root_id = str(body.get("root") or "")
            rel = str(body.get("path") or "")
            if parsed.path == "/api/files/mkdir":
                result = file_bridge.mkdir(MODE, root_id, rel)
            elif parsed.path == "/api/files/rename":
                result = file_bridge.rename(MODE, root_id, rel, str(body.get("name") or ""))
            elif parsed.path == "/api/files/delete":
                result = file_bridge.delete(MODE, root_id, rel, recursive=bool(body.get("recursive")))
            else:
                result = {"ok": False, "error": "未知文件操作", "code": 404}
            status = 200 if result.get("ok") else (result.get("code") if isinstance(result.get("code"), int) else 500)
            self._send_json(status, result)
            return

        if parsed.path == "/api/studio":
            self._handle_studio(body)
            return

        distro = str(body.get("distro") or ("alpine" if MODE == "ish" else "ubuntu")).strip()
        scope = str(body.get("scope") or "distro").strip().lower()
        if scope not in ("distro", "host"):
            self._send_json(400, {"ok": False, "error": "未知执行范围"})
            return
        command = str(body.get("cmd") or "").strip()
        cwd = str(body.get("cwd") or HOME).strip()
        if not command:
            self._send_json(400, {"ok": False, "error": "命令为空"})
            return
        if len(command) > 4000:
            self._send_json(400, {"ok": False, "error": "命令过长"})
            return
        if not cwd.startswith("/") or "\n" in cwd or "\x00" in cwd:
            cwd = HOME

        if not SEMAPHORE.acquire(blocking=False):
            self._send_json(429, {"ok": False, "error": "并发命令过多，请稍后再试"})
            return
        try:
            result = run_command(distro, command, cwd, scope=scope)
        finally:
            SEMAPHORE.release()

        if not result.get("ok"):
            status = result.get("code") if isinstance(result.get("code"), int) and 400 <= result["code"] < 600 else 500
            self._send_json(status, result)
            return
        if result.get("timed_out"):
            self._send_json(504, result)
            return
        self._send_json(200, result)


def main():
    installed = installed_distros()
    print("")
    print("  █ AETHER OS · LOCAL BRIDGE " + VERSION)
    print("  ────────────────────────────────────────────")
    print("  UI      http://%s:%d%s" % (HOST, PORT, "/?skip=1" if os.environ.get("AETHER_SKIP_BOOT") else ""))
    print("  Mode    %s" % MODE.upper())
    print("  Home    %s" % HOME)
    if MODE == "termux":
        print("  Distros %s" % (", ".join(installed) or "未安装（先运行 setup-termux.sh）"))
    elif MODE == "ish":
        print("  Distro  alpine (iSH)")
    else:
        print("  Note    当前平台只提供静态界面，/api/exec 不会执行命令。")
    print("  Token   %s" % TOKEN)
    print("  ────────────────────────────────────────────")
    print("  令牌已保存在 bridge/.aether_token；在 AETHER 终端「真 Linux」里粘贴。")
    print("  保持本终端运行；按 Ctrl+C 停止。")
    print("")
    if HOST not in ("127.0.0.1", "localhost"):
        print("  [安全提示] 正在监听非回环地址；请仅在可信局域网使用。")
        print("")
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        print("无法监听 %s:%d：%s" % (HOST, PORT, exc))
        sys.exit(1)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[bridge] 已停止。")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
