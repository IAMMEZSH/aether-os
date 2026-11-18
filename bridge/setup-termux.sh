#!/data/data/com.termux/files/usr/bin/bash
# AETHER OS · Android / Termux 一键准备脚本
# 用法：bash bridge/setup-termux.sh
set -e

echo ""
echo "  AETHER OS · Termux 环境准备"
echo "  ────────────────────────────────────"

if ! command -v pkg >/dev/null 2>&1; then
  echo "  这不是 Termux（找不到 pkg）。请在 F-Droid 或 GitHub 安装 Termux 后重试。"
  exit 1
fi

echo "  [1/4] 更新软件源并安装 python / proot-distro …"
pkg update -y
pkg install -y python proot-distro

echo "  [2/4] 安装 Ubuntu 用户空间（首次约 200–500 MB，视网络而定）…"
if [ ! -d "$PREFIX/var/lib/proot-distro/installed-rootfs/ubuntu" ]; then
  proot-distro install ubuntu
else
  echo "        ubuntu 已存在，跳过。"
fi

echo "  [3/4] 安装 Kali 用户空间（可选，可随时中断）…"
if [ ! -d "$PREFIX/var/lib/proot-distro/installed-rootfs/kali" ]; then
  proot-distro install kali
else
  echo "        kali 已存在，跳过。"
fi

echo "  [4/4] 完成。可选：安装 deepin 自备 rootfs，或保持 Ubuntu/Kali。"
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
  echo "        已尝试获取唤醒锁，减少后台被系统冻结。"
fi

echo ""
echo "  下一步："
echo "    cd ~/aether-os   # 进入本项目目录（按你的实际路径调整）"
echo "    python3 bridge/server.py"
echo ""
echo "  然后在 AETHER OS 终端里点「真 Linux」，令牌从启动输出中复制。"
echo "  提示：Android 下拉通知栏可查看 Termux 唤醒锁；锁屏后命令可能被系统暂停。"
echo ""
