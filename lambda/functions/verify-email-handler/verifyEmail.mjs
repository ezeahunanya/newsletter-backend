import { generateUniqueToken } from "/opt/shared/utils/generateUniqueToken.mjs";
import { validateToken } from "/opt/shared/utils/validateToken.mjs";
import { queueEmailJob } from "/opt/shared/sqs/queueEmailJob.mjs";
import { encryptToken } from "/opt/shared/utils/encryption.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";
import { hashToken } from "/opt/shared/utils/hashToken.mjs";

export const handleVerifyEmail = async (client, event) => {
  const { method } = event.requestContext.http;
  console.log(`Received ${method} request for email verification.`);

  if (method !== "PUT") {
    console.warn(`❌ Method ${method} not allowed.`);
    return createResponse(405, { error: "Method Not Allowed" });
  }

  const token = event.headers["x-token"];
  if (!token) {
    console.error("❌ Token is required but not provided.");
    return createResponse(400, { error: "Token is required." });
  }

  const tokenHash = hashToken(token);

  try {
    console.log("🔄 Starting transaction...");
    await client.query("BEGIN");

    // Validate token
    const { user_id, email } = await validateToken(
      client,
      token,
      "email_verification",
      process.env.SUBSCRIBERS_TABLE_NAME
    );
    console.log(`✅ Token validated for user ID: ${user_id}, email: ${email}`);

    // Mark email as verified
    await markEmailVerified(client, user_id);

    // Mark token as used
    await markTokenUsed(client, tokenHash);

    // Generate account completion token
    const { accountCompletionUrl, preferencesUrl } =
      await generateAndStoreTokens(client, user_id);

    // Queue welcome email
    await queueWelcomeEmail(email, accountCompletionUrl, preferencesUrl);

    // Commit transaction
    await client.query("COMMIT");
    console.log("✅ Transaction committed successfully.");

    return createResponse(200, {
      message: "Email verified successfully. Please check email.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Transaction failed, rolling back changes:", error);

    // Handle specific errors
    if (
      error.message.toLowerCase().includes("expired") ||
      error.message.toLowerCase().includes("not found")
    ) {
      return createResponse(400, { error: error.message });
    }

    if (error.message.toLowerCase().includes("used")) {
      return createResponse(200, {
        message: "Email already verified. Please check email.",
      });
    }

    // General error response
    return createResponse(500, { error: "Internal Server Error" });
  }
};

// Helper: Mark email as verified
const markEmailVerified = async (client, userId) => {
  console.log("Marking email as verified...");
  await client.query(
    `UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME} SET email_verified = true WHERE id = $1;`,
    [userId]
  );
  console.log("✅ Email marked as verified.");
};

// Helper: Mark token as used
const markTokenUsed = async (client, tokenHash) => {
  console.log("Marking token as used...");
  await client.query(
    `UPDATE ${process.env.TOKEN_TABLE_NAME} SET used = true, updated_at = NOW() WHERE token_hash = $1;`,
    [tokenHash]
  );
  console.log("✅ Token marked as used.");
};

// Helper: Generate and store account completion and preferences tokens
const generateAndStoreTokens = async (client, userId) => {
  console.log("Generating and storing tokens...");

  // Generate account completion token
  const { token: accountCompletionToken, tokenHash: accountCompletionHash } =
    await generateUniqueToken(client);
  const accountCompletionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await client.query(
    `INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
     VALUES ($1, $2, 'account_completion', $3, false, NOW(), NOW());`,
    [userId, accountCompletionHash, accountCompletionExpiresAt]
  );
  console.log("✅ Account completion token stored.");

  // Generate and encrypt preferences token
  const { token: preferencesToken, tokenHash: preferencesHash } =
    await generateUniqueToken(client);
  const encryptedPreferencesToken = await encryptToken(preferencesToken);

  await client.query(
    `INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, encrypted_token, token_type, created_at, updated_at)
     VALUES ($1, $2, $3, 'preferences', NOW(), NOW());`,
    [userId, preferencesHash, encryptedPreferencesToken]
  );
  console.log("✅ Preferences token stored.");

  return {
    accountCompletionUrl: `${process.env.FRONTEND_DOMAIN_URL}/complete-account?token=${accountCompletionToken}`,
    preferencesUrl: `${process.env.FRONTEND_DOMAIN_URL}/manage-preferences?token=${preferencesToken}`,
  };
};

// Helper: Queue welcome email
const queueWelcomeEmail = async (
  email,
  accountCompletionUrl,
  preferencesUrl
) => {
  console.log("Queuing welcome email...");
  await queueEmailJob("process-welcome-email", {
    email,
    accountCompletionUrl,
    preferencesUrl,
  });
  console.log("✅ Welcome email queued.");
};
