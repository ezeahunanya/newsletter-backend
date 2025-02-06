import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

// Cache for both DB and SMTP secrets
let cachedSecrets = {};

export const getSecret = async (secretName) => {
  if (cachedSecrets[secretName]) {
    console.log(`✅ Retrieved ${secretName} from cache.`);
    return cachedSecrets[secretName];
  }

  console.log(`Fetching ${secretName} from AWS Secrets Manager...`);

  const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_REGION,
  });

  const command = new GetSecretValueCommand({
    SecretId: secretName,
  });

  try {
    const secret = await secretsClient.send(command);
    console.log(`✅ Successfully retrieved secret for ${secretName}.`);

    const parsedSecret = JSON.parse(secret.SecretString);

    // Cache the secret
    cachedSecrets[secretName] = parsedSecret;

    return parsedSecret;
  } catch (error) {
    console.error(`❌ Failed to retrieve secret for ${secretName}:`, error);
    throw new Error(`Failed to retrieve secret: ${secretName}`);
  }
};
