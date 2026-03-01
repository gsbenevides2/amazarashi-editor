export const getGCPCredentials = () => {
  //  for Google Infra (Cloud Run, Cloud Functions, Cloud Run for Anthos), the credentials are automatically provided by the environment, so we can just return an empty object to use the default credentials.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {};
  }
  // for Vercel, use environment variables
  if (
    process.env.GCP_PROJECT_ID &&
    process.env.GCP_SERVICE_ACCOUNT_EMAIL &&
    process.env.GCP_PRIVATE_KEY
  ) {
    return {
      credentials: {
        client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY,
      },
      projectId: process.env.GCP_PROJECT_ID,
    };
  }

  throw new Error(
    "GCP credentials are not properly configured. Please set the GOOGLE_APPLICATION_CREDENTIALS environment variable or provide GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT_EMAIL, and GCP_PRIVATE_KEY.",
  );
};
