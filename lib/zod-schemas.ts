import { z } from 'zod';

export const visibilityEnum = z.enum(['public', 'unlisted', 'private']);

export const albumCreateSchema = z.object({
  name: z.string().min(1).max(120),
  visibility: visibilityEnum.optional(),
  coverUrl: z.string().url().optional()
});

export const albumUpdateSchema = albumCreateSchema.partial();

export const zipRequestSchema = z.object({
  stickerIds: z.array(z.string().uuid()).min(1),
  packName: z.string().min(1),
  author: z.string().optional()
});

export const whatsappShareSchema = z.object({
  phone: z.string().optional(),
  albumUrl: z.string().url(),
  albumName: z.string().min(1)
});

export const packCreateSchema = z.object({
  albumId: z.string().uuid(),
  name: z.string().min(1),
  author: z.string().optional(),
  stickerIds: z.array(z.string().uuid()).min(1)
});

export const packPublishSchema = z.object({
  makePublic: z.boolean().optional()
});
