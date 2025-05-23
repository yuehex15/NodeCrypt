#!/usr/bin/env nodejs

'use strict';

const crypto = require('crypto');
const ws = require('ws');

// 生成RSA密钥对函数，整合自key-generate.js
const generateRSAKeyPair = () => {
  try {
    console.log('Generating new RSA keypair...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      }
    });

    return {
      rsaPublic: Buffer.from(publicKey).toString('base64'),
      rsaPrivate: crypto.createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8'
      })
    };
  } catch (error) {
    console.error('Error generating RSA key pair:', error);
    process.exit(1);
  }
};

// 生成密钥并配置服务器
const keyPair = generateRSAKeyPair();
console.log('RSA key pair generated successfully');

const config = {
  rsaPrivate: keyPair.rsaPrivate,
  rsaPublic: keyPair.rsaPublic,
  wsHost: '127.0.0.1',
  wsPort: 8088,
  seenTimeout: 60000,
  debug: true
};

// Create websocket server

const wss = new ws.Server({
  host: config.wsHost,
  port: config.wsPort,
  perMessageDeflate: false
});

console.log('server started', config.wsHost, config.wsPort);

// Listen for client connections

var clients = {};
var channels = {};

wss.on('connection', ( connection ) => {

  if (
    ! connection
  ) {
    return;
  }

  // Terminate clients have not seen for a while

  const seenThreshold = ( getTime() - config.seenTimeout );

  for (
    const clientId in clients
  ) {
    if (
      clients[clientId].seen < seenThreshold
    ) {
      try {
        logEvent('connection-seen', clientId, 'debug');
        clients[clientId].connection.terminate();
      } catch ( error ) {
        logEvent('connection-seen', error, 'error');
      }
    }
  }

  // Generate client id
  // Ultimately make sure that it does not collide

  const clientId = generateClientId();

  if (
    ! clientId ||
    clients[clientId]
  ) {
    closeConnection(connection);
    return;
  }

  logEvent('connection', clientId, 'debug');

  // Add client to client list

  clients[clientId] = {
    connection: connection,
    seen: getTime(),
    key: null,
    channel: null
  };

  // Send the server's public key to the client first
  try {
    logEvent('sending-public-key', clientId, 'debug');
    sendMessage(connection, JSON.stringify({
      type: 'server-key',
      key: config.rsaPublic
    }));
  } catch (error) {
    logEvent('sending-public-key', error, 'error');
  }

  /* ============
      ON MESSAGE
     ============ */

  connection.on('message', ( message ) => {

    if (
      ! isString(message) ||
      ! clients[clientId]
    ) {
      return;
    }

    // Update seen
    clients[clientId].seen = getTime();

    // Respond to ping requests
    if (
      message === 'ping'
    ) {
      sendMessage(connection, 'pong');
      return;
    }

    logEvent('message', [ clientId, message ], 'debug');

    // Receive client ecdh public key
    if (
      ! clients[clientId].shared &&
      message.length < 2048
    ) {

      // Generate client ecdh keys
      // Set client ecdh shared key (just 256 bits required from the possible 384)
      // Send rsa signed ecdh public key to client

      try {

        const keys = crypto.createECDH('secp384r1');

        keys.generateKeys();

        const publicKey = keys.getPublicKey();
        const signature = crypto.sign('sha256', publicKey, {
        	key: config.rsaPrivate,
        	padding: crypto.constants.RSA_PKCS1_PADDING,
          dsaEncoding: 'ieee-p1363'
        });

        clients[clientId].shared = keys.computeSecret(message, 'hex', null).slice(8, 40);

        sendMessage(connection, publicKey.toString('hex') + '|' + signature.toString('base64'));

      } catch ( error ) {
        logEvent('message-key', [ clientId, error ], 'error');
        closeConnection(connection);
      }

      return;

    }

    // Receive encrypted message from client
    if (
      clients[clientId].shared &&
      message.length <= ( 8 * 1024 * 1024 )
    ) {

      // 立即处理并清理，避免在回调中持有大对象引用
      processEncryptedMessage(clientId, message);

    }

  });

  /* ==========
      ON CLOSE
     ========== */

  connection.on('close', ( event ) => {

    logEvent('close', [ clientId, event ], 'debug');

    // Remove client from channel

    const channel = clients[clientId].channel;

    if (
      channel &&
      channels[channel]
    ) {

      channels[channel].splice(channels[channel].indexOf(clientId), 1);

      if (
        channels[channel].length === 0
      ) {

        // Remove empty channel

        delete(channels[channel]);

      } else {

        // Send channel client list (except themselves) to all clients in the channel

        try {

          const members = channels[channel];

          for (
            const member of members
          ) {

            const client = clients[member];

            if (
              isClientInChannel(client, channel)
            ) {
              sendMessage(client.connection, encryptMessage({
                a: 'l',
                p: members.filter(( value ) => {
                  return(
                    value !== member
                    ? true
                    : false
                  );
                })
              }, client.shared));
            }

          }

        } catch ( error ) {
          logEvent('close-list', [ clientId, error ], 'error');
        }

      }

    }

    // Remove client from client list

    if (
      clients[clientId]
    ) {
      delete(clients[clientId]);
    }

  });

});

