/**
 * Utility to create consistent HTTP responses
 * @param {number} statusCode - HTTP status code
 * @param {object} body - Response body
 * @returns {object} - Lambda HTTP response
 */
export const createResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
});
