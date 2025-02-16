import crypto from "crypto";
import { getSecret } from "./getSecret.mjs";

export const getEncryptionKey = async () => {
  console.log("Fetching encryption key from secrets manager...");
  const encryptionKey = await getSecret(process.env.ENCRYPTION_SECRET_NAME);
  console.log("✅ Encryption key fetched successfully.");
  return encryptionKey;
};

// Encrypt function using AES-256-GCM
export const encryptToken = async (token) => {
  console.log("Encrypting token...");
  const encryptionKeySecret = await getEncryptionKey();
  const encryptionKey = Buffer.from(encryptionKeySecret.ENCRYPTION_KEY, "hex"); // 32-byte key
  const iv = crypto.randomBytes(16); // Generate random IV (16 bytes for AES-256-GCM)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Return the IV, encrypted token, and auth tag concatenated with ':' separator
  console.log("✅ Token encrypted successfully.");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
};

// Decrypt function using AES-256-GCM
export const decryptToken = async (encryptedToken) => {
  console.log("Decrypting token...");
  const encryptionKeySecret = await getEncryptionKey();
  const encryptionKey = Buffer.from(encryptionKeySecret.ENCRYPTION_KEY, "hex");

  const [ivHex, encryptedData, authTagHex] = encryptedToken.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedData, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, null, "utf8");
  decrypted += decipher.final("utf8");

  console.log("✅ Token decrypted successfully.");
  return decrypted;
};
