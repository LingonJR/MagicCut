import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Video model to store information about uploaded videos
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  duration: integer("duration"),
  format: text("format"),
  resolution: text("resolution"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processingStatus: text("processing_status").notNull().default("pending"),
});

export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  uploadedAt: true,
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;

// Clip model to store information about extracted clips
export const clips = pgTable("clips", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path").notNull(),
  startTime: integer("start_time").notNull(), // in milliseconds
  endTime: integer("end_time").notNull(), // in milliseconds
  duration: integer("duration").notNull(), // in milliseconds
  sceneIndex: integer("scene_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClipSchema = createInsertSchema(clips).omit({
  id: true,
  createdAt: true,
});

export type InsertClip = z.infer<typeof insertClipSchema>;
export type Clip = typeof clips.$inferSelect;

// Custom Zod schemas for API requests and responses
export const uploadVideoResponseSchema = z.object({
  id: z.number(),
  filename: z.string(),
  originalFilename: z.string(),
});

export const videoInfoSchema = z.object({
  id: z.number(),
  filename: z.string(),
  originalFilename: z.string(),
  fileSize: z.number(),
  duration: z.string().optional(),
  format: z.string().optional(),
  resolution: z.string().optional(),
  processingStatus: z.string(),
  sceneCount: z.number().optional(),
});

export const clipSchema = z.object({
  id: z.number(),
  videoId: z.number(),
  sceneIndex: z.number(),
  startTime: z.number(),
  endTime: z.number(),
  duration: z.number(),
  timestamp: z.string(),
  url: z.string(),
  thumbnailUrl: z.string(),
});

export type ClipInfo = z.infer<typeof clipSchema>;
export type VideoInfo = z.infer<typeof videoInfoSchema>;

export const processingStatusSchema = z.object({
  videoId: z.number().optional(),
  status: z.enum(["pending", "processing", "completed", "error"]),
  progress: z.number().min(0).max(100).optional(),
  stage: z.string().optional(),
  error: z.string().optional(),
  clips: z.array(clipSchema).optional(),
  videoInfo: videoInfoSchema.optional(),
});

export type ProcessingStatus = z.infer<typeof processingStatusSchema>;
