import { hashToken } from "./hashToken.mjs";

export const validateToken = async (
  client,
  token,
  tokenType,
  subscriberTableName = null, // Optional parameter for subscriber table
  { allowExpired = false } = {} // Destructured options
) => {
  console.log(`Starting token validation for token type: ${tokenType}`);

  const tokenHash = hashToken(token);

  const joinClause = subscriberTableName
    ? `JOIN ${subscriberTableName} s ON t.user_id = s.id`
    : "";

  const additionalFields = subscriberTableName ? ", s.email" : "";

  const tokenQuery = `
    SELECT t.user_id, t.used, t.expires_at${additionalFields}
    FROM ${process.env.TOKEN_TABLE_NAME} t
    ${joinClause}
    WHERE t.token_hash = $1 AND t.token_type = $2
    FOR UPDATE;
  `;

  const tokenResult = await client.query(tokenQuery, [tokenHash, tokenType]);

  if (tokenResult.rows.length === 0) {
    console.warn("⚠️ Token not found.");
    throw new Error("User not found: Invalid token.");
  }

  const { used, expires_at, ...additionalFieldsResult } = tokenResult.rows[0];

  console.log(`✅ Token found. Token type: ${tokenType}`);

  if (used) {
    console.warn("⚠️ Token is already used.");
    if (tokenType === "email_verification") {
      throw new Error("Email already subscribed: Token has already been used.");
    } else if (tokenType === "account_completion") {
      throw new Error("Name already saved: Token has already been used.");
    } else {
      throw new Error("Token has already been used.");
    }
  }

  if (tokenType !== "preferences") {
    if (!allowExpired && new Date() > new Date(expires_at)) {
      console.warn("⚠️ Token has expired.");
      throw new Error("Token has expired.");
    }
  }

  return {
    ...additionalFieldsResult,
    isExpired: new Date() > new Date(expires_at),
    message: "Token is valid.",
  };
};
