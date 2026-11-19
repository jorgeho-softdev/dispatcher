import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';

/**
 * Object storage for trip documents. Clients upload and download DIRECTLY
 * with short-lived presigned URLs — file bytes never pass through the api.
 * Works with AWS S3, Cloudflare R2 and SeaweedFS (local). See
 * docs/adr/0015-document-storage.md.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** Server-side operations (inside the network). */
  private readonly client: S3Client;
  /** Only used to SIGN URLs with the host clients can reach. */
  private readonly publicClient: S3Client;
  private readonly bucket: string;
  private readonly isProduction: boolean;

  constructor(config: ConfigService<Env, true>) {
    const base = {
      region: config.get('S3_REGION', { infer: true }),
      // The SDK's default flexible checksums add x-amz-checksum-* to presigned
      // URLs that phones don't send (breaks R2 / SeaweedFS / MinIO). Only use
      // checksums when an operation requires them.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
      },
    };
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const publicEndpoint =
      config.get('S3_PUBLIC_ENDPOINT', { infer: true }) ?? endpoint;
    this.client = new S3Client({ ...base, ...(endpoint && { endpoint }) });
    this.publicClient = new S3Client({
      ...base,
      ...(publicEndpoint && { endpoint: publicEndpoint }),
    });
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.isProduction =
      config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** Local/dev convenience: create the bucket if missing. Production buckets are provisioned by infra. */
  async onModuleInit() {
    if (this.isProduction) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created bucket ${this.bucket}`);
      } catch (error) {
        this.logger.warn(
          `Storage unavailable (${String(error)}). Document uploads will fail until it is up.`,
        );
      }
    }
  }

  /** Presigned PUT: the client must send exactly this Content-Type. */
  async presignUpload(
    key: string,
    contentType: string,
    expiresInSeconds = 600,
  ) {
    const url = await getSignedUrl(
      this.publicClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: expiresInSeconds },
    );
    return {
      url,
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async presignDownload(key: string, fileName: string, expiresInSeconds = 300) {
    const url = await getSignedUrl(
      this.publicClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `inline; filename="${fileName.replace(/["\\\r\n]/g, '_')}"`,
      }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
  }

  /** Metadata of an uploaded object, or null if it isn't there. */
  async head(
    key: string,
  ): Promise<{ size: number; contentType?: string } | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (error) {
      if (
        error instanceof NotFound ||
        (error instanceof S3ServiceException &&
          error.$metadata.httpStatusCode === 404)
      ) {
        return null;
      }
      throw error;
    }
  }

  /** Server-generated files (e.g. the Rate Confirmation PDF). */
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
