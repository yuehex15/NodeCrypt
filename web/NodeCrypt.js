import { sha256 } from 'js-sha256';
import { ec as elliptic } from 'elliptic';
import { ModeOfOperation } from 'aes-js';
import chacha from 'js-chacha20';
import { Buffer } from 'buffer';
window.Buffer = Buffer;

class NodeCrypt {
  constructor(config = {}, callbacks = {}) {
    // Update configuration
    this.config = {
      rsaPublic: config.rsaPublic || '',
      wsAddress: config.wsAddress || '',
      reconnectDelay: config.reconnectDelay || 3000,
      pingInterval: config.pingInterval || 20000,
      debug: config.debug || false,
    };

    // Set callbacks
    this.callbacks = {
      onServerClosed: callbacks.onServerClosed || null,
      onServerSecured: callbacks.onServerSecured || null,
      onClientSecured: callbacks.onClientSecured || null,
      onClientList: callbacks.onClientList || null,
      onClientMessage: callbacks.onClientMessage || null,
    };
    
    // Initialize server key storage
    this.SERVER_KEY_STORAGE = 'nodecrypt_server_key';

    // Initialize client elliptic curve
    try {
      this.clientEc = new elliptic('curve25519');
    } catch (error) {
      this.logEvent('constructor', error, 'error');
    }

    // Declarations
    this.serverKeys = null;
    this.serverShared = null;
    this.credentials = null;
    this.connection = null;
    this.reconnect = null;
    this.ping = null;
    this.channel = {};

    // Bindings

    this.setCredentials = this.setCredentials.bind(this);
    this.connect = this.connect.bind(this);
    this.destruct = this.destruct.bind(this);
    this.onOpen = this.onOpen.bind(this);
    this.onMessage = this.onMessage.bind(this);
    this.onError = this.onError.bind(this);
    this.onClose = this.onClose.bind(this);
    this.logEvent = this.logEvent.bind(this);
    this.isOpen = this.isOpen.bind(this);
    this.isClosed = this.isClosed.bind(this);
    this.startReconnect = this.startReconnect.bind(this);
    this.stopReconnect = this.stopReconnect.bind(this);
    this.startPing = this.startPing.bind(this);
    this.stopPing = this.stopPing.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.sendChannelMessage = this.sendChannelMessage.bind(this);
    this.encryptServerMessage = this.encryptServerMessage.bind(this);
    this.decryptServerMessage = this.decryptServerMessage.bind(this);
    this.encryptClientMessage = this.encryptClientMessage.bind(this);
    this.decryptClientMessage = this.decryptClientMessage.bind(this);

  }

  /* =================
      SET CREDENTIALS
     ================= */

  setCredentials ( username, channel, password ) {

    this.logEvent('setCredentials');

    try {

      // Set credentials
      // - username: plaintext (sent only through client to client secured channels - server never receives it)
      // - channel: hashed (sent only through client to server secured channel - server receives it for message routing)
      // - password: hashed (never leaves the client)

      this.credentials = {
        username: username,
        channel: sha256(channel),
        password: sha256(password)
      };

    } catch ( error ) {
      this.logEvent('setCredentials', error, 'error');
      return(false);
    }

    return(true);

  }

  /* =========
      CONNECT
     ========= */

  connect () {

    // Make sure we have credentials

    if (
      ! this.credentials
    ) {
      return(false);
    }

    this.logEvent('connect', this.config.wsAddress);

    // Make sure all timers cleared

    this.stopReconnect();
    this.stopPing();

    // Reset server keys

    this.serverKeys = null;
    this.serverShared = null;

    // Reset channel

    this.channel = {};

    try {

      // Connect to server

      this.connection = new WebSocket(this.config.wsAddress);

      // Set connection event handlers

      this.connection.onopen = this.onOpen;
      this.connection.onmessage = this.onMessage;
      this.connection.onerror = this.onError;
      this.connection.onclose = this.onClose;

    } catch ( error ) {
      this.logEvent('connect', error, 'error');
      return(false);
    }

    return(true);

  }

  /* ==========
      DESTRUCT
     ========== */

