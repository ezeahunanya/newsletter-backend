import { handleSubscribeRoute } from "./routes/subscribe.mjs";

export const handler = async (event) => {
  try {
    // Validate the event structure
    if (!event || !event.requestContext || !event.rawPath) {
      console.error("Invalid event structure.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid Request" }),
      };
    }

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
        console.warn(`Path not found: ${normalizedPath}`);
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Route Not Found" }),
        };
    }
  } catch (error) {
    // Catch unexpected errors
    console.error("Unhandled error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
