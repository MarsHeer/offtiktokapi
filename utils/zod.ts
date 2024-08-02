import { z } from 'zod';

export const parsedVideoData = z.object({
  id: z.string(),
  description: z.string(),
  image: z
    .object({
      list: z.array(z.string()),
    })
    .nullable(),
  video: z
    .object({
      url: z.string().optional(),
      cover: z.string().nullable().optional(),
    })
    .nullable(),
  author: z
    .object({
      id: z.string(),
      name: z.string(),
      image: z.string(),
      handle: z.string(),
    })
    .nullable(),
  music: z
    .object({
      url: z.string().nullable().optional(),
    })
    .nullable(),
});

export const userDataSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  uniqueId: z.string(),
  nickname: z.string(),
  avatarLarger: z.string(),
  avatarMedium: z.string(),
  avatarThumb: z.string(),
  signature: z.string(),
  createTime: z.number(),
  verified: z.boolean(),
  secUid: z.string(),
  ftc: z.boolean(),
  relation: z.number(),
  openFavorite: z.boolean(),
  commentSetting: z.number(),
  duetSetting: z.number(),
  stitchSetting: z.number(),
  privateAccount: z.boolean(),
  secret: z.boolean(),
  isADVirtual: z.boolean(),
  roomId: z.string(),
  uniqueIdModifyTime: z.number(),
  ttSeller: z.boolean(),
  downloadSetting: z.number(),
  recommendReason: z.string(),
  nowInvitationCardUrl: z.string(),
  nickNameModifyTime: z.number(),
  isEmbedBanned: z.boolean(),
  canExpPlaylist: z.boolean(),
  suggestAccountBind: z.boolean(),
});
