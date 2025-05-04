
const crypto = require('crypto');

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

console.log('PRIVATE', Buffer.from(privateKey).toString('base64'));
console.log('PUBLIC', Buffer.from(publicKey).toString('base64'));