  destruct () {

    this.logEvent('destruct');

    // Clear all timers

    this.stopReconnect();
    this.stopPing();

    this.reconnect = null;
    this.ping = null;

    // Reset configuration

    this.config = {
      rsaPublic: '',
      wsAddress: '',
      reconnectDelay: 3000,
      pingInterval: 15000,
      debug: false,
    };

    // Remove callbacks

    this.callbacks.onServerClosed = null;
    this.callbacks.onServerSecured = null;
    this.callbacks.onClientSecured = null;
    this.callbacks.onClientList = null;
    this.callbacks.onClientMessage = null;

    // Remove client elliptic curve

    this.clientEc = null;

    // Remove server keys

    this.serverKeys = null;
    this.serverShared = null;

    // Remove credentials

    this.credentials = null;

    // Remove connection event handlers

    this.connection.onopen = null;
    this.connection.onmessage = null;
    this.connection.onerror = null;
    this.connection.onclose = null;

    try {
      this.connection.removeAllListeners();
    } catch ( error ) {
      this.logEvent('destruct', error, 'error');
    }

    // Close connection

    try {
      this.connection.close();
    } catch ( error ) {
      this.logEvent('destruct', error, 'error');
    }

    // Remove connection

    this.connection = null;

    // Reset channel

    this.channel = {};

    return(true);

  }

  /* =========
      ON OPEN
     ========= */

