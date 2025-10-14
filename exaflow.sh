#!/bin/bash
# ExaFlow CLI wrapper script for AUR package

set -e

# Get the installation directory
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
PKG_DIR="$(dirname "$SCRIPT_DIR")"

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js is required but not installed."
    echo "Please install Node.js (>=18.0.0) and try again."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if ExaFlow is properly installed
if [ ! -f "$PKG_DIR/lib/node_modules/exaflow/dist/cli.js" ]; then
    echo "❌ Error: ExaFlow package is not properly installed."
    echo "Please reinstall the package."
    exit 1
fi

# Run ExaFlow with Node.js
exec node "$PKG_DIR/lib/node_modules/exaflow/dist/cli.js" "$@"