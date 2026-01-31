import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { logger } from "./logger";

const s3Client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
});

/**
 * Downloads a file from a URL and uploads it to S3.
 * Returns the public S3 URL.
 */
export async function uploadFromUrl(url: string, key: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "image/jpeg";

        await s3Client.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            })
        );

        const publicUrl = process.env.S3_PUBLIC_URL_PREFIX
            ? `${process.env.S3_PUBLIC_URL_PREFIX}/${key}`
            : `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;

        return publicUrl;
    } catch (error) {
        logger.error({ error, url, key }, "[S3 Utility] Upload failed");
        return null;
    }
}