// 将加密消息处理提取为独立函数，便于内存管理
const processEncryptedMessage = (clientId, message) => {
  let decrypted = null;
  
  try {
    decrypted = decryptMessage(message, clients[clientId].shared);
    
    logEvent('message-decrypted', [ clientId, decrypted ], 'debug');

    if (
      ! isObject(decrypted) ||
      ! isString(decrypted.a)
    ) {
      return;
    }

    // 根据消息类型分发处理
    const action = decrypted.a;
    
    if (action === 'j') {
      handleJoinChannel(clientId, decrypted);
    } else if (action === 'c') {
      handleClientMessage(clientId, decrypted);
    } else if (action === 'w') {
      handleChannelMessage(clientId, decrypted);
    }

  } catch (error) {
    logEvent('process-encrypted-message', [clientId, error], 'error');
  } finally {
    // 确保解密对象被立即清理
    decrypted = null;
  }
};

// 处理加入频道请求
const handleJoinChannel = (clientId, decrypted) => {
  if (
    ! isString(decrypted.p) ||
    clients[clientId].channel
  ) {
    return;
  }

  try {
    const channel = decrypted.p;

    // Set client channel
    clients[clientId].channel = channel;

    // Add client to channel
    if (! channels[channel]) {
      channels[channel] = [ clientId ];
    } else {
      channels[channel].push(clientId);
    }

    // Send channel client list
    broadcastMemberList(channel);

  } catch (error) {
    logEvent('message-join', [ clientId, error ], 'error');
  }
};

// 处理客户端私聊消息
const handleClientMessage = (clientId, decrypted) => {
  if (
    ! isString(decrypted.p) ||
    ! isString(decrypted.c) ||
    ! clients[clientId].channel
  ) {
    return;
  }

  try {
    const channel = clients[clientId].channel;
    const targetClient = clients[decrypted.c];

    if (isClientInChannel(targetClient, channel)) {
      // 创建临时消息对象，发送后立即清理
      const messageObj = {
        a: 'c',
        p: decrypted.p,
        c: clientId
      };
      
      const encrypted = encryptMessage(messageObj, targetClient.shared);
      sendMessage(targetClient.connection, encrypted);
      
      // 清理临时对象
      messageObj.p = null;
    }

  } catch (error) {
    logEvent('message-client', [ clientId, error ], 'error');
  }
};

