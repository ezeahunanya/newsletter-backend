import nodemailer from "nodemailer";
import { getSmtpCredentials, getAccessToken } from "./getAccessToken.mjs";

export const getOutlookTransport = async () => {
  const secrets = await getSmtpCredentials();

  console.log("Fetching access token...");
  const accessToken = await getAccessToken();

  console.log("Creating Outlook SMTP transport...");
  const transport = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
      type: "OAuth2",
      user: process.env.OUTLOOK_SMTP_USER,
      accessToken,
      clientId: process.env.OUTLOOK_CLIENT_ID,
      clientSecret: secrets.OUTLOOK_CLIENT_SECRET,
      refreshToken: secrets.OUTLOOK_REFRESH_TOKEN,
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  console.log("✅ Outlook SMTP transport created successfully.");
  return transport;
};
