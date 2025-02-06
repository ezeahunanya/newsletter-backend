import { generateUniqueToken } from "../db/generateUniqueToken.mjs";
import { queueEmailJob, queueUrlMap } from "/opt/shared/queueEmailJob.mjs";

export const handleSubscription = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for subscription.`);

  if (method === "POST") {
    const { email } = JSON.parse(event.body);

    if (!email) {
      console.error("❌ Email is required but not provided.");
      throw new Error("Email is required.");
    }

    try {
      console.log(`Generating unique token for email: ${email}`);
      const { token, tokenHash } = await generateUniqueToken(client);
      console.log(`✅ Generated token for ${email}`);

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiration
      console.log(`Token will expire at: ${expiresAt}`);

      console.log(`Inserting new subscriber with email: ${email}`);
      const userId = await client.query(
        `
        INSERT INTO ${process.env.SUBSCRIBERS_TABLE_NAME} (email, subscribed, subscribed_at, email_verified, preferences)
        VALUES ($1, true, NOW(), false, $2) RETURNING id;
      `,
        [
          email,
          JSON.stringify({
            updates: true,
            promotions: true,
          }),
        ]
      );
      console.log(`✅ Subscriber added with user ID: ${userId.rows[0].id}`);

      console.log(
        `Inserting verification token for user ID: ${userId.rows[0].id}`
      );
      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
        VALUES ($1, $2, 'email_verification', $3, false, NOW(), NOW());
      `,
        [userId.rows[0].id, tokenHash, expiresAt]
      );
      console.log(
        `✅ Token inserted into database for user ID: ${userId.rows[0].id}`
      );

      const verificationUrl = `${process.env.FRONTEND_DOMAIN_URL}/verify-email?token=${token}`;
      console.log(`Verification URL: ${verificationUrl}`);

      const queueUrl = queueUrlMap["verify-email"];
      console.log(
        `Queuing email verification job for ${email} to ${queueUrl}...`
      );

      await queueEmailJob(queueUrl, email, {
        verificationUrl: verificationUrl,
      });

      console.log(`✅ Email verification job queued for ${email}.`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Please verify your email." }),
      };
    } catch (error) {
      if (error.code === "23505") {
        // Duplicate email error
        console.error("❌ This email is already subscribed.");
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "This email is already subscribed." }),
        };
      }
      console.error("❌ Error during subscription:", error);
      throw error;
    }
  } else {
    console.warn(`❌ Method ${method} not allowed.`);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
};
