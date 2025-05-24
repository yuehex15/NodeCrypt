# NodeCrypt

一个具备**真正端到端加密**功能的现代化实时聊天系统，确保服务器和任何潜在的中间人都无法获取您的对话内容。

[English Documentation](./README.md)

## 核心理念

NodeCrypt实现了一个安全的通信渠道，其中：

1. **只有预期的接收者能够解密消息**
2. **服务器仅转发加密数据，无法访问内容**
3. **所有加密操作都在客户端进行**
4. **加密密钥永远不会以明文形式传输**

### 安全架构

```
   客户端A                 服务器                 客户端B
     |                        |                       |
     |-- 生成密钥对 --------->|                       |
     |                        |---- 密钥交换 -------->|
     |<---------------------- 安全通道 -------------->|
     |                        |                       |
     |-- 加密消息 ----------->|-- 加密消息 ---------->|
     |                        |   (无法读取)          |
```

## 技术架构

### 前端技术栈
- **框架**: 原生 JavaScript (ES6+模块化)
- **构建工具**: Vite 
- **加密库**: 自研 NodeCrypt.js 实现
- **UI设计**: 现代化响应式界面

### 后端技术栈
- **运行时**: Node.js
- **通信协议**: WebSocket
- **加密**: RSA + AES-256-CBC 混合加密
- **部署**: Docker + Nginx

### 核心加密机制
- **密钥交换**: 椭圆曲线 Diffie-Hellman (ECDH)
- **对称加密**: AES-256-CBC 
- **非对称加密**: RSA (服务器身份验证)
- **端到端**: 客户端间直接加密通信

## 加密工作流程

1. **初始设置**:
   - 每个客户端生成唯一的椭圆曲线密钥对（公钥/私钥）
   - 服务器使用RSA签名进行身份验证

2. **安全通道建立**:
   - 客户端A和客户端B通过服务器交换公钥
   - 两个客户端独立计算出相同的共享密钥，使用ECDH算法
   - 这个共享密钥从不在网络上传输

3. **消息加密**:
   - 消息使用共享密钥通过AES-256-CBC进行加密
   - 每条消息包含唯一的初始化向量(IV)
   - 消息真实性通过HMAC验证

4. **私密通信**:
   - 每对用户之间建立唯一的共享密钥
   - 消息专门为预期接收者加密
   - 服务器只能确定消息的路由信息，无法获知消息内容

## 主要功能特性

### 🔒 安全特性
- **真正的端到端加密**: 只有预期接收者可以解密消息
- **零知识服务器**: 服务器只处理加密数据包
- **完美前向保密**: 每次对话使用新的会话密钥
- **中间人攻击防护**: RSA服务器身份验证
- **安全密钥交换**: ECDH用于安全共享密钥生成
- **XSS攻击防护**: 内容净化和HTML转义

### 💬 聊天功能
- 多房间支持（可同时加入多个聊天室）
- 私聊模式（点击用户头像进入私聊）
- 图片发送和预览（支持拖拽缩放）
- 表情符号支持
- 系统通知消息

### 🎨 用户体验
- **自动头像生成**: 基于用户名的 SVG 头像
- **响应式设计**: 完美适配桌面和移动端
- **可调整布局**: 侧边栏宽度可调
- **智能输入框**: 自动高度调整，支持多行输入
- **未读消息提醒**: 红色徽章显示未读数量

### 📱 移动端优化
- 触摸友好的 UI 交互
- 移动端专用侧边栏和遮罩
- 自适应布局和字体大小
- 防止页面拖动和缩放

## 实现细节

### 加密类 (NodeCrypt.js)

核心加密逻辑在`NodeCrypt.js`文件中实现：

```javascript
// 展示加密过程的示例代码（简化版）
class NodeCrypt {
  constructor() {
    // 初始化用于ECDH的椭圆曲线
    this.clientEc = new elliptic('curve25519');
    
    // 生成客户端密钥对
    this.clientKeys = this.clientEc.genKeyPair();
    this.clientPublic = this.clientKeys.getPublic('hex');
    this.clientPrivate = this.clientKeys.getPrivate('hex');
  }
  
  // 与另一个客户端建立共享密钥
  establishSharedSecret(otherClientPublic) {
    const sharedSecret = this.clientKeys.derive(
      this.clientEc.keyFromPublic(otherClientPublic, 'hex').getPublic()
    );
    return sha256(sharedSecret.toString(16));
  }
  
  // 为特定接收者加密消息
  encryptClientMessage(message, sharedSecret) {
    const iv = crypto.randomBytes(16);
    const cipher = new ModeOfOperation.cbc(sharedSecret, iv);
    const encrypted = cipher.encrypt(message);
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
  }
  
  // 解密来自特定发送者的消息
  decryptClientMessage(encryptedMessage, sharedSecret) {
    const iv = Buffer.from(encryptedMessage.iv, 'hex');
    const decipher = new ModeOfOperation.cbc(sharedSecret, iv);
    const decrypted = decipher.decrypt(Buffer.from(encryptedMessage.data, 'hex'));
    return decrypted;
  }
}
```

### 客户端之间的安全通道

当两个客户端想要安全通信时：

1. 客户端A将其公钥发送给服务器
2. 服务器将客户端A的公钥转发给客户端B
3. 客户端B使用客户端A的公钥和自己的私钥计算共享密钥
4. 客户端B将其公钥发送给客户端A（通过服务器）
5. 客户端A使用客户端B的公钥和自己的私钥计算出相同的共享密钥
6. 两个客户端现在拥有相同的共享密钥，而无需在网络上传输密钥本身

### 加密消息流程

### 2. 聊天显示 (chat.js)
- 消息渲染和类型处理
- 图片预览模态框
- 输入框占位符和自动增高
- 粘贴纯文本处理

### 3. 用户界面 (ui.js)
- 用户列表渲染
- 移动端 UI 适配
- 登录模态框管理
- 设置面板交互

### 4. 工具库
- **util.dom.js**: DOM 操作封装
- **util.string.js**: 字符串处理和 HTML 转义
- **util.avatar.js**: 头像生成
- **util.image.js**: 图片处理
- **util.emoji.js**: 表情选择器
- **util.settings.js**: 设置管理

## 部署方案

### Docker 部署
- **Dockerfile**: 容器化配置
- **start.sh**: 启动脚本（动态生成 RSA 密钥对）
- **Nginx**: 静态文件服务和 WebSocket 代理

## 项目亮点

1. **安全性**: 实现了真正的端到端加密，即使服务器也无法解密消息内容
2. **用户体验**: 现代化 UI 设计，流畅的交互体验
3. **技术先进性**: 使用现代 JavaScript 特性，模块化架构
4. **跨平台**: 完美支持桌面和移动端
5. **可扩展性**: 清晰的模块划分，易于功能扩展

## 启动方式

```bash
# 开发模式
npm run dev

# 生产构建
npm run build

# Docker 部署
docker build -t nodecrypt .
docker run -p 80:80 nodecrypt
```
