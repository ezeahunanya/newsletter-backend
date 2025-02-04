import nodemailer from "nodemailer";
import { getSmtpCredentials } from "./getAccessToken.mjs";
import { getAccessToken } from "./getAccessToken.mjs";

export const getOutlookTransport = async () => {
  const secrets = await getSmtpCredentials();
  const accessToken = await getAccessToken();

  return nodemailer.createTransport({
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
};
