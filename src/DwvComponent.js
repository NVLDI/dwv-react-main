
import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Box from '@mui/material/Box';

// https://mui.com/material-ui/material-icons/
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuIcon from '@mui/icons-material/Menu';
import ContrastIcon from '@mui/icons-material/Contrast';
import SearchIcon from '@mui/icons-material/Search';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import StraightenIcon from '@mui/icons-material/Straighten';
import CameraswitchIcon from '@mui/icons-material/Cameraswitch';

import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Slide from '@mui/material/Slide';
import Toolbar from '@mui/material/Toolbar';

import TagsTable from './TagsTable';

import './DwvComponent.css';
import {
  App,
  getDwvVersion,
  decoderScripts
} from 'dwv';

// Image decoders (for web workers)
decoderScripts.jpeg2000 = `${process.env.PUBLIC_URL}/assets/dwv/decoders/pdfjs/decode-jpeg2000.js`;
decoderScripts["jpeg-lossless"] = `${process.env.PUBLIC_URL}/assets/dwv/decoders/rii-mango/decode-jpegloss.js`;
decoderScripts["jpeg-baseline"] = `${process.env.PUBLIC_URL}/assets/dwv/decoders/pdfjs/decode-jpegbaseline.js`;
decoderScripts.rle = `${process.env.PUBLIC_URL}/assets/dwv/decoders/dwv/decode-rle.js`;

const styles = theme => ({
  appBar: {
    position: 'relative',
  },
  title: {
    flex: '0 0 auto',
  },
  iconSmall: {
    fontSize: 20,
  },
  flex: {
    flex: 1,
  }
});

export const TransitionUp = React.forwardRef((props, ref) => (
  <Slide direction="up" {...props} ref={ref} />
));

