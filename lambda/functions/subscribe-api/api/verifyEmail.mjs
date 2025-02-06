import crypto from "crypto";
import { generateUniqueToken } from "../db/generateUniqueToken.mjs";
import { validateToken } from "../db/validateToken.mjs";
import { queueEmailJob } from "/opt/shared/queueEmailJob.mjs";
import { encryptToken } from "../db/encryption.mjs";

export const handleVerifyEmail = async (client, event) => {
  const method = event.requestContext.http.method;
  console.log(`Received ${method} request for email verification.`);

  if (method === "PUT") {
    const token = event.headers["x-token"];
    if (!token) {
      console.error("❌ Token is required but not provided.");
      throw new Error("Token is required.");
    }

    console.log("Validating token...");
    const { user_id, email, isUsed } = await validateToken(
      client,
      token,
      "email_verification",
      process.env.SUBSCRIBERS_TABLE_NAME,
      { allowUsed: true }
    );

    if (!isUsed) {
      console.log(
        `✅ Token validated for user ID: ${user_id}, email: ${email}`
      );

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      console.log("Marking email as verified...");
      const markVerifiedQuery = `
        UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
        SET email_verified = true
        WHERE id = $1;
      `;
      await client.query(markVerifiedQuery, [user_id]);
      console.log("✅ Email marked as verified.");

      console.log("Marking token as used...");
      const markUsedQuery = `
        UPDATE ${process.env.TOKEN_TABLE_NAME}
        SET used = true, updated_at = NOW()
        WHERE token_hash = $1;
      `;
      await client.query(markUsedQuery, [tokenHash]);
      console.log("✅ Token marked as used.");

      // Generate account completion token
      console.log("Generating account completion token...");
      const {
        token: accountCompletionToken,
        tokenHash: accountCompletionHash,
      } = await generateUniqueToken(client);

      const accountCompletionExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      console.log("Inserting account completion token into the database...");
      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
        VALUES ($1, $2, 'account_completion', $3, false, NOW(), NOW());
      `,
        [user_id, accountCompletionHash, accountCompletionExpiresAt]
      );
      console.log("✅ Account completion token inserted.");

      // Generate and encrypt preferences token
      console.log("Generating and encrypting preferences token...");
      const { token: preferencesToken, tokenHash: preferencesHash } =
        await generateUniqueToken(client);

      const encryptedPreferencesToken = await encryptToken(preferencesToken);
      console.log("✅ Preferences token encrypted.");

      // Insert the encrypted preferences token and its hash into the database
      console.log("Inserting encrypted preferences token into the database...");
      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, encrypted_token, token_type, created_at, updated_at)
        VALUES ($1, $2, $3, 'preferences', NOW(), NOW());
      `,
        [user_id, preferencesHash, encryptedPreferencesToken]
      );
      console.log("✅ Encrypted preferences token inserted.");

      // Send the welcome email with both URLs
      const accountCompletionUrl = `${process.env.FRONTEND_DOMAIN_URL}/complete-account?token=${accountCompletionToken}`;
      const preferencesUrl = `${process.env.FRONTEND_DOMAIN_URL}/manage-preferences?token=${preferencesToken}`;

      console.log("Queuing welcome email job...");
      await queueEmailJob("welcome-email", email, {
        accountCompletionUrl: accountCompletionUrl,
        preferencesUrl: preferencesUrl,
      });
      console.log("✅ Welcome email job queued.");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email verified successfully. Please check email.",
      }),
    };
  } else {
    console.warn(`❌ Method ${method} not allowed.`);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
};
