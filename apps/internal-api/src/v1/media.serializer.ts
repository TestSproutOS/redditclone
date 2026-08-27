import { Type } from "typebox"
import { UUID7String } from "../utils/common.serializer"

const imageMimeType = Type.Union([
  Type.Literal("image/jpeg"),
  Type.Literal("image/png"),
  Type.Literal("image/gif"),
  Type.Literal("image/webp"),
])

const MEDIA_TRANSFER_MAX_BYTES = 4 * 1024 * 1024

export const mediaConfirmSchemaRequest = Type.Object({
  postId: UUID7String,
})

export const mediaAvatarUploadSchemaRequest = Type.Object({
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 1, multipleOf: 1, maximum: MEDIA_TRANSFER_MAX_BYTES }),
})

export const mediaBannerUploadSchemaRequest = Type.Object({
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 1, multipleOf: 1, maximum: MEDIA_TRANSFER_MAX_BYTES }),
})

export const mediaKeyConfirmSchemaRequest = Type.Object({
  key: Type.String({ minLength: 1, maxLength: 512 }),
})

export const mediaCommunityIconUploadSchemaRequest = Type.Object({
  communityId: UUID7String,
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 1, multipleOf: 1, maximum: MEDIA_TRANSFER_MAX_BYTES }),
})

export const mediaCommunityBannerUploadSchemaRequest = Type.Object({
  communityId: UUID7String,
  mimeType: imageMimeType,
  byteSize: Type.Number({ minimum: 1, multipleOf: 1, maximum: MEDIA_TRANSFER_MAX_BYTES }),
})

export const mediaCommunityConfirmSchemaRequest = Type.Object({
  communityId: UUID7String,
  key: Type.String({ minLength: 1, maxLength: 512 }),
})

export const mediaUploadSchemaResponse = Type.Object({
  key: Type.String(),
  url: Type.String(),
})

export const mediaUploadSchemaQuery = Type.Object({
  key: Type.String({ minLength: 1, maxLength: 512 }),
})
