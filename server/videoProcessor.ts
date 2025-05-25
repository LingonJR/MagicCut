import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Video } from '@shared/schema';

const SCENE_THRESHOLD = 0.4; // Default scene detection threshold

interface ProcessOptions {
  outputDir: string;
  thumbnailDir: string;
  threshold?: number;
  onProgress: (progress: number, stage: string) => void;
  onComplete: (results: ProcessResults) => void;
  onError: (error: Error) => void;
}

interface ClipResult {
  filePath: string;
  thumbnailPath: string;
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
}

interface ProcessResults {
  clips: ClipResult[];
  duration: number; // in milliseconds
  format: string;
  resolution: string;
}

export async function processVideo(video: Video, options: ProcessOptions): Promise<void> {
  try {
    const { outputDir, thumbnailDir, onProgress, onComplete, onError } = options;
    const threshold = options.threshold || SCENE_THRESHOLD;
    
    // Step 1: Get video info
    onProgress(5, "Analyzing video...");
    const videoInfo = await getVideoInfo(video.filePath);
    
    // Step 2: Detect scenes
    onProgress(15, "Detecting scenes...");
    const scenes = await detectScenes(video.filePath, threshold);
    
    if (scenes.length === 0) {
      throw new Error("No scenes detected in the video");
    }
    
    // Step 3: Extract clips
    onProgress(30, "Extracting clips...");
    const clipResults: ClipResult[] = [];
    const totalScenes = scenes.length;
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const nextScene = i < scenes.length - 1 ? scenes[i + 1] : videoInfo.duration;
      const startTime = scene;
      const endTime = nextScene;
      const duration = endTime - startTime;
      
      if (duration < 500) {
        // Skip very short scenes (less than 0.5 seconds)
        continue;
      }
      
      // Generate filenames
      const clipFilename = `${path.parse(video.filename).name}_scene_${i + 1}.mp4`;
      const clipPath = path.join(outputDir, clipFilename);
      const thumbnailFilename = `${path.parse(video.filename).name}_scene_${i + 1}.jpg`;
      const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
      
      // Extract clip
      await extractClip(video.filePath, clipPath, startTime, endTime);
      
      // Generate thumbnail
      await generateThumbnail(video.filePath, thumbnailPath, startTime + Math.min(1000, duration / 2));
      
      clipResults.push({
        filePath: clipPath,
        thumbnailPath,
        startTime,
        endTime,
      });
      
      // Update progress
      const clipProgress = 30 + Math.floor(((i + 1) / totalScenes) * 60);
      onProgress(clipProgress, `Extracting clip ${i + 1} of ${totalScenes}...`);
    }
    
    // Step 4: Complete
    onProgress(100, "Processing complete");
    onComplete({
      clips: clipResults,
      duration: videoInfo.duration,
      format: videoInfo.format,
      resolution: videoInfo.resolution,
    });
  } catch (error) {
    console.error("Video processing error:", error);
    options.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// Get video information
async function getVideoInfo(filePath: string): Promise<{
  duration: number;
  format: string;
  resolution: string;
}> {
  return new Promise((resolve, reject) => {
    const command = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name:format=duration -of json "${filePath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running ffprobe: ${error.message}`);
        return reject(new Error(`Failed to get video info: ${error.message}`));
      }
      
      if (stderr) {
        console.error(`ffprobe stderr: ${stderr}`);
      }
      
      try {
        const info = JSON.parse(stdout);
        const width = info.streams[0].width;
        const height = info.streams[0].height;
        const codec = info.streams[0].codec_name;
        const duration = Math.floor(parseFloat(info.format.duration) * 1000); // Convert to ms
        
        resolve({
          duration,
          format: codec.toUpperCase(),
          resolution: `${width} × ${height}`,
        });
      } catch (err) {
        reject(new Error('Failed to parse video information'));
      }
    });
  });
}

// Detect scene changes in the video
async function detectScenes(filePath: string, threshold: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${filePath}" -vf "select='gt(scene,${threshold})',showinfo" -f null -`;
    
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running ffmpeg scene detection: ${error.message}`);
        return reject(new Error(`Failed to detect scenes: ${error.message}`));
      }
      
      try {
        const scenes: number[] = [0]; // Always include the start of the video
        const lines = stderr.split('\n'); // FFmpeg outputs to stderr
        
        // Extract timestamps from showinfo filter output
        for (const line of lines) {
          if (line.includes('pts_time:')) {
            const matches = line.match(/pts_time:([\d.]+)/);
            if (matches && matches[1]) {
              const timeInSeconds = parseFloat(matches[1]);
              scenes.push(Math.floor(timeInSeconds * 1000)); // Convert to ms
            }
          }
        }
        
        // Sort timestamps in ascending order
        scenes.sort((a, b) => a - b);
        
        resolve(scenes);
      } catch (err) {
        reject(new Error('Failed to parse scene detection output'));
      }
    });
  });
}

// Extract a clip from the video
async function extractClip(
  inputPath: string, 
  outputPath: string, 
  startTime: number, 
  endTime: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startSec = (startTime / 1000).toFixed(3);
    const durationSec = ((endTime - startTime) / 1000).toFixed(3);
    
    const command = `ffmpeg -ss ${startSec} -i "${inputPath}" -t ${durationSec} -c:v libx264 -c:a aac -preset fast -crf 22 "${outputPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error extracting clip: ${error.message}`);
        return reject(new Error(`Failed to extract clip: ${error.message}`));
      }
      
      resolve();
    });
  });
}

// Generate a thumbnail from the video
async function generateThumbnail(
  inputPath: string, 
  outputPath: string, 
  timeMs: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeSec = (timeMs / 1000).toFixed(3);
    
    const command = `ffmpeg -ss ${timeSec} -i "${inputPath}" -vframes 1 -q:v 2 "${outputPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error generating thumbnail: ${error.message}`);
        return reject(new Error(`Failed to generate thumbnail: ${error.message}`));
      }
      
      resolve();
    });
  });
}