#!/usr/bin/env nodejs

'use strict';

const crypto = require('crypto');
const ws = require('ws');

const config = {
  rsaPrivate: crypto.createPrivateKey({
    key: Buffer.from(process.env.CHATCRYPT_PRIVATE_KEY, 'base64'),
    format: 'der',
    type: 'pkcs8'
  }),
  wsHost: '127.0.0.1',
  wsPort: 8088,
  seenTimeout: 60000,
  debug: false
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

      const decrypted = decryptMessage(message, clients[clientId].shared);

      logEvent('message-decrypted', [ clientId, decrypted ], 'debug');

      if (
        ! isObject(decrypted) ||
        ! isString(decrypted.a)
      ) {
        return;
      }

      // Join channel

      if (
        decrypted.a === 'j' &&
        isString(decrypted.p) &&
        ! clients[clientId].channel
      ) {

        try {

          const channel = decrypted.p;

          // Set client channel

          clients[clientId].channel = channel;

          // Add client to channel

          if (
            ! channels[channel]
          ) {
            channels[channel] = [ clientId ];
          } else {
            channels[channel].push(clientId);
          }

          // Send channel client list (except themselves) to all clients in the channel

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
          logEvent('message-join', [ clientId, error ], 'error');
        }

        return;

      }

      // Message client

      if (
        decrypted.a === 'c' &&
        isString(decrypted.p) &&
        isString(decrypted.c) &&
        clients[clientId].channel
      ) {

        try {

          const channel = clients[clientId].channel;
          const client = clients[decrypted.c];

          if (
            isClientInChannel(client, channel)
          ) {
            sendMessage(client.connection, encryptMessage({
              a: 'c',
              p: decrypted.p,
              c: clientId
            }, client.shared));
          }

        } catch ( error ) {
          logEvent('message-client', [ clientId, error ], 'error');
        }

        return;

      }

      // Message whole channel

      if (
        decrypted.a === 'w' &&
        isObject(decrypted.p) &&
        clients[clientId].channel
      ) {

        try {

          const channel = clients[clientId].channel;

          for (
            const member in decrypted.p
          ) {

            const client = clients[member];

            if (
              isString(decrypted.p[member]) &&
              isClientInChannel(client, channel)
            ) {
              sendMessage(client.connection, encryptMessage({
                a: 'c',
                p: decrypted.p[member],
                c: clientId
              }, client.shared));
            }

          }

        } catch ( error ) {
          logEvent('message-channel', [ clientId, error ], 'error');
        }

        return;

      }

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

// Encrypt message

const encryptMessage = ( message, key ) => {

  let encrypted = '';

  try {

    message = Buffer.from(JSON.stringify(message), 'utf8');

    if (
      ( message.length % 16 ) !== 0
    ) {
      message = Buffer.from([ ...message, ...Buffer.alloc(16 - ( message.length % 16 )) ]);
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      key,
      iv
    );

    cipher.setAutoPadding(false);

    encrypted = iv.toString('base64') + '|' + cipher.update(message, '', 'base64') + cipher.final('base64');

  } catch ( error ) {
    logEvent('encryptMessage', error, 'error');
  }

  return(encrypted);

};

// Decrypt message

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

    decrypted = JSON.parse(( decipher.update(parts[1], 'base64', 'utf8') + decipher.final('utf8') ).replace(/\0+$/, ''));

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
