#!/bin/bash
set -e

# ==========================================
# SF9 Project Installer
# ==========================================

LOG_FILE="$HOME/sf9_installer.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=========================================="
echo " Starting SF9 Installation..."
echo " Date: $(date)"
echo " Log file: $LOG_FILE"
echo "=========================================="

# 1. System Requirements Check
echo "[*] Checking system requirements..."
if ! command -v free &> /dev/null; then
    echo "[!] 'free' command not found. Skipping RAM check."
else
    TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -lt 1000 ]; then
        echo "[!] Warning: Less than 1GB of RAM detected. The build process might fail."
    else
        echo "[+] RAM check passed: ${TOTAL_MEM}MB"
    fi
fi

# 2. Privileges
if [ "$EUID" -ne 0 ]; then
  SUDO="sudo"
  echo "[*] Script running as non-root user. Using sudo for system commands."
else
  SUDO=""
  echo "[*] Script running as root."
fi

# Parse CLI arguments
NON_INTERACTIVE=false
CLI_INSTALL_DIR=""
CLI_DOMAIN=""
CLI_LE_EMAIL=""
CLI_JWT=""
CLI_ADMIN_PASS=""
CLI_MYSQL_LOCAL=""
CLI_DB_HOST=""
CLI_DB_PORT=""
CLI_DB_NAME=""
CLI_DB_USER=""
CLI_DB_PASS=""

for arg in "$@"; do
  case $arg in
    -y|--non-interactive|--yes) NON_INTERACTIVE=true ;;
    --dir=*) CLI_INSTALL_DIR="${arg#*=}" ;;
    --domain=*) CLI_DOMAIN="${arg#*=}" ;;
    --email=*) CLI_LE_EMAIL="${arg#*=}" ;;
    --jwt=*) CLI_JWT="${arg#*=}" ;;
    --admin-pass=*) CLI_ADMIN_PASS="${arg#*=}" ;;
    --mysql-local=*) CLI_MYSQL_LOCAL="${arg#*=}" ;;
    --db-host=*) CLI_DB_HOST="${arg#*=}" ;;
    --db-port=*) CLI_DB_PORT="${arg#*=}" ;;
    --db-name=*) CLI_DB_NAME="${arg#*=}" ;;
    --db-user=*) CLI_DB_USER="${arg#*=}" ;;
    --db-pass=*) CLI_DB_PASS="${arg#*=}" ;;
  esac
done

# 3. Prompting User for Variables
echo ""
echo "--- Configuration ---"
if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_INSTALL_DIR" ]; then
    INSTALL_DIR=${CLI_INSTALL_DIR:-/opt/sf9}
else
    read -p "Enter installation directory [default: /opt/sf9]: " INSTALL_DIR
    INSTALL_DIR=${INSTALL_DIR:-/opt/sf9}
fi

if [ "$(realpath "$INSTALL_DIR")" = "$(realpath "$(pwd)")" ]; then
    echo "[!] Error: You cannot install the project in the same directory as the installer."
    echo "[!] The installer MUST copy the project to a separate folder."
    echo "[!] Please run the script again and specify a different directory."
    exit 1
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_DOMAIN" ]; then
    DOMAIN_NAME=${CLI_DOMAIN:-localhost}
else
    read -p "Enter domain for Caddy (e.g. sf9.example.com) [default: localhost]: " DOMAIN_NAME
    DOMAIN_NAME=${DOMAIN_NAME:-localhost}
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_LE_EMAIL" ]; then
    LE_EMAIL=${CLI_LE_EMAIL:-""}
else
    read -p "Enter email for Let's Encrypt (required for HTTPS, leave blank to skip): " LE_EMAIL
fi

if [ -n "$CLI_JWT" ]; then
    JWT_SECRET="$CLI_JWT"
else
    if [ "$NON_INTERACTIVE" = true ]; then
        JWT_SECRET=""
    else
        read -p "Enter JWT_SECRET [Leave blank to auto-generate]: " JWT_SECRET
    fi
fi
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')
    echo "[+] Generated random JWT_SECRET"
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_ADMIN_PASS" ]; then
    ADMIN_PASSWORD=${CLI_ADMIN_PASS:-admin}
else
    read -p "Enter Admin password [default: admin]: " ADMIN_PASSWORD
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin}
fi
echo "[+] Admin password set."

echo ""
echo "--- MySQL Database Configuration ---"
if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_MYSQL_LOCAL" ]; then
    INSTALL_MYSQL_LOCAL=${CLI_MYSQL_LOCAL:-y}
