import React, { useState, useEffect } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import LinearProgress from '@mui/material/LinearProgress';
import Slider from '@mui/material/Slider';
import Paper from '@mui/material/Paper';
import StlViewer from "./StlViewer";
import PlyViewer from "./PlyViewer";
import ObjViewer from "./ObjViewer";
import ImageViewer from './ImageViewer';
// Icons
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LayersIcon from '@mui/icons-material/Layers';

import './App.css';
import DwvComponent from './DwvComponent';

// Global viewer references for synchronized navigation
window.dwvViewers = {};

export default function App() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
    const [sharedFiles, setSharedFiles] = useState(null);
    const [loadProgress, setLoadProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    
    // Global slice navigation state
    const [globalSliceInfo, setGlobalSliceInfo] = useState({
      currentSlice: 0,
      totalSlices: 0,
      isReady: false
    });

    const theme = createTheme({
      typography: {
        useNextVariants: true,
      },
      palette: {
        primary: {
          main: '#3f51b5', // Indigo 500
        },
        secondary: {
          main: '#e91e63', // Pink 500
        },
        mode: prefersDarkMode ? 'dark' : 'light',
      }
    });

    // ADDED: Ctrl+Scroll for parallel navigation
    useEffect(() => {
      const handleGlobalWheel = (event) => {
        // Only handle when Ctrl is pressed
        if (!event.ctrlKey) return;
        
        // Check if mouse is over any viewer area
        const viewerElements = document.querySelectorAll('.layerGroup');
        let isOverViewer = false;
        
        viewerElements.forEach(element => {
          const rect = element.getBoundingClientRect();
          if (event.clientX >= rect.left && event.clientX <= rect.right &&
              event.clientY >= rect.top && event.clientY <= rect.bottom) {
            isOverViewer = true;
          }
        });
        
        if (isOverViewer && sharedFiles) {
          event.preventDefault();
          event.stopPropagation();
          
          const direction = event.deltaY > 0 ? 1 : -1;
          
          console.log('🔄 PARALLEL SCROLL: All views moving together');
          
          // Navigate all viewers simultaneously
          Object.keys(window.dwvViewers || {}).forEach(viewerId => {
            const viewer = window.dwvViewers[viewerId];
            if (viewer && viewer.state.dataLoaded) {
              console.log(`📋 Moving ${viewerId} ${direction > 0 ? 'forward' : 'backward'}`);
              viewer.navigateSlice(direction);
            }
          });

          // Update global slice info
          const newSlice = Math.max(0, Math.min(globalSliceInfo.totalSlices - 1, globalSliceInfo.currentSlice + direction));
          setGlobalSliceInfo(prev => ({
            ...prev,
            currentSlice: newSlice
          }));
        }
      };

      // Add global wheel listener
      document.addEventListener('wheel', handleGlobalWheel, { passive: false });
      
      return () => {
        document.removeEventListener('wheel', handleGlobalWheel);
      };
    }, [sharedFiles, globalSliceInfo.currentSlice, globalSliceInfo.totalSlices]);

    // ADDED: Keyboard shortcuts for parallel navigation
    useEffect(() => {
      const handleKeyDown = (event) => {
        // Only when DICOM files are loaded and no input fields focused
        if (!sharedFiles || event.target.tagName === 'INPUT') return;
        
        let direction = 0;
        
        // Arrow keys for parallel navigation
        if (event.key === 'ArrowUp' || event.key === 'PageUp') {
          direction = -1;
        } else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
          direction = 1;
        }
        
        if (direction !== 0) {
          event.preventDefault();
          
          console.log(`⌨️ KEYBOARD PARALLEL: ${direction > 0 ? 'forward' : 'backward'}`);
          
          // Navigate all viewers simultaneously
          Object.keys(window.dwvViewers || {}).forEach(viewerId => {
            const viewer = window.dwvViewers[viewerId];
            if (viewer && viewer.state.dataLoaded) {
              viewer.navigateSlice(direction);
            }
          });

          // Update global slice info
          const newSlice = Math.max(0, Math.min(globalSliceInfo.totalSlices - 1, globalSliceInfo.currentSlice + direction));
          setGlobalSliceInfo(prev => ({
            ...prev,
            currentSlice: newSlice
          }));
        }
      };

      // Add keyboard listener
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [sharedFiles, globalSliceInfo.currentSlice, globalSliceInfo.totalSlices]);

    // Handle global slice change from slider (IMPROVED)
    const handleGlobalSliceChange = (event, newSlice) => {
      console.log(`🎚️ Global slice changed to: ${newSlice}`);
      
      setGlobalSliceInfo(prev => ({
        ...prev,
        currentSlice: newSlice
      }));

      // Get the current slice from global state
      const currentSlice = globalSliceInfo.currentSlice;
      const steps = newSlice - currentSlice;
      
      if (steps === 0) return;
      
      console.log(`🔄 SLIDER PARALLEL: Moving all views ${Math.abs(steps)} steps ${steps > 0 ? 'forward' : 'backward'}`);
      
      // Navigate all viewers step by step in parallel
      let stepsDone = 0;
      const totalSteps = Math.abs(steps);
      const direction = steps > 0 ? 1 : -1;
      
      const executeParallelStep = () => {
        if (stepsDone >= totalSteps) {
          console.log(`✅ All views reached slice ${newSlice}`);
          return;
        }
        
        // Move all viewers one step simultaneously
        Object.keys(window.dwvViewers || {}).forEach(viewerId => {
          const viewer = window.dwvViewers[viewerId];
          if (viewer && viewer.state.dataLoaded) {
            viewer.navigateSlice(direction);
          }
        });
        
        stepsDone++;
        setTimeout(executeParallelStep, 25); // Fast parallel steps
      };
      
      executeParallelStep();
    };

    // Handle parallel navigation with buttons
    const handleParallelNavigation = (steps) => {
      console.log(`🔘 BUTTON PARALLEL: ${steps} steps`);
      
      Object.keys(window.dwvViewers || {}).forEach(viewerId => {
        const viewer = window.dwvViewers[viewerId];
        if (viewer && viewer.state.dataLoaded) {
          // Execute multiple steps
          for (let i = 0; i < Math.abs(steps); i++) {
            setTimeout(() => {
              viewer.navigateSlice(steps > 0 ? 1 : -1);
            }, i * 15); // 15ms between steps
          }
        }
      });

      // Update global slice info
      const newSlice = Math.max(0, Math.min(globalSliceInfo.totalSlices - 1, globalSliceInfo.currentSlice + steps));
      setTimeout(() => {
        setGlobalSliceInfo(prev => ({
          ...prev,
          currentSlice: newSlice
        }));
      }, Math.abs(steps) * 15);
    };

    // Handle slice info updates from individual viewers
    const handleSliceInfoUpdate = (viewerId, sliceInfo) => {
      console.log(`📊 Slice info update from ${viewerId}:`, sliceInfo);
      
      // Update global state with the slice information
      setGlobalSliceInfo(prev => ({
        currentSlice: sliceInfo.currentSlice,
        totalSlices: sliceInfo.totalSlices,
        isReady: sliceInfo.totalSlices > 0
      }));
    };

    // Handle individual slice change (when a single viewer scrolls)
    const handleIndividualSliceChange = (viewerId, currentSlice) => {
      console.log(`📱 Individual slice change from ${viewerId}: ${currentSlice}`);
      
      // Update global slice state to keep slider in sync
      setGlobalSliceInfo(prev => ({
        ...prev,
        currentSlice: currentSlice
      }));
    };

    // Handle file selection from button click
    const handleFileButtonClick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.dcm,.dicom,application/dicom';
      
      input.onchange = (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
          console.log('Files selected:', files.length);
          setIsLoading(true);
          setLoadProgress(0);
          setSharedFiles(files);
          
          // Reset slice info when new files are loaded
          setGlobalSliceInfo({
            currentSlice: 0,
            totalSlices: 0,
            isReady: false
          });
        }
      };
      
      input.click();
    };

    // Handle drag and drop on the main container
    const handleDragOver = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleDrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const files = event.dataTransfer.files;
      if (files && files.length > 0) {
        console.log('Files dropped:', files.length);
        setIsLoading(true);
        setLoadProgress(0);
        setSharedFiles(files);
        
        // Reset slice info when new files are loaded
        setGlobalSliceInfo({
          currentSlice: 0,
          totalSlices: 0,
          isReady: false
        });
      }
    };

    // Handle when all viewers finish loading
    const handleLoadComplete = () => {
      console.log('All viewers finished loading');
      setIsLoading(false);
      setLoadProgress(100);
      setTimeout(() => setLoadProgress(0), 2000);
    };

    // Handle progress updates
    const handleProgressUpdate = (progress) => {
      setLoadProgress(progress);
    };

    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
       
          {/* Global header with centralized import */}
          <Box 
        sx={{ 
          flexGrow: 1, 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: 'background.default'
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
             <Paper elevation={2} sx={{ p: 2, mb: 1 }}>
              <Typography variant="h6" component="h1">
                Multi-View DICOM Viewer
              </Typography>
              
              {/* Centralized Import Controls */}
             <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" flexWrap="wrap">
                {/* Import Button */}
                <Button
                  variant="contained"
                  startIcon={<FolderOpenIcon />}
                  onClick={handleFileButtonClick}
                  disabled={isLoading}
                >
                  Import DICOM Files
                </Button>

                {/* Parallel Navigation Buttons */}
                {globalSliceInfo.isReady && (
                  <>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleParallelNavigation(-10)}
                      disabled={isLoading}
                      title="Move all views back 10 slices"
                    >
                      ⏪ -10
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleParallelNavigation(-1)}
                      disabled={isLoading}
                      title="Move all views back 1 slice"
                    >
                      ◀ -1
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleParallelNavigation(1)}
                      disabled={isLoading}
                      title="Move all views forward 1 slice"
                    >
                      +1 ▶
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleParallelNavigation(10)}
                      disabled={isLoading}
                      title="Move all views forward 10 slices"
                    >
                      +10 ⏩
                    </Button>
                  </>
                )}
                </Stack>
                {/* Navigation Instructions */}
                <Typography variant="body2" color="textSecondary">
                  🎚️ <strong>Slider/Ctrl+Scroll/↑↓</strong>: All views | <strong>Mouse Scroll</strong>: Individual view
                </Typography>
              
            </Paper>
            
            {/* Global Progress Bar */}
            {isLoading && (
          <Box sx={{ px: 2, pb: 1 }}>
            <LinearProgress variant="determinate" value={loadProgress} />
            <Typography variant="body2" align="center" sx={{ mt: 0.5 }}>
              Loading DICOM files into all views... {Math.round(loadProgress)}%
            </Typography>
          </Box>
            )}

            {/* Global Slice Navigation Slider */}
            {globalSliceInfo.isReady && (
             <Paper elevation={1} sx={{ p: 2, mx: 2, mb: 1 }}>
               
                  <LayersIcon color="primary" />
                  <Typography variant="subtitle2" color="primary" sx={{ minWidth: 120 }}>
                    Parallel Navigation
                  </Typography>
                  
                  <Box sx={{ flex: 1, px: 2 }}>
                    <Slider
                      value={globalSliceInfo.currentSlice}
                      onChange={handleGlobalSliceChange}
                      min={0}
                      max={globalSliceInfo.totalSlices - 1}
                      step={1}
                      marks={[
                        { value: 0, label: '1' },
                        { 
                          value: Math.floor(globalSliceInfo.totalSlices / 2), 
                          label: Math.floor(globalSliceInfo.totalSlices / 2) + 1 
                        },
                        { 
                          value: globalSliceInfo.totalSlices - 1, 
                          label: globalSliceInfo.totalSlices 
                        }
                      ]}
                      valueLabelDisplay="on"
                      valueLabelFormat={(value) => `Slice ${value + 1}`}
                      sx={{
                        '& .MuiSlider-thumb': {
                          width: 20,
                          height: 20,
                        },
                        '& .MuiSlider-track': {
                          height: 6,
                        },
                        '& .MuiSlider-rail': {
                          height: 6,
                        }
                      }}
                    />
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" sx={{ minWidth: 100 }}>
                    {globalSliceInfo.currentSlice + 1} / {globalSliceInfo.totalSlices}
                  </Typography>
                
              </Paper>
            )}
      
          
         {/* Viewers layout */}
