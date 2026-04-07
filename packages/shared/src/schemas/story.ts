import { z } from "zod";
import {
  createPaginatedResponseSchema,
  PaginationQuerySchema,
  parseOptionalStringInput,
} from "./base.js";

export const StoryMatchedKindSchema = z.enum(["overview", "people_scene", "process"]);

export type StoryMatchedKind = z.infer<typeof StoryMatchedKindSchema>;

export const StoryListQuerySchema = PaginationQuerySchema.extend({
  query: z.preprocess(parseOptionalStringInput, z.string().min(1).optional()),
});

export type StoryListQuery = z.infer<typeof StoryListQuerySchema>;

export const StoryItemSchema = z
  .object({
    id: z.string().min(1),
    markdown: z.string().min(1),
    title: z.string(),
    time: z.string(),
    scene: z.string(),
    people: z.array(z.string()),
    impact: z.string(),
    sourceMessageSeqStart: z.number().int().nonnegative(),
    sourceMessageSeqEnd: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    score: z.number().nullable(),
    matchedKinds: z.array(StoryMatchedKindSchema),
  })
  .strict();

export type StoryItem = z.infer<typeof StoryItemSchema>;

export const StoryListResponseSchema = createPaginatedResponseSchema(StoryItemSchema);

export type StoryListResponse = z.infer<typeof StoryListResponseSchema>;

export const StoryReindexModeSchema = z.enum(["outdated", "all"]);

export type StoryReindexMode = z.infer<typeof StoryReindexModeSchema>;

export const StoryReindexRequestSchema = z.preprocess(
  value => value ?? {},
  z
    .object({
      mode: StoryReindexModeSchema.default("outdated"),
      pageSize: z.coerce.number().int().positive().max(100).default(50),
    })
    .strict(),
);

export type StoryReindexRequest = z.infer<typeof StoryReindexRequestSchema>;

export const StoryReindexFailureSchema = z
  .object({
    storyId: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export type StoryReindexFailure = z.infer<typeof StoryReindexFailureSchema>;

export const StoryReindexResponseSchema = z
  .object({
    mode: StoryReindexModeSchema,
    totalStories: z.number().int().nonnegative(),
    targetedStories: z.number().int().nonnegative(),
    reindexedStories: z.number().int().nonnegative(),
    skippedStories: z.number().int().nonnegative(),
    failedStories: z.number().int().nonnegative(),
    failures: z.array(StoryReindexFailureSchema),
  })
  .strict();

export type StoryReindexResponse = z.infer<typeof StoryReindexResponseSchema>;