  async onOpen () {

    this.logEvent('onOpen');
    this.startPing();

    // Generate server ecdh keys
    // Send ecdh public key to server

    try {

      this.serverKeys = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-384' },
        false,
        [ 'deriveKey', 'deriveBits' ]
      );

      this.serverShared = null;

      this.sendMessage(Buffer.from(await crypto.subtle.exportKey('raw', this.serverKeys.publicKey)).toString('hex'));

    } catch ( error ) {
      this.logEvent('onOpen', error, 'error');
    }

  }

  /* ============
      ON MESSAGE
     ============ */
  async onMessage ( event ) {

    if (
      ! event ||
      ! this.isString(event.data)
    ) {
      return;
    }

    // Ignore pong responses

    if (
      event.data === 'pong'
    ) {
      return;
    }

    this.logEvent('onMessage', event.data);

    // 检查是否是服务器公钥消息
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'server-key') {
        const result = await this.handleServerKey(data.key);
        if (!result) {
          return; // 如果服务器密钥处理尚未完成，不继续处理
        }
      }
    } catch (e) {
      // 不是JSON或解析错误，按正常消息处理
    }

    // Receive server ecdh public key

    if (
      ! this.serverShared
    ) {

      const parts = event.data.split('|');

      if (
        ! parts[0] ||
        ! parts[1]
      ) {
        return;
      }

      try {

        // Verify server ecdh public key rsa signature

        if (
          await crypto.subtle.verify(
            { name: 'RSASSA-PKCS1-v1_5' },
            await crypto.subtle.importKey(
              'spki',
              Buffer.from(this.config.rsaPublic, 'base64'),
              { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } },
              false,
              [ 'verify' ]
            ),
            Buffer.from(parts[1], 'base64'),
            Buffer.from(parts[0], 'hex')
          ) === true
        ) {

          // Set server ecdh shared key
          // Just 256 bits required from the possible 384

          this.serverShared = Buffer.from(await crypto.subtle.deriveBits(
            { name: 'ECDH', namedCurve: 'P-384', public: await crypto.subtle.importKey(
              'raw',
              Buffer.from(parts[0], 'hex'),
              { name: 'ECDH', namedCurve: 'P-384' },
              true,
              []
            ) },
            this.serverKeys.privateKey,
            384
          )).slice(8, 40);

          // Send join channel request to server

          this.sendMessage(this.encryptServerMessage({
            a: 'j',
            p: this.credentials.channel
          }, this.serverShared));

          // Server secured callback

          if (
            this.callbacks.onServerSecured
          ) {
            try {
              this.callbacks.onServerSecured();
            } catch ( error ) {
              this.logEvent('onMessage-server-secured-callback', error, 'error');
            }
          }

        }

      } catch ( error ) {
        this.logEvent('onMessage', error, 'error');
      }

      return;

    }

    // Receive encrypted message from server

    const serverDecrypted = this.decryptServerMessage(event.data, this.serverShared);

    this.logEvent('onMessage-server-decrypted', serverDecrypted);

    // Server action is required to continue

    if (
      ! this.isObject(serverDecrypted) ||
      ! this.isString(serverDecrypted.a)
    ) {
      return;
    }

    // Update channel client list

    if (
      serverDecrypted.a === 'l' &&
      this.isArray(serverDecrypted.p)
    ) {

      try {

        // Remove left clients from channel

        for (
          const clientId in this.channel
        ) {
          if (
            serverDecrypted.p.indexOf(clientId) < 0
          ) {
            delete(this.channel[clientId]);
          };
        }

        // Add new clients to channel

        let payloads = {};

        for (
          const clientId of serverDecrypted.p
        ) {
          if (
            ! this.channel[clientId]
          ) {

            // Generate client ecdh keys

            this.channel[clientId] = {
              username: null,
              keys: this.clientEc.genKeyPair(),
              shared: null,
            };

            // Collect their ecdh public keys

            payloads[clientId] = this.channel[clientId].keys.getPublic('hex');

          }
        }

        // Send ecdh public keys to new clients

        if (
          Object.keys(payloads).length > 0
        ) {
          this.sendMessage(this.encryptServerMessage({
            a: 'w',
            p: payloads,
          }, this.serverShared));
        }

      } catch ( error ) {
        this.logEvent('onMessage-list', error, 'error');
      }

      // Client list callback

      if (
        this.callbacks.onClientList
      ) {

        let clients = [];

        for (
          const clientId in this.channel
        ) {
          if (
            this.channel[clientId].shared &&
            this.channel[clientId].username
          ) {
            clients.push({
              clientId: clientId,
              username: this.channel[clientId].username
            });
          }
        }

        try {
          this.callbacks.onClientList(clients);
        } catch ( error ) {
          this.logEvent('onMessage-client-list-callback', error, 'error');
        }

      }

      return;

    }

    // Server payload and client is required to continue

    if (
      ! this.isString(serverDecrypted.p) ||
      ! this.isString(serverDecrypted.c)
    ) {
      return;
    }

    // Receive client ecdh public key
    // May arrive before update channel client list

    if (
      serverDecrypted.a === 'c' && (
        ! this.channel[serverDecrypted.c] ||
        ! this.channel[serverDecrypted.c].shared
      )
    ) {

      try {

        // Add new client to channel

        if (
          ! this.channel[serverDecrypted.c]
        ) {

          // Generate client ecdh keys

          this.channel[serverDecrypted.c] = {
            username: null,
            keys: this.clientEc.genKeyPair(),
            shared: null,
          };

          // Send ecdh public key to new client

          this.sendMessage(this.encryptServerMessage({
            a: 'c',
            p: this.channel[serverDecrypted.c].keys.getPublic('hex'),
            c: serverDecrypted.c
          }, this.serverShared));

        }

        // Set client ecdh shared key scrambled with the hashed password

        this.channel[serverDecrypted.c].shared = Buffer.from(this.xorHex(
          this.channel[serverDecrypted.c].keys.derive(this.clientEc.keyFromPublic(serverDecrypted.p, 'hex').getPublic()).toString('hex').padEnd(64, '8').substr(0, 64),
          this.credentials.password
        ), 'hex');

        // Send username to client

        this.sendMessage(this.encryptServerMessage({
          a: 'c',
          p: this.encryptClientMessage({
            a: 'u',
            p: this.credentials.username
          }, this.channel[serverDecrypted.c].shared),
          c: serverDecrypted.c
        }, this.serverShared));

      } catch ( error ) {
        this.logEvent('onMessage-client', error, 'error');
      }

      return;

    }

    // Receive encrypted message from client

    if (
      serverDecrypted.a === 'c' &&
      this.channel[serverDecrypted.c] &&
      this.channel[serverDecrypted.c].shared
    ) {

      const clientDecrypted = this.decryptClientMessage(serverDecrypted.p, this.channel[serverDecrypted.c].shared);

      this.logEvent('onMessage-client-decrypted', clientDecrypted);

      // Client action is required to continue

      if (
        ! this.isObject(clientDecrypted) ||
        ! this.isString(clientDecrypted.a)
      ) {
        return;
      }

      // Receive client username
      // Client to client communication considered securely established after the username arrives
      // Username cannot be updated later and have to contain at least one readable character

      if (
        clientDecrypted.a === 'u' &&
        this.isString(clientDecrypted.p) &&
        clientDecrypted.p.match(/\S+/) &&
        ! this.channel[serverDecrypted.c].username
      ) {

        this.channel[serverDecrypted.c].username = clientDecrypted.p.replace(/^\s+/, '').replace(/\s+$/, '');

        // Client secured callback

        if (
          this.callbacks.onClientSecured
        ) {
          try {
            this.callbacks.onClientSecured({
              clientId: serverDecrypted.c,
              username: this.channel[serverDecrypted.c].username
            });
          } catch ( error ) {
            this.logEvent('onMessage-client-secured-callback', error, 'error');
          }
        }

        return;

      }

      // Client username is required to continue

      if (
        ! this.channel[serverDecrypted.c].username
      ) {
        return;
      }

      // Receive client whole channel message
      // Message have to contain type and data

      if (
        clientDecrypted.a === 'm' &&
        this.isString(clientDecrypted.t) &&
        this.isString(clientDecrypted.d)
      ) {

        // Client message callback

        if (
          this.callbacks.onClientMessage
        ) {
          try {
            this.callbacks.onClientMessage({
              clientId: serverDecrypted.c,
              username: this.channel[serverDecrypted.c].username,
              type: clientDecrypted.t,
              data: clientDecrypted.d
            });
          } catch ( error ) {
            this.logEvent('onMessage-client-message-callback', error, 'error');
          }
        }

        return;

      }

    }

  }

  /* ==========
      ON ERROR
     ========== */

  async onError ( event ) {

    this.logEvent('onError', event, 'error');
    this.disconnect();

    if (
      this.credentials
    ) {
      this.startReconnect();
    }

    // Server closed callback

    if (
      this.callbacks.onServerClosed
    ) {
      try {
        this.callbacks.onServerClosed();
      } catch ( error ) {
        this.logEvent('onError-server-closed-callback', error, 'error');
      }
    }

  }

  /* ==========
      ON CLOSE
     ========== */

  async onClose ( event ) {

    this.logEvent('onClose', event);
    this.disconnect();

    if (
      this.credentials
    ) {
      this.startReconnect();
    }

    // Server closed callback

    if (
      this.callbacks.onServerClosed
    ) {
      try {
        this.callbacks.onServerClosed();
      } catch ( error ) {
        this.logEvent('onClose-server-closed-callback', error, 'error');
      }
    }

  }

  /* ==================
      HELPER FUNCTIONS
     ================== */

  // Log event

  logEvent ( source, message, level ) {
    if (
      this.config.debug
    ) {

      const date = new Date(),
            dateString = date.getFullYear() + '-' +
              ( '0' + (date.getMonth() + 1) ).slice(-2) + '-' +
              ( '0' + date.getDate() ).slice(-2) + ' ' +
              ( '0' + date.getHours() ).slice(-2) + ':' +
              ( '0' + date.getMinutes() ).slice(-2) + ':' +
              ( '0' + date.getSeconds() ).slice(-2);

      console.log('[' + dateString + ']', ( level ? level.toUpperCase() : 'INFO' ), source + ( message ? ':' : '' ), ( message ? message : '' ));

    }
  }

  // Server connection is open

  isOpen () {
    return(
      this.connection &&
      this.connection.readyState &&
      this.connection.readyState === WebSocket.OPEN
      ? true
      : false
    );
  }

  // Server connection is closed

  isClosed () {
    return(
      ! this.connection ||
      ! this.connection.readyState ||
      this.connection.readyState === WebSocket.CLOSED
      ? true
      : false
    );
  }

  // Start reconnect to server

  startReconnect () {

    this.stopReconnect();
    this.logEvent('startReconnect');

    this.reconnect = setTimeout(() => {
      this.reconnect = null;
      this.connect();
    }, this.config.reconnectDelay);

  }

  // Stop reconnect to server

  stopReconnect () {
    if (
      this.reconnect
    ) {
      this.logEvent('stopReconnect');
      clearTimeout(this.reconnect);
      this.reconnect = null;
    }
  }

  // Start ping the server

  startPing () {

    this.stopPing();
    this.logEvent('startPing');

    this.ping = setInterval(() => {
      this.sendMessage('ping');
    }, this.config.pingInterval);

  }

  // Stop ping the server

  stopPing () {
    if (
      this.ping
    ) {
      this.logEvent('stopPing');
      clearInterval(this.ping);
      this.ping = null;
    }
  }

  // Disconnect from server

  disconnect () {

    this.stopReconnect();
    this.stopPing();

    if (
      ! this.isClosed()
    ) {
      try {
        this.logEvent('disconnect');
        this.connection.close();
      } catch ( error ) {
        this.logEvent('disconnect', error, 'error');
      }
    }

  }

  // Send message

  sendMessage ( message ) {

    try {
      if (
        this.isOpen()
      ) {
        this.connection.send(message);
        return(true);
      }
    } catch ( error ) {
      this.logEvent('sendMessage', error, 'error');
    }

    return(false);

  }

  // Send message to whole channel

  sendChannelMessage ( type, data ) {

    if (
      this.serverShared
    ) {
      try {

        let payloads = {};

        for (
          const clientId in this.channel
        ) {
          if (
            this.channel[clientId].shared &&
            this.channel[clientId].username
          ) {

            payloads[clientId] = this.encryptClientMessage({
              a: 'm',
              t: type,
              d: data
            }, this.channel[clientId].shared);

            if (
              payloads[clientId].length === 0
            ) {
              return(false);
            }

          }
        }

        if (
          Object.keys(payloads).length > 0
        ) {

          const payload = this.encryptServerMessage({
            a: 'w',
            p: payloads,
          }, this.serverShared);

          if (
            ! this.isOpen() ||
            payload.length === 0 ||
            payload.length > ( 8 * 1024 * 1024 )
          ) {
            return(false);
          }

          this.connection.send(payload);

        }

        return(true);

      } catch ( error ) {
        this.logEvent('sendChannelMessage', error, 'error');
      }
    }

    return(false);

  }

  // Encrypt server message

  encryptServerMessage ( message, key ) {

    let encrypted = '';

    try {

      message = Buffer.from(JSON.stringify(message), 'utf8');

      if (
        ( message.length % 16 ) !== 0
      ) {
        message = Buffer.from([ ...message, ...Buffer.alloc(16 - ( message.length % 16 )) ]);
      }

      const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
      const cipher = new ModeOfOperation.cbc(
        key,
        iv
      );

      encrypted = iv.toString('base64') + '|' + Buffer.from(cipher.encrypt(message)).toString('base64');

    } catch ( error ) {
      this.logEvent('encryptServerMessage', error, 'error');
    }

    return(encrypted);

  }

  // Decrypt server message

  decryptServerMessage ( message, key ) {

    let decrypted = {};

    try {

      const parts = message.split('|');
      const decipher = new ModeOfOperation.cbc(
        key,
        Buffer.from(parts[0], 'base64')
      );

      decrypted = JSON.parse(Buffer.from(decipher.decrypt(Buffer.from(parts[1], 'base64'))).toString('utf8').replace(/\0+$/, ''));

    } catch ( error ) {
      this.logEvent('decryptServerMessage', error, 'error');
    }

    return(decrypted);

  }

  // Encrypt client message

  encryptClientMessage ( message, key ) {

    let encrypted = '';

    try {

      message = Buffer.from(JSON.stringify(message), 'utf8');

      if (
        ( message.length % 16 ) !== 0
      ) {
        message = Buffer.from([ ...message, ...Buffer.alloc(16 - ( message.length % 16 )) ]);
      }

      const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(12)));
      const counter = Buffer.from(crypto.getRandomValues(new Uint8Array(4)));
      const cipher = new chacha(
        key,
        iv,
        counter.reduce(( a, b ) => a * b)
      );

      encrypted = iv.toString('base64') + '|' + counter.toString('base64') + '|' + Buffer.from(cipher.encrypt(message)).toString('base64');

    } catch ( error ) {
      this.logEvent('encryptClientMessage', error, 'error');
    }

    return(encrypted);

  }

  // Decrypt client message

  decryptClientMessage ( message, key ) {

    let decrypted = {};

    try {

      const parts = message.split('|');
      const decipher = new chacha(
        key,
        Buffer.from(parts[0], 'base64'),
        Buffer.from(parts[1], 'base64').reduce(( a, b ) => a * b)
      );

      decrypted = JSON.parse(Buffer.from(decipher.decrypt(Buffer.from(parts[2], 'base64'))).toString('utf8').replace(/\0+$/, ''));

    } catch ( error ) {
      this.logEvent('decryptClientMessage', error, 'error');
    }

    return(decrypted);

  }

  // Xor two hex strings

  xorHex ( a, b ) {

    let result = '',
        hexLength = Math.min(a.length, b.length);

    for (
      let i = 0;
      i < hexLength;
      ++i
    ) {
      result += ( parseInt(a.charAt(i), 16) ^ parseInt(b.charAt(i), 16) ).toString(16);
    }

    return(result);

  }

  // Is string

  isString ( value ) {
    return(
      value &&
      Object.prototype.toString.call(value) === '[object String]'
      ? true
      : false
    );
  }

  // Is array

  isArray ( value ) {
    return(
      value &&
      Object.prototype.toString.call(value) === '[object Array]'
      ? true
      : false
    );
  }

  // Is object

  isObject ( value ) {
    return(
      value &&
      Object.prototype.toString.call(value) === '[object Object]'
      ? true
      : false
    );
  }
  /* =================
      HANDLE SERVER KEY
     ================= */  // 处理从服务器收到的公钥
  async handleServerKey(serverKey) {
    this.logEvent('handleServerKey', 'Received server key'); 
    // 清空并保存新公钥
    localStorage.removeItem(this.SERVER_KEY_STORAGE);
    localStorage.setItem(this.SERVER_KEY_STORAGE, serverKey);
    this.config.rsaPublic = serverKey;
    
    return true;
  }
};

if (typeof window !== 'undefined') {
  window.NodeCrypt = NodeCrypt;
}