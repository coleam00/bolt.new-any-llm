import { logStore } from '~/lib/stores/logs';

let masterKey: CryptoKey | null = null;

const generateRandomKey = (): Uint8Array => {
  return crypto.getRandomValues(new Uint8Array(32));
};

const isEncryptionInitialized = (): boolean => {
  return masterKey !== null;
};

const initializeMasterKey = async (): Promise<boolean> => {
  try {
    const storedKey = localStorage.getItem('masterKey');

    let keyData: Uint8Array;

    if (storedKey) {
      keyData = new Uint8Array(
        atob(storedKey)
          .split('')
          .map((c) => c.charCodeAt(0)),
      );
    } else {
      keyData = generateRandomKey();
      localStorage.setItem('masterKey', btoa(String.fromCharCode(...keyData)));
    }

    masterKey = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt', 'decrypt']);

    return true;
  } catch (error) {
    logStore.logError('Failed to initialize master key:', error);
    return false;
  }
};

const encrypt = async (text: string): Promise<string> => {
  if (!masterKey) {
    throw new Error('Master key not initialized');
  }

  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = encoder.encode(text);

  const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, encodedText);

  const encryptedArray = new Uint8Array(encryptedData);
  const combinedArray = new Uint8Array(iv.length + encryptedArray.length);
  combinedArray.set(iv);
  combinedArray.set(encryptedArray, iv.length);

  return btoa(String.fromCharCode(...combinedArray));
};

const decrypt = async (encryptedText: string): Promise<string> => {
  if (!masterKey) {
    throw new Error('Master key not initialized');
  }

  try {
    const decoder = new TextDecoder();
    const encryptedArray = new Uint8Array(
      atob(encryptedText)
        .split('')
        .map((char) => char.charCodeAt(0)),
    );

    const iv = encryptedArray.slice(0, 12);
    const encryptedData = encryptedArray.slice(12);

    const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, encryptedData);

    return decoder.decode(decryptedData);
  } catch (error) {
    logStore.logError('Decryption failed:', error);
    throw error;
  }
};

export { encrypt, decrypt, isEncryptionInitialized, initializeMasterKey };
