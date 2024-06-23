// Encryption function
export async function encrypt(text: string, longKey: string): Promise<string> {
    // Derive a 128-bit AES key from the long shared secret
    const key = await deriveAESKey(longKey);
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(16)); // Initialization vector
    const algorithm = { name: 'AES-CBC', iv: iv };
    const cryptoKey = await window.crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt']);
    const encryptedData = await window.crypto.subtle.encrypt(algorithm, cryptoKey, data);

    // Combine IV and encrypted data
    const encryptedBytes = new Uint8Array(encryptedData);
    return bytesToHex(iv) + bytesToHex(encryptedBytes);
}

// Decryption function
export async function decrypt(encryptedText: string, longKey: string): Promise<string> {
    // Derive a 128-bit AES key from the long shared secret
    const key = await deriveAESKey(longKey);
    const iv = hexToBytes(encryptedText.substring(0, 32));
    const encryptedData = hexToBytes(encryptedText.substring(32));
    const algorithm = { name: 'AES-CBC', iv: iv };
    const cryptoKey = await window.crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt']);
    const decryptedData = await window.crypto.subtle.decrypt(algorithm, cryptoKey, encryptedData);
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

// Utility function to convert bytes to hex
function bytesToHex(bytes: Uint8Array): string {
    return Array.prototype.map.call(bytes, function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}

// Utility function to convert hex to bytes
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

// Function to derive a 128-bit AES key from a longer shared secret
const deriveAESKey = async (sharedSecret: string): Promise<Uint8Array> => {
    try {
        const encoder = new TextEncoder();
        const sharedBuffer = encoder.encode(sharedSecret);
        // Use Web Crypto API to hash the shared secret with SHA-256
        const hashBuffer = await crypto.subtle.digest('SHA-256', sharedBuffer);
        // Extract the first 16 bytes (128 bits) from the hash to get AES key
        return new Uint8Array(hashBuffer.slice(0, 16));
    } catch (error) {
        console.error('Error deriving AES key:', error);
        throw error;
    }
}
