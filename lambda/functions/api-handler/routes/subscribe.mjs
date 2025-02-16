import { queueSQSJob } from "/opt/shared/sqs/queueSQSJob.mjs";
import { createResponse } from "/opt/shared/utils/createResponse.mjs";

export const handleSubscribeRoute = async (event) => {
  try {
    const method = event.requestContext.http.method;
    console.log(`Received ${method} request for subscription.`);

    if (method !== "POST") {
      console.warn(`❌ Method ${method} not allowed.`);
      return createResponse(405, { error: "Method Not Allowed" });
    }

    // Parse the request body (assuming it's valid JSON from API Gateway)
    const { email } = JSON.parse(event.body);

    if (!email) {
      console.error("❌ Missing email in request body.");
      return createResponse(400, { error: "Email is required" });
    }

    // Queue the job
    await queueSQSJob("subscribe", { email });

    return createResponse(202, { message: "Please verify your email." });
  } catch (error) {
    console.error("❌ Error handling /subscribe route:", error);
    return createResponse(500, { error: "Internal Server Error" });
  }
};
