import { validateToken } from "./validateToken.mjs";

export async function handleManagePreferences(
  client,
  event,
  tokenTableName,
  subscriberTableName,
) {
  const method = event.requestContext.http.method; // Check the HTTP method (GET or POST)
  const token = event.headers["x-token"];

  if (!token) {
    throw new Error("Token is required.");
  }

  const { user_id } = await validateToken(
    client,
    tokenTableName,
    token,
    "preferences",
  );

  if (method === "GET") {
    const query = `
      SELECT preferences
      FROM ${subscriberTableName}
      WHERE id = $1;
    `;
    const result = await client.query(query, [user_id]);

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found." }),
      };
    }

    const { preferences } = result.rows[0];
    return {
      statusCode: 200,
      body: JSON.stringify({ preferences }),
    };
  } else if (method === "POST") {
    const preferences = JSON.parse(event.body);

    if (
      typeof preferences.updates === "undefined" ||
      typeof preferences.promotions === "undefined"
    ) {
      throw new Error(
        "Both 'updates' and 'promotions' preferences must be provided.",
      );
    }

    // Ensure preferences object is always well-formed
    const updatedPreferences = {
      promotions: preferences.promotions ?? false,
      updates: preferences.updates ?? false,
    };

    if (!updatedPreferences.updates && !updatedPreferences.promotions) {
      // Unsubscribe from all
      const updateQuery = `
        UPDATE ${subscriberTableName}
        SET subscribed = false,
            unsubscribed_at = NOW(),
            preferences = $1
        WHERE id = $2;
      `;
      await client.query(updateQuery, [updatedPreferences, user_id]);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Unsubscribed from all successfully.",
        }),
      };
    } else {
      // Update preferences and subscribe if needed
      const newPreferences = JSON.stringify(updatedPreferences);
      const updateQuery = `
        UPDATE ${subscriberTableName}
        SET preferences = $1,
            subscribed = true,
            unsubscribed_at = NULL
        WHERE id = $2;
      `;
      await client.query(updateQuery, [newPreferences, user_id]);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Preferences updated successfully." }),
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
}
