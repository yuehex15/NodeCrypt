import crypto from 'node:crypto';

// Generate a new RSA key pair using Node.js crypto API
export const generateRSAKeyPair = async () => {
  try {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          // Convert PEM to base64 (remove headers and newlines)
          const rsaPublic = publicKey
            .replace(/-----BEGIN PUBLIC KEY-----/, '')
            .replace(/-----END PUBLIC KEY-----/, '')
            .replace(/\n/g, '');
          
          resolve({
            rsaPublic,
            rsaPrivate: privateKey
          });
        }
      });
    });
  } catch (error) {
    console.error('Error generating RSA key pair:', error);
    throw error;
  }
};

export const generateClientId = () => {
  try {
    return crypto.randomBytes(8).toString('hex');
  } catch (error) {
    logEvent('generateClientId', error, 'error');
    return null;
  }
};

export const encryptMessage = async (message, key) => {
  try {
    const messageString = JSON.stringify(message);
    const iv = crypto.randomBytes(16);
    
    // Use createCipheriv instead of createCipher for better compatibility
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    cipher.setAutoPadding(false);
    
    // Manual padding to 16-byte boundary with zeros
    const messageBuffer = Buffer.from(messageString, 'utf8');
    const paddingLength = 16 - (messageBuffer.length % 16);
    const paddedBuffer = Buffer.concat([messageBuffer, Buffer.alloc(paddingLength)]);
    
    const encrypted = Buffer.concat([
      cipher.update(paddedBuffer),
      cipher.final()
    ]);
    
    // Format: iv|encrypted (base64 encoded)
    const ivBase64 = iv.toString('base64');
    const encryptedBase64 = encrypted.toString('base64');
    
    return ivBase64 + '|' + encryptedBase64;
    
  } catch (error) {
    logEvent('encryptMessage', error, 'error');
    return '';
  }
};

export const decryptMessage = async (message, key) => {
  try {
    const parts = message.split('|');
    if (parts.length !== 2) {
      throw new Error(`Invalid message format: expected 2 parts, got ${parts.length}`);
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const encryptedData = Buffer.from(parts[1], 'base64');
    
    logEvent('decryptMessage', `IV length: ${iv.length}, encrypted data length: ${encryptedData.length}, key length: ${key.length}`, 'debug');
    
    // Use createDecipheriv instead of createDecipher for better compatibility
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv);
    decipher.setAutoPadding(false);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
    
    // Remove null padding and convert to string
    const decryptedText = decrypted.toString('utf8').replace(/\0+$/, '');
    
    logEvent('decryptMessage', `Decrypted text: "${decryptedText}"`, 'debug');
    
    return JSON.parse(decryptedText);
    
  } catch (error) {
    logEvent('decryptMessage', error, 'error');
    return {};
  }
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