<Grid container spacing={1} sx={{ flexGrow: 1, px: 2, pb: 2 }}>
  {/* Row 1: DICOM views */}
  <Grid item xs={12} md={4} sx={{ height: '85vh' }}>
    <DwvComponent
      viewerId="viewer1"
      layerGroupId="layerGroup0"
      title="Axial View"
      defaultOrientation="axial"
      sharedFiles={sharedFiles}
      onLoadComplete={handleLoadComplete}
      onProgressUpdate={handleProgressUpdate}
      onSliceInfoUpdate={handleSliceInfoUpdate}
      onIndividualSliceChange={handleIndividualSliceChange}
      viewIndex={0}
    />
  </Grid>
  <Grid item xs={12} md={4} sx={{ height: '85vh' }}>
    <DwvComponent
      viewerId="viewer2"
      layerGroupId="layerGroup1"
      title="Sagittal View"
      defaultOrientation="sagittal"
      sharedFiles={sharedFiles}
      onLoadComplete={handleLoadComplete}
      onProgressUpdate={handleProgressUpdate}
      onSliceInfoUpdate={handleSliceInfoUpdate}
      onIndividualSliceChange={handleIndividualSliceChange}
      viewIndex={1}
    />
  </Grid>
  <Grid item xs={12} md={4} sx={{ height: '85vh' }}>
    <DwvComponent
      viewerId="viewer3"
      layerGroupId="layerGroup2"
      title="Coronal View"
      defaultOrientation="coronal"
      sharedFiles={sharedFiles}
      onLoadComplete={handleLoadComplete}
      onProgressUpdate={handleProgressUpdate}
      onSliceInfoUpdate={handleSliceInfoUpdate}
      onIndividualSliceChange={handleIndividualSliceChange}
      viewIndex={2}
    />
  </Grid>

  {/* Row 2: STL + PLY viewers */}
  <Grid item xs={12} md={4} sx={{ height: '70vh' }}>
    <StlViewer />
  </Grid>
  <Grid item xs={12} md={4} sx={{ height: '70vh' }}>
    <PlyViewer />
  </Grid>
  <Grid item xs={12} md={4} sx={{ height: '70vh' }}>
  <ObjViewer />
</Grid>
 <Grid item xs={12} md={4} sx={{ height: '70vh' }}>
    <ImageViewer />
  </Grid>
</Grid>         
         
        </Box>
      </ThemeProvider>
    );
}