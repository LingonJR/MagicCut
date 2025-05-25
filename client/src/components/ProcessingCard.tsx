import { Card, CardContent } from "@/components/ui/card";
import type { ProcessingStatus, ClipInfo } from "@shared/schema";

interface ProcessingCardProps {
  processingStatus: ProcessingStatus;
  clips: ClipInfo[];
  onTryAgain: () => void;
  onDownloadAllClips: () => void;
}

export default function ProcessingCard({
  processingStatus,
  clips,
  onTryAgain,
  onDownloadAllClips,
}: ProcessingCardProps) {
  const { status, progress, stage } = processingStatus;
  const isProcessing = status === "processing";
  
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Processing Status</h2>
        
        {/* Idle state */}
        {status === "pending" && stage === "idle" && (
          <div className="flex items-center justify-center p-6 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-500">Upload a video file to begin processing</p>
          </div>
        )}
        
        {/* Processing state */}
        {isProcessing && (
          <div>
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{stage || "Processing..."}</span>
                <span className="text-sm font-medium text-gray-700">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
            <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-800">
                  This process analyzes your video frame by frame to detect scene changes. This may take a few minutes depending on the video length.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Completed state */}
        {status === "completed" && (
          <div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 mb-4">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-800">
                  Processing complete! We've detected <span className="font-medium">{clips.length}</span> scenes in your video.
                </p>
              </div>
            </div>
            <button 
              type="button" 
              className="w-full px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center"
              onClick={onDownloadAllClips}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All Clips
            </button>
          </div>
        )}
        
        {/* Error state */}
        {status === "error" && (
          <div>
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
              <div className="flex">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-red-800 font-medium">
                    Processing failed
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {processingStatus.error || "There was an error processing your video. Please try again or upload a different file."}
                  </p>
                </div>
              </div>
            </div>
            <button 
              type="button" 
              className="w-full px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium"
              onClick={onTryAgain}
            >
              Try Again
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
