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
    // Import aes-js for compatibility with client
    const { ModeOfOperation } = await import('aes-js');
    
    // Convert message to Buffer exactly like client
    const messageString = JSON.stringify(message);
    let messageBuffer = new TextEncoder().encode(messageString);
    
    // Pad to 16-byte boundary with zeros exactly like client: Buffer.alloc(16 - (message.length % 16))
    if ((messageBuffer.length % 16) !== 0) {
      const paddingLength = 16 - (messageBuffer.length % 16);
      const paddedBuffer = new Uint8Array(messageBuffer.length + paddingLength);
      paddedBuffer.set(messageBuffer);
      // Remaining bytes are already zero (null padding)
      messageBuffer = paddedBuffer;
    }
    
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    // Use aes-js CBC mode exactly like client
    const cipher = new ModeOfOperation.cbc(key.slice(0, 32), iv);
    const encryptedBytes = cipher.encrypt(messageBuffer);
    
    // Encode to Base64 exactly like client
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const encryptedBase64 = btoa(String.fromCharCode(...encryptedBytes));
    
    encrypted = ivBase64 + '|' + encryptedBase64;

  } catch (error) {
    logEvent('encryptMessage', error, 'error');
  }

  return encrypted;
};

export const decryptMessage = async (message, key) => {
  let decrypted = {};

  try {
    // Import aes-js for compatibility with client
    const { ModeOfOperation } = await import('aes-js');
    
    const parts = message.split('|');
    if (parts.length !== 2) {
      throw new Error(`Invalid message format: expected 2 parts, got ${parts.length}`);
    }
    
    const iv = new Uint8Array(atob(parts[0]).split('').map(c => c.charCodeAt(0)));
    const encryptedData = new Uint8Array(atob(parts[1]).split('').map(c => c.charCodeAt(0)));
    
    logEvent('decryptMessage', `IV length: ${iv.length}, encrypted data length: ${encryptedData.length}, key length: ${key.length}`, 'debug');
    
    // Use aes-js CBC mode exactly like client
    const decipher = new ModeOfOperation.cbc(key.slice(0, 32), iv);
    const decryptedBytes = decipher.decrypt(encryptedData);

    // Convert to string and remove null padding exactly like client: .replace(/\0+$/, '')
    const decryptedText = new TextDecoder().decode(decryptedBytes);
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