else
    read -p "Install local MySQL server? (y/n) [default: y]: " INSTALL_MYSQL_LOCAL
    INSTALL_MYSQL_LOCAL=${INSTALL_MYSQL_LOCAL:-y}
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_DB_HOST" ]; then
    DB_HOST=${CLI_DB_HOST:-127.0.0.1}
else
    read -p "Enter MySQL Host [default: 127.0.0.1]: " DB_HOST
    DB_HOST=${DB_HOST:-127.0.0.1}
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_DB_PORT" ]; then
    DB_PORT=${CLI_DB_PORT:-3306}
else
    read -p "Enter MySQL Port [default: 3306]: " DB_PORT
    DB_PORT=${DB_PORT:-3306}
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_DB_NAME" ]; then
    DB_NAME=${CLI_DB_NAME:-sf9_db}
else
    read -p "Enter MySQL Database Name [default: sf9_db]: " DB_NAME
    DB_NAME=${DB_NAME:-sf9_db}
fi

if [ "$NON_INTERACTIVE" = true ] || [ -n "$CLI_DB_USER" ]; then
    DB_USER=${CLI_DB_USER:-sf9_user}
else
    read -p "Enter MySQL Database User [default: sf9_user]: " DB_USER
    DB_USER=${DB_USER:-sf9_user}
fi

if [ -n "$CLI_DB_PASS" ]; then
    DB_PASS="$CLI_DB_PASS"
else
    if [ "$NON_INTERACTIVE" = true ]; then
        DB_PASS=""
    else
        read -p "Enter MySQL Database Password [Leave blank to auto-generate]: " DB_PASS
    fi
fi
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9')
    echo "[+] Generated random MySQL Database password: $DB_PASS"
fi

# 4. Install Dependencies
echo ""
echo "[*] Updating package lists..."
$SUDO apt-get update -y

echo "[*] Installing system dependencies (curl, git, rsync, python3, python3-venv, python3-pip, golang, ffmpeg, zip, tar, etc)..."
$SUDO apt-get install -y curl git rsync python3 python3-venv python3-pip golang ffmpeg libgl1 debian-keyring debian-archive-keyring apt-transport-https zip tar

if [[ "$INSTALL_MYSQL_LOCAL" =~ ^[Yy]$ ]]; then
    echo "[*] Installing MySQL server..."
    $SUDO apt-get install -y default-mysql-server || $SUDO apt-get install -y mysql-server
    $SUDO systemctl enable mysql || $SUDO systemctl enable mariadb || true
    $SUDO systemctl start mysql || $SUDO systemctl start mariadb || true

    echo "[*] Setting up local MySQL database and user..."
    $SUDO mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || true
    $SUDO mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';" || true
    $SUDO mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" || true
    $SUDO mysql -e "ALTER USER '${DB_USER}'@'%' IDENTIFIED BY '${DB_PASS}';" || true
    $SUDO mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';" || true
    $SUDO mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'%';" || true
    $SUDO mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';" || true
    $SUDO mysql -e "FLUSH PRIVILEGES;" || true
    echo "[+] Local MySQL database '${DB_NAME}' and user '${DB_USER}' configured."
fi

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME=$(eval echo "~$TARGET_USER")

# Install Bun
if [ -f "$TARGET_HOME/.bun/bin/bun" ]; then
    echo "[+] Found Bun for $TARGET_USER at $TARGET_HOME/.bun/bin/bun"
    BUN_INSTALL="$TARGET_HOME/.bun"
elif [ -f "$HOME/.bun/bin/bun" ]; then
    echo "[+] Found Bun at $HOME/.bun/bin/bun"
    BUN_INSTALL="$HOME/.bun"
elif command -v bun &> /dev/null; then
    BUN_BIN="$(which bun)"
    BUN_INSTALL="$(dirname $(dirname "$BUN_BIN"))"
    echo "[+] Found system Bun at $BUN_BIN"
else
    echo "[*] Installing Bun..."
    su - "$TARGET_USER" -c "curl -fsSL https://bun.sh/install | bash" || curl -fsSL https://bun.sh/install | bash
    BUN_INSTALL="$TARGET_HOME/.bun"
    echo "[+] Bun installed at $BUN_INSTALL"
fi

export PATH="$BUN_INSTALL/bin:$PATH"

# Install Caddy
if ! command -v caddy &> /dev/null; then
    echo "[*] Installing Caddy..."
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | $SUDO gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | $SUDO tee /etc/apt/sources.list.d/caddy-stable.list
    $SUDO apt-get update -y
    $SUDO apt-get install caddy -y
    echo "[+] Caddy installed."
