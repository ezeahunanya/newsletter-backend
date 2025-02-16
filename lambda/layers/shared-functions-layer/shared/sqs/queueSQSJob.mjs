import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// Initialize SQS client lazily to avoid unnecessary instantiation
let sqsClient;

/**
 * Lazily retrieves or initializes the SQS client
 * @returns {SQSClient} - The initialized SQS client
 */
const getSQSClient = () => {
  if (!sqsClient) {
    console.log("Initializing new SQS client...");
    sqsClient = new SQSClient({ region: process.env.AWS_REGION });
    console.log("✅ SQS client initialized.");
  }
  return sqsClient;
};

// 🔹 Map event types to their respective SQS queue URLs
const queueUrlMap = {
  subscribe: process.env.SUBSCRIBE_QUEUE_URL,
  "verify-email": process.env.VERIFY_EMAIL_QUEUE_URL,
  "complete-account": process.env.COMPLETE_ACCOUNT_QUEUE_URL,
  "manage-preferences": process.env.MANAGE_PREFERENCES_QUEUE_URL,
  "process-verification-email": process.env.PROCESS_WELCOME_EMAIL_QUEUE_URL,
  "process-welcome-email": process.env.PROCESS_WELCOME_EMAIL_QUEUE_URL,
  "process-token-regeneration-email":
    process.env.PROCESS_WELCOME_EMAIL_QUEUE_URL,
  "process-newsletter-email": process.env.PROCESS_NEWSLETTER_EMAIL_QUEUE_URL,
};

/**
 * Queues a job in SQS
 * @param {string} eventType - The type of event to process
 * @param {object} data - Data to be passed with the job
 * @throws {Error} - If the event type is invalid or SQS operation fails
 */
export const queueSQSJob = async (eventType, data = {}) => {
  const queueUrl = queueUrlMap[eventType];

  if (!queueUrl) {
    console.error(`❌ Invalid event type: "${eventType}"`);
    throw new Error(`Invalid event type: "${eventType}"`);
  }

  const sqsClient = getSQSClient();
  const messageBody = JSON.stringify({ eventType, ...data });

  try {
    const params = {
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    };

    const result = await sqsClient.send(new SendMessageCommand(params));
    console.log(
      `✅ Successfully queued job for event "${eventType}" (MessageId: ${result.MessageId})`
    );

    return result.MessageId; // Return MessageId for additional tracking if needed
  } catch (error) {
    console.error(`❌ Failed to queue job for event "${eventType}":`, error);
    throw new Error(`Failed to queue SQS job for event "${eventType}"`);
  }
};
