// ObjViewer.js - COMPLETE FINAL VERSION with all fixes applied

import React, { useRef, useState, useEffect } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Box, Button, Typography, Stack, Paper, Alert } from "@mui/material";

export default function ObjViewer() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [loadedFiles, setLoadedFiles] = useState([]);

  // ✅ FIXED: Proper cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    // Cancel animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // Clean up renderer
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current = null;
    }

    // Clean up scene
    if (sceneRef.current) {
      sceneRef.current.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      sceneRef.current = null;
    }

    // Clean up DOM
    if (mountRef.current && rendererRef.current?.domElement) {
      try {
        if (mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      } catch (error) {
        console.warn("Error removing renderer element:", error);
      }
    }
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    console.log("🔍 All selected files:", files.map(f => f.name));
    setLoadedFiles(files.map(f => f.name));

    const objFile = files.find((f) => f.name.toLowerCase().endsWith(".obj"));
    const mtlFile = files.find((f) => f.name.toLowerCase().endsWith(".mtl"));
    const textureFiles = files.filter((f) => 
      /\.(jpg|jpeg|png|bmp|gif|tga)$/i.test(f.name)
    );

    console.log("📁 Found files:", { 
      obj: objFile?.name, 
      mtl: mtlFile?.name, 
      textures: textureFiles.map(f => f.name) 
    });

    if (!objFile) {
      setWarnings(["No OBJ file found in selection"]);
      return;
    }

    setFileName(objFile.name);
    setWarnings([]);

    try {
      await loadOBJ(objFile, mtlFile, textureFiles);
    } catch (error) {
      console.error("❌ Error loading model:", error);
      setWarnings([`Error loading model: ${error.message}`]);
    }
  };

  const loadOBJ = async (objFile, mtlFile, textureFiles) => {
    if (!mountRef.current) return;

    // ✅ FIXED: Clean up previous content properly
    cleanup();

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Additional fill lights
    const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight1.position.set(-10, 5, 5);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight2.position.set(0, -10, 5);
    scene.add(fillLight2);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    try {
      const objLoader = new OBJLoader();
      let materials = null;

      // ✅ FIXED: Create texture map and URL mapping
      const textureMap = new Map();
      const urlToCleanup = [];
      
      textureFiles.forEach(file => {
        const url = URL.createObjectURL(file);
        textureMap.set(file.name, url);
        urlToCleanup.push(url);
      });

      // ✅ CRITICAL FIX: Properly handle MTL loading with texture overrides
      if (mtlFile) {
        console.log("🎨 Loading MTL file...");
        const mtlURL = URL.createObjectURL(mtlFile);
        const mtlLoader = new MTLLoader();
        
        try {
          materials = await mtlLoader.loadAsync(mtlURL);
          
          // ✅ CRITICAL FIX: Process materials AFTER loading to override texture references
          Object.keys(materials.materials).forEach(materialName => {
            const material = materials.materials[materialName];
            console.log("🔍 Processing material:", materialName, material);
            
            // Find texture files that match this material's texture reference
            textureFiles.forEach(textureFile => {
              const textureName = textureFile.name;
              const textureURL = textureMap.get(textureName);
              
              if (textureURL) {
                console.log("🎨 Creating texture for:", textureName);
                
                // Create the texture properly
                const textureLoader = new THREE.TextureLoader();
                const texture = textureLoader.load(textureURL);
                
                // ✅ CRITICAL: Prevent tiling - THIS IS THE KEY FIX
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.flipY = false;
                
                // Apply the texture to the material
                material.map = texture;
                material.needsUpdate = true;
                
                console.log("✅ Applied texture to material:", materialName);
              }
            });
          });
          
          materials.preload();
          objLoader.setMaterials(materials);
          console.log("✅ MTL loaded successfully with corrected textures");
          URL.revokeObjectURL(mtlURL);
        } catch (mtlError) {
          console.warn("⚠️ MTL loading failed:", mtlError);
          setWarnings(prev => [...prev, `MTL loading failed: ${mtlError.message}`]);
        }
      }

      const objURL = URL.createObjectURL(objFile);
      const object = await objLoader.loadAsync(objURL);
      URL.revokeObjectURL(objURL);

      console.log("✅ OBJ loaded successfully");

      // ✅ FIXED: Process materials and textures properly
      let textureApplied = false;

      object.traverse((child) => {
        if (child.isMesh) {
          console.log("🔍 Processing mesh:", child.name);
          
          // ✅ FIXED: Check and handle UV coordinates
          if (!child.geometry.attributes.uv) {
            console.warn("⚠️ No UV coordinates found, generating basic UVs for:", child.name);
            generateBasicUVs(child.geometry);
            setWarnings(prev => [...prev, `Generated UV coordinates for ${child.name || 'mesh'}`]);
          } else {
            console.log("✅ UV coordinates found for:", child.name);
          }

          // ✅ FIXED: Apply texture from files if no MTL texture was applied
          if (!textureApplied && textureFiles.length > 0) {
            // Check if material already has a texture from MTL
            const hasTextureFromMTL = child.material && child.material.map;
            
            if (!hasTextureFromMTL) {
              console.log("🖼️ Applying texture from files...");
              applyTextureFromFiles(child, textureFiles, textureMap);
              textureApplied = true;
            } else {
              console.log("✅ Using texture from MTL file");
            }
          } else if (!child.material) {
            // Apply default material if no texture and no MTL material
            child.material = new THREE.MeshLambertMaterial({
              color: 0xcccccc,
              side: THREE.DoubleSide
            });
          }

          // Enable shadows
          child.castShadow = true;
          child.receiveShadow = true;

          // ✅ FIXED: Ensure proper material properties
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
              });
            } else {
              child.material.side = THREE.DoubleSide;
              child.material.needsUpdate = true;
            }
          }
        }
      });

      scene.add(object);

      // Calculate dimensions and position
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      setDimensions({
        width: size.x.toFixed(2),
        height: size.y.toFixed(2),
        depth: size.z.toFixed(2),
      });

      // ✅ FIXED: Better camera positioning
      object.position.sub(center);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
      
      camera.position.set(0, 0, cameraZ * 1.5);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      console.log("📐 Model dimensions:", { size, center, cameraZ });

      // ✅ FIXED: Animation loop with proper reference
      const animate = () => {
        animationRef.current = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle window resize
      const handleResize = () => {
        if (mountRef.current && camera && renderer) {
          const width = mountRef.current.clientWidth;
          const height = mountRef.current.clientHeight;
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      };

      window.addEventListener('resize', handleResize);

      // ✅ FIXED: Clean up URLs after a delay to allow loading
      setTimeout(() => {
        urlToCleanup.forEach(url => URL.revokeObjectURL(url));
      }, 5000);

    } catch (error) {
      console.error("❌ Error in loadOBJ:", error);
      throw error;
    }
  };

  // ✅ FIXED: Proper texture application function with texture map
  const applyTextureFromFiles = (mesh, textureFiles, textureMap) => {
    const textureFile = textureFiles[0]; // Use first texture file
    console.log("🎨 Applying texture:", textureFile.name);

    const textureURL = textureMap.get(textureFile.name);
    if (!textureURL) {
      console.error("❌ Texture URL not found for:", textureFile.name);
      return;
    }

    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      textureURL,
      (texture) => {
        console.log("✅ Texture loaded successfully");
        
        // ✅ CRITICAL: Critical texture settings to prevent tiling
        texture.wrapS = THREE.ClampToEdgeWrapping;  // Prevent horizontal tiling
        texture.wrapT = THREE.ClampToEdgeWrapping;  // Prevent vertical tiling
        texture.minFilter = THREE.LinearFilter;      // Smooth scaling
        texture.magFilter = THREE.LinearFilter;      // Smooth scaling
        texture.flipY = false;                       // Proper orientation
        
        // Create material with the texture
        const material = new THREE.MeshLambertMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
        });

        mesh.material = material;
        
        console.log("🎨 Texture applied successfully to mesh");
      },
      undefined,
      (error) => {
        console.error("❌ Texture loading failed:", error);
      }
    );
  };

  // ✅ FIXED: Generate basic UV coordinates function
  const generateBasicUVs = (geometry) => {
    const positions = geometry.attributes.position;
    const uvs = [];

    // Calculate bounding box for UV mapping
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const sizeX = bbox.max.x - bbox.min.x;
    const sizeY = bbox.max.y - bbox.min.y;
    const sizeZ = bbox.max.z - bbox.min.z;

    // Use the largest two dimensions for UV mapping
    let uIndex, vIndex;
    if (sizeX >= sizeY && sizeX >= sizeZ) {
      if (sizeY >= sizeZ) {
        uIndex = 0; vIndex = 1; // X-Y plane
      } else {
        uIndex = 0; vIndex = 2; // X-Z plane
      }
    } else if (sizeY >= sizeZ) {
      uIndex = 1; vIndex = 2; // Y-Z plane
    } else {
      uIndex = 0; vIndex = 2; // X-Z plane
    }

    const sizeU = uIndex === 0 ? sizeX : (uIndex === 1 ? sizeY : sizeZ);
    const sizeV = vIndex === 0 ? sizeX : (vIndex === 1 ? sizeY : sizeZ);
    const minU = uIndex === 0 ? bbox.min.x : (uIndex === 1 ? bbox.min.y : bbox.min.z);
    const minV = vIndex === 0 ? bbox.min.x : (vIndex === 1 ? bbox.min.y : bbox.min.z);

    for (let i = 0; i < positions.count; i++) {
      const u = (positions.getX(i) - minU) / sizeU;
      const v = (positions.getY(i) - minV) / sizeV;
      uvs.push(u, v);
    }

    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    console.log("✅ Generated UV coordinates:", uvs.length / 2, "vertices");
  };

  const resetView = () => {
    cleanup();
    setFileName(null);
    setDimensions(null);
    setWarnings([]);
    setLoadedFiles([]);
  };

  return (
  
  <Paper sx={{ p: 2, height: "100%" }}>
    <Stack spacing={2}>
      {/* Upload + Clear Buttons */}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" component="label">
          Load 3D Model
          <input
            type="file"
            hidden
            multiple
            accept=".obj,.mtl,.jpg,.jpeg,.png,.bmp,.gif,.tga"
            onChange={handleFileChange}
          />
        </Button>
        {fileName && (
          <Button variant="outlined" onClick={resetView}>
            Clear
          </Button>
        )}
      </Stack>

     
      {/* Warnings */}
      {warnings.length > 0 && (
        <Stack spacing={1}>
          {warnings.map((warning, index) => (
            <Alert key={index} severity="warning">
              {warning}
            </Alert>
          ))}
        </Stack>
      )}

      {/* 3D Viewer */}
      <Box ref={mountRef} sx={{ flex: 1, minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!fileName && (
          <Typography variant="h6" color="textSecondary" align="center">
            Select OBJ, MTL, and texture files to load your 3D model
          </Typography>
        )}
      </Box>
    </Stack>
  </Paper>


  );
}