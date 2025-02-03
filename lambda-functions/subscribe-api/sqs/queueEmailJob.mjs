import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

let sqsClient = null;

const getSQSClient = () => {
  if (!sqsClient) {
    sqsClient = new SQSClient({ region: process.env.AWS_REGION });
  }
  return sqsClient;
};

// 🔹 Define queue URLs based on event types
const queueUrlMap = {
  "verify-email": process.env.VERIFY_EMAIL_QUEUE_URL,
  "welcome-email": process.env.PROCESS_EMAIL_QUEUE_URL,
};

export const queueEmailJob = async (email, eventType, data = {}) => {
  const queueUrl = queueUrlMap[eventType]; // Store your SQS queue URL in environment variables
  const sqsClient = getSQSClient();

  const messageBody = JSON.stringify({
    email: email,
    eventType: eventType, // e.g., "verify-email" or "welcome-email"
    data: data, // Pass dynamic data (e.g., links, names, etc.)
  });

  const params = {
    QueueUrl: queueUrl,
    MessageBody: messageBody,
  };

  try {
    await sqsClient.send(new SendMessageCommand(params));
  } catch (error) {
    console.error("Error sending message to SQS", error);
    throw new Error("Failed to queue email job");
  }
};
