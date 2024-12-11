const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_LENGTH = 16;

export async function encrypt(key: string, data: string) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const cryptoKey = await getKey(key);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    cryptoKey,
    encoder.encode(data),
  );

  const bundle = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  bundle.set(new Uint8Array(ciphertext));
  bundle.set(iv, ciphertext.byteLength);

  return arrayBufferToBase64(bundle);
}

export async function decrypt(key: string, payload: string) {
  const bundle = base64ToArrayBuffer(payload);
  
  const iv = new Uint8Array(bundle.slice(bundle.byteLength - IV_LENGTH));
  const ciphertext = new Uint8Array(bundle.slice(0, bundle.byteLength - IV_LENGTH));

  const cryptoKey = await getKey(key);

  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-CBC',
      iv,
    },
    cryptoKey,
    ciphertext,
  );

  return decoder.decode(plaintext);
}

async function getKey(key: string) {
  const keyData = encoder.encode(key.padEnd(32, '0')).slice(0, 32);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-CBC' },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binString = atob(base64);
  const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
  return bytes.buffer;
}
