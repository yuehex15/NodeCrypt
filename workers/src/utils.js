// Generate a new RSA key pair for Cloudflare Workers
export const generateRSAKeyPair = () => {
  // For simplicity, we'll generate this synchronously when the worker starts
  // In a real implementation, you might want to store and reuse keys
  return crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  ).then(async (keyPair) => {
    const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const rsaPublic = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

    return {
      rsaPublic,
      rsaPrivate: keyPair.privateKey
    };
  }).catch(error => {
    console.error('Error generating RSA key pair:', error);
    throw error;
  });
};

export const generateClientId = () => {
  try {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    logEvent('generateClientId', error, 'error');
    return null;
  }
};

export const encryptMessage = async (message, key) => {
  let encrypted = '';

  try {
    const messageString = JSON.stringify(message);
    const messageBuffer = new TextEncoder().encode(messageString);
    
    // Manual padding exactly like Node.js server: pad to 16-byte boundary with null bytes
    const paddingLength = 16 - (messageBuffer.length % 16);
    const finalPaddingLength = paddingLength === 16 ? 0 : paddingLength;
    
    const paddedBuffer = new Uint8Array(messageBuffer.length + finalPaddingLength);
    paddedBuffer.set(messageBuffer);
    // Remaining bytes are already zero (null padding), matching Node.js Buffer.alloc()
    
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    // Use AES in manual mode to match Node.js setAutoPadding(false)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.slice(0, 32), // Ensure exactly 32 bytes for AES-256
      { name: 'AES-CBC' },
      false,
      ['encrypt']
    );

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv: iv
      },
      cryptoKey,
      paddedBuffer
    );

    // Encode to Base64 exactly like Node.js server
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
    
    encrypted = ivBase64 + '|' + encryptedBase64;

  } catch (error) {
    logEvent('encryptMessage', error, 'error');
  }

  return encrypted;
};

export const decryptMessage = async (message, key) => {
  let decrypted = {};

  try {
    const parts = message.split('|');
    if (parts.length !== 2) {
      throw new Error(`Invalid message format: expected 2 parts, got ${parts.length}`);
    }
    
    const iv = new Uint8Array(atob(parts[0]).split('').map(c => c.charCodeAt(0)));
    const encryptedData = new Uint8Array(atob(parts[1]).split('').map(c => c.charCodeAt(0)));
    
    logEvent('decryptMessage', `IV length: ${iv.length}, encrypted data length: ${encryptedData.length}, key length: ${key.length}`, 'debug');
    
    // Import key for decryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key.slice(0, 32), // Ensure exactly 32 bytes for AES-256
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv: iv
      },
      cryptoKey,
      encryptedData
    );

    // Convert to string and remove null padding (same as original .replace(/\0+$/, ''))
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    const cleanText = decryptedText.replace(/\0+$/, '');
    
    logEvent('decryptMessage', `Decrypted text length: ${decryptedText.length}, clean text: "${cleanText}"`, 'debug');
    
    decrypted = JSON.parse(cleanText);

  } catch (error) {
    logEvent('decryptMessage', error, 'error');
  }

  return decrypted;
};

export const logEvent = (source, message, level) => {
  if (level !== 'debug' || true) { // Always show debug for now
    const date = new Date();
    const dateString = date.getFullYear() + '-' +
      ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
      ('0' + date.getDate()).slice(-2) + ' ' +
      ('0' + date.getHours()).slice(-2) + ':' +
      ('0' + date.getMinutes()).slice(-2) + ':' +
      ('0' + date.getSeconds()).slice(-2);

    console.log('[' + dateString + ']', (level ? level.toUpperCase() : 'INFO'), source + (message ? ':' : ''), (message ? message : ''));
  }
};

export const getTime = () => {
  return new Date().getTime();
};

export const isString = (value) => {
  return value && Object.prototype.toString.call(value) === '[object String]';
};

export const isArray = (value) => {
  return value && Object.prototype.toString.call(value) === '[object Array]';
};

export const isObject = (value) => {
  return value && Object.prototype.toString.call(value) === '[object Object]';
};
