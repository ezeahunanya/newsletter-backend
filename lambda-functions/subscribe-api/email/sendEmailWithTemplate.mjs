import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nunjucks from "nunjucks";
import path from "path";
import { fileURLToPath } from "url";
import { getOutlookTransport } from "./getOutlookTransport.mjs";
import { getAccessToken } from "./getAccessToken.mjs"; // Import updated function

let sesClient = null;

const getSESClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({ region: process.env.AWS_REGION });
  }
  return sesClient;
};

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Nunjucks for rendering templates
const configureNunjucks = () => {
  const templatesPath = path.resolve(__dirname, "emailTemplates");
  nunjucks.configure(templatesPath, { autoescape: true });
};

export const sendEmailWithTemplate = async (
  email,
  templateName,
  context,
  subject
) => {
  configureNunjucks();
  const emailHtml = nunjucks.render(`${templateName}.html`, context);

  const isProd = process.env.APP_STAGE === "prod";

  if (isProd) {
    return await sendEmailViaOutlook(email, subject, emailHtml);
  } else {
    return await sendEmailViaSES(email, subject, emailHtml);
  }
};

// Function to send via Outlook and handle token expiration
const sendEmailViaOutlook = async (email, subject, emailHtml) => {
  try {
    const transporter = await getOutlookTransport();

    const mailOptions = {
      from: process.env.OUTLOOK_SMTP_SENDER,
      to: email,
      subject: subject,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("❌ Error sending email via Outlook:", error);

    // If authentication fails, refresh the token so the next SQS retry works
    if (
      error.responseCode === 535 ||
      error.responseCode === 530 ||
      error.message.includes("5.7.3") ||
      error.message.includes("Client not authenticated")
    ) {
      console.warn("🔄 Refreshing access token for next attempt...");
      await getAccessToken(true); // Refresh the cached token
    }

    throw new Error("Failed to send email via Outlook SMTP");
  }
};

// Function to send via AWS SES
const sendEmailViaSES = async (email, subject, emailHtml) => {
  try {
    console.log("Sending email via SES...");
    const sesClient = getSESClient();
    const emailParams = {
      Destination: { ToAddresses: [email] },
      Message: {
        Body: { Html: { Data: emailHtml } },
        Subject: { Data: subject },
      },
      Source: process.env.SES_SOURCE_EMAIL,
    };

    await sesClient.send(new SendEmailCommand(emailParams));
    console.log("✅ Email sent via SES");
  } catch (error) {
    console.error("❌ Error sending email via SES:", error);
    throw new Error("Failed to send email via SES");
  }
};
