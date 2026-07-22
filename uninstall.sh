#!/bin/bash
set -e

# ==========================================
# SF9 Project Uninstaller
# ==========================================

LOG_FILE="$HOME/sf9_uninstaller.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=========================================="
echo " Starting SF9 Uninstallation..."
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

# 2. Prompting User for Variables
echo ""
echo "--- Configuration ---"
read -p "Enter installation directory to remove [default: $(pwd)]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$(pwd)}

echo ""
read -p "Are you sure you want to completely remove SF9 from $INSTALL_DIR? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Uninstallation aborted."
    exit 0
fi

# 3. Systemd Service
echo ""
echo "[*] Stopping and disabling sf9 systemd service..."
if systemctl list-units --full -all | grep -Fq 'sf9.service'; then
    $SUDO systemctl stop sf9 || true
    $SUDO systemctl disable sf9 || true
    $SUDO rm -f /etc/systemd/system/sf9.service
    $SUDO systemctl daemon-reload
    echo "[+] Systemd service sf9 removed."
else
    echo "[!] Systemd service sf9 not found."
fi

# 4. Remove Files
echo ""
echo "[*] Removing application files from $INSTALL_DIR..."
if [ -d "$INSTALL_DIR" ]; then
    # Safety check: don't delete / or /home or /root
    if [ "$INSTALL_DIR" = "/" ] || [ "$INSTALL_DIR" = "/root" ] || [ "$INSTALL_DIR" = "/home" ] || [ "$INSTALL_DIR" = "$HOME" ]; then
        echo "[!] Refusing to delete system/home directory: $INSTALL_DIR"
        echo "[!] Please remove the application files manually."
    else
        $SUDO rm -rf "$INSTALL_DIR"
        echo "[+] Files removed."
    fi
else
    echo "[!] Directory $INSTALL_DIR not found."
fi

# 5. Caddy Configuration
echo ""
echo "[*] Cleaning up Caddy configuration..."
read -p "Do you want to clear the Caddy configuration (/etc/caddy/Caddyfile)? (y/N): " RESET_CADDY
if [[ "$RESET_CADDY" =~ ^[Yy]$ ]]; then
    if [ -f "/etc/caddy/Caddyfile" ]; then
        $SUDO rm -f /etc/caddy/Caddyfile
        $SUDO systemctl reload caddy || true
        echo "[+] Caddy configuration cleared."
    fi
fi

echo ""
echo "=========================================="
echo " SF9 Project Uninstallation Completed! 🗑️"
echo "=========================================="
echo " Dependencies like Bun, Go, Python, and Caddy were NOT removed."
echo " If you wish to remove them, you can do so manually via apt-get."
echo " Uninstallation Log: $LOG_FILE"
echo "=========================================="
