import { useState } from 'react';
import { API_PREFIX } from './consts';

const FileUpload = ({currentFloor, isImageSelected}: {currentFloor: string, isImageSelected: boolean}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // Handle file selection
  const handleFileChange = (event: any) => {
    setSelectedFile(event.target.files[0]);
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) {
      setUploadStatus('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_PREFIX}/api/floorplans/${currentFloor}/image`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadStatus('File uploaded successfully.');
      } else {
        setUploadStatus('Failed to upload file.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadStatus('Error uploading file.');
    }
  };

  return (
    <div style={{margin: "5px"}}>
      <input
        type="file"
        onChange={handleFileChange}
      />
      <button onClick={handleFileUpload}>{isImageSelected ? "Change Image" : "Upload Image"}</button>
      <p>{uploadStatus}</p>
    </div>
  );
};

export default FileUpload;
