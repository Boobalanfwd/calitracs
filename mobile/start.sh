#!/bin/bash
# Start Expo with raised file descriptor limits (works while watchman installs)
# This bypasses EMFILE on macOS by raising both soft and hard limits

echo "🔧 Raising file descriptor limits..."
ulimit -Sn 65536
ulimit -Hn 65536 2>/dev/null || true

echo "📱 Starting Expo..."
exec npx expo start --clear
