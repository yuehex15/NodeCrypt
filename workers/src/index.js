import { generateClientId, encryptMessage, decryptMessage, logEvent, isString, isObject, getTime } from './utils.js';

export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }

    // Get or create a Durable Object instance
    const id = env.CHAT_ROOM.idFromName('chat-room');
    const stub = env.CHAT_ROOM.get(id);
    
    return stub.fetch(request);
  }
};

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.clients = new Map();
    this.channels = new Map();
    this.config = {
      seenTimeout: 60000,
      debug: false
    };
    
    // Initialize RSA key pair
    this.initRSAKeyPair();
  }  async initRSAKeyPair() {
    try {
      let stored = await this.state.storage.get('rsaKeyPair');
      if (!stored) {
        console.log('Generating new RSA keypair...');        const keyPair = await crypto.subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256'
          },
          true,
          ['sign', 'verify']
        );

        const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        
        stored = {
          rsaPublic: btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer))),
          rsaPrivateData: Array.from(new Uint8Array(privateKeyBuffer))
        };
        
        await this.state.storage.put('rsaKeyPair', stored);
        console.log('RSA key pair generated and stored');
      }
      
      // Reconstruct the private key
      if (stored.rsaPrivateData) {
        const privateKeyBuffer = new Uint8Array(stored.rsaPrivateData);        stored.rsaPrivate = await crypto.subtle.importKey(
          'pkcs8',
          privateKeyBuffer,
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
          },
          false,
          ['sign']
        );
      }
      
      this.keyPair = stored;
    } catch (error) {
      console.error('Error initializing RSA key pair:', error);
      throw error;
    }
  }  async fetch(request) {
    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }

    // Ensure RSA keys are initialized
    if (!this.keyPair) {
      await this.initRSAKeyPair();
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(webSocket) {
    webSocket.accept();

    // Clean up old connections
    await this.cleanupOldConnections();

    const clientId = generateClientId();
    
    if (!clientId || this.clients.has(clientId)) {
      webSocket.close();
      return;
    }

    logEvent('connection', clientId, 'debug');

    // Store client information
    const clientInfo = {
      webSocket: webSocket,
      seen: getTime(),
      shared: null,
      channel: null
    };
    
    this.clients.set(clientId, clientInfo);

    // Send RSA public key
    try {
      logEvent('sending-public-key', clientId, 'debug');
      webSocket.send(JSON.stringify({
        type: 'server-key',
        key: this.keyPair.rsaPublic
      }));
    } catch (error) {
      logEvent('sending-public-key', error, 'error');
    }

    // Handle messages
    webSocket.addEventListener('message', async (event) => {
      await this.handleMessage(clientId, event.data);
    });

    // Handle connection close
    webSocket.addEventListener('close', async (event) => {
      await this.handleClose(clientId, event);
    });
  }
  async handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    
    if (!isString(message) || !client) {
      return;
    }

    client.seen = getTime();

    if (message === 'ping') {
      this.sendMessage(client.webSocket, 'pong');
      return;
    }

    logEvent('message', [clientId, message], 'debug');    // Handle key exchange
    if (!client.shared && message.length < 2048) {
      try {        // Generate ECDH key pair using P-384 curve (equivalent to secp384r1)
        const keys = await crypto.subtle.generateKey(
          {
            name: 'ECDH',
            namedCurve: 'P-384'
          },
          true,
          ['deriveBits', 'deriveKey']
        );

        const publicKeyBuffer = await crypto.subtle.exportKey('raw', keys.publicKey);
        
        // Sign the public key using PKCS1 padding (compatible with original)
        const signature = await crypto.subtle.sign(
          {
            name: 'RSASSA-PKCS1-v1_5'
          },
          this.keyPair.rsaPrivate,
          publicKeyBuffer
        );        // Convert hex string to Uint8Array for client public key
        const clientPublicKeyHex = message;
        console.log('Client public key length:', clientPublicKeyHex.length);
        
        // P-384 uncompressed point: 1 + 48 + 48 = 97 bytes = 194 hex chars
        // But secp384r1 might be compressed, so let's be more flexible
        if (clientPublicKeyHex.length < 96 || clientPublicKeyHex.length > 200) {
          throw new Error(`Invalid client public key length: ${clientPublicKeyHex.length}`);
        }
        
        const clientPublicKeyBytes = new Uint8Array(clientPublicKeyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        
        // Import client's public key
        const clientPublicKey = await crypto.subtle.importKey(
          'raw',
          clientPublicKeyBytes,
          { name: 'ECDH', namedCurve: 'P-384' },
          false,
          []
        );

        // Derive shared secret bits (equivalent to computeSecret in Node.js)
        const sharedSecretBits = await crypto.subtle.deriveBits(
          {
            name: 'ECDH',
            public: clientPublicKey
          },
          keys.privateKey,
          384 // P-384 produces 48 bytes (384 bits)
        );        // Take bytes 8-40 (32 bytes) for AES-256 key, same as original .slice(8, 40)
        client.shared = new Uint8Array(sharedSecretBits).slice(8, 40);

        logEvent('ECDH-shared-secret', `Full secret length: ${new Uint8Array(sharedSecretBits).length}, key length: ${client.shared.length}, key: ${Array.from(client.shared).map(b => b.toString(16).padStart(2, '0')).join('')}`, 'debug');

        const response = Array.from(new Uint8Array(publicKeyBuffer))
          .map(b => b.toString(16).padStart(2, '0')).join('') + 
          '|' + btoa(String.fromCharCode(...new Uint8Array(signature)));
        
        this.sendMessage(client.webSocket, response);

        logEvent('key-exchange-success', clientId, 'debug');

      } catch (error) {
        logEvent('message-key', [clientId, error.message], 'error');
        client.webSocket.close();
      }
      return;
    }

    // Handle encrypted messages
    if (client.shared && message.length <= (8 * 1024 * 1024)) {
      await this.processEncryptedMessage(clientId, message);
    }
  }

  async processEncryptedMessage(clientId, message) {
    let decrypted = null;

    try {
      const client = this.clients.get(clientId);
      decrypted = await decryptMessage(message, client.shared);

      logEvent('message-decrypted', [clientId, decrypted], 'debug');

      if (!isObject(decrypted) || !isString(decrypted.a)) {
        return;
      }

      const action = decrypted.a;

      if (action === 'j') {
        await this.handleJoinChannel(clientId, decrypted);
      } else if (action === 'c') {
        await this.handleClientMessage(clientId, decrypted);
      } else if (action === 'w') {
        await this.handleChannelMessage(clientId, decrypted);
      }

    } catch (error) {
      logEvent('process-encrypted-message', [clientId, error], 'error');
    } finally {
      decrypted = null;
    }
  }

  async handleJoinChannel(clientId, decrypted) {
    const client = this.clients.get(clientId);
    
    if (!isString(decrypted.p) || client.channel) {
      return;
    }

    try {
      const channel = decrypted.p;
      client.channel = channel;

      if (!this.channels.has(channel)) {
        this.channels.set(channel, [clientId]);
      } else {
        this.channels.get(channel).push(clientId);
      }

      await this.broadcastMemberList(channel);

    } catch (error) {
      logEvent('message-join', [clientId, error], 'error');
    }
  }

  async handleClientMessage(clientId, decrypted) {
    const client = this.clients.get(clientId);
    
    if (!isString(decrypted.p) || !isString(decrypted.c) || !client.channel) {
      return;
    }

    try {
      const channel = client.channel;
      const targetClient = this.clients.get(decrypted.c);

      if (this.isClientInChannel(targetClient, channel)) {
        const messageObj = {
          a: 'c',
          p: decrypted.p,
          c: clientId
        };

        const encrypted = await encryptMessage(messageObj, targetClient.shared);
        this.sendMessage(targetClient.webSocket, encrypted);

        messageObj.p = null;
      }

    } catch (error) {
      logEvent('message-client', [clientId, error], 'error');
    }
  }

  async handleChannelMessage(clientId, decrypted) {
    const client = this.clients.get(clientId);
    
    if (!isObject(decrypted.p) || !client.channel) {
      return;
    }

    try {
      const channel = client.channel;

      for (const member in decrypted.p) {
        const targetClient = this.clients.get(member);

        if (isString(decrypted.p[member]) && this.isClientInChannel(targetClient, channel)) {
          const messageObj = {
            a: 'c',
            p: decrypted.p[member],
            c: clientId
          };

          const encrypted = await encryptMessage(messageObj, targetClient.shared);
          this.sendMessage(targetClient.webSocket, encrypted);

          messageObj.p = null;
        }
      }

    } catch (error) {
      logEvent('message-channel', [clientId, error], 'error');
    }
  }

  async broadcastMemberList(channel) {
    try {
      const members = this.channels.get(channel);

      for (const member of members) {
        const client = this.clients.get(member);

        if (this.isClientInChannel(client, channel)) {
          const filteredMembers = members.filter(value => value !== member);

          const listObj = {
            a: 'l',
            p: filteredMembers
          };

          const encrypted = await encryptMessage(listObj, client.shared);
          this.sendMessage(client.webSocket, encrypted);

          listObj.p = null;
        }
      }
    } catch (error) {
      logEvent('broadcast-member-list', error, 'error');
    }
  }

  async handleClose(clientId, event) {
    logEvent('close', [clientId, event], 'debug');

    const client = this.clients.get(clientId);
    if (!client) return;

    const channel = client.channel;

    if (channel && this.channels.has(channel)) {
      const members = this.channels.get(channel);
      const index = members.indexOf(clientId);
      
      if (index > -1) {
        members.splice(index, 1);
      }

      if (members.length === 0) {
        this.channels.delete(channel);
      } else {
        try {
          for (const member of members) {
            const memberClient = this.clients.get(member);

            if (this.isClientInChannel(memberClient, channel)) {
              const listObj = {
                a: 'l',
                p: members.filter(value => value !== member)
              };

              const encrypted = await encryptMessage(listObj, memberClient.shared);
              this.sendMessage(memberClient.webSocket, encrypted);
            }
          }
        } catch (error) {
          logEvent('close-list', [clientId, error], 'error');
        }
      }
    }

    this.clients.delete(clientId);
  }

  async cleanupOldConnections() {
    const seenThreshold = getTime() - this.config.seenTimeout;

    for (const [clientId, client] of this.clients) {
      if (client.seen < seenThreshold) {
        try {
          logEvent('connection-seen', clientId, 'debug');
          client.webSocket.close();
          this.clients.delete(clientId);
        } catch (error) {
          logEvent('connection-seen', error, 'error');
        }
      }
    }
  }

  isClientInChannel(client, channel) {
    return (
      client &&
      client.webSocket &&
      client.shared &&
      client.channel &&
      client.channel === channel
    );
  }  sendMessage(webSocket, message) {
    try {
      // In Cloudflare Workers, WebSocket.READY_STATE_OPEN is 1
      if (webSocket.readyState === 1) {
        webSocket.send(message);
      }
    } catch (error) {
      logEvent('sendMessage', error, 'error');
    }
  }
}
