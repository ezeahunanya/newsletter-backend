import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

// Cache for secrets
const cachedSecrets = {};

// Initialize SecretsManager client outside the function
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || "eu-west-1", // Default to a region if none is provided
});

/**
 * Retrieve a secret from AWS Secrets Manager with caching.
 * @param {string} secretName - The name of the secret to retrieve.
 * @returns {Promise<Object>} - The parsed secret value.
 */
export const getSecret = async (secretName) => {
  if (cachedSecrets[secretName]) {
    console.log(`✅ Secret '${secretName}' retrieved from cache.`);
    return cachedSecrets[secretName];
  }

  console.log(`🔄 Fetching secret '${secretName}' from AWS Secrets Manager...`);

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error(
        `Secret '${secretName}' does not contain a valid string.`
      );
    }

    const parsedSecret = JSON.parse(response.SecretString);

    // Cache the successfully retrieved secret
    cachedSecrets[secretName] = parsedSecret;

    console.log(`✅ Secret '${secretName}' successfully fetched and cached.`);
    return parsedSecret;
  } catch (error) {
    console.error(
      `❌ Failed to retrieve secret '${secretName}':`,
      error.message
    );
    throw new Error(`Failed to retrieve secret '${secretName}'.`);
  }
};
