import { generateUniqueToken } from "./generateUniqueToken.mjs";
import { sendVerificationEmail } from "./email.mjs";

export const handleSubscription = async (
  client,
  event,
  subscriberTableName,
  tokenTableName,
  frontendUrlBase,
  configurationSet,
) => {
  const method = event.requestContext.http.method;

  if (method === "POST") {
    const { email } = JSON.parse(event.body);

    if (!email) {
      throw new Error("Email is required.");
    }

    try {
      const { token, tokenHash } = await generateUniqueToken(
        client,
        tokenTableName,
      );

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const userId = await client.query(
        `
        INSERT INTO ${subscriberTableName} (email, subscribed, subscribed_at, email_verified, preferences)
        VALUES ($1, true, NOW(), false, $2) RETURNING id;
      `,
        [
          email,
          JSON.stringify({
            updates: true,
            promotions: true,
          }),
        ],
      );

      await client.query(
        `
        INSERT INTO ${tokenTableName} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
        VALUES ($1, $2, 'email_verification', $3, false, NOW(), NOW());
      `,
        [userId.rows[0].id, tokenHash, expiresAt],
      );

      const verificationUrl = `${frontendUrlBase}/verify-email?token=${token}`;
      await sendVerificationEmail(email, verificationUrl, configurationSet);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Please verify your email." }),
      };
    } catch (error) {
      if (error.code === "23505") {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "This email is already subscribed." }),
        };
      }
      throw error;
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
};
