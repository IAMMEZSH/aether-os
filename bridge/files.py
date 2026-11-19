"""Local file-system bridge.

Only directories explicitly exposed by this module are reachable. Paths are
resolved inside those roots, symlink escapes are rejected, and token/owner
files are never listed or served.
"""

from __future__ import annotations

import mimetypes
import os
import shutil
import tempfile
import time
from pathlib import Path

MAX_ITEMS = 2000
MAX_READ = 64 * 1024 * 1024
MAX_WRITE = 64 * 1024 * 1024
MAX_NAME = 180
BLOCKED_NAMES = {".aether_token", ".tsowner", "aether_token"}
SKIP_DIRS = {".git", "node_modules", ".thumbnails", "thumbnails", "cache", "Cache"}


def _mode(mode: str):
    if mode in ("termux", "ish"):
        return mode
    if os.name == "nt":
        return "windows"
    return "linux"


def _root_defs(mode: str):
    home = Path(os.path.expanduser("~"))
    mode = _mode(mode)
    defs = []

    def add(root_id, label, path):
        defs.append((root_id, label, Path(path).expanduser()))

    env_paths = os.environ.get("AETHER_FILE_ROOTS", "")
    index = 0
    for raw in env_paths.split(os.pathsep):
        raw = raw.strip()
        if raw:
            add("ext%d" % index, Path(raw).name or raw, raw)
            index += 1

    if mode == "termux":
        shared = home / "storage" / "shared"
        if not shared.is_dir():
            shared = Path("/sdcard")
        add("shared", "手机存储", shared)
        add("downloads", "下载", shared / "Download")
        add("documents", "文档", shared / "Documents")
        add("pictures", "图片", shared / "Pictures")
        add("home", "Termux 主目录", home)
    elif mode == "ish":
        add("home", "iSH 主目录", home)
        add("documents", "文档", home / "Documents")
        add("downloads", "下载", home / "Downloads")
        add("pictures", "图片", home / "Pictures")
    elif mode == "windows":
        add("home", "用户目录", home)
        add("desktop", "桌面", home / "Desktop")
        add("documents", "文档", home / "Documents")
        add("downloads", "下载", home / "Downloads")
        add("pictures", "图片", home / "Pictures")
    else:
        add("home", "用户目录", home)
        add("documents", "文档", home / "Documents")
        add("downloads", "下载", home / "Downloads")
        add("pictures", "图片", home / "Pictures")

    seen = set()
    roots = []
    for root_id, label, path in defs:
        try:
            resolved = path.resolve()
        except OSError:
            continue
        key = str(resolved).lower() if os.name == "nt" else str(resolved)
        if key in seen or not resolved.is_dir():
            continue
        seen.add(key)
        roots.append({"id": root_id, "label": label, "path": str(resolved)})
    return roots


def _roots(mode: str):
    return _root_defs(mode)


def _root(mode: str, root_id: str):
    for item in _roots(mode):
        if item["id"] == root_id:
            return item, Path(item["path"])
    return None, None


def _note(mode: str):
    mode = _mode(mode)
    if mode == "termux":
        return "已连接 Termux 能看到的 Android 共享存储。首次使用请在 Termux 运行 termux-setup-storage 并允许文件访问；这里的增删改会直接作用于手机文件。"
    if mode == "ish":
        return "iSH 只能管理它自己可见的目录（主目录、Documents、Downloads、Pictures）。iOS 不把整个「文件」App 或系统存储交给网页；可先用系统文件选择器导入，或把文件同步进 iSH 目录。"
    if mode == "windows":
        return "已连接 Windows 用户目录与常用文件夹；可通过 AETHER_FILE_ROOTS 增加更多授权目录。"
    return "已连接本机用户目录与常用文件夹。"


def _error(message, code=400):
    return {"ok": False, "error": message, "code": code}


def _blocked(path: Path):
    for part in path.parts:
        if part.lower() in BLOCKED_NAMES:
            return True
    return False


