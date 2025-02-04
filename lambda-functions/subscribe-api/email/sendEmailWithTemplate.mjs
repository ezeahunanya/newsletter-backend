import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nunjucks from "nunjucks";
import path from "path";
import { fileURLToPath } from "url";
import { getOutlookTransport } from "./getOutlookTransport.mjs";

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
    try {
      console.log("Fetching Outlook OAuth2 transport...");
      const transporter = await getOutlookTransport();

      const mailOptions = {
        from: process.env.OUTLOOK_SMTP_SENDER,
        to: email,
        subject: subject,
        html: emailHtml,
      };

      console.log("Sending email via Outlook SMTP...");
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent via Outlook: ${info.response}`);
    } catch (error) {
      console.error("Error sending email via Outlook:", error);
      throw new Error("Failed to send email via Outlook SMTP");
    }
  } else {
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
      console.log("Email sent via SES");
    } catch (error) {
      console.error("Error sending email via SES:", error);
      throw new Error("Failed to send email via SES");
    }
  }
};
