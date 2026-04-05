#!/bin/bash

# Aedra Production Setup Wrapper
# This script is a convenience wrapper for scripts/setup-production.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_SCRIPT="$SCRIPT_DIR/scripts/setup-production.sh"

if [ ! -f "$SETUP_SCRIPT" ]; then
    echo "Error: setup-production.sh not found in $SCRIPT_DIR/scripts/"
    exit 1
fi

chmod +x "$SETUP_SCRIPT"
exec "$SETUP_SCRIPT" "$@"
