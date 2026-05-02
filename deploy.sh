#!/bin/bash
# FormatRx — one-shot GitHub + Vercel deploy
# Run this from your terminal: bash ~/Desktop/manuscript-formatter/deploy.sh

set -e
cd "$(dirname "$0")"

echo "🚀 FormatRx deploy script"
echo ""

# ── 1. Git init & push ─────────────────────────────────────────────────────
if [ -d ".git" ]; then
  echo "ℹ️  Removing old git state..."
  rm -rf .git
fi

git init
git branch -m main
git config user.email "contact.hues26@gmail.com"
git config user.name "ahilapillai"
git add -A
git commit -m "Initial commit: FormatRx manuscript formatter

- React/Vite frontend (7-step workflow)
- FastAPI backend + Vercel Python serverless (api/)
- Journals: AJSP, Cureus, JMMC
- Side-by-side diff viewer with accept/reject/edit
- Grammar safety gate + compliance checklist"

git remote add origin https://github.com/ahilapillai/FormatRx.git
git push -u origin main --force

echo ""
echo "✅ Pushed to https://github.com/ahilapillai/FormatRx"
echo ""

# ── 2. Vercel deploy ───────────────────────────────────────────────────────
if ! command -v vercel &>/dev/null; then
  echo "📦 Installing Vercel CLI..."
  npm install -g vercel
fi

echo "🌐 Deploying to Vercel..."
vercel --prod --yes

echo ""
echo "🎉 Done! Your live link is shown above."
