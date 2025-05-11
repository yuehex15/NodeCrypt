#!/bin/sh
key_output=$(node /app/server/key-generate.js)
export CHATCRYPT_PRIVATE_KEY=$(echo "$key_output" | grep '^PRIVATE' | cut -d' ' -f2)
export CHATCRYPT_PUBLIC_KEY=$(echo "$key_output" | grep '^PUBLIC' | cut -d' ' -f2)
echo "PRIVATE_KEY=$CHATCRYPT_PRIVATE_KEY"
echo "PUBLIC_KEY=$CHATCRYPT_PUBLIC_KEY"
# 替换 main.js 里的 CHATCRYPT_PUBLIC_KEY 为实际公钥
PUB_ESC=$(printf "%s" "$CHATCRYPT_PUBLIC_KEY" | sed "s/'/\\\\'/g")
sed -i "s|'CHATCRYPT_PUBLIC_KEY'|'$PUB_ESC'|g" /app/web/main.js

node /app/server/server.js &
nginx -g "daemon off;"
