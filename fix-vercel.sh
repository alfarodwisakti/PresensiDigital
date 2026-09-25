#!/usr/bin/env bash
set -e
rm -rf node_modules package-lock.json dist .vercel-tmp
npm install
chmod +x node_modules/.bin/* 2>/dev/null || true
echo "22" > .nvmrc
npm run build
git add -A
git commit -m "Fix Vercel build: clean lockfile, .nvmrc, exec perms" --allow-empty
git checkout main 2>/dev/null || git checkout -b main
git push -f origin main