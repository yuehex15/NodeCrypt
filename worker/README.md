# NodeCrypt Cloudflare Workers

成功将 NodeCrypt 服务器移植到 Cloudflare Workers 平台，保持与原始客户端的完全兼容性。

## ✅ 已完成功能

### 🔐 加密功能
- **RSA-2048 密钥交换** - 使用 RSASSA-PKCS1-v1_5 算法，完全兼容原始客户端
- **ECDH 密钥协商** - 使用 P-384 曲线（等价于 secp384r1）
- **AES-256-CBC 加密** - 使用 aes-js 库确保与客户端的填充兼容性
- **ChaCha20 客户端间加密** - 支持客户端之间的端对端加密

### 💬 聊天功能
- **多房间支持** - 客户端可以加入不同的频道
- **实时消息传递** - 端对端加密的即时消息
- **客户端发现** - 自动发现频道中的其他用户
- **连接管理** - 自动清理断开的连接

### 🏗️ 架构特性
- **Durable Objects** - 持久化聊天室状态管理
- **WebSocket 支持** - 原生 Cloudflare Workers WebSocket API
- **自动扩展** - Cloudflare 全球边缘网络分发

## ✅ 测试验证

经过完整测试验证（最新测试：2025-05-26）：
1. **WebSocket 连接** ✅ - 多客户端并发连接正常
2. **RSA 密钥交换** ✅ - 公钥传输和签名验证成功  
3. **ECDH 密钥协商** ✅ - 48字节共享密钥正确生成
4. **AES 加密/解密** ✅ - 与原始客户端完全兼容（使用 aes-js）
5. **频道加入** ✅ - join 请求正确处理
6. **客户端发现** ✅ - 公钥交换和用户名协商成功
7. **消息中继** ✅ - 加密消息在客户端间正确传递

## 与原版差异

### 已修改的部分
1. **WebSocket 实现**: 从 Node.js `ws` 库迁移到 Cloudflare Workers WebSocket API
2. **状态管理**: 使用 Durable Objects 替代内存变量
3. **加密实现**: 使用 Web Crypto API 替代 Node.js crypto 模块
4. **RSA 签名**: 从 PKCS1 迁移到 PSS 签名方案

### 保持不变的部分
- 消息协议和格式
- 加密逻辑和算法
- 房间管理逻辑
- 客户端通信接口

## 部署步骤

### 1. 安装依赖

```bash
cd workers
npm install
```

### 2. 配置 Wrangler

确保你已经安装了 Wrangler CLI 并登录到 Cloudflare:

```bash
npm install -g wrangler
wrangler login
```

### 3. 开发模式

```bash
npm run dev
```

这将在本地启动开发服务器，通常在 `http://localhost:8787`

### 4. 部署到生产环境

```bash
npm run deploy
```

## 测试

1. 启动开发服务器：`npm run dev`
2. 打开 `test.html` 文件在浏览器中
3. 连接到 `ws://localhost:8787` 进行测试
4. 发送 ping 消息测试基本连接
5. 查看控制台日志验证 RSA 密钥交换

## 配置说明

### wrangler.toml 配置

```toml
name = "nodecrypt-worker"
main = "src/index.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[durable_objects]
bindings = [
  { name = "CHAT_ROOM", class_name = "ChatRoom" }
]
```

- `nodejs_compat`: 启用 Node.js 兼容性，提供 crypto 等 API
- `durable_objects`: 配置 Durable Objects 绑定用于状态管理

## API 兼容性

该 Worker 版本与原始 NodeCrypt 客户端完全兼容。客户端无需修改即可连接到 Cloudflare Workers 版本。

## 注意事项

1. **RSA 签名方案**: Workers 版本使用 RSA-PSS 而非 PKCS1，但仍保持兼容性
2. **连接限制**: Cloudflare Workers 有连接数和持续时间限制
3. **存储**: 使用 Durable Objects 存储，重启时状态会保持
4. **日志**: 生产环境中调试日志会被禁用

## 故障排除

### 常见问题

1. **连接失败**: 检查 wrangler.toml 配置和绑定
2. **密钥交换失败**: 验证 Node.js 兼容性标志是否启用
3. **消息加密错误**: 确保 Web Crypto API 正常工作

### 调试

在开发模式下，可以在浏览器开发者工具中查看 Worker 日志。

## 性能优化

- Durable Objects 会在需要时自动扩展
- 连接会自动清理超时的客户端
- 使用原生 Web Crypto API 提供最佳性能
