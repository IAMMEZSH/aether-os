"""Code Studio bridge: compile/run/debug a whitelist of languages.

The bridge only runs code the user explicitly sends, inside a temporary
directory.  Paths and tool names are fixed here; nothing from the request is
interpolated into a shell command except through base64 source payloads and
validated integers.
"""

from __future__ import annotations

import base64
import locale
import os
import platform
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

MAX_CODE = 32 * 1024
MAX_DIAGNOSTICS = 40
LANG_NAMES = {
    "js": "JavaScript",
    "py": "Python",
    "c": "C",
    "cpp": "C++",
    "java": "Java",
    "rust": "Rust",
    "go": "Go",
    "php": "PHP",
    "asm": "Assembly",
    "kotlin": "Kotlin",
    "swift": "Swift",
}
SOURCE_NAMES = {
    "js": "main.js",
    "py": "main.py",
    "c": "main.c",
    "cpp": "main.cpp",
    "java": "Main.java",
    "rust": "main.rs",
    "go": "main.go",
    "php": "main.php",
    "asm": "main.asm",
    "kotlin": "Main.kt",
    "swift": "main.swift",
}
TOOL_HINTS = {
    "c": "安装 gcc（Ubuntu: sudo apt install build-essential）",
    "cpp": "安装 g++（Ubuntu: sudo apt install build-essential）",
    "java": "安装 JDK 17+（sudo apt install openjdk-17-jdk）",
    "rust": "安装 rustc（sudo apt install rustc 或 rustup）",
    "go": "安装 Go（sudo apt install golang-go）",
    "php": "安装 PHP CLI（sudo apt install php-cli）",
    "asm": "x86-64 安装 nasm；ARM64 使用 binutils 的 as/ld",
    "py": "安装 python3",
    "js": "安装 Node.js（sudo apt install nodejs）",
    "kotlin": "安装 Kotlin 编译器与 JDK（Termux: pkg install kotlin openjdk-17；桌面: SDKMAN 或官方压缩包）",
    "swift": "安装 Swift 工具链（官方 Linux Swift；Windows 需 Swift for Windows）",
}
ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]")
PATH_RE = re.compile(r"(?:[A-Za-z]:)?[^\s:]+")


