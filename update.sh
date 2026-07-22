#!/bin/bash
set -e

# ==========================================
# SF9 Project Updater (Preserves Database & Downloads)
# ==========================================

LOG_FILE="$HOME/sf9_updater.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=========================================="
echo " Starting SF9 Update..."
echo " Date: $(date)"
echo " Log file: $LOG_FILE"
echo "=========================================="

# 1. Privileges
if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
  echo "[*] Script running as non-root user. Using sudo for system commands."
else
  SUDO=""
  echo "[*] Script running as root."
fi

# 2. Target Directory Detection
DEFAULT_DIR="/opt/sf9"
if [ -f "./.env" ] && [ -f "./package.json" ]; then
    DEFAULT_DIR="$(pwd)"
fi

read -p "Enter installation directory to update [default: $DEFAULT_DIR]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_DIR}

if [ ! -d "$INSTALL_DIR" ]; then
    echo "[!] Error: Target directory $INSTALL_DIR does not exist."
    echo "[!] Please run install.sh first or specify an existing installation path."
    exit 1
fi

SRC_DIR="$(pwd)"

# 3. Copy/Sync updated code if running from outside the install dir
if [ "$(realpath "$SRC_DIR")" != "$(realpath "$INSTALL_DIR")" ]; then
    echo "[*] Copying updated source files to $INSTALL_DIR (preserving .env & download/)..."
    $SUDO rsync -a --exclude '.env' --exclude 'download' --exclude 'node_modules' --exclude '.next' --exclude 'venv' --exclude '.git' "$SRC_DIR/" "$INSTALL_DIR/"
    TARGET_USER="${SUDO_USER:-$USER}"
    $SUDO chown -R "$TARGET_USER:$TARGET_USER" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR" || exit 1

if [ ! -f ".env" ]; then
    echo "[!] Error: .env file not found in $INSTALL_DIR."
    echo "[!] Cannot update project without database configuration."
    exit 1
fi

# 4. Install Deno if missing for yt-dlp EJS solver
if ! command -v deno &> /dev/null && [ ! -f "/usr/local/bin/deno" ]; then
    echo "[*] Installing Deno for yt-dlp EJS JavaScript solver..."
    curl -fsSL https://deno.land/install.sh | sh || true
    if [ -f "$HOME/.deno/bin/deno" ]; then
        $SUDO cp "$HOME/.deno/bin/deno" /usr/local/bin/ 2>/dev/null || true
    fi
fi

# 5. Find Bun
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(eval echo "~$TARGET_USER")

if [ -f "$TARGET_HOME/.bun/bin/bun" ]; then
    BUN_INSTALL="$TARGET_HOME/.bun"
elif [ -f "$HOME/.bun/bin/bun" ]; then
    BUN_INSTALL="$HOME/.bun"
elif command -v bun &> /dev/null; then
    BUN_BIN="$(which bun)"
    BUN_INSTALL="$(dirname $(dirname "$BUN_BIN"))"
else
    echo "[*] Installing Bun..."
    su - "$TARGET_USER" -c "curl -fsSL https://bun.sh/install | bash" || curl -fsSL https://bun.sh/install | bash
    BUN_INSTALL="$TARGET_HOME/.bun"
fi

export PATH="$BUN_INSTALL/bin:$PATH"

# 5. Dependency installation & Database Schema Sync
echo ""
echo "[*] Updating NPM dependencies..."
rm -f bun.lock
bun install --force

echo "[*] Generating Prisma Client for MySQL..."
bun run db:generate

echo "[*] Applying Database Schema updates (safe push to MySQL)..."
bun run db:push

# 6. Build Next.js Application
echo "[*] Building Next.js application..."
rm -rf venv
bun run build

if [ -d ".next/standalone" ]; then
    echo "[*] Copying static assets to standalone directory..."
    cp -r public .next/standalone/ 2>/dev/null || true
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi

# 7. Python VENV Setup
echo "[*] Updating Python Virtual Environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install curl_cffi requests beautifulsoup4 opencv-python numpy yt-dlp mutagen
deactivate

# 8. Go Decryptor Build
if [ -d "go-decryptor" ]; then
    echo "[*] Rebuilding Go Decryptor..."
    cd go-decryptor
    go build -o decryptor main.go
    cd ..
fi

# 9. Service Restart
echo ""
TARGET_USER="${SUDO_USER:-$USER}"
$SUDO chown -R "$TARGET_USER:$TARGET_USER" "$INSTALL_DIR"

echo "[*] Restarting systemd service sf9..."
if systemctl list-units --full -all | grep -Fq 'sf9.service'; then
    $SUDO systemctl restart sf9
    echo "[+] Service sf9 restarted."
else
    echo "[!] Service sf9 not found in systemd. Skipping service restart."
fi

echo ""
echo "=========================================="
echo " SF9 Project Update Completed! 🚀"
echo "=========================================="
echo " App Directory: $INSTALL_DIR"
echo " Log file:      $LOG_FILE"
echo " Database:      Preserved (MySQL schema synced)"
echo "=========================================="
