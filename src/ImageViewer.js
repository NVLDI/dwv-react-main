// ImageViewer.js
import React, { useRef, useState } from "react";
import { 
  Box, 
  Button, 
  Stack, 
  Paper, 
  Chip, 
  Typography,
  Card,
  CardMedia,
  IconButton,
  Dialog,
  DialogContent
} from "@mui/material";
import { 
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateLeft as RotateLeftIcon,
  RotateRight as RotateRightIcon,
  Fullscreen as FullscreenIcon,
  Close as CloseIcon
} from "@mui/icons-material";

export default function ImageViewer() {
  const [imageModels, setImageModels] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [imageInfo, setImageInfo] = useState(null);

  const handleFolderChange = async (event) => {
    const files = Array.from(event.target.files);
    const imageFiles = files.filter(file => {
      const extension = file.name.toLowerCase();
      return extension.endsWith('.jpg') || 
             extension.endsWith('.jpeg') || 
             extension.endsWith('.png') || 
             extension.endsWith('.bmp') || 
             extension.endsWith('.gif') || 
             extension.endsWith('.webp');
    });

    if (imageFiles.length === 0) {
      alert('No image files found in the selected folder');
      return;
    }

    setLoading(true);
    const models = {};

    // Process each image file
    for (const file of imageFiles) {
      const fileName = file.name.toLowerCase();
      const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
      
      // Determine model type based on filename
      let modelType = 'other';
      if (nameWithoutExt.includes('upper')) modelType = 'upper';
      else if (nameWithoutExt.includes('lower')) modelType = 'lower';
      else if (nameWithoutExt.includes('left')) modelType = 'left';
      else if (nameWithoutExt.includes('right')) modelType = 'right';
      else if (nameWithoutExt.includes('top')) modelType = 'upper';
      else if (nameWithoutExt.includes('bottom')) modelType = 'lower';
      else if (nameWithoutExt.includes('front')) modelType = 'front';
      else if (nameWithoutExt.includes('back')) modelType = 'back';
      else if (nameWithoutExt.includes('side')) modelType = 'side';

      try {
        const imageUrl = await readFileAsDataURL(file);
        const imageInfo = await getImageInfo(imageUrl);
        
        models[modelType] = {
          imageUrl,
          fileName: file.name,
          width: imageInfo.width,
          height: imageInfo.height,
          size: file.size
        };
      } catch (error) {
        console.error(`Error loading ${file.name}:`, error);
      }
    }

    setImageModels(models);
    setLoading(false);

    // Auto-select the first available model
    const firstModel = Object.keys(models)[0];
    if (firstModel) {
      displayImage(firstModel, models);
    }
  };

  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getImageInfo = (imageUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = reject;
      img.src = imageUrl;
    });
  };

  const displayImage = (modelType, models = imageModels) => {
    if (!models[modelType]) return;

    setActiveModel(modelType);
    setImageInfo(models[modelType]);
    setZoom(1);
    setRotation(0);
  };

  const handleModelSelect = (modelType) => {
    if (imageModels[modelType]) {
      displayImage(modelType);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleRotateLeft = () => {
    setRotation(prev => prev - 90);
  };

  const handleRotateRight = () => {
    setRotation(prev => prev + 90);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Paper sx={{ p: 2, height: "100%", display: 'flex', flexDirection: 'column' }}>
      <Stack spacing={2} sx={{ flex: 1 }}>
        {/* Upload Section */}
        <Box>
          <Button 
            variant="contained" 
            component="label" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Select Image Folder'}
            <input
              type="file"
              hidden
              webkitdirectory="true"
              directory="true"
              multiple
              accept="image/*"
              onChange={handleFolderChange}
            />
          </Button>
          
          {Object.keys(imageModels).length > 0 && (
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              Loaded {Object.keys(imageModels).length} images
            </Typography>
          )}
        </Box>

        {/* Image Viewer */}
        {activeModel && imageInfo && (
          <Card sx={{ flex: 1, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
            {/* Image Controls */}
            <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' }}>
              <Typography variant="subtitle2">
                {imageInfo.fileName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton size="small" onClick={handleZoomOut}>
                  <ZoomOutIcon />
                </IconButton>
                <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center', alignSelf: 'center' }}>
                  {Math.round(zoom * 100)}%
                </Typography>
                <IconButton size="small" onClick={handleZoomIn}>
                  <ZoomInIcon />
                </IconButton>
                <IconButton size="small" onClick={handleRotateLeft}>
                  <RotateLeftIcon />
                </IconButton>
                <IconButton size="small" onClick={handleRotateRight}>
                  <RotateRightIcon />
                </IconButton>
                <IconButton size="small" onClick={() => setFullscreenOpen(true)}>
                  <FullscreenIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Image Display */}
            <Box 
              sx={{ 
                flex: 1, 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                overflow: 'hidden',
                backgroundColor: '#f5f5f5'
              }}
            >
              <CardMedia
                component="img"
                image={imageInfo.imageUrl}
                alt={imageInfo.fileName}
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out',
                  cursor: zoom > 1 ? 'grab' : 'default'
                }}
                onDoubleClick={handleZoomIn}
              />
            </Box>
          </Card>
        )}

        {/* Image Info */}
        {imageInfo && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              <strong>Dimensions:</strong> {imageInfo.width} × {imageInfo.height}px
            </Typography>
            <Typography variant="body2">
              <strong>Size:</strong> {formatFileSize(imageInfo.size)}
            </Typography>
            <Typography variant="body2">
              <strong>Aspect Ratio:</strong> {(imageInfo.width / imageInfo.height).toFixed(2)}:1
            </Typography>
          </Box>
        )}

        {/* Model Selection Buttons */}
        {Object.keys(imageModels).length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Select Image:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {Object.keys(imageModels).map((modelType) => (
                <Chip
                  key={modelType}
                  label={modelType.charAt(0).toUpperCase() + modelType.slice(1)}
                  onClick={() => handleModelSelect(modelType)}
                  color={activeModel === modelType ? "primary" : "default"}
                  variant={activeModel === modelType ? "filled" : "outlined"}
                  sx={{ 
                    textTransform: 'capitalize',
                    fontWeight: activeModel === modelType ? 'bold' : 'normal'
                  }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      {/* Fullscreen Dialog */}
      <Dialog
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        maxWidth={false}
        fullScreen
        sx={{ '& .MuiDialog-paper': { backgroundColor: 'rgba(0,0,0,0.9)' } }}
      >
        <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {/* Fullscreen Controls */}
          <Box sx={{ 
            position: 'absolute', 
            top: 10, 
            right: 10, 
            zIndex: 1000,
            display: 'flex',
            gap: 1,
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: 1,
            p: 0.5
          }}>
            <IconButton sx={{ color: 'white' }} onClick={handleZoomOut}>
              <ZoomOutIcon />
            </IconButton>
            <IconButton sx={{ color: 'white' }} onClick={handleZoomIn}>
              <ZoomInIcon />
            </IconButton>
            <IconButton sx={{ color: 'white' }} onClick={handleRotateLeft}>
              <RotateLeftIcon />
            </IconButton>
            <IconButton sx={{ color: 'white' }} onClick={handleRotateRight}>
              <RotateRightIcon />
            </IconButton>
            <IconButton sx={{ color: 'white' }} onClick={() => setFullscreenOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Fullscreen Image */}
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center' 
          }}>
            {imageInfo && (
              <img
                src={imageInfo.imageUrl}
                alt={imageInfo.fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease-in-out'
                }}
                onDoubleClick={handleZoomIn}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Paper>
  );
}
