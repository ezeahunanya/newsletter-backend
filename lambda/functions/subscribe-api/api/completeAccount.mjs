import crypto from "crypto";
import { validateToken } from "../db/validateToken.mjs";

export const handleCompleteAccount = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for account completion.`);

  try {
    if (method === "GET") {
      const token = event.headers["x-token"];

      if (!token) {
        console.error("❌ Token is required but not provided.");
        throw new Error("Token is required.");
      }

      console.log("Validating token for account completion...");
      const result = await validateToken(client, token, "account_completion");
      console.log("✅ Token validation successful.");

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    } else if (method === "PUT") {
      const token = event.headers["x-token"];
      const { firstName, lastName } = JSON.parse(event.body);

      if (!token || !firstName) {
        console.error("❌ Missing required fields: Token and first name.");
        throw new Error("Token and first name are required.");
      }

      console.log("Validating token for account completion...");
      const { user_id } = await validateToken(
        client,
        token,
        "account_completion"
      );
      console.log(
        "✅ Token validation successful. Proceeding with database update..."
      );

      const updateQuery = `
        UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
        SET first_name = $1, last_name = $2
        WHERE id = $3;
      `;
      await client.query(updateQuery, [firstName, lastName || null, user_id]);
      console.log(`✅ Successfully updated name for user ID: ${user_id}`);

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      console.log("Marking token as used...");

      const markUsedQuery = `
        UPDATE ${process.env.TOKEN_TABLE_NAME}
        SET used = true, updated_at = NOW()
        WHERE token_hash = $1;
      `;
      await client.query(markUsedQuery, [tokenHash]);
      console.log("✅ Token successfully marked as used.");

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Names successfully added." }),
      };
    } else {
      console.warn(`❌ Method ${method} not allowed.`);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }
  } catch (error) {
    console.error("❌ Error handling account completion:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
