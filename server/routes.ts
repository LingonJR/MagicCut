import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage as dataStorage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { WebSocketServer } from "ws";
import { processVideo } from "./videoProcessor";
import archiver from "archiver";
import { insertVideoSchema, insertClipSchema, processingStatusSchema } from "@shared/schema";
import { z } from "zod";

// Setup uploads directory
const uploadsDir = path.join(process.cwd(), "uploads");
const clipsDir = path.join(uploadsDir, "clips");
const thumbnailsDir = path.join(uploadsDir, "thumbnails");

// Create directories if they don't exist
[uploadsDir, clipsDir, thumbnailsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueFilename = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only video files
    const allowedMimes = ["video/mp4", "video/quicktime", "video/x-msvideo"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only MP4, MOV, and AVI formats are allowed."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: "/api/ws/processing-status" });
  
  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
    
    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });
  
  // Broadcast status updates to all connected clients
  const broadcastStatus = (videoId: number, status: z.infer<typeof processingStatusSchema>) => {
    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({ videoId, ...status }));
      }
    });
  };
  
  // API Routes
  
  // Upload video endpoint
  app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const { filename, originalname, path: filePath, size } = req.file;
      
      // Store video info in database
      const videoData = {
        filename,
        originalFilename: originalname,
        filePath,
        fileSize: size,
        processingStatus: "pending",
      };
      
      const newVideo = await dataStorage.createVideo(videoData);
      
      res.json({
        id: newVideo.id,
        filename: newVideo.filename,
        originalFilename: newVideo.originalFilename,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Error uploading video" });
    }
  });
  
  // Start video processing
  app.post("/api/videos/:id/process", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id, 10);
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }
      
      const video = await dataStorage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Update status to processing
      await dataStorage.updateVideoStatus(videoId, "processing");
      
      // Process video in background
      processVideo(video, {
        outputDir: clipsDir,
        thumbnailDir: thumbnailsDir,
        onProgress: (progress, stage) => {
          const status = {
            status: "processing" as const,
            progress,
            stage,
          };
          broadcastStatus(videoId, status);
        },
        onComplete: async (results) => {
          try {
            // Save clips to database
            const clips = [];
            for (let i = 0; i < results.clips.length; i++) {
              const clip = results.clips[i];
              const clipData = {
                videoId,
                filename: path.basename(clip.filePath),
                filePath: clip.filePath,
                thumbnailPath: clip.thumbnailPath,
                startTime: clip.startTime,
                endTime: clip.endTime,
                duration: clip.endTime - clip.startTime,
                sceneIndex: i,
              };
              
              const savedClip = await dataStorage.createClip(clipData);
              clips.push({
                id: savedClip.id,
                videoId: savedClip.videoId,
                sceneIndex: savedClip.sceneIndex,
                startTime: savedClip.startTime,
                endTime: savedClip.endTime,
                duration: savedClip.duration,
                timestamp: formatTimestamp(savedClip.startTime, savedClip.endTime),
                url: `/api/clips/${savedClip.id}/stream`,
                thumbnailUrl: `/api/clips/${savedClip.id}/thumbnail`,
              });
            }
            
            // Update video metadata
            await dataStorage.updateVideo(videoId, {
              duration: formatDuration(results.duration),
              format: results.format,
              resolution: results.resolution,
              processingStatus: "completed",
            });
            
            // Send completion status
            const videoInfo = await dataStorage.getVideoInfo(videoId);
            const status = {
              status: "completed" as const,
              progress: 100,
              clips,
              videoInfo: {
                ...videoInfo,
                sceneCount: clips.length,
              },
            };
            broadcastStatus(videoId, status);
          } catch (error) {
            console.error("Error saving clips:", error);
            await dataStorage.updateVideoStatus(videoId, "error");
            broadcastStatus(videoId, {
              status: "error" as const,
              error: "Failed to save clip data",
            });
          }
        },
        onError: async (error) => {
          console.error("Processing error:", error);
          await dataStorage.updateVideoStatus(videoId, "error");
          broadcastStatus(videoId, {
            status: "error" as const,
            error: error.message,
          });
        },
      });
      
      res.json({ message: "Processing started" });
    } catch (error) {
      console.error("Process error:", error);
      res.status(500).json({ message: "Error starting processing" });
    }
  });
  
  // Get video processing status
  app.get("/api/videos/:id/status", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id, 10);
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }
      
      const video = await dataStorage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      const clips = await dataStorage.getClipsByVideo(videoId);
      const formattedClips = clips.map(clip => ({
        id: clip.id,
        videoId: clip.videoId,
        sceneIndex: clip.sceneIndex,
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.duration,
        timestamp: formatTimestamp(clip.startTime, clip.endTime),
        url: `/api/clips/${clip.id}/stream`,
        thumbnailUrl: `/api/clips/${clip.id}/thumbnail`,
      }));
      
      const videoInfo = await dataStorage.getVideoInfo(videoId);
      
      const response = {
        status: video.processingStatus,
        progress: video.processingStatus === "completed" ? 100 : 0,
        clips: formattedClips,
        videoInfo: {
          ...videoInfo,
          sceneCount: clips.length,
        },
      };
      
      res.json(response);
    } catch (error) {
      console.error("Status error:", error);
      res.status(500).json({ message: "Error getting status" });
    }
  });
  
  // Stream a clip
  app.get("/api/clips/:id/stream", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id, 10);
      if (isNaN(clipId)) {
        return res.status(400).json({ message: "Invalid clip ID" });
      }
      
      const clip = await dataStorage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }
      
      const filePath = clip.filePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Clip file not found" });
      }
      
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": "video/mp4",
        });
        
        file.pipe(res);
      } else {
        res.writeHead(200, {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
        });
        
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      console.error("Stream error:", error);
      res.status(500).json({ message: "Error streaming clip" });
    }
  });
  
  // Get clip thumbnail
  app.get("/api/clips/:id/thumbnail", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id, 10);
      if (isNaN(clipId)) {
        return res.status(400).json({ message: "Invalid clip ID" });
      }
      
      const clip = await dataStorage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }
      
      const thumbnailPath = clip.thumbnailPath;
      if (!fs.existsSync(thumbnailPath)) {
        return res.status(404).json({ message: "Thumbnail not found" });
      }
      
      res.sendFile(thumbnailPath);
    } catch (error) {
      console.error("Thumbnail error:", error);
      res.status(500).json({ message: "Error getting thumbnail" });
    }
  });
  
  // Download a clip
  app.get("/api/clips/:id/download", async (req, res) => {
    try {
      const clipId = parseInt(req.params.id, 10);
      if (isNaN(clipId)) {
        return res.status(400).json({ message: "Invalid clip ID" });
      }
      
      const clip = await dataStorage.getClip(clipId);
      if (!clip) {
        return res.status(404).json({ message: "Clip not found" });
      }
      
      const filePath = clip.filePath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Clip file not found" });
      }
      
      const video = await dataStorage.getVideo(clip.videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      // Generate a friendly filename
      const originalName = path.parse(video.originalFilename).name;
      const extension = path.extname(clip.filename);
      const downloadName = `${originalName}_scene_${clip.sceneIndex + 1}${extension}`;
      
      res.download(filePath, downloadName);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Error downloading clip" });
    }
  });
  
  // Download all clips as a zip
  app.get("/api/videos/:id/download-clips", async (req, res) => {
    try {
      const videoId = parseInt(req.params.id, 10);
      if (isNaN(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }
      
      const video = await dataStorage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      
      const clips = await dataStorage.getClipsByVideo(videoId);
      if (clips.length === 0) {
        return res.status(404).json({ message: "No clips found for this video" });
      }
      
      // Setup zip file
      res.attachment(`${path.parse(video.originalFilename).name}_scenes.zip`);
      
      const archive = archiver('zip', {
        zlib: { level: 5 } // Compression level
      });
      
      archive.on('error', (err) => {
        throw err;
      });
      
      // Pipe archive data to response
      archive.pipe(res);
      
      // Add each clip to the archive
      for (const clip of clips) {
        const originalName = path.parse(video.originalFilename).name;
        const extension = path.extname(clip.filename);
        const filename = `${originalName}_scene_${clip.sceneIndex + 1}${extension}`;
        
        archive.file(clip.filePath, { name: filename });
      }
      
      // Finalize archive
      await archive.finalize();
    } catch (error) {
      console.error("Download all error:", error);
      res.status(500).json({ message: "Error downloading clips" });
    }
  });

  return httpServer;
}

// Helper functions for formatting timestamps
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}

function formatTimestamp(startMs: number, endMs: number): string {
  return `${formatDuration(startMs)} - ${formatDuration(endMs)}`;
}
