import crypto from "crypto";
import { generateUniqueToken } from "../db/generateUniqueToken.mjs";
import { validateToken } from "../db/validateToken.mjs";
import { queueEmailJob } from "../sqs/queueEmailJob.mjs";

export const handleVerifyEmail = async (client, event) => {
  const method = event.requestContext.http.method;

  if (method === "PUT") {
    const token = event.headers["x-token"];

    if (!token) {
      throw new Error("Token is required.");
    }

    const { user_id, email, isUsed } = await validateToken(
      client,
      token,
      "email_verification",
      process.env.SUBSCRIBERS_TABLE_NAME,
      { allowUsed: true }
    );

    if (!isUsed) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const markVerifiedQuery = `
        UPDATE ${process.env.SUBSCRIBERS_TABLE_NAME}
        SET email_verified = true
        WHERE id = $1;
      `;
      await client.query(markVerifiedQuery, [user_id]);

      // Mark the token as used
      const markUsedQuery = `
        UPDATE ${process.env.TOKEN_TABLE_NAME}
        SET used = true, updated_at = NOW()
        WHERE token_hash = $1;
      `;
      await client.query(markUsedQuery, [tokenHash]);

      // Generate account completion token
      const {
        token: accountCompletionToken,
        tokenHash: accountCompletionHash,
      } = await generateUniqueToken(client);

      const accountCompletionExpiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, expires_at, used, created_at, updated_at)
        VALUES ($1, $2, 'account_completion', $3, false, NOW(), NOW());
      `,
        [user_id, accountCompletionHash, accountCompletionExpiresAt]
      );

      // Generate preferences token
      const { token: preferencesToken, tokenHash: preferencesHash } =
        await generateUniqueToken(client);

      // Insert the preferences token into the database
      await client.query(
        `
        INSERT INTO ${process.env.TOKEN_TABLE_NAME} (user_id, token_hash, token_type, created_at, updated_at)
        VALUES ($1, $2, 'preferences', NOW(), NOW());
      `,
        [user_id, preferencesHash]
      );

      // Send the welcome email with both URLs
      const accountCompletionUrl = `${process.env.FRONTEND_DOMAIN_URL}/complete-account?token=${accountCompletionToken}`;
      const preferencesUrl = `${process.env.FRONTEND_DOMAIN_URL}/manage-preferences?token=${preferencesToken}`;
      await queueEmailJob(email, "welcome-email", {
        accountCompletionUrl: accountCompletionUrl,
        preferencesUrl: preferencesUrl,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email verified successfully. Please check email.",
      }),
    };
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }
};
