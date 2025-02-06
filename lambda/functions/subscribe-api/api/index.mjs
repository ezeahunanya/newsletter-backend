import {
  getDbCredentials,
  connectToDatabase,
} from "../db/connectToDatabase.mjs";
import { handleSubscription } from "./subscribe.mjs";
import { handleVerifyEmail } from "./verifyEmail.mjs";
import { handleCompleteAccount } from "./completeAccount.mjs";
import { handleManagePreferences } from "./managePreferences.mjs";
import { handleRegenerateToken } from "./regenerateToken.mjs";
import { processSQSMessage } from "../sqs/sqsProcessor.mjs";

export const handler = async (event) => {
  let client;
  try {
    if (event.Records) {
      // 🔹 This is an SQS event
      return await processSQSMessage(event);
    }

    const stage = event.requestContext.stage; // Get the stage ('dev', 'prod', etc.)
    const rawPath = event.rawPath; // Includes the stage prefix (e.g., /dev/subscribe)
    const normalizedPath = rawPath.replace(`/${stage}`, ""); // Strip the stage prefix

    const dbCredentials = await getDbCredentials();
    client = await connectToDatabase(dbCredentials);

    if (normalizedPath === "/subscribe") {
      return await handleSubscription(client, event);
    } else if (normalizedPath === "/verify-email") {
      return await handleVerifyEmail(client, event);
    } else if (normalizedPath === "/complete-account") {
      return await handleCompleteAccount(client, event);
    } else if (normalizedPath === "/manage-preferences") {
      return await handleManagePreferences(client, event);
    } else if (normalizedPath === "/regenerate-token") {
      return await handleRegenerateToken(client, event);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Not Found" }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    if (client) {
      await client.end();
    }
  }
};
