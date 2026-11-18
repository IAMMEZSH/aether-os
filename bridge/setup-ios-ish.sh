#!/bin/sh
# AETHER OS · iOS / iSH 一键准备脚本
# 用法：在 iSH 中执行 sh bridge/setup-ios-ish.sh
set -e

echo ""
echo "  AETHER OS · iSH 环境准备"
echo "  ────────────────────────────────────"

if [ ! -f /etc/alpine-release ]; then
  echo "  当前环境不是 iSH（缺少 /etc/alpine-release）。"
  echo "  请从 App Store 免费安装 iSH 后，在 iSH 中打开本项目目录再运行。"
  exit 1
fi

echo "  [1/2] 更新 apk 索引并安装 python3 …"
apk update
apk add python3

echo "  [2/2] 完成。"
echo ""
echo "  下一步："
echo "    cd ~/aether-os   # 进入本项目目录（按 iSH 中的实际路径调整）"
echo "    python3 bridge/server.py"
echo ""
echo "  iOS 限制：切到别的 App 后 iSH 会很快被系统挂起，桥接随之中断。"
echo "  最稳的用法是 iPad 分屏（Safari + iSH 并排），或保持 iSH 在前台。"
echo "  在桌面 Safari 以及已添加到主屏幕的 AETHER 里，均可连接 127.0.0.1:8787。"
echo ""