def _clean_rel(rel: str):
    value = str(rel or "").strip().replace("\\", "/")
    if "\x00" in value or value.startswith("/"):
        return None
    parts = [p for p in value.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        return None
    return "/".join(parts)


def _resolve(mode: str, root_id: str, rel: str, must_exist=True):
    item, root_path = _root(mode, root_id)
    if not item or not root_path:
        return None, None, _error("文件来源不存在", 404)
    clean = _clean_rel(rel)
    if clean is None:
        return None, None, _error("路径无效", 400)
    target = (root_path / clean).resolve() if clean else root_path.resolve()
    try:
        target.relative_to(root_path)
    except ValueError:
        return None, None, _error("路径不在授权目录内", 403)
    if _blocked(target):
        return None, None, _error("该文件受保护，不能访问", 403)
    if must_exist and not target.exists():
        return None, None, _error("文件或文件夹不存在", 404)
    return item, target, None


def _safe_label(name: str):
    name = str(name or "").strip()
    if not name or len(name) > MAX_NAME or name in (".", ".."):
        return None
    if any(ch in name for ch in ("/", "\\", "\x00", "\r", "\n")):
        return None
    if name.lower() in BLOCKED_NAMES:
        return None
    return name


def _rel(root_path: Path, target: Path):
    try:
        value = str(target.relative_to(root_path)).replace("\\", "/")
    except ValueError:
        return ""
    return "" if value == "." else value


def roots(mode: str):
    items = []
    for root in _roots(mode):
        entry = dict(root)
        try:
            entry["writable"] = os.access(entry["path"], os.W_OK)
        except OSError:
            entry["writable"] = False
        items.append(entry)
    return {"ok": True, "mode": _mode(mode), "roots": items, "note": _note(mode)}


def list_dir(mode: str, root_id: str, rel: str, hidden=False):
    item, target, err = _resolve(mode, root_id, rel)
    if err:
        return err
    if not target.is_dir():
        return _error("不是文件夹", 400)
    items = []
    truncated = False
    try:
        with os.scandir(target) as scanner:
            for entry in scanner:
                if len(items) >= MAX_ITEMS:
                    truncated = True
                    break
                try:
                    name = entry.name
                    if name.lower() in BLOCKED_NAMES:
                        continue
                    if not hidden and name.startswith("."):
                        continue
                    if entry.is_dir(follow_symlinks=False) and name in SKIP_DIRS and not hidden:
                        continue
                    is_link = entry.is_symlink()
                    try:
                        resolved = Path(entry.path).resolve()
                        resolved.relative_to(Path(item["path"]))
                    except (OSError, ValueError):
                        continue
                    try:
                        is_dir = entry.is_dir(follow_symlinks=True)
                    except OSError:
                        is_dir = False
                    stat = entry.stat(follow_symlinks=True)
                    suffix = "" if is_dir else Path(name).suffix.lower()
                    mime = "inode/directory" if is_dir else (
                        mimetypes.guess_type(name)[0] or "application/octet-stream"
                    )
                    items.append({
                        "name": name,
                        "path": (_rel(Path(item["path"]), resolved)),
                        "type": "folder" if is_dir else "file",
                        "link": is_link,
                        "size": None if is_dir else stat.st_size,
                        "mtime": int(stat.st_mtime * 1000),
                        "ext": suffix.lstrip("."),
                        "mime": mime,
                        "writable": os.access(entry.path, os.W_OK),
                    })
                except OSError:
                    continue
    except PermissionError:
        return _error("没有权限读取此文件夹", 403)
    except OSError as exc:
        return _error("读取文件夹失败：%s" % exc, 500)
    items.sort(key=lambda x: (0 if x["type"] == "folder" else 1, x["name"].casefold()))
    parent = _rel(Path(item["path"]), target.parent) if target != Path(item["path"]) else None
    return {
        "ok": True,
        "root": item["id"],
        "rootLabel": item["label"],
        "path": _rel(Path(item["path"]), target),
        "parent": parent,
        "items": items,
        "truncated": truncated,
        "hidden": bool(hidden),
        "writable": os.access(str(target), os.W_OK),
        "note": _note(mode),
    }


def read_file(mode: str, root_id: str, rel: str):
    item, target, err = _resolve(mode, root_id, rel)
    if err:
        return err
    if target.is_dir():
        return _error("文件夹不能作为文件读取", 400)
    try:
        stat = target.stat()
    except OSError:
        return _error("文件不存在", 404)
    if not target.is_file():
        return _error("不是普通文件", 400)
    if stat.st_size > MAX_READ:
        return _error("文件超过 64 MB，浏览器内预览会占用过多内存", 413)
    try:
        data = target.read_bytes()
    except OSError as exc:
        return _error("读取失败：%s" % exc, 500)
    mime = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
    return {
        "ok": True, "data": data, "mime": mime, "name": target.name,
        "size": len(data), "mtime": int(stat.st_mtime * 1000),
    }


def _lexical(item, rel):
    clean = _clean_rel(rel)
    if clean is None:
        return None
    base = Path(item["path"])
    return base / Path(*clean.split("/")) if clean else base


def write_file(mode: str, root_id: str, rel: str, data: bytes, overwrite=False):
    item, target, err = _resolve(mode, root_id, rel, must_exist=False)
    if err:
        return err
    lexical = _lexical(item, rel)
    if not lexical:
        return _error("路径无效", 400)
    if lexical.is_symlink():
        return _error("不允许通过符号链接写入", 403)
    if not _safe_label(lexical.name):
        return _error("文件名无效", 400)
    if len(data) > MAX_WRITE:
        return _error("文件超过 64 MB", 413)
    parent = lexical.parent
    if not parent.is_dir():
        return _error("目标文件夹不存在", 404)
    if lexical.exists():
        if lexical.is_dir():
            return _error("同名文件夹已存在", 409)
        if not overwrite:
            return _error("同名文件已存在", 409)
    tmp_name = None
    try:
        with tempfile.NamedTemporaryFile(dir=str(parent), prefix=".aether-upload-", delete=False) as tmp:
            tmp.write(data)
            tmp_name = tmp.name
        if lexical.exists():
            try:
                os.chmod(tmp_name, lexical.stat().st_mode & 0o777)
            except OSError:
                pass
        os.replace(tmp_name, lexical)
        tmp_name = None
        stat = lexical.stat()
        return {
            "ok": True, "name": lexical.name,
            "path": _rel(Path(item["path"]), lexical),
            "size": stat.st_size,
            "mtime": int(stat.st_mtime * 1000),
        }
    except OSError as exc:
        return _error("写入失败：%s" % exc, 500)
    finally:
        if tmp_name:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass


def mkdir(mode: str, root_id: str, rel: str):
    item, target, err = _resolve(mode, root_id, rel, must_exist=False)
    if err:
        return err
    lexical = _lexical(item, rel)
    if not lexical:
        return _error("路径无效", 400)
    if lexical.is_symlink():
        return _error("不允许通过符号链接创建文件夹", 403)
    if not _safe_label(lexical.name):
        return _error("文件夹名无效", 400)
    if lexical.exists():
        return _error("同名项目已存在", 409)
    try:
        lexical.mkdir()
        return {"ok": True, "name": lexical.name, "path": _rel(Path(item["path"]), lexical)}
    except OSError as exc:
        return _error("新建文件夹失败：%s" % exc, 500)


def rename(mode: str, root_id: str, rel: str, name: str):
    item, target, err = _resolve(mode, root_id, rel)
    if err:
        return err
    lexical = _lexical(item, rel)
    if not lexical:
        return _error("路径无效", 400)
    new_name = _safe_label(name)
    if not new_name:
        return _error("新名称无效", 400)
    if lexical == Path(item["path"]):
        return _error("不能重命名授权根目录", 400)
    dest = lexical.parent / new_name
    if dest.exists() or dest.is_symlink():
        return _error("同名项目已存在", 409)
    if _blocked(dest):
        return _error("该名称受保护", 403)
    try:
        os.rename(lexical, dest)
        return {"ok": True, "name": new_name, "path": _rel(Path(item["path"]), dest)}
    except OSError as exc:
        return _error("重命名失败：%s" % exc, 500)


def delete(mode: str, root_id: str, rel: str, recursive=False):
    item, target, err = _resolve(mode, root_id, rel)
    if err:
        return err
    lexical = _lexical(item, rel)
    if not lexical:
        return _error("路径无效", 400)
    if lexical == Path(item["path"]):
        return _error("不能删除授权根目录", 400)
    try:
        if lexical.is_symlink() or lexical.is_file():
            lexical.unlink()
        elif lexical.is_dir():
            if not recursive:
                try:
                    lexical.rmdir()
                except OSError:
                    return _error("文件夹不为空，请确认后递归删除", 409)
            else:
                shutil.rmtree(lexical)
        else:
            return _error("不支持的项目类型", 400)
        return {"ok": True}
    except OSError as exc:
        return _error("删除失败：%s" % exc, 500)