class DwvComponent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      versions: {
        dwv: getDwvVersion(),
        react: React.version
      },
      tools: {
        Scroll: {},
        ZoomAndPan: {},
        WindowLevel: {},
        Draw: {
          options: ['Ruler']
        }
      },
      selectedTool: 'Select Tool',
      loadProgress: 0,
      dataLoaded: false,
      dwvApp: null,
      metaData: {},
      orientation: props.defaultOrientation || 'axial',
      showDicomTags: false,
      // Props-based configuration for multiple views
      viewerId: props.viewerId || 'defaultViewer',
      layerGroupId: props.layerGroupId || 'layerGroup0',
      defaultOrientation: props.defaultOrientation || 'axial',
      viewIndex: props.viewIndex || 0,
      // Mouse and focus states for synchronized scrolling
      isHovered: false,
      // Slice info
      currentSlice: 0,
      totalSlices: 0
    };
    
    this.loadedViewers = new Set(); // Track which viewers have finished loading
    this.layerGroupRef = null; // Reference to the layer group element
    this.dataId = null;
  }

  render() {
    const { classes, title } = this.props;
    const { versions, tools, loadProgress, dataLoaded, metaData, isHovered, currentSlice, totalSlices } = this.state;

    const handleToolChange = (event, newTool) => {
      if (newTool) {
        this.onChangeTool(newTool);
      }
    };

    const toolsButtons = Object.keys(tools).map((tool) => {
      return (
        <ToggleButton value={tool} key={tool} title={tool}
          disabled={!dataLoaded || !this.canRunTool(tool)}>
          {this.getToolIcon(tool)}
        </ToggleButton>
      );
    });

    return (
      <div 
        id={this.state.viewerId} 
        style={{
          border: isHovered ? '2px solid #ffffffff' : '1px solid #ddd', 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'border-color 0.2s ease',
        }}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
        tabIndex={0} // Make div focusable
      >
        {/* View title */}
        {title && (
          <Box sx={{ 
            padding: 1, 
            backgroundColor: '#333',
            fontSize: '14px', 
            fontWeight: 'bold',
            borderBottom: '1px solid #333',
            textAlign: 'center',
            transition: 'background-color 0.2s ease',
            color: 'white'
          }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <span>{title} ({this.state.orientation})</span>
              {dataLoaded && totalSlices > 0 && (
                <Typography variant="caption" color="textSecondary">
                  {currentSlice + 1}/{totalSlices}
                </Typography>
              )}
            </Stack>
            {isHovered && (
              <Typography variant="caption" color="white" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                ● Active - Mouse scroll for individual navigation
              </Typography>
            )}
          </Box>
        )}
        
        {/* Compact toolbar for each view */}
        <Stack direction="row" spacing={1} padding={1}
          justifyContent="center" flexWrap="wrap">
          <ToggleButtonGroup size="small"
            color="primary"
            value={this.state.selectedTool}
            exclusive
            onChange={handleToolChange}
          >
            {toolsButtons}
          </ToggleButtonGroup>

          <ToggleButton size="small"
            value="reset"
            title="Reset"
            disabled={!dataLoaded}
            onChange={this.onReset}
          >
            <RefreshIcon />
          </ToggleButton>

          <ToggleButton size="small"
            value="toggleOrientation"
            title="Toggle Orientation"
            disabled={!dataLoaded}
            onClick={this.toggleOrientation}
          >
            <CameraswitchIcon />
          </ToggleButton>

          {/* Show tags button only on first viewer to avoid multiple dialogs */}
          {this.state.viewerId === 'viewer1' && (
            <ToggleButton size="small"
              value="tags"
              title="Tags"
              disabled={!dataLoaded}
              onClick={this.handleTagsDialogOpen}
            >
              <LibraryBooksIcon />
            </ToggleButton>
          )}
        </Stack>

        {/* Image display area */}
        <div 
          id={this.state.layerGroupId} 
          className="layerGroup" 
          style={{flex: 1}}
          ref={ref => this.layerGroupRef = ref}
        >
          {/* Show "Ready" message when no data loaded */}
          {!dataLoaded && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'text.secondary',
                zIndex: 1
              }}
            >
              <Typography variant="body2">
                Ready for DICOM import
              </Typography>
            </Box>
          )}
        </div>

        {/* Tags dialog - only on first viewer */}
        {this.state.viewerId === 'viewer1' && (
          <Dialog
            open={this.state.showDicomTags}
            onClose={this.handleTagsDialogClose}
            TransitionComponent={TransitionUp}
          >
            <AppBar className={classes.appBar} position="sticky">
              <Toolbar>
                <IconButton 
                  color="inherit" 
                  onClick={this.handleTagsDialogClose} 
                  aria-label="Close"
                >
                  <CloseIcon />
                </IconButton>
                <Typography variant="h6" color="inherit" className={classes.flex}>
                  DICOM Tags
                </Typography>
              </Toolbar>
            </AppBar>
            <TagsTable data={metaData} />
          </Dialog>
        )}
      </div>
    );
  }

  componentDidMount() {
    // Create the DWV app with initial orientation configuration
    const app = new App();
    
    // Initialize with correct orientation from the start
    const initialConfig = {
      "dataViewConfigs": {
        '*': [{
          divId: this.state.layerGroupId,
          orientation: this.state.defaultOrientation
        }]
      },
      "tools": this.state.tools
    };
    
    console.log(`Initializing ${this.state.viewerId} with orientation: ${this.state.defaultOrientation}`);
    app.init(initialConfig);

    // Store reference to app immediately
    this.setState({dwvApp: app});

    // Register this viewer globally for synchronized scrolling
    if (typeof window !== 'undefined') {
      window.dwvViewers[this.state.viewerId] = this;
    }

    // Load events
    let nLoadItem = null;
    let nReceivedLoadError = null;
    let nReceivedLoadAbort = null;
    let isFirstRender = null;
    
    app.addEventListener('loadstart', (/*event*/) => {
      console.log(`${this.state.viewerId}: Load started`);
      nLoadItem = 0;
      nReceivedLoadError = 0;
      nReceivedLoadAbort = 0;
      isFirstRender = true;
    });
    
    app.addEventListener("loadprogress", (event) => {
      this.setState({loadProgress: event.loaded});
      // Report progress to parent
      if (this.props.onProgressUpdate) {
        this.props.onProgressUpdate(event.loaded);
      }
    });
    
    app.addEventListener('renderend', (/*event*/) => {
      if (isFirstRender) {
        isFirstRender = false;
        console.log(`${this.state.viewerId}: First render completed`);
        
        // available tools
        let selectedTool = 'ZoomAndPan';
        if (app.canScroll()) {
          selectedTool = 'Scroll';
        }
        this.onChangeTool(selectedTool);
        
        // Apply orientation after first render
        this.applyOrientation();
        
        // Set up scroll event listeners after first render
        this.setupScrollEvents();
      }
    });
    
    app.addEventListener("load", (event) => {
      console.log(`${this.state.viewerId}: Data loaded`);
      
      this.dataId = event.dataid;
      
      // set dicom tags
      this.setState({metaData: app.getMetaData(event.dataid)});
      // set data loaded flag
      this.setState({dataLoaded: true});
      
      // Get total slices and notify parent
      this.updateSliceInfo();
      
      // Apply orientation after data is loaded
      setTimeout(() => {
        this.applyOrientation();
      }, 100);
    });
    
    app.addEventListener('loadend', (/*event*/) => {
      console.log(`${this.state.viewerId}: Load ended`);
      
      // Add this viewer to loaded set
      if (typeof window !== 'undefined') {
        if (!window.loadedViewers) {
          window.loadedViewers = new Set();
        }
        window.loadedViewers.add(this.state.viewIndex);
        
        // If all 3 viewers are loaded, notify parent
        if (window.loadedViewers.size >= 3 && this.props.onLoadComplete) {
          this.props.onLoadComplete();
          window.loadedViewers.clear(); // Reset for next load
        }
      }
      
      if (nReceivedLoadError) {
        alert('Received errors during load. Check log for details.');
      }
      if (nReceivedLoadAbort) {
        alert('Load was aborted.');
      }
    });
    
    app.addEventListener('loaditem', (/*event*/) => {
      ++nLoadItem;
    });
    
    app.addEventListener('loaderror', (event) => {
      console.error(`${this.state.viewerId}: Load error:`, event.error);
      ++nReceivedLoadError;
    });
    
    app.addEventListener('loadabort', (/*event*/) => {
      ++nReceivedLoadAbort;
    });

    // handle key events
    app.addEventListener('keydown', (event) => {
      app.defaultOnKeydown(event);
    });
    
    // handle window resize
    window.addEventListener('resize', app.onResize);
  }

  componentWillUnmount() {
    // Clean up scroll event listeners
    if (this.layerGroupRef) {
      this.layerGroupRef.removeEventListener('wheel', this.handleWheel);
    }
    
    // Remove global reference
    if (typeof window !== 'undefined' && window.dwvViewers) {
      delete window.dwvViewers[this.state.viewerId];
    }
  }

  // Watch for shared files from parent
  componentDidUpdate(prevProps) {
    if (this.props.sharedFiles && this.props.sharedFiles !== prevProps.sharedFiles) {
      console.log(`${this.state.viewerId}: Loading shared files`);
      if (this.state.dwvApp) {
        this.state.dwvApp.loadFiles(this.props.sharedFiles);
      }
    }
  }

  // Set up scroll event listeners for individual navigation
  setupScrollEvents = () => {
    if (this.layerGroupRef) {
      console.log(`${this.state.viewerId}: Setting up scroll events`);
      this.layerGroupRef.addEventListener('wheel', this.handleWheel, { passive: false });
    }
  }

  // Handle individual mouse wheel scrolling
  handleWheel = (event) => {
    if (!this.state.dataLoaded || !this.state.dwvApp) return;

    console.log(`${this.state.viewerId}: Individual mouse scroll`);
    event.preventDefault();
    event.stopPropagation();

    const delta = event.deltaY > 0 ? 1 : -1;
    this.navigateSlice(delta);
  }

  // SIMPLE: Navigate slice using arrow key simulation (this works!)
  navigateSlice = (direction) => {
    if (!this.state.dwvApp || !this.state.dataLoaded) return;

    const keyCode = direction > 0 ? 'ArrowDown' : 'ArrowUp';
    const keyEvent = new KeyboardEvent('keydown', {
      key: keyCode,
      code: keyCode,
      keyCode: keyCode === 'ArrowUp' ? 38 : 40,
      which: keyCode === 'ArrowUp' ? 38 : 40,
      bubbles: true,
      cancelable: true
    });

    console.log(`${this.state.viewerId}: Navigating ${keyCode}`);
    this.state.dwvApp.defaultOnKeydown(keyEvent);

    // Update current slice tracking
    const newSlice = Math.max(0, Math.min(this.state.totalSlices - 1, this.state.currentSlice + direction));
    this.setState({ currentSlice: newSlice });

    // Notify parent of individual slice change
    if (this.props.onIndividualSliceChange) {
      this.props.onIndividualSliceChange(this.state.viewerId, newSlice);
    }
  }

  // SIMPLIFIED: Set slice index for global slider (multiple single steps)
  setSliceIndex = (targetSlice) => {
    if (!this.state.dwvApp || !this.state.dataLoaded) {
      console.warn(`${this.state.viewerId}: Cannot set slice - app not ready`);
      return;
    }

    const currentSlice = this.state.currentSlice;
    const steps = targetSlice - currentSlice;

    console.log(`${this.state.viewerId}: 🎯 Setting slice from ${currentSlice} to ${targetSlice} (${steps} steps)`);

    if (steps === 0) return; // Already at target

    // Execute steps one by one with small delays
    let stepsDone = 0;
    const totalSteps = Math.abs(steps);
    const direction = steps > 0 ? 1 : -1;

    const executeStep = () => {
      if (stepsDone >= totalSteps) {
        console.log(`${this.state.viewerId}: ✅ Reached target slice ${targetSlice}`);
        return;
      }

      this.navigateSlice(direction);
      stepsDone++;

      // Continue with next step
      setTimeout(executeStep, 50); // 50ms delay between steps
    };

    executeStep();
  }

  // Get slice information
  updateSliceInfo = () => {
    if (!this.state.dwvApp || !this.state.dataLoaded || !this.dataId) return;

    try {
      const image = this.state.dwvApp.getImage(this.dataId);
      if (image) {
        const geometry = image.getGeometry();
        const size = geometry.getSize();
        const totalSlices = size.get(2) || 1;

        console.log(`${this.state.viewerId}: Found ${totalSlices} slices`);

        this.setState({ 
          currentSlice: 0, 
          totalSlices: totalSlices 
        });

        // Notify parent
        if (this.props.onSliceInfoUpdate) {
          this.props.onSliceInfoUpdate(this.state.viewerId, {
            currentSlice: 0,
            totalSlices: totalSlices
          });
        }
      }
    } catch (error) {
      console.error(`${this.state.viewerId}: Error getting slice info:`, error);
    }
  }

  // Mouse enter/leave handlers for visual feedback
  handleMouseEnter = () => {
    this.setState({ isHovered: true });
    console.log(`${this.state.viewerId}: Mouse entered`);
  }

  handleMouseLeave = () => {
    this.setState({ isHovered: false });
    console.log(`${this.state.viewerId}: Mouse left`);
  }

  // Apply orientation properly
  applyOrientation = () => {
    if (this.state.dwvApp && this.state.dataLoaded) {
      console.log(`${this.state.viewerId}: Applying orientation: ${this.state.orientation}`);
      
      // Update data view config with current orientation
      const config = {
        '*': [{
          divId: this.state.layerGroupId,
          orientation: this.state.orientation
        }]
      };
      
      this.state.dwvApp.setDataViewConfigs(config);
      
      // Force render all data with new orientation
      const dataIds = this.state.dwvApp.getDataIds();
      for (const dataId of dataIds) {
        this.state.dwvApp.render(dataId);
      }
    }
  }

  /**
   * Get the icon of a tool.
   */
  getToolIcon = (tool) => {
    let res;
    if (tool === 'Scroll') {
      res = (<MenuIcon />);
    } else if (tool === 'ZoomAndPan') {
      res = (<SearchIcon />);
    } else if (tool === 'WindowLevel') {
      res = (<ContrastIcon />);
    } else if (tool === 'Draw') {
      res = (<StraightenIcon />);
    }
    return res;
  }

  /**
   * Handle a change tool event.
   */
  onChangeTool = (tool) => {
    if (this.state.dwvApp) {
      this.setState({selectedTool: tool});
      this.state.dwvApp.setTool(tool);
      if (tool === 'Draw') {
        this.onChangeShape(this.state.tools.Draw.options[0]);
      }
    }
  }

  /**
   * Check if a tool can be run.
   */
  canRunTool = (tool) => {
    let res;
    if (tool === 'Scroll') {
      res = this.state.dwvApp && this.state.dwvApp.canScroll();
    } else if (tool === 'WindowLevel') {
      res = this.state.dwvApp && this.state.dwvApp.canWindowLevel();
    } else {
      res = true;
    }
    return res;
  }

  /**
   * Toggle the viewer orientation.
   */
  toggleOrientation = () => {
    let newOrientation;
    
    if (this.state.orientation === 'axial') {
      newOrientation = 'coronal';
    } else if (this.state.orientation === 'coronal') {
      newOrientation = 'sagittal';
    } else if (this.state.orientation === 'sagittal') {
      newOrientation = 'axial';
    } else {
      newOrientation = 'coronal';
    }
    
    console.log(`${this.state.viewerId}: Toggling from ${this.state.orientation} to ${newOrientation}`);
    this.setState({orientation: newOrientation}, () => {
      this.applyOrientation();
    });
  }

  /**
   * Handle a change draw shape event.
   */
  onChangeShape = (shape) => {
    if (this.state.dwvApp) {
      this.state.dwvApp.setToolFeatures({shapeName: shape});
    }
  }

  /**
   * Handle a reset event.
   */
  onReset = () => {
    if (this.state.dwvApp) {
      this.state.dwvApp.resetDisplay();
    }
  }

  /**
   * Open the DICOM tags dialog.
   */
  handleTagsDialogOpen = () => {
    this.setState({ showDicomTags: true });
  }

  /**
   * Close the DICOM tags dialog.
   */
  handleTagsDialogClose = () => {
    this.setState({ showDicomTags: false });
  };

} // DwvComponent

DwvComponent.propTypes = {
  classes: PropTypes.object.isRequired,
  viewerId: PropTypes.string,
  layerGroupId: PropTypes.string,
  title: PropTypes.string,
  defaultOrientation: PropTypes.oneOf(['axial', 'sagittal', 'coronal']),
  sharedFiles: PropTypes.object, // Files from parent to load
  onLoadComplete: PropTypes.func, // Callback when loading is complete
  onProgressUpdate: PropTypes.func, // Callback for progress updates
  onSliceInfoUpdate: PropTypes.func, // Callback for slice info
  onIndividualSliceChange: PropTypes.func, // Callback for individual slice changes
  viewIndex: PropTypes.number // Index of this view (0, 1, 2)
};

export default withStyles(styles)(DwvComponent);