const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.COOKIE_ENCRYPTION_KEY || 'zonix-cookie-key-change-in-production-32ch';

function encryptData(plaintext) {
  try {
    const key = CryptoJS.SHA256(ENCRYPTION_KEY);
    const iv = CryptoJS.lib.WordArray.random(16);

    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encryptedData: encrypted.ciphertext.toString(CryptoJS.enc.Hex),
      iv: iv.toString(CryptoJS.enc.Hex),
      hash: CryptoJS.SHA256(plaintext).toString(CryptoJS.enc.Hex)
    };
  } catch (err) {
    console.error('[Crypto] Encryption failed:', err.message);
    throw new Error('Encryption failed');
  }
}

function decryptData(encryptedDataHex, ivHex) {
  try {
    const key = CryptoJS.SHA256(ENCRYPTION_KEY);
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const ciphertext = CryptoJS.enc.Hex.parse(encryptedDataHex);

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: ciphertext
    });

    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    console.error('[Crypto] Decryption failed:', err.message);
    throw new Error('Decryption failed');
  }
}

function hashString(str) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}

function generateSessionToken() {
  const bytes = CryptoJS.lib.WordArray.random(32);
  return bytes.toString(CryptoJS.enc.Hex);
}

module.exports = {
  encryptData,
  decryptData,
  hashString,
  generateSessionToken
};
