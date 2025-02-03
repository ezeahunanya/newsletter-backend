import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import nunjucks from "nunjucks";
import path from "path";
import { fileURLToPath } from "url";

let sesClient = null;

// Create an SMTP transport for Outlook
const getOutlookTransport = () => {
  return nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.OUTLOOK_SMTP_USER, // Outlook email address
      pass: process.env.OUTLOOK_SMTP_PASSWORD, // App password or regular password
    },
  });
};

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

  const isProd = process.env.APP_STAGE === "prod"; // Check if app stage is 'prod'

  if (isProd) {
    // Use Outlook SMTP in production
    const transporter = getOutlookTransport();

    const mailOptions = {
      from: process.env.OUTLOOK_SMTP_USER, // From your Outlook email
      to: email, // Recipient's email
      subject: subject, // Email subject
      html: emailHtml, // HTML body
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent via Outlook: ${info.response}`);
    } catch (error) {
      console.error("Error sending email via Outlook:", error);
      throw new Error("Failed to send email via Outlook SMTP");
    }
  } else {
    // Use SES in development
    const sesClient = getSESClient();

    const emailParams = {
      Destination: { ToAddresses: [email] },
      Message: {
        Body: { Html: { Data: emailHtml } },
        Subject: { Data: subject },
      },
      Source: process.env.SES_SOURCE_EMAIL, // Source email (SES verified)
      ConfigurationSetName: configurationSet,
    };

    try {
      await sesClient.send(new SendEmailCommand(emailParams));
      console.log("Email sent via SES");
    } catch (error) {
      console.error("Error sending email via SES:", error);
      throw new Error("Failed to send email via SES");
    }
  }
};
