import { Card } from "@/components/ui/card";
import type { ClipInfo } from "@shared/schema";
import { useRef, useEffect } from "react";

interface ClipsPreviewCardProps {
  clips: ClipInfo[];
  selectedClipIndex: number;
  onSelectClip: (index: number) => void;
  onDownloadClip: (index: number) => void;
}

export default function ClipsPreviewCard({
  clips,
  selectedClipIndex,
  onSelectClip,
  onDownloadClip,
}: ClipsPreviewCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Reset video position when switching clips
  useEffect(() => {
    if (videoRef.current && clips.length > 0) {
      videoRef.current.load();
    }
  }, [selectedClipIndex, clips]);
  
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Extracted Clips</h2>
      </div>
      
      {/* No clips state */}
      {clips.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-800 mb-2">No Clips Available</h3>
            <p className="text-gray-600 mb-4">Upload and process a video to see extracted clips here.</p>
          </div>
        </div>
      )}
      
      {/* Clips available state */}
      {clips.length > 0 && (
        <div className="flex-1 flex flex-col">
          {/* Preview area */}
          <div className="relative aspect-video bg-gray-900">
            <video 
              ref={videoRef}
              className="w-full h-full" 
              controls
              preload="auto"
            >
              <source src={clips[selectedClipIndex].url} type="video/mp4" />
              Your browser doesn't support HTML5 video.
            </video>
            <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-75 rounded-lg py-1 px-2.5 text-white text-sm font-medium">
              <span>{formatDuration(clips[selectedClipIndex].duration)}</span>
            </div>
          </div>
          
          {/* Clip info and actions */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-medium text-gray-800">
                <span>Scene {selectedClipIndex + 1}</span>
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">{clips[selectedClipIndex].timestamp}</span>
              </div>
            </div>
            <button 
              type="button" 
              className="w-full mt-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center"
              onClick={() => onDownloadClip(selectedClipIndex)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download This Clip
            </button>
          </div>
          
          {/* Clip thumbnails */}
          <div className="p-4 flex-1 overflow-y-auto clip-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {clips.map((clip, index) => (
                <div 
                  key={clip.id}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition duration-200 hover:opacity-90 ${
                    selectedClipIndex === index ? 'border-primary' : 'border-transparent'
                  }`}
                  onClick={() => onSelectClip(index)}
                >
                  <img 
                    src={clip.thumbnailUrl} 
                    alt={`Scene ${index + 1} thumbnail`} 
                    className="w-full aspect-video object-cover" 
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent px-2 py-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-white text-xs font-medium">Scene {index + 1}</span>
                      <span className="text-white text-xs">{formatDuration(clip.duration)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// Format milliseconds to MM:SS
function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
