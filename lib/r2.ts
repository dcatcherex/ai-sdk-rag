import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const publicBaseUrl = normalizeBaseUrl(env.R2_PUBLIC_BASE_URL);

export type UploadPublicObjectOptions = {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
  cacheControl?: string;
};

export async function uploadPublicObject({
  key,
  body,
  contentType,
  cacheControl = "public, max-age=31536000, immutable",
}: UploadPublicObjectOptions) {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );

  return {
    key,
    url: `${publicBaseUrl}/${key}`,
  };
}