else
    echo "[+] Caddy is already installed."
fi

# 5. Application Setup
echo ""
echo "--- Setting up application ---"
echo "[*] Copying files to $INSTALL_DIR..."
$SUDO mkdir -p "$INSTALL_DIR"
$SUDO rsync -a --exclude 'node_modules' --exclude '.next' --exclude 'venv' --exclude '.git' . "$INSTALL_DIR/"
$SUDO chown -R "$TARGET_USER:$TARGET_USER" "$INSTALL_DIR"
cd "$INSTALL_DIR" || exit 1

echo "[*] Creating .env file..."
cat > .env <<EOF
DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}
JWT_SECRET=${JWT_SECRET}
EOF

# Bun Install & Build
echo "[*] Installing NPM dependencies via Bun..."
rm -f bun.lock
bun install --force

echo "[*] Generating Prisma Client..."
bun run db:generate

echo "[*] Pushing Database Schema..."
bun run db:push

echo "[*] Seeding Admin User..."
ADMIN_PASSWORD="$ADMIN_PASSWORD" bun run scripts/seed-admin.ts

echo "[*] Building Next.js project..."
rm -rf venv
bun run build

if [ -d ".next/standalone" ]; then
    echo "[*] Copying static assets to standalone directory..."
    cp -r public .next/standalone/ 2>/dev/null || true
    mkdir -p .next/standalone/.next
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi

# Python VENV
echo "[*] Setting up Python Virtual Environment..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install curl_cffi requests beautifulsoup4 opencv-python numpy yt-dlp mutagen
deactivate
echo "[+] Python dependencies installed."

# Go Build
echo "[*] Building Go Decryptor..."
if [ -d "go-decryptor" ]; then
    cd go-decryptor
    go build -o decryptor main.go
    cd ..
    echo "[+] Go Decryptor built."
else
    echo "[!] go-decryptor directory not found, skipping Go build."
fi

# 6. Systemd Service
echo ""
echo "--- Setting up System Services ---"
echo "[*] Creating systemd service for SF9..."
$SUDO bash -c "cat > /etc/systemd/system/sf9.service" <<EOF
[Unit]
Description=SF9 Next.js App
After=network.target

[Service]
Type=simple
User=${SUDO_USER:-$USER}
WorkingDirectory=$INSTALL_DIR
Environment="NODE_ENV=production"
Environment="HOSTNAME=127.0.0.1"
Environment="PATH=$BUN_INSTALL/bin:$INSTALL_DIR/venv/bin:/usr/bin:/bin"
ExecStart=$BUN_INSTALL/bin/bun .next/standalone/server.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

$SUDO chown -R "$TARGET_USER:$TARGET_USER" "$INSTALL_DIR"

$SUDO systemctl daemon-reload
$SUDO systemctl enable sf9
$SUDO systemctl restart sf9
echo "[+] Systemd service sf9 started."

# 7. Caddy Setup
echo "[*] Setting up Caddy..."
if [ -f "Caddyfile" ]; then
    echo "[*] Configuring Caddyfile with domain: $DOMAIN_NAME"
    $SUDO cp Caddyfile /etc/caddy/Caddyfile
    # Replace :81 with domain
    $SUDO sed -i "s/:81/$DOMAIN_NAME/g" /etc/caddy/Caddyfile
    
    # Insert tls directive if email provided and not localhost
    if [ -n "$LE_EMAIL" ] && [ "$DOMAIN_NAME" != "localhost" ]; then
        $SUDO sed -i "/^$DOMAIN_NAME {/a \\\ttls $LE_EMAIL" /etc/caddy/Caddyfile
        echo "[+] Let's Encrypt configured with email: $LE_EMAIL"
    fi

    $SUDO systemctl reload caddy
    echo "[+] Caddy reloaded."
else
    echo "[!] Caddyfile not found locally, skipping Caddy configuration."
fi

echo ""
echo "=========================================="
echo " SF9 Project Installation Completed! 🎉"
echo "=========================================="
echo " App Directory:    $INSTALL_DIR"
if [ "$DOMAIN_NAME" != "localhost" ]; then
    echo " Domain:           https://$DOMAIN_NAME"
else
    echo " Domain:           http://$DOMAIN_NAME"
fi
echo " Service Status:   sudo systemctl status sf9"
echo " Web Server:       sudo systemctl status caddy"
echo " Logs:             sudo journalctl -u sf9 -f"
echo " Installation Log: $LOG_FILE"
echo "=========================================="
