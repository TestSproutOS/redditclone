import { randomUUID } from "node:crypto"
import { getCommunityAuthz } from "@lib/dao/authz/community/get"
import { crudCommunity } from "@lib/dao/community/crud"
import { fetchPost } from "@lib/dao/post/fetch"
import { fetchPostMedia } from "@lib/dao/postMedia/fetch"
import { crudUser } from "@lib/dao/user/crud"
import { db } from "@template-nextjs/db"
import {
  existsOnS3,
  getExtensionForImageContentType,
  getObjectFromS3,
  putObjectToS3,
} from "@utils/aws"
import { promoteMediaCleanup } from "@utils/queues"
import { Hono } from "hono"
import { describeRoute } from "hono-typebox-openapi"
import { resolver, validator } from "hono-typebox-openapi/typebox"
import { authMiddleware } from "../middleware"
import { EmptyObject, ErrorSchemaResponse } from "../utils/common.serializer"
import { throwBadRequest, throwForbidden, throwNotFound } from "../utils/http-exception"
import {
  mediaAvatarUploadSchemaRequest,
  mediaBannerUploadSchemaRequest,
  mediaCommunityBannerUploadSchemaRequest,
  mediaCommunityConfirmSchemaRequest,
  mediaCommunityIconUploadSchemaRequest,
  mediaConfirmSchemaRequest,
  mediaKeyConfirmSchemaRequest,
  mediaUploadSchemaQuery,
  mediaUploadSchemaResponse,
} from "./media.serializer"
import { isPublicMediaKey, MEDIA_TRANSFER_MAX_BYTES, mimeTypeForImageKey } from "./media-path"

function uploadUrl(requestUrl: string, key: string): string {
  const url = new URL("/api/v1/media/upload", requestUrl)
  url.searchParams.set("key", key)
  return url.toString()
}

