import crypto from "crypto";
import { generateUniqueToken } from "../db/generateUniqueToken.mjs";
import { validateToken } from "../db/validateToken.mjs";
import { queueEmailJob, queueUrlMap } from "../sqs/queueEmailJob.mjs";
import { getSecret } from "../credentials/getSecret.mjs";

export const getEncryptionKey = async () => {
  const encryptionKey = await getSecret(process.env.ENCRYPTION_SECRET_NAME);
  return encryptionKey;
};

// Encrypt function using AES-256-GCM
const encryptToken = async (token) => {
  const encryptionKeySecret = await getEncryptionKey();
  const encryptionKey = Buffer.from(encryptionKeySecret.ENCRYPTION_KEY, "hex"); // 32-byte key
  const iv = crypto.randomBytes(16); // Generate random IV (16 bytes for AES-256-GCM)
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Return the IV, encrypted token, and auth tag concatenated with ':' separator
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
};

// Decrypt function using AES-256-GCM
const decryptToken = async (encryptedToken) => {
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

  return decrypted;
};

export const handleVerifyEmail = async (client, event) => {
  const method = event.requestContext.http.method;

  if (method === "PUT") {
    const token = event.headers["x-token"];
    if (!token) {
      throw new Error("Token is required.");
    }

    const { user_id, email, isUsed } = await validateToken(
      client,
      token,
      "email_verification",
      process.env.SUBSCRIBERS_TABLE_NAME,
      { allowUsed: true }
    );

    if (!isUsed) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const markVerifiedQuery = `
        UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
        SET email_verified = true
        WHERE id = $1;
      `;
      await client.query(markVerifiedQuery, [user_id]);

      // Mark the token as used
      const markUsedQuery = `
        UPDATE ${process.env.TOKEN_TABLE_NAME}
        SET used = true, updated_at = NOW()
        WHERE token_hash = $1;
      `;
      await client.query(markUsedQuery, [tokenHash]);

      // Generate account completion token
      const {
        token: accountCompletionToken,
        tokenHash: accountCompletionHash,
      } = await generateUniqueToken(client);

      const accountCompletionExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
        VALUES ($1, $2, 'account_completion', $3, false, NOW(), NOW());
      `,
        [user_id, accountCompletionHash, accountCompletionExpiresAt]
      );

      // Generate and encrypt preferences token
      const { token: preferencesToken, tokenHash: preferencesHash } =
        await generateUniqueToken(client);

      const encryptedPreferencesToken = encryptToken(preferencesToken);

      // Insert the encrypted preferences token and its hash into the database
      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, encrypted_token, token_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'preferences', NOW(), NOW());
      `,
        [user_id, preferencesHash, encryptedPreferencesToken]
      );

      // Send the welcome email with both URLs
      const accountCompletionUrl = `${process.env.FRONTEND_DOMAIN_URL}/complete-account?token=${accountCompletionToken}`;
      const preferencesUrl = `${process.env.FRONTEND_DOMAIN_URL}/manage-preferences?token=${preferencesToken}`;
      const queueUrl = queueUrlMap["welcome-email"];

      await queueEmailJob(queueUrl, email, {
        accountCompletionUrl: accountCompletionUrl,
        preferencesUrl: preferencesUrl,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email verified successfully. Please check email.",
      }),
    };
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
};
