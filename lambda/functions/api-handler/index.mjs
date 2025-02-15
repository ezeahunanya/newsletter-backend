import { handleSubscribeRoute } from "./routes/subscribe.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";

export const handler = async (event) => {
  // Detect EventBridge Scheduler warm-up pings
  if (event.source === "aws.scheduler") {
    console.log(
      "Warm-up ping received from EventBridge Scheduler. Keeping Lambda warm."
    );
    return createResponse(200, { message: "Lambda warmed up" });
  }

  // Validate the event structure
  if (!event || !event.requestContext || !event.rawPath) {
    console.error("❌ Invalid event structure.");
    return createResponse(400, { error: "Invalid Request" });
  }

  try {
    // Extract path and stage
    const { stage } = event.requestContext;
    const { rawPath } = event;

    // Normalize path (strip stage prefix if present)
    const normalizedPath = rawPath.replace(`/${stage}`, "");

    // Route handling
    switch (normalizedPath) {
      case "/subscribe":
        return await handleSubscribeRoute(event);
      // Add additional routes here
      default:
        console.warn(`❌ Path not found: ${normalizedPath}`);
        return createResponse(404, { error: "Route Not Found" });
    }
  } catch (error) {
    // Catch unexpected errors
    console.error("❌ Unhandled error:", error);
    return createResponse(500, { error: "Internal Server Error" });
  }
};
