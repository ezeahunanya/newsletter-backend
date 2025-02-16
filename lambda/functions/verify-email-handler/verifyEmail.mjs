import crypto from "crypto";
import { generateUniqueToken } from "../db/generateUniqueToken.mjs";
import { validateToken } from "../db/validateToken.mjs";
import { queueEmailJob } from "../sqs/queueEmailJob.mjs";
import { encryptToken } from "../db/encryption.mjs";

export const handleVerifyEmail = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for email verification.`);

  if (method !== "PUT") {
    console.warn(`❌ Method ${method} not allowed.`);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const token = event.headers["x-token"];
  if (!token) {
    console.error("❌ Token is required but not provided.");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Token is required." }),
    };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  try {
    // ✅ Begin transaction
    await client.query("BEGIN");
    console.log("🔄 Transaction started.");

    const { user_id, email } = await validateToken(
      client,
      token,
      "email_verification",
      process.env.SUBSCRIBERS_TABLE_NAME
    );
    console.log(`✅ Token validated for user ID: ${user_id}, email: ${email}`);

    // ✅ Mark email as verified
    console.log("Marking email as verified...");
    await client.query(
      `UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME} SET email_verified = true WHERE id = $1;`,
      [user_id]
    );
    console.log("✅ Email marked as verified.");

    // ✅ Mark token as used
    console.log("Marking token as used...");
    await client.query(
      `UPDATE ${process.env.TOKEN_TABLE_NAME} SET used = true, updated_at = NOW() WHERE token_hash = $1;`,
      [tokenHash]
    );
    console.log("✅ Token marked as used.");

    // ✅ Generate account completion token
    console.log("Generating account completion token...");
    const { token: accountCompletionToken, tokenHash: accountCompletionHash } =
      await generateUniqueToken(client);
    const accountCompletionExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    );

    console.log("Inserting account completion token into database...");
    await client.query(
      `INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
       VALUES ($1, $2, 'account_completion', $3, false, NOW(), NOW());`,
      [user_id, accountCompletionHash, accountCompletionExpiresAt]
    );
    console.log("✅ Account completion token inserted.");

    // ✅ Generate and encrypt preferences token
    console.log("Generating and encrypting preferences token...");
    const { token: preferencesToken, tokenHash: preferencesHash } =
      await generateUniqueToken(client);
    const encryptedPreferencesToken = await encryptToken(preferencesToken);
    console.log("✅ Preferences token encrypted.");

    console.log("Inserting encrypted preferences token into database...");
    await client.query(
      `INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, encrypted_token, token_type, created_at, updated_at)
       VALUES ($1, $2, $3, 'preferences', NOW(), NOW());`,
      [user_id, preferencesHash, encryptedPreferencesToken]
    );
    console.log("✅ Encrypted preferences token inserted.");

    // ✅ Queue welcome email **inside transaction**
    const accountCompletionUrl = `${process.env.FRONTEND_DOMAIN_URL}/complete-account?token=${accountCompletionToken}`;
    const preferencesUrl = `${process.env.FRONTEND_DOMAIN_URL}/manage-preferences?token=${preferencesToken}`;

    await queueEmailJob("welcome-email", email, {
      accountCompletionUrl,
      preferencesUrl,
    });

    // ✅ Commit transaction (everything succeeded)
    await client.query("COMMIT");
    console.log("✅ Transaction committed successfully.");
  } catch (error) {
    // ❌ Rollback if any step fails
    await client.query("ROLLBACK");
    console.error("❌ Transaction failed, rolling back changes:", error);

    if (
      error.message.toLowerCase().includes("expired") ||
      error.message.toLowerCase().includes("not found")
    ) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message }),
      };
    }

    if (error.message.toLowerCase().includes("used")) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Email verified successfully. Please check email.",
        }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Email verified successfully. Please check email.",
    }),
  };
};
