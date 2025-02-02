import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nunjucks from "nunjucks";
import path from "path";
import { fileURLToPath } from "url";

let sesClient = null;

const getSESClient = () => {
  if (!sesClient) {
    sesClient = new SESClient({ region: process.env.AWS_REGION });
  }
  return sesClient;
};

// Define __dirname manually for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Nunjucks for rendering templates
const configureNunjucks = () => {
  const templatesPath = path.resolve(__dirname, "emailTemplates");
  nunjucks.configure(templatesPath, {
    autoescape: true,
  });
};

// Generic function to send emails using a Maizzle template
export const sendEmailWithTemplate = async (
  email,
  templateName,
  context,
  subject,
  configurationSet
) => {
  configureNunjucks();

  // Render email HTML using Nunjucks
  const emailHtml = nunjucks.render(`${templateName}.html`, context);

  const sesClient = getSESClient();

  const emailParams = {
    Destination: { ToAddresses: [email] },
    Message: {
      Body: { Html: { Data: emailHtml } },
      Subject: { Data: subject },
    },
    Source: process.env.SES_SOURCE_EMAIL,
    ConfigurationSetName: configurationSet,
  };

  await sesClient.send(new SendEmailCommand(emailParams));
};