// 处理频道广播消息
const handleChannelMessage = (clientId, decrypted) => {
  if (
    ! isObject(decrypted.p) ||
    ! clients[clientId].channel
  ) {
    return;
  }

  try {
    const channel = clients[clientId].channel;

    for (const member in decrypted.p) {
      const targetClient = clients[member];
      
      if (
        isString(decrypted.p[member]) &&
        isClientInChannel(targetClient, channel)
      ) {
        // 创建临时消息对象
        const messageObj = {
          a: 'c',
          p: decrypted.p[member],
          c: clientId
        };
        
        const encrypted = encryptMessage(messageObj, targetClient.shared);
        sendMessage(targetClient.connection, encrypted);
        
        // 清理临时对象
        messageObj.p = null;
      }
    }

  } catch (error) {
    logEvent('message-channel', [ clientId, error ], 'error');
  }
};

// 广播成员列表
const broadcastMemberList = (channel) => {
  try {
    const members = channels[channel];
    
    for (const member of members) {
      const client = clients[member];
      
      if (isClientInChannel(client, channel)) {
        // 创建过滤后的成员列表
        const filteredMembers = members.filter(value => value !== member);
        
        const listObj = {
          a: 'l',
          p: filteredMembers
        };
        
        const encrypted = encryptMessage(listObj, client.shared);
        sendMessage(client.connection, encrypted);
        
        // 清理临时对象
        listObj.p = null;
      }
    }
  } catch (error) {
    logEvent('broadcast-member-list', error, 'error');
  }
};

/* ==================
    HELPER FUNCTIONS
   ================== */

// Log event

const logEvent = ( source, message, level ) => {
  if (
    level !== 'debug' ||
    config.debug
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
};

// Generate client id

const generateClientId = () => {
  try {
    return(crypto.randomBytes(8).toString('hex'));
  } catch ( error ) {
    logEvent('generateClientId', error, 'error');
    return(null);
  }
};

// Close connection

const closeConnection = ( connection ) => {
  try {
    connection.close();
  } catch ( error ) {
    logEvent('closeConnection', error, 'error');
  }
};

// Is client in channel

const isClientInChannel = ( client, channel ) => {
  return(
    client &&
    client.connection &&
    client.shared &&
    client.channel &&
    client.channel === channel
    ? true
    : false
  );
};

// Send message

const sendMessage = ( connection, message ) => {
  try {
    if (
      connection.readyState &&
      connection.readyState === ws.OPEN
    ) {
      connection.send(message);
    }
  } catch ( error ) {
    logEvent('sendMessage', error, 'error');
  }
};


const encryptMessage = ( message, key ) => {

  let encrypted = '';

  try {

    const messageBuffer = Buffer.from(JSON.stringify(message), 'utf8');

    const paddedBuffer = ( messageBuffer.length % 16 ) !== 0
      ? Buffer.concat([messageBuffer, Buffer.alloc(16 - ( messageBuffer.length % 16 ))])
      : messageBuffer;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);

    encrypted = iv.toString('base64') + '|' + cipher.update(paddedBuffer, '', 'base64') + cipher.final('base64');

  } catch ( error ) {
    logEvent('encryptMessage', error, 'error');
  }

  return(encrypted);

};


const decryptMessage = ( message, key ) => {

  let decrypted = {};

  try {

    const parts = message.split('|');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(parts[0], 'base64')
    );

    decipher.setAutoPadding(false);

    const decryptedText = decipher.update(parts[1], 'base64', 'utf8') + decipher.final('utf8');
    decrypted = JSON.parse(decryptedText.replace(/\0+$/, ''));

  } catch ( error ) {
    logEvent('decryptMessage', error, 'error');
  }

  return(decrypted);

};

// Get time

const getTime = () => {
  return(new Date().getTime());
};

// Is string

const isString = ( value ) => {
  return(
    value &&
    Object.prototype.toString.call(value) === '[object String]'
    ? true
    : false
  );
};

// Is array

const isArray = ( value ) => {
  return(
    value &&
    Object.prototype.toString.call(value) === '[object Array]'
    ? true
    : false
  );
};

// Is object

const isObject = ( value ) => {
  return(
    value &&
    Object.prototype.toString.call(value) === '[object Object]'
    ? true
    : false
  );
};

// 每30秒强制触发一次垃圾回收
setInterval(() => {
  if (global.gc) {
    global.gc();
    gcCounter++;
  }
}, 30000);