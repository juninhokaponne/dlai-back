import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export class SpacesStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(
    endpoint: string = process.env.DO_SPACES_ENDPOINT ?? "",
    region: string = process.env.DO_SPACES_REGION ?? "",
    bucket: string = process.env.DO_SPACES_BUCKET ?? "",
    publicUrl: string = process.env.DO_SPACES_PUBLIC_URL ?? "",
    accessKeyId: string = process.env.DO_SPACES_KEY ?? "",
    secretAccessKey: string = process.env.DO_SPACES_SECRET ?? "",
  ) {
    if (!endpoint || !region || !bucket || !publicUrl || !accessKeyId || !secretAccessKey) {
      throw new Error("DigitalOcean Spaces is not configured.");
    }

    this.bucket = bucket;
    this.publicUrl = publicUrl.replace(/\/$/, "");
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: false,
      credentials: { accessKeyId, secretAccessKey },
      // DigitalOcean Spaces doesn't support the flexible-checksum headers
      // the SDK sends by default, which breaks request signing.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async uploadFile(
    folder: string,
    ownerId: string,
    buffer: Buffer,
    contentType: string,
    extension: string,
  ): Promise<string> {
    const key = `${folder}/${ownerId}-${randomUUID()}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      }),
    );

    return `${this.publicUrl}/${key}`;
  }

  uploadAvatar(userId: string, buffer: Buffer, contentType: string, extension: string): Promise<string> {
    return this.uploadFile("avatars", userId, buffer, contentType, extension);
  }

  // For shared, app-level assets that live at a fixed key (e.g. re-uploading
  // overwrites the same object) rather than one file per user.
  async uploadStaticAsset(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      }),
    );

    return `${this.publicUrl}/${key}`;
  }
}
