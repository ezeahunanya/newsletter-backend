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
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Token is required." }),
        };
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
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Token and first name are required." }),
        };
      }

      console.log("Validating token for account completion...");
      let user_id;
      try {
        ({ user_id } = await validateToken(
          client,
          token,
          "account_completion"
        ));
        console.log(`✅ Token validation successful for user ID: ${user_id}`);
      } catch (error) {
        console.error("❌ Token validation failed:", error);
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid or expired token." }),
        };
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      try {
        // ✅ Begin transaction
        await client.query("BEGIN");
        console.log("🔄 Transaction started.");

        // ✅ Update user's first and last name
        console.log(`Updating name for user ID: ${user_id}`);
        const updateQuery = `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET first_name = $1, last_name = $2
          WHERE id = $3;
        `;
        await client.query(updateQuery, [firstName, lastName || null, user_id]);
        console.log(`✅ Successfully updated name for user ID: ${user_id}`);

        // ✅ Mark token as used
        console.log("Marking token as used...");
        const markUsedQuery = `
          UPDATE ${process.env.TOKEN_TABLE_NAME}
          SET used = true, updated_at = NOW()
          WHERE token_hash = $1;
        `;
        await client.query(markUsedQuery, [tokenHash]);
        console.log("✅ Token successfully marked as used.");

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
      body: JSON.stringify({ error: error.message }),
    };
  }
};
