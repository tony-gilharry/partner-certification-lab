#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP="$PROJECT_ROOT/Partner Readiness Lab.app"
CONTENTS="$APP/Contents"
BUILD_DIR="$SCRIPT_DIR/.build"

rm -rf "$BUILD_DIR" "$APP"
mkdir -p "$BUILD_DIR" "$CONTENTS/MacOS" "$CONTENTS/Resources"

npm --prefix "$PROJECT_ROOT" run build

xcrun swiftc \
    -O \
    -target "$(uname -m)-apple-macos12.0" \
    -framework AppKit \
    -framework WebKit \
    -o "$BUILD_DIR/PartnerReadinessLab" \
    "$SCRIPT_DIR/main.swift" \
    "$SCRIPT_DIR/ServerManager.swift"

cp "$BUILD_DIR/PartnerReadinessLab" "$CONTENTS/MacOS/PartnerReadinessLab"
cp "$SCRIPT_DIR/Info.plist" "$CONTENTS/Info.plist"
cp "$SCRIPT_DIR/desktop_server.py" "$CONTENTS/Resources/desktop_server.py"
cp -R "$PROJECT_ROOT/dist" "$CONTENTS/Resources/web"
chmod +x "$CONTENTS/MacOS/PartnerReadinessLab"
codesign --force --sign - "$APP"

printf 'Built %s\n' "$APP"
