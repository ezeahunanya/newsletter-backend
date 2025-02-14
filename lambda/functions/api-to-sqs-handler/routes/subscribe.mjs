import { queueSQSJob } from "/opt/shared/queueSQSJob.mjs";

export const handleSubscribeRoute = async (event) => {
  try {
    // Parse and validate the request body
    const { body } = event;

    let requestBody;
    try {
      requestBody = JSON.parse(body);
    } catch (error) {
      console.error("❌ Invalid JSON in request body:", error);
      return createResponse(400, { error: "Invalid JSON body" });
    }

    const { email } = requestBody;

    if (!email) {
      console.error("❌ Missing email in request body.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    // Queue the job
    await queueSQSJob("new-subscriber", { email });

    return createResponse(202, { message: "Subscription request received" });
  } catch (error) {
    console.error("❌ Error handling /subscribe route:", error);
    return createResponse(500, { error: "Internal Server Error" });
  }
};
