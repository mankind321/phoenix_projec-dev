import { Storage } from "@google-cloud/storage";

// Load the JSON credentials from environment variable
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!);

// Initialize GCS client using explicit credentials (NOT files)
const storage = new Storage({
  projectId: credentials.project_id,
  credentials: {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
  },
});

// Export bucket instance
export const bucket = storage.bucket(process.env.GOOGLE_BUCKET_NAME!);

// Example helper — list files
export async function listFiles() {
  const [files] = await bucket.getFiles();
  return files.map((file) => file.name);
}
