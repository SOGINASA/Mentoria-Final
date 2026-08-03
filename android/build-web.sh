#!/usr/bin/env bash
# Собирает веб (../front) под Android и кладёт бандл в assets/www.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
FRONT="$DIR/../front"
API_URL="${REACT_APP_API_URL:-https://foodtrack.beast-inside.kz/bahandi}"
echo "▶ Building web (relative paths + HashRouter)…"
( cd "$FRONT" && PUBLIC_URL=. REACT_APP_HASH_ROUTER=1 REACT_APP_API_URL="$API_URL" npm run build )
DST="$DIR/app/src/main/assets/www"
rm -rf "$DST"; mkdir -p "$DST"
cp -R "$FRONT/build/"* "$DST/"

# WebView открывает index.html через file://, поэтому абсолютные /static/... URL
# дадут белый экран, даже если обычная веб-сборка завершилась без ошибок.
if grep -Eq '(src|href)="/static/' "$DST/index.html"; then
  echo "✗ Android bundle contains absolute /static paths" >&2
  exit 1
fi

echo "✓ Веб-бандл → $DST"
