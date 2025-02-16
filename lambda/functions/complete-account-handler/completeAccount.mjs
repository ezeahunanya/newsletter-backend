import { validateToken } from "/opt/shared/utils/validateToken.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";
import { hashToken } from "/opt/shared/utils/hashToken.mjs";
import { handleError } from "/opt/shared/utils/handleError.mjs";

export const handleCompleteAccount = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for account completion.`);

  if (method === "GET") {
    const token = event.headers["x-token"];
    if (!token) {
      console.error("❌ Token is required but not provided.");
      return createResponse(400, { error: "Token is required." });
    }

    try {
      await validateToken(client, token, "account_completion");
      console.log("✅ Token validation successful.");
      return createResponse(200, { message: "Token is valid." });
    } catch (error) {
      console.error("❌ Token validation failed:", error);
      return createResponse(400, { error: error.message });
    }
  }

  if (method === "PUT") {
    const token = event.headers["x-token"];
    const { firstName, lastName } = JSON.parse(event.body);

    if (!token || !firstName) {
      console.error("❌ Missing required fields: Token and first name.");
      return createResponse(400, {
        error: "Token and first name are required.",
      });
    }

    const tokenHash = hashToken(token);
    let userId;

    try {
      // Start transaction
      await client.query("BEGIN");
      console.log("🔄 Transaction started.");

      // Validate token
      ({ user_id: userId } = await validateToken(
        client,
        token,
        "account_completion"
      ));
      console.log(`✅ Token validated for user ID: ${userId}`);

      // Update user's name
      await client.query(
        `UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
         SET first_name = $1, last_name = $2
         WHERE id = $3;`,
        [firstName, lastName || null, userId]
      );
      console.log(`✅ User's name updated for user ID: ${userId}`);

      // Mark token as used
      await client.query(
        `UPDATE ${process.env.TOKEN_TABLE_NAME}
         SET used = true, updated_at = NOW()
         WHERE token_hash = $1;`,
        [tokenHash]
      );
      console.log("✅ Token successfully marked as used.");

      // Commit transaction
      await client.query("COMMIT");
      console.log("✅ Transaction committed successfully.");
    } catch (error) {
      return handleError(error, client);
    }

    return createResponse(200, { message: "Names successfully added." });
  }

  console.warn(`❌ Method ${method} not allowed.`);
  return createResponse(405, { error: "Method Not Allowed" });
};
