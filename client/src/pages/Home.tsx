import UploadCard from "@/components/UploadCard";
import ProcessingCard from "@/components/ProcessingCard";
import VideoInfoCard from "@/components/VideoInfoCard";
import ClipsPreviewCard from "@/components/ClipsPreviewCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/lib/hooks";
import type { VideoInfo, ClipInfo, ProcessingStatus } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedVideoId, setUploadedVideoId] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    status: "pending",
    progress: 0,
    stage: "idle"
  });
  const [clips, setClips] = useState<ClipInfo[]>([]);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  
  // Set up WebSocket connection with useEffect to prevent infinite loops
  useEffect(() => {
    if (!uploadedVideoId) return;
    
    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/processing-status`;
    const ws = new WebSocket(wsUrl);
    
    // Set up event handlers
    ws.onopen = () => {
      console.log(`WebSocket connected for video ID: ${uploadedVideoId}`);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Only process messages for our current video
        if (data && data.videoId && data.videoId === uploadedVideoId) {
          // Update processing status
          setProcessingStatus(prevStatus => ({
            ...prevStatus,
            status: data.status || prevStatus.status,
            progress: data.progress !== undefined ? data.progress : prevStatus.progress,
            stage: data.stage || prevStatus.stage,
            error: data.error
          }));
          
          // Update clips when available
          if (data.clips && Array.isArray(data.clips) && data.clips.length > 0) {
            setClips(data.clips);
          }
          
          // Update video info when available
          if (data.videoInfo) {
            setVideoInfo(data.videoInfo);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    // Clean up on unmount or when uploadedVideoId changes
    return () => {
      console.log('Closing WebSocket connection');
      ws.close();
    };
  }, [uploadedVideoId]); // Only reconnect when uploadedVideoId changes

  // Fetch video status if we have an uploadedVideoId
  const { data: videoStatusData } = useQuery({
    queryKey: ['/api/videos/status', uploadedVideoId],
    enabled: !!uploadedVideoId,
    refetchInterval: processingStatus.status === "processing" ? 2000 : false
  });

  // Update processing status from polling
  useEffect(() => {
    if (videoStatusData) {
      setProcessingStatus(prevStatus => ({
        ...prevStatus,
        status: videoStatusData.status || prevStatus.status,
        progress: videoStatusData.progress !== undefined ? videoStatusData.progress : prevStatus.progress,
        stage: videoStatusData.stage || prevStatus.stage,
        error: videoStatusData.error
      }));
      
      if (videoStatusData.clips && Array.isArray(videoStatusData.clips) && videoStatusData.clips.length > 0) {
        setClips(videoStatusData.clips);
      }
      
      if (videoStatusData.videoInfo) {
        setVideoInfo(videoStatusData.videoInfo);
      }
    }
  }, [videoStatusData]);

  // Handle file upload
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Upload failed');
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      setIsUploading(false);
      setUploadProgress(100);
      setUploadedVideoId(data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/videos/status', data.id] });
      toast({
        title: "Upload successful",
        description: "Your video has been uploaded and is now being processed.",
      });
    },
    onError: (error) => {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message || "There was an error uploading your video.",
        variant: "destructive",
      });
    }
  });

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
  };

  // Start processing the uploaded video
  const startProcessing = async () => {
    if (!selectedFile) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('video', selectedFile);
    
    // Upload with progress tracking
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/videos/upload', true);
    xhr.withCredentials = true;
    
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress);
      }
    };
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        setIsUploading(false);
        setUploadProgress(100);
        setUploadedVideoId(response.id);
        
        // Start processing the video
        apiRequest('POST', `/api/videos/${response.id}/process`, {})
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/videos/status', response.id] });
          })
          .catch((error) => {
            toast({
              title: "Processing failed",
              description: error.message || "There was an error processing your video.",
              variant: "destructive",
            });
          });
      } else {
        setIsUploading(false);
        setUploadProgress(0);
        toast({
          title: "Upload failed",
          description: xhr.responseText || "There was an error uploading your video.",
          variant: "destructive",
        });
      }
    };
    
    xhr.onerror = () => {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: "Network error occurred during upload.",
        variant: "destructive",
      });
    };
    
    xhr.send(formData);
  };

  // Cancel ongoing upload
  const cancelUpload = () => {
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Try processing again after an error
  const tryAgain = () => {
    if (uploadedVideoId) {
      apiRequest('POST', `/api/videos/${uploadedVideoId}/process`, {})
        .then(() => {
          setProcessingStatus({
            status: "processing",
            progress: 0,
            stage: "Restarting processing..."
          });
          queryClient.invalidateQueries({ queryKey: ['/api/videos/status', uploadedVideoId] });
        })
        .catch((error) => {
          toast({
            title: "Processing failed",
            description: error.message || "There was an error processing your video.",
            variant: "destructive",
          });
        });
    } else if (selectedFile) {
      startProcessing();
    } else {
      setProcessingStatus({
        status: "pending",
        progress: 0,
        stage: "idle"
      });
    }
  };

  // Download a specific clip
  const downloadClip = (index: number) => {
    if (clips.length > index) {
      window.location.href = `/api/clips/${clips[index].id}/download`;
    }
  };

  // Download all clips as a zip
  const downloadAllClips = () => {
    if (uploadedVideoId) {
      window.location.href = `/api/videos/${uploadedVideoId}/download-clips`;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">SceneClipper</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload your video and our AI will automatically detect scene changes and extract individual clips that you can preview and download.
          </p>
        </header>

        {/* Main Content */}
        <main>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left panel - Upload and Processing */}
            <div className="lg:col-span-5">
              <UploadCard
                selectedFile={selectedFile}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                onFileSelect={handleFileSelect}
                onRemoveFile={handleRemoveFile}
                startProcessing={startProcessing}
                cancelUpload={cancelUpload}
              />
              
              <ProcessingCard
                processingStatus={processingStatus}
                clips={clips}
                onTryAgain={tryAgain}
                onDownloadAllClips={downloadAllClips}
              />
              
              <VideoInfoCard videoInfo={videoInfo} />
            </div>
            
            {/* Right panel - Clips preview */}
            <div className="lg:col-span-7">
              <ClipsPreviewCard
                clips={clips}
                selectedClipIndex={selectedClipIndex}
                onSelectClip={setSelectedClipIndex}
                onDownloadClip={downloadClip}
              />
            </div>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} SceneClipper. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
