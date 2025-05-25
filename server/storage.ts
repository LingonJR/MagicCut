import { users, type User, type InsertUser, type InsertVideo, type Video, type InsertClip, type Clip, type VideoInfo } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Video methods
  createVideo(video: InsertVideo): Promise<Video>;
  getVideo(id: number): Promise<Video | undefined>;
  updateVideo(id: number, data: Partial<Video>): Promise<Video>;
  updateVideoStatus(id: number, status: string): Promise<Video>;
  getVideoInfo(id: number): Promise<VideoInfo>;
  
  // Clip methods
  createClip(clip: InsertClip): Promise<Clip>;
  getClip(id: number): Promise<Clip | undefined>;
  getClipsByVideo(videoId: number): Promise<Clip[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private videos: Map<number, Video>;
  private clips: Map<number, Clip>;
  private userId: number;
  private videoId: number;
  private clipId: number;

  constructor() {
    this.users = new Map();
    this.videos = new Map();
    this.clips = new Map();
    this.userId = 1;
    this.videoId = 1;
    this.clipId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Video methods
  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    const id = this.videoId++;
    const now = new Date();
    const video: Video = { 
      ...insertVideo, 
      id,
      uploadedAt: now,
    };
    this.videos.set(id, video);
    return video;
  }
  
  async getVideo(id: number): Promise<Video | undefined> {
    return this.videos.get(id);
  }
  
  async updateVideo(id: number, data: Partial<Video>): Promise<Video> {
    const video = this.videos.get(id);
    if (!video) {
      throw new Error(`Video with ID ${id} not found`);
    }
    
    const updatedVideo = { ...video, ...data };
    this.videos.set(id, updatedVideo);
    return updatedVideo;
  }
  
  async updateVideoStatus(id: number, status: string): Promise<Video> {
    return this.updateVideo(id, { processingStatus: status });
  }
  
  async getVideoInfo(id: number): Promise<VideoInfo> {
    const video = this.videos.get(id);
    if (!video) {
      throw new Error(`Video with ID ${id} not found`);
    }
    
    return {
      id: video.id,
      filename: video.filename,
      originalFilename: video.originalFilename,
      fileSize: video.fileSize,
      duration: video.duration,
      format: video.format,
      resolution: video.resolution,
      processingStatus: video.processingStatus,
    };
  }
  
  // Clip methods
  async createClip(insertClip: InsertClip): Promise<Clip> {
    const id = this.clipId++;
    const now = new Date();
    const clip: Clip = {
      ...insertClip,
      id,
      createdAt: now,
    };
    this.clips.set(id, clip);
    return clip;
  }
  
  async getClip(id: number): Promise<Clip | undefined> {
    return this.clips.get(id);
  }
  
  async getClipsByVideo(videoId: number): Promise<Clip[]> {
    return Array.from(this.clips.values())
      .filter(clip => clip.videoId === videoId)
      .sort((a, b) => a.sceneIndex - b.sceneIndex);
  }
}

export const storage = new MemStorage();
