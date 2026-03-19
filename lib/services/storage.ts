import { Storage } from "@google-cloud/storage";

const credentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!,
);

const storage = new Storage({
  projectId: credentials.project_id,
  credentials,
});

const bucket = storage.bucket(process.env.GOOGLE_BUCKET_DOCUMENT!);

export async function getSignedUrl(path: string) {
  try {
    const [url] = await bucket.file(path).getSignedUrl({
      action: "read",
      expires: Date.now() + 3600000,
    });
    return url;
  } catch {
    return null;
  }
}