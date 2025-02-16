import { connectToDatabase } from "../db/connectToDatabase.mjs";
import { handleVerifyEmail } from "./verifyEmail.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";

export const handler = async (event) => {
  if (event.source === "aws.events") {
    console.log("🔄 Lambda warm-up request detected. Exiting early.");
    return;
  }

  let client;
  try {
    const stage = event.requestContext.stage; // Get the stage ('dev', 'prod', etc.)
    const rawPath = event.rawPath; // Includes the stage prefix (e.g., /dev/subscribe)
    const normalizedPath = rawPath.replace(`/${stage}`, ""); // Strip the stage prefix

    client = await connectToDatabase();

    if (normalizedPath !== "/verify-email") {
      console.warn(`❌ Route ${normalizedPath} not found.`);
      return createResponse(405, { error: "Not Found" });
    }

    return await handleVerifyEmail(client, event);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  } finally {
    if (client) {
      client = null;
    }
  }
};
