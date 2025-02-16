import { connectToDatabase } from "/opt/shared/db/connectToDatabase.mjs";
import { handleVerifyEmail } from "./verifyEmail.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";

export const handler = async (event) => {
  // Handle Lambda warm-up requests
  if (event.source === "aws.events") {
    console.log("🔄 Lambda warm-up request detected. Exiting early.");
    return;
  }

  let client;

  try {
    // Normalize the request path
    const { requestContext: { stage } = {}, rawPath } = event;
    const normalizedPath = rawPath.replace(`/${stage}`, "");

    // Validate route
    if (normalizedPath !== "/verify-email") {
      console.warn(`❌ Route ${normalizedPath} not supported.`);
      return createResponse(404, { error: "Not Found" });
    }

    // Database connection
    console.log("Connecting to the database...");
    client = await connectToDatabase();

    // Route handler
    return await handleVerifyEmail(client, event);
  } catch (error) {
    console.error("❌ Error in Lambda handler:", error);

    // Consistent error response
    return createResponse(500, { error: "Internal Server Error" });
  } finally {
    // Ensure the database client is cleaned up
    if (client) {
      console.log("🔒 Cleaning up database client.");
      client = null;
    }
  }
};
