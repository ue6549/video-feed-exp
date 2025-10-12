#!/bin/bash
# inspect_ktv_cache.sh - Find and inspect KTVHTTPCache storage

# Find the most recently modified VideoFeedApp simulator cache
CACHE_DIR=$(find ~/Library/Developer/CoreSimulator/Devices \
  -path "*/Containers/Data/Application/*/Library/Caches/com.KTVHTTPCache" \
  -type d \
  -print0 2>/dev/null | xargs -0 ls -td | head -1)

if [ -z "$CACHE_DIR" ]; then
    echo "❌ KTVHTTPCache directory not found"
    echo "Make sure app has run at least once"
    exit 1
fi

echo "📁 Cache Directory:"
echo "$CACHE_DIR"
echo ""

echo "📊 Cache Statistics:"
du -sh "$CACHE_DIR"
echo ""

echo "📂 Cache Contents:"
ls -lh "$CACHE_DIR" | head -20
echo ""

echo "🔍 File Count by Type:"
find "$CACHE_DIR" -type f -name "*.ts" | wc -l | xargs echo "  Video segments (.ts):"
find "$CACHE_DIR" -type f -name "*.m3u8" | wc -l | xargs echo "  Manifests (.m3u8):"
find "$CACHE_DIR" -type f -name "*.idx" | wc -l | xargs echo "  Index files (.idx):"
echo ""

echo "📦 Total Files:"
find "$CACHE_DIR" -type f | wc -l
echo ""

echo "💾 Largest Files:"
find "$CACHE_DIR" -type f -exec ls -lh {} \; | sort -k5 -hr | head -10

