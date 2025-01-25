import crypto from "crypto";
import { validateToken } from "./validateToken.mjs";

export const handleCompleteAccount = async (
  client,
  event,
  tokenTableName,
  subscriberTableName,
) => {
  const method = event.requestContext.http.method;

  if (method === "GET") {
    const token = event.headers["x-token"];

    if (!token) {
      throw new Error("Token is required.");
    }

    const result = await validateToken(
      client,
      tokenTableName,
      token,
      "account_completion",
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } else if (method === "POST") {
    const token = event.headers["x-token"];
    const { firstName, lastName } = JSON.parse(event.body);

    if (!token || !firstName) {
      throw new Error("Token and first name are required.");
    }

    const { user_id } = await validateToken(
      client,
      tokenTableName,
      token,
      "account_completion",
    );

    const updateQuery = `
      UPDATE ${subscriberTableName}
      SET first_name = $1, last_name = $2
      WHERE id = $3;
    `;
    await client.query(updateQuery, [firstName, lastName || null, user_id]);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const markUsedQuery = `
    UPDATE ${tokenTableName}
    SET used = true, updated_at = NOW()
    WHERE token_hash = $1;
  `;
    await client.query(markUsedQuery, [tokenHash]);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Names successfully added." }),
    };
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
};
