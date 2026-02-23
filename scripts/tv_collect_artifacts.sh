#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
OUT_DIR="$ROOT_DIR/release/tv"

mkdir -p "$OUT_DIR"

copy_if_exists() {
  local src="$1"
  if [[ -f "$src" ]]; then
    cp -f "$src" "$OUT_DIR/"
    echo "Copied: $src"
  fi
}

copy_if_exists "$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
copy_if_exists "$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
copy_if_exists "$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"

echo "TV artifacts ready in: $OUT_DIR"
