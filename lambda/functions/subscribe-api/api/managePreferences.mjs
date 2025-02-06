import { validateToken } from "../db/validateToken.mjs";

export async function handleManagePreferences(client, event) {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for managing preferences.`);

  const token = event.headers["x-token"];

  if (!token) {
    console.error("❌ Token is required but not provided.");
    throw new Error("Token is required.");
  }

  try {
    console.log("Validating token for preferences...");
    const { user_id } = await validateToken(client, token, "preferences");
    console.log(`✅ Token validation successful for user ID: ${user_id}`);

    if (method === "GET") {
      console.log(`Fetching preferences for user ID: ${user_id}...`);
      const query = `
        SELECT preferences
        FROM ${process.env.SUBSCRIBERS_TABLE_NAME}
        WHERE id = $1;
      `;
      const result = await client.query(query, [user_id]);

      if (result.rows.length === 0) {
        console.warn(`⚠️ User ID ${user_id} not found.`);
        return {
          statusCode: 404,
          body: JSON.stringify({ message: "User not found." }),
        };
      }

      const { preferences } = result.rows[0];
      console.log(`✅ Retrieved preferences for user ID: ${user_id}.`);
      return {
        statusCode: 200,
        body: JSON.stringify({ preferences }),
      };
    } else if (method === "PUT") {
      console.log(`Updating preferences for user ID: ${user_id}...`);
      const preferences = JSON.parse(event.body);

      if (
        typeof preferences.updates === "undefined" ||
        typeof preferences.promotions === "undefined"
      ) {
        console.error(
          "❌ Invalid request: Missing required preferences fields."
        );
        throw new Error(
          "Both 'updates' and 'promotions' preferences must be provided."
        );
      }

      // Ensure preferences object is always well-formed
      const updatedPreferences = {
        promotions: preferences.promotions ?? false,
        updates: preferences.updates ?? false,
      };

      if (!updatedPreferences.updates && !updatedPreferences.promotions) {
        console.log(`User ID ${user_id} unsubscribing from all notifications.`);
        // Unsubscribe from all
        const updateQuery = `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET subscribed = false,
              unsubscribed_at = NOW(),
              preferences = $1
          WHERE id = $2;
        `;
        await client.query(updateQuery, [updatedPreferences, user_id]);

        console.log(`✅ User ID ${user_id} unsubscribed successfully.`);
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Unsubscribed from all successfully.",
          }),
        };
      } else {
        console.log(`Updating preferences and subscribing user ID ${user_id}.`);
        // Update preferences and subscribe if needed
        const newPreferences = JSON.stringify(updatedPreferences);
        const updateQuery = `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET preferences = $1,
              subscribed = true,
              unsubscribed_at = NULL
          WHERE id = $2;
        `;
        await client.query(updateQuery, [newPreferences, user_id]);

        console.log(
          `✅ Preferences updated successfully for user ID: ${user_id}.`
        );
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Preferences updated successfully.",
          }),
        };
      }
    } else {
      console.warn(`❌ Method ${method} not allowed.`);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }
  } catch (error) {
    console.error("❌ Error handling preferences:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
}
