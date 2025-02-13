import {
  getDbCredentials,
  connectToDatabase,
} from "/opt/shared/connectToDatabase.mjs";
import { handleSubscription } from "./subscribe.mjs";

export const handler = async (event) => {
  if (event.source === "aws.events") {
    console.log("Lambda warm-up request. Returning early.");
    return;
  }

  const stage = event.requestContext.stage; // Get the stage ('dev', 'prod', etc.)
  const rawPath = event.rawPath; // Includes the stage prefix (e.g., /dev/subscribe)
  const normalizedPath = rawPath.replace(`/${stage}`, ""); // Strip the stage prefix

  if (normalizedPath !== "/subscribe") {
    console.warn(`❌ Route ${normalizedPath} not found.`);
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Route Not found" }),
    };
  }

  let client;

  try {
    const dbCredentials = await getDbCredentials();
    client = await connectToDatabase(dbCredentials);

    return await handleSubscription(client, event);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
