import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getS3BucketName, s3Client } from "./client"

export interface StoredObject {
  body: Uint8Array
  contentType: string
}

export async function getObjectFromS3(key: string, maxBytes: number): Promise<StoredObject | null> {
  try {
    const object = await s3Client.send(
      new GetObjectCommand({ Bucket: getS3BucketName(), Key: key }),
    )
    if (!object.Body) return null
    if (object.ContentLength !== undefined && object.ContentLength > maxBytes) {
      throw new Error("Stored media exceeds the application transfer limit")
    }
    const body = await object.Body.transformToByteArray()
    if (body.byteLength > maxBytes) {
      throw new Error("Stored media exceeds the application transfer limit")
    }
    return { body, contentType: object.ContentType ?? "application/octet-stream" }
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    if (status === 404 || status === 403) return null
    throw err
  }
}
