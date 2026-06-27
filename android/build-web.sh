#!/usr/bin/env bash
# Собирает веб (../front) под Android и кладёт бандл в assets/www.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
FRONT="$DIR/../front"
echo "▶ Building web (relative paths + HashRouter)…"
( cd "$FRONT" && PUBLIC_URL=. REACT_APP_HASH_ROUTER=1 npm run build )
DST="$DIR/app/src/main/assets/www"
rm -rf "$DST"; mkdir -p "$DST"
cp -R "$FRONT/build/"* "$DST/"
echo "✓ Веб-бандл → $DST"
