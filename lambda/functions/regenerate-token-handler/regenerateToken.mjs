import { validateToken } from "/opt/shared/utils/validateToken.mjs";
import { generateUniqueToken } from "/opt/shared/utils/generateUniqueToken.mjs";
import { queueSQSJob } from "/opt/shared/sqs/queueSQSJob.mjs";

export const handleRegenerateToken = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request to regenerate token.`);

  if (method !== "PUT") {
    console.warn(`❌ Method ${method} not allowed.`);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const token = event.headers["x-token"]; // Custom header for token
  const origin = event.headers["x-request-origin"]; // Custom header for origin

  if (!token || !origin) {
    console.error("❌ Token and origin are required but not provided.");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Token and origin are required." }),
    };
  }

  console.log(`Validating origin: ${origin}`);

  // Define token types and valid origins
  const validOrigins = ["verify-email", "complete-account"];
  const tokenTypeMap = {
    "verify-email": "email_verification",
    "complete-account": "account_completion",
  };

  if (!validOrigins.includes(origin)) {
    console.error(`❌ Invalid origin specified: ${origin}`);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid origin specified." }),
    };
  }

  const tokenType = tokenTypeMap[origin];

  let user_id, email, newToken, newTokenHash;

  try {
    // ✅ Begin transaction
    await client.query("BEGIN");
    console.log("🔄 Transaction started.");

    console.log(`Validating token for user with type: ${tokenType}`);
    // ✅ Validate the token (allow expired tokens)
    ({ user_id, email } = await validateToken(
      client,
      token,
      tokenType,
      process.env.SUBSCRIBERS_TABLE_NAME,
      { allowExpired: true }
    ));

    console.log(
      `✅ Token validation successful for user ID: ${user_id}, email: ${email}`
    );

    console.log(`Generating new ${tokenTypeMap[origin]} token...`);
    ({ token: newToken, tokenHash: newTokenHash } = await generateUniqueToken(
      client
    ));
    console.log(`✅ New ${tokenTypeMap[origin]} token generated successfully.`);

    const linkUrl = `${process.env.FRONTEND_DOMAIN_URL}/${origin}?token=${newToken}`;

    // ✅ Update the token table with the new token
    console.log(`Updating token table for user ID: ${user_id}`);
    const updateTokenQuery = `
      UPDATE ${process.env.TOKEN_TABLE_NAME}
      SET token_hash = $1, expires_at = NOW() + interval '24 hours', used = false, updated_at = NOW()
      WHERE user_id = $2 AND token_type = $3
    `;
    await client.query(updateTokenQuery, [newTokenHash, user_id, tokenType]);
    console.log("✅ Token table updated successfully.");

    // ✅ Queue email (inside the transaction)
    await queueSQSJob("regenerate-token", email, {
      linkUrl: linkUrl,
      origin: origin,
    });

    // ✅ Commit transaction (everything succeeded)
    await client.query("COMMIT");
    console.log("✅ Transaction committed successfully.");
  } catch (error) {
    // ❌ Rollback if any step fails
    await client.query("ROLLBACK");
    console.error("❌ Transaction failed, rolling back changes:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "A new link has been sent to your email.",
    }),
  };
};
