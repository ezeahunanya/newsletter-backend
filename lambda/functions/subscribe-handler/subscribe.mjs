import { generateUniqueToken } from "/opt/shared/generateUniqueToken.mjs";
import { queueEmailJob } from "/opt/shared/queueEmailJob.mjs";

export const handleSubscription = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for subscription.`);

  if (method !== "POST") {
    console.warn(`❌ Method ${method} not allowed.`);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  const { email } = JSON.parse(event.body);

  if (!email) {
    console.error("❌ Email is required but not provided.");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email is required." }),
    };
  }

  let token, tokenHash, userId;

  try {
    // ✅ Start the transaction
    await client.query("BEGIN");
    console.log("🔄 Transaction started.");

    // ✅ Insert new subscriber
    console.log(`Inserting new subscriber with email: ${email}`);
    const userResult = await client.query(
      `
      INSERT INTO ${process.env.SUBSCRIBERS_TABLE_NAME} (email, subscribed, subscribed_at, email_verified, preferences)
      VALUES ($1, true, NOW(), false, $2) RETURNING id;
      `,
      [email, JSON.stringify({ updates: true, promotions: true })]
    );
    userId = userResult.rows[0].id;
    console.log(`✅ Subscriber added with user ID: ${userId}`);

    console.log(`Generating unique token for email: ${email}`);
    ({ token, tokenHash } = await generateUniqueToken(client));
    console.log(`✅ Generated token for ${email}`);

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    console.log(`Token will expire at: ${expiresAt}`);

    // ✅ Insert verification token (linked to the subscriber)
    console.log(`Inserting verification token for user ID: ${userId}`);
    await client.query(
      `
      INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
      VALUES ($1, $2, 'email_verification', $3, false, NOW(), NOW());
      `,
      [userId, tokenHash, expiresAt]
    );
    console.log(`✅ Token inserted into database for user ID: ${userId}`);

    // ✅ Email queueing (inside the transaction)
    const verificationUrl = `${process.env.FRONTEND_DOMAIN_URL}/verify-email?token=${token}`;

    //await queueEmailJob("verify-email", email, { verificationUrl });

    // ✅ Commit the transaction (everything succeeds)
    await client.query("COMMIT");
    console.log("✅ Transaction committed successfully.");
  } catch (error) {
    // ❌ Rollback if anything fails (DB insert or email queuing)
    await client.query("ROLLBACK");
    console.error("❌ Transaction failed, rolling back changes:", error);

    if (error.code === "23505") {
      console.error("❌ This email is already subscribed.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "This email is already subscribed." }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Please verify your email." }),
  };
};
