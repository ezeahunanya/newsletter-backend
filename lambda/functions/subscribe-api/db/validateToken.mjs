import crypto from "crypto";

export const validateToken = async (
  client,
  token,
  tokenType,
  subscriberTableName = null, // Optional parameter for subscriber table
  { allowExpired = false, allowUsed = false } = {} // Destructured options
) => {
  console.log(`Starting token validation for token type: ${tokenType}`);

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const joinClause = subscriberTableName
    ? `JOIN ${subscriberTableName} s ON t.user_id = s.id`
    : "";

  const additionalFields = subscriberTableName ? ", s.email" : "";

  const tokenQuery = `
    SELECT t.user_id, t.used, t.expires_at${additionalFields}
    FROM ${process.env.TOKEN_TABLE_NAME} t
    ${joinClause}
    WHERE t.token_hash = $1 AND t.token_type = $2;
  `;

  console.log(`Executing token query for token hash: ${tokenHash}`);

  const tokenResult = await client.query(tokenQuery, [tokenHash, tokenType]);

  if (tokenResult.rows.length === 0) {
    console.error(
      "❌ Token validation failed: Invalid token or user not found."
    );
    throw new Error("User not found: Invalid token.");
  }

  const { used, expires_at, ...additionalFieldsResult } = tokenResult.rows[0];

  console.log(`✅ Token validation successful. Token type: ${tokenType}`);

  if (used) {
    console.warn("⚠️ Token is already used.");
    if (!allowUsed) {
      if (tokenType === "email_verification") {
        throw new Error(
          "Email already subscribed: Token has already been used."
        );
      } else if (tokenType === "account_completion") {
        throw new Error("Name already saved: Token has already been used.");
      } else {
        throw new Error("Token has already been used.");
      }
    }
  }

  if (tokenType !== "preferences") {
    if (!allowExpired && new Date() > new Date(expires_at)) {
      console.warn("⚠️ Token has expired.");
      throw new Error("Token has expired.");
    }
  }

  console.log(
    `✅ Token is valid for user ID: ${additionalFieldsResult.user_id}`
  );
  return {
    ...additionalFieldsResult,
    isExpired: new Date() > new Date(expires_at),
    isUsed: used,
    message: "Token is valid.",
  };
};
