import { Card, CardContent } from "@/components/ui/card";
import type { VideoInfo } from "@shared/schema";

interface VideoInfoCardProps {
  videoInfo: VideoInfo | null;
}

// Helper to format bytes to human-readable size
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function VideoInfoCard({ videoInfo }: VideoInfoCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Video Information</h2>
        
        {/* No video selected state */}
        {!videoInfo && (
          <div className="flex items-center justify-center p-6 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-500">No video information available</p>
          </div>
        )}
        
        {/* Video info state */}
        {videoInfo && (
          <ul className="divide-y divide-gray-200">
            <li className="py-3 flex justify-between">
              <span className="text-gray-600">Duration</span>
              <span className="text-gray-900 font-medium">{videoInfo.duration || "Unknown"}</span>
            </li>
            <li className="py-3 flex justify-between">
              <span className="text-gray-600">Format</span>
              <span className="text-gray-900 font-medium">{videoInfo.format || "Unknown"}</span>
            </li>
            <li className="py-3 flex justify-between">
              <span className="text-gray-600">Resolution</span>
              <span className="text-gray-900 font-medium">{videoInfo.resolution || "Unknown"}</span>
            </li>
            <li className="py-3 flex justify-between">
              <span className="text-gray-600">Size</span>
              <span className="text-gray-900 font-medium">{formatBytes(videoInfo.fileSize)}</span>
            </li>
            <li className="py-3 flex justify-between">
              <span className="text-gray-600">Detected Scenes</span>
              <span className="text-gray-900 font-medium">{videoInfo.sceneCount || 0}</span>
            </li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