def _decode(raw: bytes) -> str:
    if not raw:
        return ""
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        pass
    for enc in (locale.getpreferredencoding(False), "gb18030", "latin-1"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", "replace")


def _clean_output(text: str) -> str:
    text = (
        ANSI_RE.sub("", text or "")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\x08", "")
        .replace("\x00", "")
    )
    # Node's inspect REPL prefixes output with "debug>" sometimes without a
    # newline; drop it so file:line patterns stay parseable.
    text = text.replace("debug>", "")
    drop_prefixes = (
        "Could not find platform independent libraries",
        "Could not find platform dependent libraries",
        "Consider setting $PYTHONHOME",
        "add-auto-load-safe-path",
        "set auto-load safe-path",
        "To enable execution of this file",
        "To completely disable this security protection",
        "For more information about auto-loading",
        "Auto-loading safe path",
        '"Auto-loading safe path"',
        'info "(gdb)Auto-loading safe path"',
        "line to your configuration file",
        "warning: File \"",
        "Missing separate debuginfos",
    )
    keep = []
    for line in text.split("\n"):
        stripped = line.strip()
        if any(stripped.startswith(p) for p in drop_prefixes):
            continue
        keep.append(line)
    return "\n".join(keep).strip("\n")


def _norm_file(value: str) -> str:
    return (value or "").replace("\\", "/").split("/")[-1].strip()


def _severity(value: str) -> str:
    value = (value or "").lower()
    if value in ("warning", "warn"):
        return "warning"
    if value in ("note", "info", "help"):
        return "info"
    return "error"


def parse_diagnostics(lang: str, text: str, source: str, failed: bool = False) -> list:
    """Extract source line/column diagnostics from compiler/runtime output."""
    text = _clean_output(text)
    lines = text.split("\n")
    out = []
    seen = set()
    pending_runtime = []
    debug_stop = any(("Breakpoint hit" in l or "Thread 1 hit Breakpoint" in l or "hit Breakpoint" in l) for l in lines)
    crashed = bool(re.search(r"Program received signal|SIG(SEGV|ABRT|ILL|FPE)|Segmentation fault", text))

    def attach_last(prefix, file_suffix=".js"):
        frames = [d for d in out if d.get("file", "").endswith(file_suffix)]
        if frames:
            frames[-1]["severity"] = "error"
            frames[-1]["message"] = prefix
            return True
        return False

    def add(line, col, sev, msg, file=""):
        try:
            line = int(line)
        except (TypeError, ValueError):
            return
        if line <= 0 or line > 200000:
            return
        try:
            col = int(col) if col not in (None, "") else None
        except (TypeError, ValueError):
            col = None
        if col is not None and (col <= 0 or col > 200000):
            col = None
        msg = re.sub(r"\s+", " ", str(msg or "")).strip()
        if not msg:
            return
        f = _norm_file(file)
        if f and source and f != source and not f.endswith(source):
            # Compiler output can contain absolute paths; keep the source file.
            if source not in (file or ""):
                return
        key = (line, col, sev, msg)
        if key in seen:
            return
        seen.add(key)
        out.append({
            "line": line,
            "column": col,
            "severity": sev,
            "message": msg,
            "file": f or source,
        })

    # GCC / Clang / javac / Go / rustc single-line formats.
    for idx, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("Break on start in "):
            continue
        m = re.match(
            r"^(?P<file>.+?):(?P<line>\d+)(?::(?P<col>\d+))?:\s*"
            r"(?P<sev>fatal error|error|warning|note):\s*(?P<msg>.+)$",
            line, re.I,
        )
        if m:
            add(m.group("line"), m.group("col"), _severity(m.group("sev")),
                m.group("msg"), m.group("file"))
            continue

        # Go: ./main.go:8:2: undefined: x  (no "error:" prefix)
        if lang == "go":
            m = re.match(
                r"^(?P<file>.+?\.go):(?P<line>\d+)(?::(?P<col>\d+))?:\s*(?P<msg>.+)$",
                line, re.I,
            )
            if m and not line.lower().startswith(("go: downloading", "go: finding")):
                add(m.group("line"), m.group("col"), "error", m.group("msg"), m.group("file"))
                continue

        # NASM: main.asm:7: error: ...
        if lang == "asm":
            m = re.match(
                r"^(?P<file>.+?\.(?:asm|s)):(?P<line>\d+):\s*"
                r"(?P<sev>error|warning|fatal):\s*(?P<msg>.+)$",
                line, re.I,
            )
            if m:
                add(m.group("line"), None, _severity(m.group("sev")),
                    m.group("msg"), m.group("file"))
                continue

        # Rust block header: error[E0425]: cannot find value `x`
        m = re.match(r"^(?P<sev>error|warning)(?:\[[^\]]+\])?:\s*(?P<msg>.+)$", line, re.I)
        if m:
            for nxt in lines[idx + 1: idx + 4]:
                loc = re.match(r"^\s*-->\s*(?P<file>.+?):(?P<line>\d+):(?P<col>\d+)", nxt)
                if loc:
                    add(loc.group("line"), loc.group("col"), _severity(m.group("sev")),
                        m.group("msg"), loc.group("file"))
                    break
            continue

        # PHP: Parse error: ... in main.php on line 4
        m = re.search(r"Unclosed\s+['\"](?P<char>.+?)['\"]\s+on\s+line\s+(?P<line>\d+)", line, re.I)
        if m:
            add(m.group("line"), None, "error", "未闭合的 " + m.group("char"), source)
            continue
        m = re.search(
            r"^(?:PHP\s+)?(?:Parse|Fatal|Warning|Notice|Deprecated|Recoverable fatal)\s+error:\s*"
            r"(?P<msg>.+?)\s+in\s+(?P<file>.+?)(?:\s+on\s+line\s+|:)(?P<line>\d+)",
            line, re.I,
        )
        if m:
            sev = "warning" if any(x in line.lower() for x in ("warning", "notice", "deprecated")) else "error"
            if "Unclosed" in m.group("msg"):
                continue
            add(m.group("line"), None, sev, m.group("msg"), m.group("file"))
            continue

        # Python traceback / pdb frames.
        m = re.match(
            r'^\s*File\s+"(?P<file>[^"]+)",\s+line\s+(?P<line>\d+)(?:,\s+in\s+(?P<func>.+))?',
            line,
        )
        if m:
            add(m.group("line"), None, "info",
                "Traceback: " + (m.group("func") or "frame"), m.group("file"))
            continue
        m = re.match(r"^\s*(?P<file>.+?\.py)\((?P<line>\d+)\)", line)
        if m:
            add(m.group("line"), None, "info", "Debugger frame", m.group("file"))
            continue
        m = re.search(r"(?P<file>[\w./\\-]+\.py),?\s+line\s+(?P<line>\d+)", line)
        if m:
            add(m.group("line"), None, "info", "Python frame", m.group("file"))
            continue
        if lang == "py":
            m = re.match(r"^(?P<etype>[A-Za-z_][\w.]*(?:Error|Exception|Exit|Interrupt|Warning)):\s*(?P<msg>.*)$", line)
            if m:
                # Attach the exception text to the deepest frame we saw.
                prev = [d for d in out if d.get("file", "").endswith(source)]
                if prev:
                    prev[-1]["message"] = (m.group("etype") + ": " + m.group("msg")).strip(": ")
                    prev[-1]["severity"] = "error"
                else:
                    add(1, None, "error", m.group("etype") + ": " + m.group("msg"), source)
                continue

        if lang == "js":
            m = re.match(r"^(?P<etype>[A-Za-z_][\w.]*(?:Error|Exception)):\s*(?P<msg>.*)$", line)
            if m:
                pending_runtime.append((m.group("etype") + ": " + m.group("msg")).strip(": "))
                continue

        # Java runtime exception: attach the exception text to the deepest frame.
        if lang == "java":
            m = re.match(r'^(?:Exception in thread "(?:[^"]*)"\s+)?(?P<etype>[A-Za-z_$][\w.$]*(?:Exception|Error)):\s*(?P<msg>.*)$', line)
            if m:
                pending_runtime.append((m.group("etype") + ": " + m.group("msg")).strip(": "))
                continue

        # Kotlin/JVM runtime exception header.
        if lang == "kotlin":
            m = re.match(
                r'^(?:Exception in thread "[^"]*"\s+)?(?P<etype>[A-Za-z_$][\w.$]*(?:Exception|Error))(?::\s*(?P<msg>.*))?$',
                line,
            )
            if m:
                pending_runtime.append((m.group("etype") + ": " + (m.group("msg") or "")).strip(": "))
                continue

        # Swift runtime fatal error: "...: file main.swift, line 3".
        if lang == "swift":
            m = re.search(r"file (?P<file>[\w./\\-]+\.swift), line (?P<line>\d+)", line)
            if m:
                add(m.group("line"), None, "error", line.strip(), m.group("file"))
                continue
            m = re.match(r"^Fatal error:\s*(?P<msg>.+)$", line)
            if m:
                pending_runtime.append("Fatal error: " + m.group("msg").strip())
                continue

        # Rust panic carries its own file:line.
        if lang == "rust":
            m = re.search(r"panicked at (?P<file>.+?\.rs):(?P<line>\d+):(?P<col>\d+)", line)
            if not m:
                m = re.search(r"panicked at .*?,\s*(?P<file>.+?\.rs):(?P<line>\d+):(?P<col>\d+)", line)
            if m:
                add(m.group("line"), m.group("col"), "error", line.strip(), m.group("file"))
                continue

        # Go panic stack line: main.go:5 +0xNN
        if lang == "go":
            m = re.match(r"^panic:\s*(?P<msg>.+)$", line)
            if m:
                pending_runtime.append("panic: " + m.group("msg").strip())
                continue
            m = re.search(r"(?P<file>.+?\.go):(?P<line>\d+)(?::(?P<col>\d+))?\s+\+0x", line)
            if m:
                add(m.group("line"), m.group("col"), "error", "Go panic 位置", m.group("file"))
                continue

        # Node inspect breakpoint line: "break in main.js:3".
        m = re.match(r"^break in (?P<file>.+?\.js):(?P<line>\d+)$", line)
        if m:
            add(m.group("line"), None, "info", "断点命中", m.group("file"))
            continue

        # Node.js stack frames.
        m = re.search(r"\(?(?P<file>[^()\s]+?\.js):(?P<line>\d+):(?P<col>\d+)\)?", line)
        if m and ("at " in line or line.startswith("main.js:")):
            add(m.group("line"), m.group("col"), "info", "Stack frame", m.group("file"))
            continue
        m = re.match(r"^(?P<file>.+?\.js):(?P<line>\d+)$", line)
        if m:
            add(m.group("line"), None, "info", "Node 代码位置", m.group("file"))
            continue

        # GDB frames: #0 main () at main.c:5
        m = re.search(r"(?:#\d+\s+)?(?:0x[0-9a-f]+\s+in\s+)?[^\n]+?\s+\(\)\s+at\s+(?P<file>.+?):(?P<line>\d+)", line)
        if m:
            sev = "info" if debug_stop and not crashed else "error"
            add(m.group("line"), None, sev, "调试器停在 " + line.strip(), m.group("file"))
            continue

        # jdb / phpdbg.
        m = re.search(r"Breakpoint hit:.*line=(?P<line>\d+)", line)
        if m:
            add(m.group("line"), None, "info", "断点命中", source)
            continue
        m = re.search(r"\[1\]\s+.*?\((?P<file>[\w.]+\.java):(?P<line>\d+)\)", line)
        if m:
            sev = "info" if debug_stop and not crashed else "error"
            add(m.group("line"), None, sev,
                "断点命中" if sev == "info" else "Java 调用栈", m.group("file"))
            continue
        m = re.search(r"at\s+.*?\((?P<file>[\w.]+\.java):(?P<line>\d+)\)", line)
        if m:
            sev = "info" if debug_stop and not crashed else "error"
            add(m.group("line"), None, sev,
                "断点命中" if sev == "info" else "Java 调用栈", m.group("file"))
            continue
        m = re.search(r"at\s+.*?\((?P<file>[\w.$]+\.kt):(?P<line>\d+)\)", line)
        if m:
            add(m.group("line"), None, "error", "Kotlin 调用栈", m.group("file"))
            continue
        if lang == "swift":
            m = re.match(r"^\s*(?P<file>[\w./\\-]+\.swift):(?P<line>\d+)(?::(?P<col>\d+))?", line)
            if m:
                add(m.group("line"), m.group("col"), "error", "Swift 代码位置", m.group("file"))
                continue
        m = re.match(r"^>0*(?P<line>\d+):", line)
        if m and lang == "php":
            add(m.group("line"), None, "info", "phpdbg 当前行", source)
            continue
        m = re.search(r"main\.php:(\d+)", line)
        if m and lang == "php":
            add(m.group(1), None, "info", "PHP 调试位置", source)
            continue

    # Attach runtime exception text to the deepest stack frame now that all
    # frames have been parsed (Node/Java put the message before the frames).
    for msg in pending_runtime:
        suffix = {
            "java": ".java", "kotlin": ".kt", "swift": ".swift",
            "js": ".js", "go": ".go",
        }.get(lang, ".go")
        if not attach_last(msg, suffix):
            add(1, None, "error", msg, source)

    # Keep one deepest frame per file; drop it when an error already points at
    # the same line (Node prints a code frame and a stack frame for one error).
    info_by_file = {}
    for d in out:
        if d["severity"] != "info":
            continue
        old = info_by_file.get(d["file"])
        if not old or (d["line"] or 0) >= (old["line"] or 0):
            info_by_file[d["file"]] = d
    error_lines = {(d["line"], d["file"]) for d in out if d["severity"] == "error"}
    out = [d for d in out if d["severity"] != "info"]
    out += [d for d in info_by_file.values() if (d["line"], d["file"]) not in error_lines]

    # Collapse debugger frame info: the deepest error frame is the useful one.
    errors = [d for d in out if d["severity"] == "error"]
    if not errors:
        for d in out:
            if d["severity"] != "info":
                errors.append(d)
                break
    if not errors and failed:
        infos = [d for d in out if d["severity"] == "info"]
        if infos:
            infos[-1]["severity"] = "error"
            infos[-1]["message"] = infos[-1]["message"] + "（程序异常结束）"
            errors.append(infos[-1])
        elif lang in ("c", "cpp", "asm") and re.search(r"SIG(SEGV|ABRT|ILL|FPE)|Segmentation fault", text):
            errors.append({
                "line": None, "column": None, "severity": "error",
                "message": "程序崩溃，但未返回可解析的源码行；请查看调试器输出。",
                "file": source,
            })
        else:
            for raw in reversed(lines):
                line = raw.strip()
                if line and not line.startswith(("__AETHER_", "[")):
                    errors.append({
                        "line": None, "column": None, "severity": "error",
                        "message": line[:500], "file": source,
                    })
                    break
    # Keep explicit error/warning entries first, info last, at most 40.
    order = {"error": 0, "warning": 1, "info": 2}
    out.sort(key=lambda d: (order.get(d["severity"], 3), d["line"] or 10 ** 9))
    return (errors[:1] + [d for d in out if d not in errors[:1]])[:MAX_DIAGNOSTICS]


def _which(name: str):
    return shutil.which(name)


def _tool_map(extra=None):
    names = ["gcc", "g++", "javac", "java", "jdb", "kotlinc", "swiftc", "swift", "lldb",
             "rustc", "go", "php", "phpdbg", "node", "nasm", "as", "ld", "gdb", "python3", "python"]
    tools = {n: bool(_which(n)) for n in names}
    if extra:
        tools.update(extra)
    return tools


def probe_studio(mode: str, distro: str, linux_exec=None):
    arch = platform.machine().lower()
    tools = {}
    if os.name == "nt":
        tools = _tool_map()
        tools["python"] = bool(sys.executable)
        platform_name = "windows"
    elif mode in ("termux", "ish"):
        platform_name = "termux" if mode == "termux" else "ish"
        if not linux_exec:
            return {"ok": True, "available": False, "platform": platform_name, "arch": arch,
                    "tools": {}, "error": "桥接未提供 Linux 执行器"}
        script = (
            "printf 'ARCH:%s\\n' \"$(uname -m)\"\n"
            "for t in gcc g++ javac java jdb kotlinc swiftc swift lldb rustc go php phpdbg node nasm as ld gdb python3 python; do\n"
            "  if command -v \"$t\" >/dev/null 2>&1; then printf 'TOOL:%s:1\\n' \"$t\"; "
            "else printf 'TOOL:%s:0\\n' \"$t\"; fi\n"
            "done\n"
        )
        res = linux_exec(script, os.path.expanduser("~"), 20)
        if not res.get("ok"):
            return {"ok": True, "available": False, "platform": platform_name, "arch": arch,
                    "tools": {}, "error": res.get("error") or "工具链探测失败"}
        for line in (res.get("out") or "").splitlines():
            if line.startswith("ARCH:"):
                arch = line[5:].strip().lower()
            elif line.startswith("TOOL:") and line.count(":") >= 2:
                _, name, value = line.split(":", 2)
                tools[name] = value.strip() == "1"
    else:
        return {"ok": True, "available": False, "platform": "static", "arch": arch,
                "tools": {}, "error": "当前平台没有可用的代码执行环境"}

    if arch in ("arm64", "aarch64"):
        arch_name = "aarch64"
    elif arch in ("i386", "i686", "x86"):
        arch_name = "i386"
    elif arch in ("amd64", "x86_64", "x64"):
        arch_name = "x86_64"
    else:
        arch_name = arch
    asm_ok = bool(tools.get("gcc")) and (
        (arch_name == "x86_64" and tools.get("nasm")) or
        (arch_name in ("aarch64", "i386", "arm") and tools.get("as") and tools.get("ld"))
    )
    return {
        "ok": True,
        "available": True,
        "platform": platform_name,
        "arch": arch_name,
        "tools": tools,
        "langs": {
            "js": bool(tools.get("node")),
            "py": bool(tools.get("python3") or tools.get("python")),
            "c": bool(tools.get("gcc")),
            "cpp": bool(tools.get("g++")),
            "java": bool(tools.get("javac") and tools.get("java")),
            "rust": bool(tools.get("rustc")),
            "go": bool(tools.get("go")),
            "php": bool(tools.get("php")),
            "asm": asm_ok,
            "kotlin": bool(tools.get("kotlinc") and tools.get("java")),
            "swift": bool(tools.get("swiftc")),
        },
        "debug": {
            "c": bool(tools.get("gdb")), "cpp": bool(tools.get("gdb")),
            "rust": bool(tools.get("gdb")), "go": bool(tools.get("gdb")),
            "asm": bool(tools.get("gdb")), "java": bool(tools.get("jdb")),
            "py": bool(tools.get("python3") or tools.get("python")),
            "php": bool(tools.get("phpdbg")), "js": bool(tools.get("node")),
            "kotlin": False, "swift": False,
        },
        "notes": [
            "浏览器 / PWA 本身不能编译 C/C++/Java/Kotlin/Rust/Go/PHP/Swift/汇编，必须经本机桥接调用已安装的工具链。",
            "Kotlin 只编译 JVM 命令行程序，不构建 Android APK，不包含 Android SDK / Gradle；Swift 只编译命令行程序，不构建 iOS App，不包含 Xcode。",
            "Kotlin / Swift 暂未接入自动交互断点，调试按钮会编译运行并解析错误行列；可在宿主机用 jdb / lldb 手动调试。",
            "Android Termux 的 ARM64 环境不能运行 x86-64 汇编；汇编模板会按桥接报告的架构选择。",
        ],
    }


def _hint(lang, missing):
    return TOOL_HINTS.get(lang, "") + (("；缺少：" + "、".join(missing)) if missing else "")


def _source_for(lang, code):
    return SOURCE_NAMES.get(lang, "main.txt")


def _run_proc(args, cwd, timeout, env=None, stdin_data=None):
    started = time.time()
    try:
        proc = subprocess.run(
            args,
            cwd=str(cwd),
            input=stdin_data,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            env=env,
        )
        return {
            "code": proc.returncode,
            "output": _decode((proc.stdout or b"") + (proc.stderr or b"")),
            "ms": int((time.time() - started) * 1000),
            "timed_out": False,
        }
    except subprocess.TimeoutExpired as exc:
        raw = (exc.output or b"") + (exc.stderr or b"")
        return {
            "code": 124,
            "output": _decode(raw) + "\n[studio] 超过 %d 秒，已中止。\n" % timeout,
            "ms": int((time.time() - started) * 1000),
            "timed_out": True,
        }
    except FileNotFoundError as exc:
        return {"code": 127, "output": "找不到命令：%s\n" % exc, "ms": 0, "timed_out": False}
    except Exception as exc:  # noqa: BLE001
        return {"code": 1, "output": "执行失败：%s\n" % exc, "ms": 0, "timed_out": False}


def _interactive(args, cwd, env, waits, timeout, stop_on=None):
    """Run a REPL-style debugger and send commands when prompts appear.

    waits is a list of (needles, payload, seconds) where needles is str or tuple.
    When stop_on appears, terminate the debugger and report a successful stop.
    """
    started = time.time()
    try:
        proc = subprocess.Popen(
            args, cwd=str(cwd), env=env,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
    except FileNotFoundError as exc:
        return {"code": 127, "output": "找不到调试器：%s\n" % exc, "ms": 0, "timed_out": False}
    chunks = []
    lock = threading.Lock()

    def reader():
        while True:
            try:
                # read(4096) can block until the pipe fills on Windows; os.read
                # returns the bytes that are actually available, so prompts are
                # visible immediately.
                chunk = os.read(proc.stdout.fileno(), 4096)
            except Exception:
                break
            if not chunk:
                break
            with lock:
                chunks.append(chunk)

    thread = threading.Thread(target=reader, daemon=True)
    thread.start()

    def snapshot():
        with lock:
            return _decode(b"".join(chunks))

    def wait_for(needles, seconds):
        end = time.time() + seconds
        while time.time() < end:
            text = snapshot()
            if isinstance(needles, str):
                needles = (needles,)
            if any(n and n in text for n in needles):
                return True
            if proc.poll() is not None:
                return False
            time.sleep(0.05)
        return False

    try:
        for needles, payload, seconds in waits:
            wait_for(needles, seconds)
            if proc.poll() is not None:
                break
            try:
                proc.stdin.write(payload.encode("utf-8"))
                proc.stdin.flush()
            except (BrokenPipeError, OSError):
                break
        if stop_on:
            needles = stop_on if isinstance(stop_on, tuple) else (stop_on,)
            hit = wait_for(needles, 5)
            if hit:
                output = _clean_output(snapshot())
                _terminate_tree(proc)
                try:
                    proc.wait(timeout=2)
                except Exception:
                    pass
                thread.join(timeout=1)
                return {
                    "code": 0,
                    "output": output,
                    "ms": int((time.time() - started) * 1000),
                    "timed_out": False,
                }
        # Closing stdin lets REPLs without a quit command (Node inspect) finish
        # instead of waiting for the full timeout and being reported as failed.
        try:
            if proc.stdin and not proc.stdin.closed:
                proc.stdin.close()
        except OSError:
            pass
        deadline = started + (min(timeout, 8) if stop_on else timeout)
        while proc.poll() is None and time.time() < deadline:
            time.sleep(0.05)
        timed_out = proc.poll() is None
        if timed_out:
            try:
                proc.kill()
            except OSError:
                pass
        try:
            proc.wait(timeout=2)
        except Exception:
            pass
        thread.join(timeout=1)
        return {
            "code": 124 if timed_out else (proc.returncode or 0),
            "output": snapshot(),
            "ms": int((time.time() - started) * 1000),
            "timed_out": timed_out,
        }
    finally:
        if proc.poll() is None:
            try:
                proc.kill()
            except OSError:
                pass


def _terminate_tree(proc):
    if proc.poll() is not None:
        return
    if os.name == "nt":
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5,
            )
        except Exception:
            try:
                proc.kill()
            except OSError:
                pass
    else:
        try:
            os.killpg(os.getpgid(proc.pid), 9)
        except OSError:
            try:
                proc.kill()
            except OSError:
                pass


def _windows_tools_ok(lang, action):
    need = {
        "js": ["node"], "py": [sys.executable or "python"],
        "c": ["gcc"], "cpp": ["g++"], "java": ["javac", "java"],
        "kotlin": ["kotlinc", "java"], "swift": ["swiftc"],
        "rust": ["rustc"], "go": ["go"], "php": ["php"], "asm": ["nasm", "gcc"],
    }.get(lang, [])
    missing = []
    for item in need:
        if os.path.isabs(item):
            if not Path(item).exists():
                missing.append(item)
        elif not shutil.which(item):
            missing.append(item)
    return missing


def _run_windows(lang, code, action, bp, timeout):
    missing = _windows_tools_ok(lang, action)
    if missing:
        return {"ok": False, "error": "工具链不完整：" + "、".join(missing), "hint": _hint(lang, missing), "code": 400}

    work = Path(tempfile.mkdtemp(prefix="aether-studio-"))
    source = _source_for(lang, code)
    src = work / source
    src.write_text(code, encoding="utf-8")
    exe = work / "main.exe"
    env = dict(os.environ)
    env.update({"NO_COLOR": "1", "TERM": "dumb", "PYTHONUNBUFFERED": "1", "PYTHONIOENCODING": "utf-8"})
    if lang == "go":
        env["GO111MODULE"] = "off"
    notes = []
    debugger = None
    compile_res = None
    run_res = None
    try:
        if lang in ("js", "py", "php"):
            if lang == "php":
                compile_res = _run_proc([_which("php"), "-l", str(src)], work, timeout, env)
                if compile_res["code"] != 0:
                    output = _clean_output(compile_res["output"])
                    return _result(lang, source, action, compile_res["code"], None, output, "",
                                   compile_res, None, notes, debugger, "windows")
            if action == "debug" and lang == "py":
                debugger = "pdb"
                cmd = [sys.executable or "python", "-m", "pdb", str(src)]
                feed = ""
                if bp:
                    feed += "break %s:%d\n" % (source, bp)
                feed += "continue\nwhere\npp {k: v for k, v in locals().items() if not k.startswith('__')}\nquit\n"
                run_res = _run_proc(cmd, work, timeout, env, feed.encode("utf-8"))
            elif action == "debug" and lang == "php" and bp and _which("phpdbg"):
                debugger = "phpdbg"
                waits = [
                    ("prompt>", "exec %s\n" % source, 5),
                    ("prompt>", "break %d\n" % bp, 5),
                    ("prompt>", "run\n", 5),
                    ((">0", "prompt>"), "ev array_diff_key(get_defined_vars(), array_flip(['GLOBALS','_SERVER','_GET','_POST','_FILES','_COOKIE','_SESSION','_REQUEST','_ENV']))\nback\nquit\n", 8),
                ]
                run_res = _interactive([_which("phpdbg"), "-q"], work, env, waits, timeout)
            elif action == "debug" and lang == "js" and bp:
                debugger = "node inspect"
                waits = [
                    ("debug>", "sb(%d)\n" % bp, 10),
                    ("debug>", "c\n", 2),
                    (("break in %s:%d" % (source, bp), "break in "), "bt\n", 12),
                ]
                run_res = _interactive(
                    [_which("node"), "inspect", source], work, env, waits, timeout,
                    stop_on="break in %s:%d" % (source, bp),
                )
            else:
                cmd = {
                    "js": [ _which("node"), source ],
                    "py": [ sys.executable or "python", "-u", source ],
                    "php": [ _which("php"), "-d", "display_errors=1", "-d", "error_reporting=E_ALL", "-d", "log_errors=0", source ],
                }[lang]
                run_res = _run_proc(cmd, work, timeout, env)
            output = _clean_output("\n".join(x for x in [(compile_res or {}).get("output", ""), run_res.get("output", "")] if x))
            return _result(lang, source, action, run_res.get("code"), None, output, output,
                           compile_res, run_res, notes, debugger, "windows")
        if lang == "java":
            compile_res = _run_proc([_which("javac"), "-encoding", "UTF-8", "-g", "-J-Duser.language=en", str(src)], work, timeout, env)
            if compile_res["code"] != 0:
                output = _clean_output(compile_res["output"])
                return _result(lang, source, action, compile_res["code"], None, output, "", compile_res, None,
                               notes, debugger, "windows")
            if action == "debug" and bp and _which("jdb"):
                debugger = "jdb"
                waits = [
                    ("> ", "stop at %s:%d\n" % ("Main", bp), 8),
                    ("> ", "run\n", 8),
                    (("Breakpoint hit", "Exception", "VM"), "locals\nwhere\nquit\n", 12),
                ]
                run_res = _interactive([_which("jdb"), "-J-Duser.language=en", "-classpath", str(work), "Main"], work, env, waits, timeout)
            else:
                run_res = _run_proc([_which("java"), "-Dfile.encoding=UTF-8", "-cp", str(work), "Main"], work, timeout, env)
            output = _clean_output("\n".join(x for x in [compile_res["output"], run_res.get("output", "")] if x))
            return _result(lang, source, action, run_res.get("code"), None, output, output,
                           compile_res, run_res, notes, debugger, "windows")
        if lang == "kotlin":
            kotlinc = _which("kotlinc")
            jar = work / "main.jar"
            compiler = [kotlinc]
            if kotlinc.lower().endswith((".bat", ".cmd")):
                compiler = [os.environ.get("COMSPEC") or "cmd.exe", "/c", kotlinc]
            compile_res = _run_proc(compiler + [str(src), "-include-runtime", "-d", str(jar)], work, timeout, env)
            if compile_res["code"] != 0:
                output = _clean_output(compile_res["output"])
                return _result(lang, source, action, compile_res["code"], None, output, "", compile_res, None,
                               notes, debugger, "windows")
            if action == "debug":
                notes.append("Kotlin 暂未接入自动交互断点，已编译并直接运行；错误位置仍会解析。")
            run_res = _run_proc([_which("java"), "-Dfile.encoding=UTF-8", "-jar", str(jar)], work, timeout, env)
            output = _clean_output("\n".join(x for x in [compile_res["output"], run_res.get("output", "")] if x))
            return _result(lang, source, action, run_res.get("code"), None, output, output,
                           compile_res, run_res, notes, debugger, "windows")
        if lang == "swift":
            flags = ["-g", "-Onone"] if action == "debug" else ["-O"]
            compile_res = _run_proc([_which("swiftc")] + flags + [str(src), "-o", str(exe)], work, timeout, env)
            if compile_res["code"] != 0:
                output = _clean_output(compile_res["output"])
                return _result(lang, source, action, compile_res["code"], None, output, "", compile_res, None,
                               notes, debugger, "windows")
            if action == "debug":
                notes.append("Swift 暂未接入自动交互断点，已编译并直接运行；错误位置仍会解析。")
            run_res = _run_proc([str(exe)], work, timeout, env)
            output = _clean_output("\n".join(x for x in [compile_res["output"], run_res.get("output", "")] if x))
            return _result(lang, source, action, run_res.get("code"), None, output, output,
                           compile_res, run_res, notes, debugger, "windows")
        if lang == "c":
            compile_cmd = [_which("gcc"), "-std=c17", "-Wall", "-Wextra", "-fdiagnostics-color=never"]
            debug_flags = ["-g", "-O0"] if action == "debug" else ["-O2"]
            compile_res = _run_proc(compile_cmd + debug_flags + [str(src), "-o", str(exe)], work, timeout, env)
        elif lang == "cpp":
            compile_cmd = [_which("g++"), "-std=c++17", "-Wall", "-Wextra", "-fdiagnostics-color=never"]
            debug_flags = ["-g", "-O0"] if action == "debug" else ["-O2"]
            compile_res = _run_proc(compile_cmd + debug_flags + [str(src), "-o", str(exe)], work, timeout, env)
        elif lang == "rust":
            flags = ["-g", "-C", "opt-level=0"] if action == "debug" else ["-O"]
            compile_res = _run_proc([_which("rustc")] + flags + [str(src), "-o", str(exe)], work, timeout, env)
        elif lang == "go":
            flags = ["-gcflags=all=-N -l"] if action == "debug" else []
            compile_res = _run_proc([_which("go"), "build"] + flags + ["-o", str(exe), str(src)], work, timeout, env)
        elif lang == "asm":
            if platform.machine().lower() not in ("amd64", "x86_64"):
                return {"ok": False, "error": "Windows 仅支持 x86-64 汇编", "hint": "请使用 Termux/iSH 的原生架构模板", "code": 400}
            compile_res = _run_proc([_which("nasm"), "-f", "win64", str(src), "-o", str(work / "main.obj")], work, timeout, env)
            if compile_res["code"] == 0:
                compile_res = _run_proc([_which("gcc"), str(work / "main.obj"), "-o", str(exe)], work, timeout, env)
        else:
            return {"ok": False, "error": "未支持的语言", "code": 400}

        if compile_res["code"] != 0:
            output = _clean_output(compile_res["output"])
            return _result(lang, source, action, compile_res["code"], None, output, "", compile_res, None,
                           notes, debugger, "windows")
        if action == "debug" and lang in ("c", "cpp", "rust", "go", "asm") and _which("gdb"):
            debugger = "gdb"
            if bp and lang != "asm":
                break_arg = "%s:%d" % (source, bp)
            elif lang == "go":
                break_arg = "main.main"
            elif lang == "asm":
                break_arg = "main"
            else:
                break_arg = "main"
            run_res = _run_proc([
                _which("gdb"), "-nx", "-batch",
                "-ex", "set pagination off",
                "-ex", "break " + break_arg,
                "-ex", "run", "-ex", "bt", "-ex", "info locals",
                str(exe),
            ], work, timeout, env)
        else:
            if action == "debug" and lang in ("c", "cpp", "rust", "go", "asm"):
                notes.append("未安装 gdb，已改为直接运行；错误定位仍会解析程序输出。")
            run_res = _run_proc([str(exe)], work, timeout, env)
        output = _clean_output("\n".join(x for x in [compile_res["output"], run_res.get("output", "")] if x))
        result = _result(lang, source, action, run_res.get("code"), None, output, output,
                         compile_res, run_res, notes, debugger, "windows")
        if (lang == "asm" and action == "debug" and bp and debugger == "gdb"
                and not result["diagnostics"] and "Breakpoint 1" in output):
            result["diagnostics"] = [{
                "line": bp, "column": None, "severity": "info", "file": source,
                "message": "断点停在汇编入口 main；Windows NASM 调试信息不含源码行号，以上方设定断点行为准",
            }]
            result["notes"] = list(result["notes"]) + [
                "Windows 的 NASM 不支持 DWARF 行号表；需要逐行断点请使用 Termux/iSH 的 Linux 桥接。"
            ]
        return result
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _shq(value: str) -> str:
    return "'" + str(value).replace("'", "'\\''") + "'"


def _write_source_block(source, b64):
    q = _shq(source)
    return (
        f"if command -v base64 >/dev/null 2>&1; then\n"
        f"  printf '%s' '{b64}' | base64 -d > {q}\n"
        f"else\n"
        f"  printf '%s' '{b64}' | openssl base64 -d -A > {q}\n"
        f"fi\n"
    )


def _linux_script(lang, code, action, bp):
    source = _source_for(lang, code)
    b64 = base64.b64encode(code.encode("utf-8")).decode("ascii")
    marker = "__AETHER_" + secrets.token_hex(4) + "_"
    write = _write_source_block(source, b64)
    if lang == "asm":
        # Write both NASM and GNU syntax names; the arch branch selects one.
        write = _write_source_block("main.asm", b64) + _write_source_block("main.s", b64)
    prelude = "PY=python3\ncommand -v python3 >/dev/null 2>&1 || PY=python\n"
    arch_line = "ARCH=$(uname -m 2>/dev/null || echo unknown)\n"

    compile_cmd = ""
    run_cmd = ""
    if lang == "c":
        flags = "-g -O0" if action == "debug" else "-O2"
        compile_cmd = f"gcc -std=c17 -Wall -Wextra -fdiagnostics-color=never {flags} main.c -o main"
        run_cmd = "./main"
    elif lang == "cpp":
        flags = "-g -O0" if action == "debug" else "-O2"
        compile_cmd = f"g++ -std=c++17 -Wall -Wextra -fdiagnostics-color=never {flags} main.cpp -o main"
        run_cmd = "./main"
    elif lang == "java":
        compile_cmd = "javac -encoding UTF-8 -g -J-Duser.language=en Main.java"
        run_cmd = "java -Dfile.encoding=UTF-8 Main"
    elif lang == "kotlin":
        compile_cmd = "kotlinc Main.kt -include-runtime -d main.jar"
        run_cmd = "java -Dfile.encoding=UTF-8 -jar main.jar"
    elif lang == "swift":
        flags = "-g -Onone" if action == "debug" else "-O"
        compile_cmd = f"swiftc {flags} main.swift -o main"
        run_cmd = "./main"
    elif lang == "rust":
        flags = "-g -C opt-level=0" if action == "debug" else "-O"
        compile_cmd = f"rustc {flags} main.rs -o main"
        run_cmd = "./main"
    elif lang == "go":
        flags = '-gcflags="all=-N -l"' if action == "debug" else ""
        compile_cmd = f"GO111MODULE=off go build {flags} -o main main.go"
        run_cmd = "./main"
    elif lang == "php":
        compile_cmd = "php -l main.php"
        run_cmd = "php -d display_errors=1 -d error_reporting=E_ALL -d log_errors=0 main.php"
    elif lang == "py":
        compile_cmd = "$PY -m py_compile main.py"
        run_cmd = "$PY -u main.py"
    elif lang == "js":
        compile_cmd = "node --check main.js"
        run_cmd = "node main.js"
    elif lang == "asm":
        compile_cmd = (
            "case \"$ARCH\" in\n"
            "  x86_64|amd64) nasm -f elf64 -g -F dwarf main.asm -o main.o && gcc -no-pie main.o -o main ;;\n"
            "  aarch64|arm64) as -g main.s -o main.o && gcc -no-pie main.o -o main ;;\n"
            "  armv7l|arm) as -g main.s -o main.o && ld main.o -o main ;;\n"
            "  i386|i686) as --32 -g main.s -o main.o && ld -m elf_i386 main.o -o main ;;\n"
            "  *) echo \"不支持的汇编架构: $ARCH\"; false ;;\n"
            "esac"
        )
        run_cmd = "./main"

    # Debug action replaces the run command where a real debugger is available.
    if action == "debug":
        if lang == "py":
            feed = "continue\\nwhere\\npp {k: v for k, v in locals().items() if not k.startswith('__')}\\nquit\\n"
            if bp:
                feed = "break main.py:%d\\n" % bp + feed
            run_cmd = "printf %b " + _shq(feed) + " | $PY -m pdb main.py"
        elif lang == "java" and bp:
            java_run = "java -Dfile.encoding=UTF-8 Main"
            run_cmd = (
                "if command -v jdb >/dev/null 2>&1; then\n"
                "  ( printf %b " + _shq("stop at Main:%d\\nrun\\n" % bp) + "; sleep 2; "
                "printf %b " + _shq("locals\\nwhere\\nquit\\n") + " ) "
                "| jdb -J-Duser.language=en -classpath . Main\n"
                "else\n"
                "  echo '[studio] jdb 未安装，已改为直接运行'\n"
                f"  {java_run}\n"
                "fi"
            )
        elif lang == "php" and bp:
            php_run = "php -d display_errors=1 -d error_reporting=E_ALL -d log_errors=0 main.php"
            php_vars = (
                "ev array_diff_key(get_defined_vars(), array_flip("
                "['GLOBALS','_SERVER','_GET','_POST','_FILES','_COOKIE','_SESSION','_REQUEST','_ENV']))\\n"
                "back\\nquit\\n"
            )
            run_cmd = (
                "if command -v phpdbg >/dev/null 2>&1; then\n"
                "  ( printf %b " + _shq("exec main.php\\nbreak %d\\nrun\\n" % bp) + "; sleep 2; "
                "printf %b " + _shq(php_vars) + " ) "
                "| phpdbg -q\n"
                "else\n"
                "  echo '[studio] phpdbg 未安装，已改为直接运行'\n"
                f"  {php_run}\n"
                "fi"
            )
        elif lang == "js" and bp:
            node_feed = "sb(%d)\\nc\\n" % bp
            run_cmd = (
                "if command -v node >/dev/null 2>&1; then\n"
                "  ( sleep 2; printf %b " + _shq(node_feed) + "; sleep 2; "
                "printf %b " + _shq("bt\\n") + " ) "
                "| node inspect main.js\n"
                "else\n"
                "  echo '[studio] node 未安装，已改为直接运行'\n"
                "  node main.js\n"
                "fi"
            )
        elif lang == "asm":
            if bp:
                break_expr = f'"break $ASM_SRC:{bp}"'
            else:
                break_expr = '"break main"'
            run_cmd = (
                "if [ \"$ARCH\" = x86_64 ] || [ \"$ARCH\" = amd64 ]; then ASM_SRC=main.asm; else ASM_SRC=main.s; fi\n"
                "if command -v gdb >/dev/null 2>&1; then\n"
                f"  gdb -nx -batch -ex {_shq('set pagination off')} -ex {break_expr} "
                "-ex 'run' -ex 'bt' -ex 'info locals' ./main\n"
                "else\n"
                "  echo '[studio] gdb 未安装，已改为直接运行'\n"
                "  ./main\n"
                "fi\n"
            )
        elif lang in ("c", "cpp", "rust", "go"):
            if bp:
                break_arg = {
                    "c": "main.c:%d" % bp, "cpp": "main.cpp:%d" % bp,
                    "rust": "main.rs:%d" % bp, "go": "main.go:%d" % bp,
                }[lang]
            else:
                break_arg = "main.main" if lang == "go" else "main"
            run_cmd = (
                "if command -v gdb >/dev/null 2>&1; then\n"
                f"  gdb -nx -batch -ex {_shq('set pagination off')} -ex {_shq('break ' + break_arg)} "
                "-ex 'run' -ex 'bt' -ex 'info locals' ./main\n"
                "else\n"
                "  echo '[studio] gdb 未安装，已改为直接运行'\n"
                "  ./main\n"
                "fi\n"
            )
        elif lang == "php":
            run_cmd = "php -d display_errors=1 -d error_reporting=E_ALL -d log_errors=0 main.php"

    script = (
        f"mkdir -p \"$HOME/.aether-studio\" 2>/dev/null\n"
        f"WORK=$(mktemp -d \"$HOME/.aether-studio/run.XXXXXX\") || {{ echo '{marker}WORK_FAIL'; exit 90; }}\n"
        "trap 'rm -rf \"$WORK\"' EXIT INT TERM\n"
        "cd \"$WORK\" || exit 91\n"
        f"{prelude}"
        f"{arch_line}"
        f"{write}"
        f"printf '{marker}COMPILE__\\n'\n"
        f"( {compile_cmd} ) 2>&1\n"
        "rc=$?\n"
        f"printf '{marker}COMPILE_END__%s\\n' \"$rc\"\n"
        "if [ \"$rc\" -eq 0 ]; then\n"
        f"  printf '{marker}RUN__\\n'\n"
        f"  ( {run_cmd} ) 2>&1\n"
        "  rc=$?\n"
        f"  printf '{marker}RUN_END__%s\\n' \"$rc\"\n"
        "else\n"
        f"  printf '{marker}RUN_END__SKIP\\n'\n"
        "fi\n"
    )
    return script, marker, source


def _parse_linux(out, marker):
    compile_out = run_out = ""
    compile_code = run_code = None
    try:
        m = re.search(
            re.escape(marker) + r"COMPILE__\n(.*?)" + re.escape(marker) + r"COMPILE_END__(\S+)\n"
            r"(?:" + re.escape(marker) + r"RUN__\n(.*?)" + re.escape(marker) + r"RUN_END__(\S+))?",
            out, re.S,
        )
        if m:
            compile_out = m.group(1).strip("\n")
            compile_code = 0 if m.group(2) == "0" else int(m.group(2)) if m.group(2).isdigit() else 1
            if m.group(3) is not None:
                run_out = m.group(3).strip("\n")
                if m.group(4) == "SKIP":
                    run_code = None
                else:
                    run_code = 0 if m.group(4) == "0" else int(m.group(4)) if m.group(4).isdigit() else 1
    except (ValueError, TypeError):
        pass
    return compile_out, compile_code, run_out, run_code


def _result(lang, source, action, run_code, debug_line, output, run_output, compile_res, run_res,
            notes, debugger, platform_name):
    compile_code = (compile_res or {}).get("code") if compile_res else None
    success = compile_code in (None, 0) and run_code in (None, 0)
    failed = (compile_code not in (None, 0)) or (run_code not in (None, 0)) or bool((run_res or {}).get("timed_out"))
    diagnostics = parse_diagnostics(lang, output, source, failed=failed)
    if action == "debug" and not debugger and lang in ("c", "cpp", "rust", "go", "asm"):
        notes = list(notes) + ["当前环境没有安装对应的调试器，已执行普通运行并解析错误位置。"]
    return {
        "ok": True,
        "success": success,
        "lang": lang,
        "source": source,
        "action": action,
        "platform": platform_name,
        "compile_code": compile_code,
        "exit_code": run_code,
        "output": output,
        "run_output": run_output,
        "diagnostics": diagnostics,
        "debugger": debugger,
        "notes": notes or [],
        "timed_out": bool((run_res or {}).get("timed_out")),
    }


def _run_linux(lang, code, action, bp, distro, linux_exec, timeout, mode="termux"):
    script, marker, source = _linux_script(lang, code, action, bp)
    res = linux_exec(script, os.path.expanduser("~"), timeout)
    if not res.get("ok"):
        return {"ok": False, "error": res.get("error") or "Linux 执行失败", "code": res.get("code") or 500}
    raw = res.get("out") or ""
    compile_out, compile_code, run_out, run_code = _parse_linux(raw, marker)
    if compile_code is None:
        # The script may have failed before the compile marker (e.g. no base64).
        output = _clean_output(raw)
        return {"ok": True, "success": False, "lang": lang, "source": source, "action": action,
                "platform": mode, "compile_code": 1, "exit_code": None,
                "output": output, "run_output": "", "diagnostics": parse_diagnostics(lang, output, source, failed=True),
                "debugger": None, "notes": ["桥接执行脚本未能完成，请检查工具链。"], "timed_out": False}
    output = _clean_output("\n".join(x for x in (compile_out, run_out) if x))
    debugger = None
    if action == "debug":
        debugger = {
            "py": "pdb", "java": "jdb" if bp else None, "php": "phpdbg" if bp else None,
            "js": "node inspect" if bp else None,
            "c": "gdb", "cpp": "gdb", "rust": "gdb", "go": "gdb", "asm": "gdb",
        }.get(lang)
    notes = []
    if action == "debug" and lang in ("java", "php", "js") and not bp:
        notes.append("未指定断点行，已直接运行并解析运行时错误位置；填写断点行可使用交互调试器。")
    if action == "debug" and lang in ("kotlin", "swift"):
        notes.append("Kotlin / Swift 暂未接入自动交互断点，已编译并直接运行；错误位置仍会解析。可在宿主机用 jdb / lldb 手动调试。")
    if action == "debug" and lang in ("c", "cpp", "rust", "go", "asm") and "gdb 未安装" in compile_out + run_out:
        notes.append("当前环境没有安装 gdb，已改为直接运行并解析错误位置。")
    return _result(lang, source, action, run_code, None, output, run_out, {"code": compile_code}, {
        "code": run_code, "timed_out": res.get("timed_out", False)
    }, notes, debugger, mode)


def run_studio(lang, code, action, breakpoint, mode, distro, linux_exec=None, timeout=90):
    lang = str(lang or "").strip().lower()
    if lang not in LANG_NAMES:
        return {"ok": False, "error": "不支持的语言", "code": 400}
    code = str(code or "")
    if not code.strip():
        return {"ok": False, "error": "代码为空", "code": 400}
    if len(code) > MAX_CODE:
        return {"ok": False, "error": "代码过长（桥接编译上限 32 KB）", "code": 400}
    try:
        bp = int(breakpoint) if breakpoint not in (None, "", 0, "0") else None
    except (TypeError, ValueError):
        bp = None
    if bp is not None and (bp <= 0 or bp > 200000):
        return {"ok": False, "error": "断点行号无效", "code": 400}
    try:
        timeout = max(10, min(int(timeout or 90), 120))
    except (TypeError, ValueError):
        timeout = 90
    if os.name == "nt":
        return _run_windows(lang, code, action, bp, timeout)
    if mode in ("termux", "ish") and linux_exec:
        return _run_linux(lang, code, action, bp, distro, linux_exec, timeout, mode)
    return {"ok": False, "error": "当前平台没有可用的代码执行环境", "code": 501,
            "hint": "请在 Termux/iSH 上运行桥接，或在 Windows 本机运行 bridge/server.py。"}
