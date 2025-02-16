import { validateToken } from "/opt/utils/validateToken.mjs";
import { handleError } from "/opt/shared/utils/handleError.mjs";

export async function handleManagePreferences(client, event) {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for managing preferences.`);

  const token = event.headers["x-token"];
  if (!token) {
    console.error("❌ Token is required but not provided.");
    return createResponse(400, { error: "Token is required." });
  }

  try {
    // Validate token to get user ID
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

      const { preferences } = result.rows[0];
      console.log(`✅ Retrieved preferences for user ID: ${user_id}.`);
      return createResponse(200, { preferences });
    }

    if (method === "PUT") {
      console.log(`Updating preferences for user ID: ${user_id}...`);

      const { updates, promotions } = JSON.parse(event.body);
      if (typeof updates === "undefined" || typeof promotions === "undefined") {
        console.error("❌ Missing required preferences fields.");
        return createResponse(400, {
          error:
            "Both 'updates' and 'promotions' preferences must be provided.",
        });
      }

      // Ensure preferences object is well-formed
      const updatedPreferences = {
        updates: updates ?? false,
        promotions: promotions ?? false,
      };

      // Start transaction
      await client.query("BEGIN");
      console.log("🔄 Transaction started.");

      const query =
        updatedPreferences.updates || updatedPreferences.promotions
          ? `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET preferences = $1,
              subscribed = true,
              unsubscribed_at = NULL
          WHERE id = $2;
        `
          : `
          UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
          SET preferences = $1,
              subscribed = false,
              unsubscribed_at = NOW()
          WHERE id = $2;
        `;

      const params = [JSON.stringify(updatedPreferences), user_id];
      await client.query(query, params);

      console.log(
        `✅ Preferences updated successfully for user ID: ${user_id}.`
      );

      // Commit transaction
      await client.query("COMMIT");
      console.log("✅ Transaction committed successfully.");
      return createResponse(200, {
        message: "Preferences updated successfully.",
      });
    }

    console.warn(`❌ Method ${method} not allowed.`);
    return createResponse(405, { error: "Method Not Allowed" });
  } catch (error) {
    return handleError(error, client);
  }
}
