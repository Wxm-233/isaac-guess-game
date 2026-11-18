#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  exec node server.mjs
elif [ -x /tmp/isaac-tools/node-v22.16.0-linux-x64/bin/node ]; then
  exec /tmp/isaac-tools/node-v22.16.0-linux-x64/bin/node server.mjs
else
  echo 'Please install Node.js 20+, then run: npm run dev'
  exit 1
fi
