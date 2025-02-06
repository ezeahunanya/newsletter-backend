import { validateToken } from "../db/validateToken.mjs";
import { generateUniqueToken } from "../db/generateUniqueToken.mjs";
import { queueEmailJob, queueUrlMap } from "/opt/shared/queueEmailJob.mjs";

export const handleRegenerateToken = async (client, event) => {
  try {
    const token = event.headers["x-token"]; // Custom header for token
    const origin = event.headers["x-request-origin"]; // Custom header for origin
    if (!token || !origin) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Token and origin are required." }),
      };
    }

    // Define token types and valid origins
    const validOrigins = ["verify-email", "complete-account"];
    const tokenTypeMap = {
      "verify-email": "email_verification",
      "complete-account": "account_completion",
    };

    if (!validOrigins.includes(origin)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid origin specified." }),
      };
    }

    const tokenType = tokenTypeMap[origin];

    // Validate the token (allow expired tokens)
    const { user_id, email } = await validateToken(
      client,
      token,
      tokenType,
      process.env.SUBSCRIBERS_TABLE_NAME,
      { allowExpired: true } // Custom logic to allow expired tokens
    );

    // Generate a new token
    const { token: newToken, tokenHash: newTokenHash } =
      await generateUniqueToken(client);

    // Update the token table with the new token
    const updateTokenQuery = `
      UPDATE ${process.env.TOKEN_TABLE_NAME}
      SET token_hash = $1, expires_at = NOW() + interval '24 hours', used = false, updated_at = NOW()
      WHERE user_id = $2 AND token_type = $3
    `;
    await client.query(updateTokenQuery, [newTokenHash, user_id, tokenType]);

    // Construct the link
    const linkUrl = `${process.env.FRONTEND_DOMAIN_URL}/${origin}?token=${newToken}`;
    const queueUrl = queueUrlMap["regenerate-token"];

    await queueEmailJob(queueUrl, email, {
      linkUrl: linkUrl,
      origin: origin,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "A new link has been sent to your email.",
      }),
    };
  } catch (error) {
    console.error("Error regenerating token:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
