#!/usr/bin/env bash
# NSE/BSE AI Trading Terminal — Linux/macOS Setup
set -e

echo ""
echo " ============================================================"
echo "  NSE/BSE AI Trading Terminal — Setup"
echo " ============================================================"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo " [ERROR] Node.js is not installed."
  echo " Please install Node.js 20 LTS from: https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version)")
echo " Node.js found: $NODE_VER"

# Copy .env example
if [ ! -f ".env" ]; then
  echo " Creating .env from template..."
  cp .env.example .env
  echo " [!] Edit .env to add DATABASE_URL and OPENAI_API_KEY."
  echo ""
fi

# Install dependencies
echo " Installing dependencies..."
npm install

echo ""
echo " ============================================================"
echo "  Setup complete!"
echo " ============================================================"
echo ""
echo " To launch:     npm run dev"
echo " To build:      npm run dist"
echo ""
