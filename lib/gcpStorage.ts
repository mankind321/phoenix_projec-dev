import { Storage } from "@google-cloud/storage";
import path from "path";

const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: path.join(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS!),
});

export const bucket = storage.bucket(process.env.GOOGLE_BUCKET_NAME!);

// Test helper: list files from bucket
export async function listFiles() {
  const [files] = await bucket.getFiles();
  return files.map((file) => file.name);
}
