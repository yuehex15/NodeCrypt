# NodeCrypt

A modern real-time chat system with **true end-to-end encryption**, ensuring that neither the server nor any potential man-in-the-middle can access your conversation content.

[中文文档](./README.zh-CN.md)

## Core Concept

NodeCrypt implements a secure communication channel where:

1. **Only the intended recipients can decrypt messages**
2. **The server merely relays encrypted data without access to content**
3. **All cryptographic operations happen client-side**
4. **No encryption keys are ever transmitted in plain text**

### Security Architecture

```
   Client A                 Server                 Client B
     |                        |                       |
     |-- Generate Key Pair -->|                       |
     |                        |---- Key Exchange ---->|
     |<---------------------- Secure Channel -------->|
     |                        |                       |
     |-- Encrypted Message -->|-- Encrypted Message ->|
     |                        |    (Cannot Read)      |
```

## Technology Stack

### Frontend
- **Framework**: Native JavaScript (ES6+ modules)
- **Build Tool**: Vite 
- **Encryption**: Custom NodeCrypt.js implementation
- **UI Design**: Responsive interface with modern design

### Backend
- **Runtime**: Node.js
- **Communication**: WebSocket protocol
- **Encryption**: RSA + AES-256-CBC hybrid encryption
- **Deployment**: Docker + Nginx

### Core Encryption Mechanism
- **Key Exchange**: Elliptic Curve Diffie-Hellman (ECDH)
- **Symmetric Encryption**: AES-256-CBC 
- **Asymmetric Encryption**: RSA (server authentication)
- **End-to-End**: Direct encrypted communication between clients

## Encryption Workflow

1. **Initial Setup**:
   - Each client generates a unique elliptic curve key pair (public/private)
   - Server authenticates itself using RSA signatures

2. **Secure Channel Establishment**:
   - Client A and Client B exchange public keys via the server
   - Both clients independently compute the same shared secret using ECDH
   - This shared secret is never transmitted over the network

3. **Message Encryption**:
   - Messages are encrypted with AES-256-CBC using the shared secret
   - Each message includes a unique initialization vector
   - Message authenticity is verified with HMAC

4. **Private Messaging**:
   - Unique shared keys are established between each pair of users
   - Messages are specifically encrypted for the intended recipient only
   - Server cannot determine message content, only routing information

## Key Features

### 🔒 Security
- **True End-to-End Encryption**: Only intended recipients can decrypt messages
- **Zero-Knowledge Server**: Server only handles encrypted data packets
- **Perfect Forward Secrecy**: New session keys for each conversation
- **Man-in-the-Middle Protection**: RSA server authentication
- **Secure Key Exchange**: ECDH for secure shared key generation
- **XSS Protection**: Content sanitization and HTML escaping

### 💬 Chat Functionality
- Multi-room support (join multiple chat rooms simultaneously)
- Private chat mode (click user avatar to start private chat)
- Image sharing and preview (with drag and zoom support)
- Emoji support
- System notification messages

### 🎨 User Experience
- **Auto Avatar Generation**: SVG avatars based on username
- **Responsive Design**: Works perfectly on desktop and mobile
- **Adjustable Layout**: Resizable sidebar
- **Smart Input**: Auto-height adjustment, multi-line support
- **Unread Notifications**: Badge showing unread count

### 📱 Mobile Optimization
- Touch-friendly UI interactions
- Mobile-specific sidebar with overlay
- Adaptive layout and font sizes
- Prevents page drag and zoom on touch devices

## Implementation Details

### Encryption Class (NodeCrypt.js)

The core encryption logic is implemented in the `NodeCrypt.js` file:

```javascript
// Sample code showing the encryption process (simplified)
class NodeCrypt {
  constructor() {
    // Initialize elliptic curve for ECDH
    this.clientEc = new elliptic('curve25519');
    
    // Generate client keypair
    this.clientKeys = this.clientEc.genKeyPair();
    this.clientPublic = this.clientKeys.getPublic('hex');
    this.clientPrivate = this.clientKeys.getPrivate('hex');
  }
  
  // Establish shared secret with another client
  establishSharedSecret(otherClientPublic) {
    const sharedSecret = this.clientKeys.derive(
      this.clientEc.keyFromPublic(otherClientPublic, 'hex').getPublic()
    );
    return sha256(sharedSecret.toString(16));
  }
  
  // Encrypt message for specific recipient
  encryptClientMessage(message, sharedSecret) {
    const iv = crypto.randomBytes(16);
    const cipher = new ModeOfOperation.cbc(sharedSecret, iv);
    const encrypted = cipher.encrypt(message);
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') };
  }
  
  // Decrypt message from specific sender
  decryptClientMessage(encryptedMessage, sharedSecret) {
    const iv = Buffer.from(encryptedMessage.iv, 'hex');
    const decipher = new ModeOfOperation.cbc(sharedSecret, iv);
    const decrypted = decipher.decrypt(Buffer.from(encryptedMessage.data, 'hex'));
    return decrypted;
  }
}
```

### Client-to-Client Secure Channel

When two clients want to communicate securely:

1. Client A sends its public key to the server
2. Server relays Client A's public key to Client B
3. Client B computes shared secret using Client A's public key and its own private key
4. Client B sends its public key to Client A (via server)
5. Client A computes the same shared secret using Client B's public key and its own private key
6. Both clients now have identical shared secrets without ever transmitting the secret itself

### Message Flow with Encryption

### 2. Chat Display (chat.js)
- Message rendering and type handling
- Image preview modal
- Input field placeholder and auto-height
- Paste plain text processing

### 3. User Interface (ui.js)
- User list rendering
- Mobile UI adaptation
- Login modal management
- Settings panel interaction

### 4. Utility Libraries
- **util.dom.js**: DOM operation wrappers
- **util.string.js**: String handling and HTML escaping
- **util.avatar.js**: Avatar generation
- **util.image.js**: Image processing
- **util.emoji.js**: Emoji picker
- **util.settings.js**: Settings management

## Deployment

### Docker Deployment
- **Dockerfile**: Container configuration
- **start.sh**: Startup script (dynamic RSA key pair generation)
- **Nginx**: Static file serving and WebSocket proxy

## Project Highlights

1. **Security**: True end-to-end encryption where even the server cannot decrypt message content
2. **User Experience**: Modern UI with smooth interactions
3. **Modularity**: Clean separation of concerns with well-organized code modules
4. **Responsiveness**: Fully functional on all device sizes
5. **Extensibility**: Clear module separation, easy to extend functionality

## Getting Started

```bash
# Development mode
npm run dev

# Production build
npm run build

# Docker deployment
docker build -t nodecrypt .
docker run -p 80:80 nodecrypt
```