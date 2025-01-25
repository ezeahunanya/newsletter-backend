import { getDbCredentials, connectToDatabase } from "./db.mjs";
import { handleSubscription } from "./subscribe.mjs";
import { handleVerifyEmail } from "./verifyEmail.mjs";
import { handleCompleteAccount } from "./completeAccount.mjs";
import { handleManagePreferences } from "./managePreferences.mjs";
import { handleRegenerateToken } from "./regenerateToken.mjs";

const {
  TABLE_NAME_DEV,
  TABLE_NAME_PROD,
  TOKEN_TABLE_DEV,
  TOKEN_TABLE_PROD,
  WELCOME_CONFIGURATION_SET_DEV,
  WELCOME_CONFIGURATION_SET_PROD,
  APP_STAGE,
  FRONTEND_DOMAIN_URL_DEV,
  FRONTEND_DOMAIN_URL_PROD,
} = process.env;

const isProd = APP_STAGE === "prod";
const subscriberTableName = isProd ? TABLE_NAME_PROD : TABLE_NAME_DEV;
const tokenTableName = isProd ? TOKEN_TABLE_PROD : TOKEN_TABLE_DEV;
const configurationSet = isProd
  ? WELCOME_CONFIGURATION_SET_PROD
  : WELCOME_CONFIGURATION_SET_DEV;
const frontendUrl = isProd ? FRONTEND_DOMAIN_URL_PROD : FRONTEND_DOMAIN_URL_DEV;

export const handler = async (event) => {
  const stage = event.requestContext.stage; // Get the stage ('dev', 'prod', etc.)
  const rawPath = event.rawPath; // Includes the stage prefix (e.g., /dev/subscribe)
  const normalizedPath = rawPath.replace(`/${stage}`, ""); // Strip the stage prefix

  let client;

  try {
    const dbCredentials = await getDbCredentials();
    client = await connectToDatabase(dbCredentials);

    if (normalizedPath === "/subscribe") {
      return await handleSubscription(
        client,
        event,
        subscriberTableName,
        tokenTableName,
        frontendUrl,
        configurationSet,
      );
    } else if (normalizedPath === "/verify-email") {
      return await handleVerifyEmail(
        client,
        event,
        tokenTableName,
        subscriberTableName,
        frontendUrl,
        configurationSet,
      );
    } else if (normalizedPath === "/complete-account") {
      return await handleCompleteAccount(
        client,
        event,
        tokenTableName,
        subscriberTableName,
      );
    } else if (normalizedPath === "/manage-preferences") {
      return await handleManagePreferences(
        client,
        event,
        tokenTableName,
        subscriberTableName,
      );
    } else if (normalizedPath === "/regenerate-token") {
      return await handleRegenerateToken(
        client,
        event,
        tokenTableName,
        subscriberTableName,
        frontendUrl,
      );
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Not Found" }),
    };
  } catch (error) {
    console.error(error);

    if (error.message === "This email is already subscribed.") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "This email is already subscribed." }),
      };
    }

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
