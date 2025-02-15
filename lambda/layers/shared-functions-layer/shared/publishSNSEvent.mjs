import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

// Initialize SNS client lazily to avoid unnecessary instantiation
let snsClient;

/**
 * Lazily retrieves or initializes the SNS client
 * @returns {SNSClient} - The initialized SNS client
 */
const getSNSClient = () => {
  if (!snsClient) {
    console.log("Initializing new SNS client...");
    snsClient = new SNSClient({ region: process.env.AWS_REGION });
    console.log("✅ SNS client initialized.");
  }
  return snsClient;
};

// 🔹 Map event types to their respective SNS topic ARNs
const topicArnMap = {
  "new-subscriber": process.env.NEW_SUBSCRIBER_TOPIC_ARN,
  "verify-email": process.env.VERIFY_EMAIL_TOPIC_ARN,
  "regenerate-token": process.env.VERIFY_EMAIL_TOPIC_ARN,
};

/**
 * Publishes a message to an SNS topic
 * @param {string} eventType - The type of event to process
 * @param {object} data - Data to be passed with the event
 * @throws {Error} - If the event type is invalid or SNS operation fails
 */
export const publishSNSEvent = async (eventType, data = {}) => {
  const topicArn = topicArnMap[eventType];

  if (!topicArn) {
    console.error(`❌ Invalid event type: "${eventType}"`);
    throw new Error(`Invalid event type: "${eventType}"`);
  }

  const snsClient = getSNSClient();
  const messageBody = JSON.stringify({ eventType, ...data });

  try {
    const params = {
      TopicArn: topicArn,
      Message: messageBody,
      MessageAttributes: {
        eventType: {
          DataType: "String",
          StringValue: eventType,
        },
      },
    };

    const result = await snsClient.send(new PublishCommand(params));
    console.log(
      `✅ Successfully published message to topic "${eventType}" (MessageId: ${result.MessageId})`
    );

    return result.MessageId; // Return MessageId for additional tracking if needed
  } catch (error) {
    console.error(
      `❌ Failed to publish message for event "${eventType}":`,
      error
    );
    throw new Error(`Failed to publish SNS message for event "${eventType}"`);
  }
};
