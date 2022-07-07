/**
 * String to Array Buffer
 * @param str string to convert
 */
export const str2ab = (str: string) => {
    const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
    const bufView = new Uint16Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
};

/**
 * Buffer to Base64 url-encoded string
 * @param buffer buffer to convert
 */
export const bufferToBase64URLString = (buffer: ArrayBuffer): string => {
    const base64String = bufferToBase64String(buffer);
    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

/**
 * Base64 url-encoded string to buffer
 * @param content string to convert
 */
export const base64StringToBuffer = (content: string): ArrayBuffer | Uint8Array => {
    const parsedUrl = content.replace(/\-/g, '+').replace(/\_/g, '/');
    return stringToBuffer(atob(parsedUrl));
};

/**
 * String to buffer
 * @param content string to convert
 */
export const stringToBuffer = (content: string): ArrayBuffer | Uint8Array => {
    return Uint8Array.from(content, (c) => c.charCodeAt(0));
};

export const bufferToBase64String = (buffer: ArrayBuffer): string => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

export const sha256 = async (message: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hash;
};
