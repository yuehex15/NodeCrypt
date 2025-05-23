FROM docker.1ms.run/node:18-alpine AS backend-builder

WORKDIR /app

# 只复制package.json先安装依赖，利用Docker缓存层
COPY server/package.json ./server/
RUN cd server && npm install --production --no-package-lock --no-audit

# 复制其余服务器代码
COPY server/ ./server/

# 前端构建阶段
FROM docker.1ms.run/node:18-alpine AS frontend-builder

WORKDIR /app

# 复制前端项目依赖和配置文件
COPY package.json package-lock.json* ./
# 安装依赖
RUN npm ci --no-audit || npm install --no-audit

# 复制源代码和配置文件
COPY vite.config.js ./
COPY web/ ./web/

# 构建前端
RUN npm run build:docker

# 第二阶段：极小镜像
FROM docker.1ms.run/alpine:3.16

# 安装最小化版本的Node.js和Nginx
RUN apk add --no-cache nodejs nginx && \
    mkdir -p /app/server /app/web /run/nginx && \
    # 清理apk缓存
    rm -rf /var/cache/apk/*

# 复制服务器文件和静态文件
COPY --from=backend-builder /app/server/node_modules /app/server/node_modules
COPY --from=backend-builder /app/server/*.js /app/server/
# 从前端构建阶段复制构建好的文件，而不是复制dist目录
COPY --from=frontend-builder /app/dist/ /app/web/

# 优化的Nginx配置
RUN cat > /etc/nginx/nginx.conf <<'EOF'
worker_processes 1;
worker_rlimit_nofile 512;
events { 
    worker_connections 128; 
    multi_accept off;
}
http {
    include       mime.types;
    default_type  application/octet-stream;
    
    # 优化设置
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 15;
    types_hash_max_size 1024;
    client_max_body_size 1M;
    client_body_buffer_size 128k;
    
    # 禁用访问日志以减少I/O
    access_log off;
    error_log /dev/null;
    
    # 禁用不需要的功能
    server_tokens off;

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

# 设置低内存环境变量，去除不支持的选项
ENV NODE_OPTIONS="--max-old-space-size=64" \
    NODE_ENV="production"

# 使用前台运行并合并命令减少进程数
CMD ["sh", "-c", "node --expose-gc --unhandled-rejections=strict /app/server/server.js & nginx -g 'daemon off;'"]