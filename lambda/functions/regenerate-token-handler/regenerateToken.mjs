import { validateToken } from "/opt/shared/utils/validateToken.mjs";
import { generateUniqueToken } from "/opt/shared/utils/generateUniqueToken.mjs";
import { queueSQSJob } from "/opt/shared/sqs/queueSQSJob.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";

export const handleRegenerateToken = async (client, event) => {
  const { method } = event.requestContext.http;
  console.log(`Received ${method} request to regenerate token.`);

  if (method !== "PUT") {
    console.warn(`❌ Method ${method} not allowed.`);
    return createResponse(405, { error: "Method Not Allowed" });
  }

  const token = event.headers["x-token"];
  const origin = event.headers["x-request-origin"];
  if (!token || !origin) {
    console.error("❌ Token and origin are required but not provided.");
    return createResponse(400, { error: "Token and origin are required." });
  }

  // Validate origin and map to token type
  const tokenType = getTokenType(origin);
  if (!tokenType) {
    console.error(`❌ Invalid origin specified: ${origin}`);
    return createResponse(400, { error: "Invalid origin specified." });
  }

  try {
    // Start transaction
    await client.query("BEGIN");
    console.log("🔄 Transaction started.");

    const { user_id, email } = await validateToken(
      client,
      token,
      tokenType,
      process.env.SUBSCRIBERS_TABLE_NAME,
      { allowExpired: true }
    );

    console.log(
      `✅ Token validation successful for user ID: ${user_id}, email: ${email}`
    );

    console.log(`Generating new ${tokenType} token...`);
    const { token: newToken, tokenHash: newTokenHash } =
      await generateUniqueToken(client);

    await updateTokenInDatabase(client, user_id, newTokenHash, tokenType);

    const linkUrl = `${process.env.FRONTEND_DOMAIN_URL}/${origin}?token=${newToken}`;

    // Queue email notification
    await queueSQSJob("regenerate-token", {
      email,
      linkUrl,
      origin,
    });

    // Commit transaction
    await client.query("COMMIT");
    console.log("✅ Transaction committed successfully.");

    return createResponse(200, {
      message: "A new link has been sent to your email.",
    });
  } catch (error) {
    // Rollback on failure
    await client.query("ROLLBACK");
    console.error("❌ Transaction failed, rolling back changes:", error);
    return createResponse(500, { error: "Internal Server Error" });
  }
};

/**
 * Helper Functions
 */

// Map origin to token type
const getTokenType = (origin) => {
  const tokenTypeMap = {
    "verify-email": "email_verification",
    "complete-account": "account_completion",
  };
  return tokenTypeMap[origin] || null;
};

// Update token in the database
const updateTokenInDatabase = async (client, user_id, tokenHash, tokenType) => {
  console.log(`Updating token in database for user ID: ${user_id}`);
  const query = `
    UPDATE ${process.env.TOKEN_TABLE_NAME}
    SET token_hash = $1, expires_at = NOW() + interval '24 hours', 
        used = false, updated_at = NOW()
    WHERE user_id = $2 AND token_type = $3
  `;
  await client.query(query, [tokenHash, user_id, tokenType]);
  console.log("✅ Token updated successfully in database.");
};
