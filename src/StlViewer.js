// StlViewer.js
import React, { useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Box, Button, Stack, Paper, Chip, Typography } from "@mui/material";

export default function StlViewer() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const [stlModels, setStlModels] = useState({});
  const [activeModel, setActiveModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dimensions, setDimensions] = useState(null);
  const [triangleCount, setTriangleCount] = useState(null);

  const handleFolderChange = async (event) => {
    const files = Array.from(event.target.files);
    const stlFiles = files.filter(file => 
      file.name.toLowerCase().endsWith('.stl')
    );

    if (stlFiles.length === 0) {
      alert('No STL files found in the selected folder');
      return;
    }

    setLoading(true);
    const models = {};

    // Process each STL file
    for (const file of stlFiles) {
      const fileName = file.name.replace('.stl', '').toLowerCase();
      
      // Determine model type based on filename
      let modelType = 'other';
      if (fileName.includes('upper')) modelType = 'upper';
      else if (fileName.includes('lower')) modelType = 'lower';
      else if (fileName.includes('left')) modelType = 'left';
      else if (fileName.includes('right')) modelType = 'right';
      else if (fileName.includes('top')) modelType = 'upper';
      else if (fileName.includes('bottom')) modelType = 'lower';

      try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const geometry = await loadSTLGeometry(arrayBuffer);
        
        models[modelType] = {
          geometry,
          fileName: file.name,
          mesh: null // Will be created when displayed
        };
      } catch (error) {
        console.error(`Error loading ${file.name}:`, error);
      }
    }

    setStlModels(models);
    setLoading(false);

    // Auto-select the first available model
    const firstModel = Object.keys(models)[0];
    if (firstModel) {
      displayModel(firstModel, models);
    }
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const loadSTLGeometry = (arrayBuffer) => {
    return new Promise((resolve, reject) => {
      try {
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);
        geometry.computeVertexNormals();
        resolve(geometry);
      } catch (error) {
        reject(error);
      }
    });
  };

  const setupScene = () => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.innerHTML = "";
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    // Lighting setup
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(5, 10, 10);
    dirLight1.castShadow = true;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-10, -5, -10);
    scene.add(dirLight2);

    return { scene, camera, renderer, controls };
  };

  const displayModel = (modelType, models = stlModels) => {
    if (!models[modelType]) return;

    const { scene, camera, renderer, controls } = setupScene();
    sceneRef.current = { scene, camera, renderer, controls };

    const geometry = models[modelType].geometry;
    
    const material = new THREE.MeshStandardMaterial({
      color: getModelColor(modelType),
      metalness: 0.1,
      roughness: 0.4,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Auto-center and scale
    geometry.center();
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    setDimensions(size);
    setTriangleCount(geometry.attributes.position.count / 3);

    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 100 / maxDim;
    mesh.scale.setScalar(scale);

    // Position camera
    const distance = maxDim * 1.5;
    camera.position.set(distance * 0.7, distance * 0.5, distance);
    camera.lookAt(0, 0, 0);
    controls.update();

    setActiveModel(modelType);

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  };

  const getModelColor = (modelType) => {
    const colors = {
      upper: 0xB59E68,  // Golden
      lower: 0x8B7355,  // Brown
      left: 0x7B68EE,   // Medium slate blue
      right: 0xFF6347,  // Tomato
      other: 0x808080   // Gray
    };
    return colors[modelType] || colors.other;
  };

  const handleModelSelect = (modelType) => {
    if (stlModels[modelType]) {
      displayModel(modelType);
    }
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
            {loading ? 'Loading...' : 'Select STL Folder'}
            <input
              type="file"
              hidden
              webkitdirectory="true"
              directory="true"
              multiple
              onChange={handleFolderChange}
            />
          </Button>
          
          {Object.keys(stlModels).length > 0 && (
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              Loaded {Object.keys(stlModels).length} STL models
            </Typography>
          )}
        </Box>

        {/* 3D Viewer */}
        <Box 
          ref={mountRef} 
          sx={{ 
            flex: 1, 
            minHeight: 400, 
            border: '1px solid #ddd',
            borderRadius: 1,
            overflow: 'hidden'
          }} 
        />

        {/* Model Info */}
        {dimensions && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2">
              <strong>Dimensions:</strong> {dimensions.x.toFixed(1)} × {dimensions.y.toFixed(1)} × {dimensions.z.toFixed(1)}
            </Typography>
            <Typography variant="body2">
              <strong>Triangles:</strong> {triangleCount?.toLocaleString()}
            </Typography>
          </Box>
        )}

        {/* Model Selection Buttons */}
        {Object.keys(stlModels).length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Select Model:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {Object.keys(stlModels).map((modelType) => (
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
    </Paper>
  );
}
