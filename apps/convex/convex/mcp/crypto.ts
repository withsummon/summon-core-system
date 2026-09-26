function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}
async function key() {
  const raw = process.env.SUMMON_CREDENTIAL_KEY;
  if (!raw) throw new Error("Credential encryption is not configured.");
  let decoded: ReturnType<typeof decode>;
  try {
    decoded = decode(raw);
  } catch {
    throw new Error("Credential encryption is not configured.");
  }
  if (decoded.length !== 32) throw new Error("Credential encryption requires a 32-byte base64 key.");
  return crypto.subtle.importKey("raw", decoded, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encrypt(secret: string) {
  if (!secret || secret.length > 8192) throw new Error("Enter a credential of up to 8192 characters.");
  const encryptionKey = await key();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    encryptionKey,
    new TextEncoder().encode(secret)
  );
  return { ciphertext: encode(new Uint8Array(ciphertext)), nonce: encode(nonce), keyVersion: 2 as const };
}
export async function decrypt(secret: { ciphertext: string; nonce: string; keyVersion: 2 }) {
  const result = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decode(secret.nonce) },
    await key(),
    decode(secret.ciphertext)
  );
  return new TextDecoder().decode(result);
}
