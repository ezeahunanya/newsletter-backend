import { validateToken } from "../db/validateToken.mjs";

export async function handleManagePreferences(client, event) {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for managing preferences.`);

  const token = event.headers["x-token"];

  if (!token) {
    console.error("❌ Token is required but not provided.");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Token is required." }),
    };
  }

  let user_id;

  if (method === "GET") {
    try {
      ({ user_id } = await validateToken(client, token, "preferences"));

      console.log(`Fetching preferences for user ID: ${user_id}...`);
      const query = `
      SELECT preferences
      FROM ${process.env.SUBSCRIBERS_TABLE_NAME}
      WHERE id = $1;
      `;
      const result = await client.query(query, [user_id]);

      const { preferences } = result.rows[0];
      console.log(`✅ Retrieved preferences for user ID: ${user_id}.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ preferences }),
      };
    } catch (error) {
      console.error("❌ Error fetching preferences:", error);

      if (
        error.message.toLowerCase().includes("expired") ||
        error.message.toLowerCase().includes("used") ||
        error.message.toLowerCase().includes("not found")
      ) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: error.message }),
        };
      }

      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Internal Server Error" }),
      };
    }
  } else if (method === "PUT") {
    console.log(`Updating preferences for user ID: ${user_id}...`);
    const preferences = JSON.parse(event.body);

    if (
      typeof preferences.updates === "undefined" ||
      typeof preferences.promotions === "undefined"
    ) {
      console.error("❌ Invalid request: Missing required preferences fields.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Both 'updates' and 'promotions' preferences must be provided.",
        }),
      };
    }

    // Ensure preferences object is always well-formed
    const updatedPreferences = {
      promotions: preferences.promotions ?? false,
      updates: preferences.updates ?? false,
    };

    try {
      // ✅ Begin transaction
      await client.query("BEGIN");
      console.log("🔄 Transaction started.");

      ({ user_id } = await validateToken(client, token, "preferences"));
      console.log(`✅ Token validation successful for user ID: ${user_id}`);

      let updateQuery;
      let updateParams;

      if (!updatedPreferences.updates && !updatedPreferences.promotions) {
        console.log(`User ID ${user_id} unsubscribing from all notifications.`);
        // Unsubscribe from all
        updateQuery = `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET subscribed = false,
              unsubscribed_at = NOW(),
              preferences = $1
          WHERE id = $2;
        `;
        updateParams = [JSON.stringify(updatedPreferences), user_id];
      } else {
        console.log(`Updating preferences and subscribing user ID ${user_id}.`);
        // Update preferences and subscribe if needed
        updateQuery = `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET preferences = $1,
              subscribed = true,
              unsubscribed_at = NULL
          WHERE id = $2;
        `;
        updateParams = [JSON.stringify(updatedPreferences), user_id];
      }

      await client.query(updateQuery, updateParams);
      console.log(
        `✅ Preferences updated successfully for user ID: ${user_id}.`
      );

      // ✅ Commit transaction (everything succeeded)
      await client.query("COMMIT");
      console.log("✅ Transaction committed successfully.");
    } catch (error) {
      // ❌ Rollback if any step fails
      await client.query("ROLLBACK");
      console.error("❌ Transaction failed, rolling back changes:", error);

      if (
        error.message.toLowerCase().includes("expired") ||
        error.message.toLowerCase().includes("used") ||
        error.message.toLowerCase().includes("not found")
      ) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: error.message }),
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
        message: "Preferences updated successfully.",
      }),
    };
  } else {
    console.warn(`❌ Method ${method} not allowed.`);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
}
