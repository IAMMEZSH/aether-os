"""Local gallery bridge: scan user-authorized picture folders.

This is deliberately limited to folders the bridge process can read:
- Android/Termux: shared DCIM/Pictures after `termux-setup-storage`.
- Windows: the user's Pictures folders.
- iSH: the app's own Pictures/Documents/Downloads folders; iOS does not expose
  the Photos library to iSH, so those files must be imported by the user.
"""

from __future__ import annotations

import base64
import mimetypes
import os
import platform
import time
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif", ".avif"}
MIME_OVERRIDES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
    ".heic": "image/heic", ".heif": "image/heif", ".avif": "image/avif",
}
MAX_FILE = 32 * 1024 * 1024
MAX_ITEMS = 4000
MAX_DEPTH = 4
SKIP_DIRS = {
    ".thumbnails", ".trash", ".Trash", "thumbnails", "cache", "Cache",
    "node_modules", ".git", ".aether", "Android/data",
}
_CACHE = {"at": 0.0, "items": None, "roots": None, "mode": "", "note": ""}
CACHE_TTL = 12.0


def _roots(mode: str):
    home = Path(os.path.expanduser("~"))
    candidates = []
    env_dirs = os.environ.get("AETHER_GALLERY_DIRS", "")
    for raw in env_dirs.split(os.pathsep):
        raw = raw.strip()
        if raw:
            candidates.append(Path(raw).expanduser())
    if mode == "termux":
        candidates += [
            home / "storage" / "dcim",
            home / "storage" / "pictures",
            Path("/sdcard/DCIM"),
            Path("/sdcard/Pictures"),
            Path("/storage/emulated/0/DCIM"),
            Path("/storage/emulated/0/Pictures"),
        ]
    elif mode == "ish":
        candidates += [home / "Pictures", home / "Documents", home / "Downloads"]
    elif os.name == "nt":
        candidates += [home / "Pictures", home / "OneDrive" / "Pictures"]
    else:
        candidates += [home / "Pictures", home / "Documents"]

    roots = []
    seen = set()
    for item in candidates:
        try:
            resolved = item.resolve()
        except OSError:
            continue
        key = str(resolved).lower() if os.name == "nt" else str(resolved)
        if key in seen:
            continue
        if resolved.is_dir():
            seen.add(key)
            roots.append(resolved)
    return roots


def _mode(mode: str):
    if mode in ("termux", "ish"):
        return mode
    if os.name == "nt":
        return "windows"
    return "linux"


def _note(mode: str):
    if mode == "termux":
        return "已连接 Android 共享存储。首次使用需在 Termux 运行 termux-setup-storage 并允许照片权限。"
    if mode == "ish":
        return "iSH 只能读取你导入到它自己 Pictures/Documents/Downloads 的文件；iOS 不向 iSH 开放「照片」图库，无法自动读取整个系统相册。"
    if mode == "windows":
        return "已扫描 Windows 用户「图片」目录；可通过 AETHER_GALLERY_DIRS 增加更多文件夹。"
    return "已扫描用户图片目录。"


def _file_id(path: Path):
    raw = str(path).encode("utf-8", "surrogatepass")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _from_id(value: str):
    raw = value.strip()
    try:
        raw += "=" * (-len(raw) % 4)
        return Path(base64.urlsafe_b64decode(raw.encode("ascii")).decode("utf-8", "surrogatepass"))
    except Exception:
        return None


def _inside(path: Path, roots):
    try:
        resolved = path.resolve()
    except OSError:
        return None, None
    for root in roots:
        try:
            resolved.relative_to(root)
            return resolved, root
        except ValueError:
            continue
    return None, None


def _iter_images(root: Path):
    root_depth = len(root.parts)
    stack = [root]
    while stack:
        folder = stack.pop()
        try:
            entries = list(os.scandir(folder))
        except OSError:
            continue
        for entry in entries:
            try:
                if entry.name.startswith(".") or entry.name in SKIP_DIRS:
                    continue
                if entry.is_dir(follow_symlinks=False):
                    if len(Path(entry.path).parts) - root_depth < MAX_DEPTH:
                        stack.append(Path(entry.path))
                    continue
                if not entry.is_file(follow_symlinks=False):
                    continue
                suffix = Path(entry.name).suffix.lower()
                if suffix not in IMAGE_EXTS:
                    continue
                stat = entry.stat(follow_symlinks=False)
                if stat.st_size <= 0 or stat.st_size > MAX_FILE:
                    continue
                yield Path(entry.path), stat
            except OSError:
                continue


def list_images(mode: str, refresh: bool = False):
    resolved_mode = _mode(mode)
    now = time.time()
    if (not refresh and _CACHE["items"] is not None and _CACHE["mode"] == resolved_mode
            and now - _CACHE["at"] < CACHE_TTL):
        return {
            "ok": True, "mode": resolved_mode, "roots": _CACHE["roots"],
            "count": len(_CACHE["items"]), "items": _CACHE["items"],
            "note": _CACHE["note"], "cached": True,
        }

    roots = _roots(resolved_mode)
    items = []
    for root in roots:
        for path, stat in _iter_images(root):
            try:
                rel = str(path.relative_to(root)).replace("\\", "/")
                parent = str(path.parent.relative_to(root)).replace("\\", "/")
            except ValueError:
                continue
            items.append({
                "id": _file_id(path),
                "name": path.name,
                "rel": rel,
                "dir": "" if parent == "." else parent,
                "size": stat.st_size,
                "mtime": int(stat.st_mtime * 1000),
                "mime": MIME_OVERRIDES.get(path.suffix.lower(), "image/*"),
            })
            if len(items) >= MAX_ITEMS:
                break
        if len(items) >= MAX_ITEMS:
            break
    items.sort(key=lambda item: item["mtime"], reverse=True)
    roots_view = [str(root) for root in roots]
    note = _note(resolved_mode)
    _CACHE.update({
        "at": now, "items": items, "roots": roots_view,
        "mode": resolved_mode, "note": note,
    })
    return {
        "ok": True, "mode": resolved_mode, "roots": roots_view,
        "count": len(items), "items": items, "note": note,
        "cached": False, "limited": len(items) >= MAX_ITEMS,
    }


def read_image(mode: str, value: str):
    resolved_mode = _mode(mode)
    roots = _roots(resolved_mode)
    if not roots:
        return {"ok": False, "error": "没有可读取的相册目录", "code": 404}
    path = _from_id(value)
    if not path:
        return {"ok": False, "error": "图片标识无效", "code": 400}
    safe_path, root = _inside(path, roots)
    if not safe_path or not root:
        return {"ok": False, "error": "路径不在授权的相册目录内", "code": 403}
    if safe_path.suffix.lower() not in IMAGE_EXTS:
        return {"ok": False, "error": "不是支持的图片格式", "code": 415}
    try:
        stat = safe_path.stat()
    except OSError:
        return {"ok": False, "error": "图片不存在", "code": 404}
    if not safe_path.is_file() or stat.st_size <= 0 or stat.st_size > MAX_FILE:
        return {"ok": False, "error": "图片不可读取或过大", "code": 413}
    try:
        data = safe_path.read_bytes()
    except OSError as exc:
        return {"ok": False, "error": "读取失败：%s" % exc, "code": 500}
    mime = MIME_OVERRIDES.get(safe_path.suffix.lower())
    if not mime:
        mime = mimetypes.guess_type(str(safe_path))[0] or "application/octet-stream"
    return {
        "ok": True,
        "data": data,
        "mime": mime,
        "name": safe_path.name,
        "size": len(data),
        "mtime": int(stat.st_mtime * 1000),
    }
