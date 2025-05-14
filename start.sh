#!/bin/sh
key_output=$(node /app/server/key-generate.js)
export NODECRYPT_PRIVATE_KEY=$(echo "$key_output" | grep '^PRIVATE' | cut -d' ' -f2)
export NODECRYPT_PUBLIC_KEY=$(echo "$key_output" | grep '^PUBLIC' | cut -d' ' -f2)
echo "PRIVATE_KEY=$NODECRYPT_PRIVATE_KEY"
echo "PUBLIC_KEY=$NODECRYPT_PUBLIC_KEY"
# 替换 main.js 里的 NODECRYPT_PUBLIC_KEY 为实际公钥
PUB_ESC=$(printf "%s" "$NODECRYPT_PUBLIC_KEY" | sed "s/'/\\\\'/g")
sed -i "s|'NODECRYPT_PUBLIC_KEY'|'$PUB_ESC'|g" /app/web/index.html

node /app/server/server.js &
nginx -g "daemon off;"
