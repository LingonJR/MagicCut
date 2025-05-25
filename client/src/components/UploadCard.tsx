import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface UploadCardProps {
  selectedFile: File | null;
  isUploading: boolean;
  uploadProgress: number;
  onFileSelect: (file: File) => void;
  onRemoveFile: () => void;
  startProcessing: () => void;
  cancelUpload: () => void;
}

export default function UploadCard({
  selectedFile,
  isUploading,
  uploadProgress,
  onFileSelect,
  onRemoveFile,
  startProcessing,
  cancelUpload,
}: UploadCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle file selection from input
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  // Handle click on the browse button
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle selecting a different file
  const handleSelectDifferentFile = () => {
    onRemoveFile();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const acceptedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      
      if (acceptedTypes.includes(file.type)) {
        onFileSelect(file);
      } else {
        alert('Please upload a valid video file (MP4, MOV, AVI)');
      }
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload Video</h2>
        
        {/* Initial upload state */}
        {!isUploading && !selectedFile && (
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition duration-200 cursor-pointer ${
              isDragOver ? 'border-primary bg-blue-50' : 'border-gray-300 hover:border-primary'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
          >
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-700 mb-2">Drag and drop your video file here</p>
            <p className="text-gray-500 text-sm mb-4">Supports MP4, MOV, AVI formats</p>
            <button 
              type="button" 
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-700 transition duration-200 font-medium"
            >
              Browse Files
            </button>
            <input 
              type="file" 
              className="hidden" 
              accept="video/mp4,video/quicktime,video/x-msvideo" 
              ref={fileInputRef}
              onChange={handleFileInputChange}
            />
          </div>
        )}
        
        {/* Upload progress state */}
        {isUploading && (
          <div>
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm font-medium text-gray-700">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
            <p className="text-sm text-gray-600">{selectedFile?.name}</p>
            <button 
              type="button" 
              className="mt-3 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
              onClick={cancelUpload}
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* File selected state */}
        {selectedFile && !isUploading && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-800 font-medium truncate max-w-[200px]">{selectedFile.name}</span>
              </div>
              <button 
                type="button" 
                className="text-gray-500 hover:text-gray-700"
                onClick={onRemoveFile}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                type="button" 
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                onClick={startProcessing}
              >
                Process Video
              </button>
              <button 
                type="button" 
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                onClick={handleSelectDifferentFile}
              >
                Choose Different File
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