const uploadResponse = {
  200: {
    description: "Authenticated application upload",
    content: { "application/json": { schema: resolver(mediaUploadSchemaResponse) } },
  },
  400: {
    description: "Invalid request",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
  403: {
    description: "Not permitted",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
}

const confirmResponse = {
  200: {
    description: "Confirmed",
    content: { "application/json": { schema: resolver(EmptyObject) } },
  },
  400: {
    description: "Invalid request",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
  403: {
    description: "Not permitted",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
  404: {
    description: "Not found",
    content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
  },
}

const app = new Hono()
  .get(
    "/object/*",
    describeRoute({
      description: "Read public application media",
      responses: {
        200: { description: "Media object" },
        404: {
          description: "Media not found",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    async (c) => {
      const key = c.req.param("*") ?? ""
      if (!isPublicMediaKey(key)) return throwNotFound(c, "Media not found")
      const object = await getObjectFromS3(key, MEDIA_TRANSFER_MAX_BYTES)
      if (!object) return throwNotFound(c, "Media not found")
      return new Response(Buffer.from(object.body), {
        headers: {
          "cache-control": "public, max-age=31536000, immutable",
          "content-length": String(object.body.byteLength),
          "content-type": object.contentType,
          "x-content-type-options": "nosniff",
        },
      })
    },
  )
  .use(authMiddleware)
  .put(
    "/upload",
    describeRoute({
      description: "Upload media through the authenticated application server",
      responses: {
        200: {
          description: "Uploaded",
          content: { "application/json": { schema: resolver(EmptyObject) } },
        },
        400: {
          description: "Invalid upload",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
        403: {
          description: "Not permitted",
          content: { "application/json": { schema: resolver(ErrorSchemaResponse) } },
        },
      },
    }),
    validator("query", mediaUploadSchemaQuery),
    async (c) => {
      const user = c.var.user
      const { key } = c.req.valid("query")
      const contentType = (c.req.header("content-type") ?? "").split(";")[0]?.toLowerCase()
      const contentLength = Number(c.req.header("content-length"))
      if (
        !Number.isSafeInteger(contentLength) ||
        contentLength <= 0 ||
        contentLength > MEDIA_TRANSFER_MAX_BYTES
      ) {
        return throwBadRequest(c, "Invalid media size", undefined, { target: "content-length" })
      }

      let expectedMimeType: string | null = null
      if (key.startsWith(`user-avatar/${user.id}/`) || key.startsWith(`user-banner/${user.id}/`)) {
        expectedMimeType = mimeTypeForImageKey(key)
      } else if (key.startsWith("community-icon/") || key.startsWith("community-banner/")) {
        const communityId = key.split("/")[1]
        if (!communityId) return throwForbidden(c, "Invalid upload target")
        const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
        if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
        expectedMimeType = mimeTypeForImageKey(key)
      } else if (key.startsWith("post-media/")) {
        const media = await fetchPostMedia(db).getByS3Key(key, [
          "postId",
          "mimeType",
          "byteSize",
          "uploadStatus",
        ])
        if (!media || media.uploadStatus !== "pending") {
          return throwForbidden(c, "Invalid upload target")
        }
        const post = await fetchPost(db).getOne(media.postId, ["authorUserId"])
        if (!post || post.authorUserId !== user.id) return throwForbidden(c, "Not your post")
        if (media.byteSize !== null && Number(media.byteSize) !== contentLength) {
          return throwBadRequest(c, "Media size does not match", undefined, {
            target: "content-length",
          })
        }
        expectedMimeType = media.mimeType
      } else {
        return throwForbidden(c, "Invalid upload target")
      }

      if (!isPublicMediaKey(key) || !contentType || expectedMimeType !== contentType) {
        return throwBadRequest(c, "Media type does not match", undefined, {
          target: "content-type",
        })
      }
      const body = new Uint8Array(await c.req.arrayBuffer())
      if (body.byteLength !== contentLength) {
        return throwBadRequest(c, "Media size does not match", undefined, {
          target: "content-length",
        })
      }
      await putObjectToS3(key, body, contentType)
      return c.json({})
    },
  )
  .post(
    "/confirm",
    describeRoute({
      description: "Confirm a media post's uploads finished, promoting its cleanup job",
      responses: confirmResponse,
    }),
    validator("json", mediaConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { postId } = c.req.valid("json")

      const post = await fetchPost(db).getOne(postId, ["authorUserId", "type"])
      if (!post) return throwNotFound(c, "Post not found")
      if (post.authorUserId !== user.id) return throwForbidden(c, "Not your post")
      if (post.type === "media") await promoteMediaCleanup(postId)

      return c.json({})
    },
  )
  .post(
    "/avatar-upload",
    describeRoute({
      description: "Application upload for the current user's avatar",
      responses: uploadResponse,
    }),
    validator("json", mediaAvatarUploadSchemaRequest),
    (c) => {
      const user = c.var.user
      const { mimeType } = c.req.valid("json")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `user-avatar/${user.id}/${randomUUID()}.${ext}`
      return c.json({
        key,
        url: uploadUrl(c.req.url, key),
      })
    },
  )
  .post(
    "/avatar-confirm",
    describeRoute({
      description: "Confirm an uploaded avatar and set it on the current user",
      responses: confirmResponse,
    }),
    validator("json", mediaKeyConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { key } = c.req.valid("json")
      if (!key.startsWith(`user-avatar/${user.id}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudUser(db).updateUser(user.id, { avatarImageKey: key })
      return c.json({})
    },
  )
  .post(
    "/banner-upload",
    describeRoute({
      description: "Application upload for the current user's profile banner",
      responses: uploadResponse,
    }),
    validator("json", mediaBannerUploadSchemaRequest),
    (c) => {
      const user = c.var.user
      const { mimeType } = c.req.valid("json")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `user-banner/${user.id}/${randomUUID()}.${ext}`
      return c.json({
        key,
        url: uploadUrl(c.req.url, key),
      })
    },
  )
  .post(
    "/banner-confirm",
    describeRoute({
      description: "Confirm an uploaded banner and set it on the current user",
      responses: confirmResponse,
    }),
    validator("json", mediaKeyConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { key } = c.req.valid("json")
      if (!key.startsWith(`user-banner/${user.id}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudUser(db).updateUser(user.id, { bannerImageKey: key })
      return c.json({})
    },
  )
  .post(
    "/community-icon-upload",
    describeRoute({
      description: "Application upload for a community icon (mod config permission required)",
      responses: uploadResponse,
    }),
    validator("json", mediaCommunityIconUploadSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, mimeType } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `community-icon/${communityId}/${randomUUID()}.${ext}`
      return c.json({
        key,
        url: uploadUrl(c.req.url, key),
      })
    },
  )
  .post(
    "/community-icon-confirm",
    describeRoute({
      description: "Confirm an uploaded community icon (mod config permission required)",
      responses: confirmResponse,
    }),
    validator("json", mediaCommunityConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, key } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      if (!key.startsWith(`community-icon/${communityId}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudCommunity(db).update(communityId, { iconImageKey: key })
      return c.json({})
    },
  )
  .post(
    "/community-banner-upload",
    describeRoute({
      description: "Application upload for a community banner (mod config permission required)",
      responses: uploadResponse,
    }),
    validator("json", mediaCommunityBannerUploadSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, mimeType } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      const ext = getExtensionForImageContentType(mimeType) ?? "bin"
      const key = `community-banner/${communityId}/${randomUUID()}.${ext}`
      return c.json({
        key,
        url: uploadUrl(c.req.url, key),
      })
    },
  )
  .post(
    "/community-banner-confirm",
    describeRoute({
      description: "Confirm an uploaded community banner (mod config permission required)",
      responses: confirmResponse,
    }),
    validator("json", mediaCommunityConfirmSchemaRequest),
    async (c) => {
      const user = c.var.user
      const { communityId, key } = c.req.valid("json")
      const mod = await getCommunityAuthz(db).canModerate(communityId, user.id, "config")
      if (!mod.ok) return throwForbidden(c, "You cannot configure this community")
      if (!key.startsWith(`community-banner/${communityId}/`)) {
        return throwBadRequest(c, "Invalid upload key", undefined, { target: "key" })
      }
      if (!(await existsOnS3(key))) {
        return throwBadRequest(c, "Uploaded file not found", undefined, { target: "key" })
      }
      await crudCommunity(db).update(communityId, { bannerImageKey: key })
      return c.json({})
    },
  )

export default app
