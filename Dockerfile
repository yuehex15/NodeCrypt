FROM docker.1ms.run/node:18-alpine

WORKDIR /app

COPY server/ ./server/
RUN cd server && npm install
COPY dist/ ./web/

RUN apk add --no-cache nginx && \
    mkdir -p /etc/nginx

RUN cat > /etc/nginx/nginx.conf <<'EOF'
worker_processes  1;
events { worker_connections  1024; }
http {
    include       mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name localhost;

        # Serve static files
        location / {
            root /app/web;
            index index.html;
            try_files $uri $uri/ /index.html;
        }

        # Proxy WebSocket requests to Node.js backend
        location /ws {
            proxy_pass http://127.0.0.1:8088;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
EOF

EXPOSE 80

# 直接启动Node.js服务和Nginx
CMD node /app/server/server.js & nginx -g "daemon off;"