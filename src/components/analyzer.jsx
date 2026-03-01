// acts as rendererer
// gets audioURL from app and handles everything related to sound and graphics
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import "./analyzer.css";
import * as THREE from "three";

// Compute spectrogram directly from raw PCM data
function precomputeSpectrogram(audioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  const fftSize = 1024;          // larger window = smoother
  const binCount = fftSize / 2;
  const sampleCount = 128;
  const hopSize = Math.floor(channelData.length / sampleCount);

  // Downsample frequency bins to match time resolution
  // This makes a square grid (128 × 128) instead of (128 × 512)
  const outputBins = 128;
  const binsPerGroup = Math.floor(binCount / outputBins);

  const rawMatrix = [];

  for (let i = 0; i < sampleCount; i++) {
    const start = i * hopSize;
    const padded = new Float32Array(fftSize);
    const end = Math.min(start + fftSize, channelData.length);
    for (let j = start; j < end; j++) {
      padded[j - start] = channelData[j];
    }

    // Apply Hann window
    for (let n = 0; n < fftSize; n++) {
      padded[n] *= 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
    }

    // Simple DFT to get magnitude spectrum (full resolution)
    const fullMagnitudes = new Array(binCount);
    for (let k = 0; k < binCount; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (2 * Math.PI * k * n) / fftSize;
        real += padded[n] * Math.cos(angle);
        imag -= padded[n] * Math.sin(angle);
      }
      const magnitude = Math.sqrt(real * real + imag * imag);
      fullMagnitudes[k] = Math.min(255, Math.log10(magnitude + 1) * 40);
    }

    // Downsample: average groups of frequency bins into outputBins
    const magnitudes = new Array(outputBins);
    for (let b = 0; b < outputBins; b++) {
      let sum = 0;
      const startBin = b * binsPerGroup;
      const endBin = Math.min(startBin + binsPerGroup, binCount);
      for (let k = startBin; k < endBin; k++) {
        sum += fullMagnitudes[k];
      }
      magnitudes[b] = sum / (endBin - startBin);
    }

    rawMatrix.push(magnitudes);
  }

  // Smoothing each row across time using a moving average (blend neighbors)
  const smoothed = [];
  const windowSize = 6; // how many neighbors to average

  for (let i = 0; i < rawMatrix.length; i++) {
    const blended = new Array(outputBins);
    for (let k = 0; k < outputBins; k++) {
      let sum = 0;
      let count = 0;
      for (let offset = -windowSize; offset <= windowSize; offset++) {
        const idx = i + offset;
        if (idx >= 0 && idx < rawMatrix.length) {
          sum += rawMatrix[idx][k];
          count++;
        }
      }
      blended[k] = sum / count;
    }
    smoothed.push(blended);
  }

  // Also smooth across frequency bins to reduce jaggedness
  const finalMatrix = [];
  const freqWindow = 5;

  for (let i = 0; i < smoothed.length; i++) {
    const row = new Array(outputBins);
    for (let k = 0; k < outputBins; k++) {
      let sum = 0;
      let count = 0;
      for (let offset = -freqWindow; offset <= freqWindow; offset++) {
        const idx = k + offset;
        if (idx >= 0 && idx < outputBins) {
          sum += smoothed[i][idx];
          count++;
        }
      }
      row[k] = sum / count;
    }
    finalMatrix.push(row);
  }

  return finalMatrix;
}

// 3D axis cage with labeled tick marks that surrounds the terrain
function AxisCage({ size, tickCount = 5 }) {
  const half = size / 2;
  // Cube: all axes are the same size
  const h = size;

  // Colors for each axis
  const xColor = "#ff4444";
  const yColor = "#44ff44";
  const zColor = "#4488ff";
  const lineColor = "#555555";

  // Generate tick positions (0 to 1 normalized)
  const ticks = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(i / tickCount);
  }

  return (
    <group>
      {/* === Three main axis lines along edges === */}

      {/* X axis — along bottom-front edge (time) */}
      <Line
        points={[[-half, 0, half], [half, 0, half]]}
        color={xColor}
        lineWidth={2}
      />
      {/* Y axis — vertical left-front edge (amplitude) */}
      <Line
        points={[[-half, 0, half], [-half, h, half]]}
        color={yColor}
        lineWidth={2}
      />
      {/* Z axis — along bottom-left edge (frequency) */}
      <Line
        points={[[-half, 0, half], [-half, 0, -half]]}
        color={zColor}
        lineWidth={2}
      />

      {/* === Axis labels === */}
      <Text
        position={[0, -1.2, half + 1]}
        fontSize={0.8}
        color={xColor}
        anchorX="center"
        anchorY="middle"
      >
        Time
      </Text>
      <Text
        position={[-half - 1.5, h / 2, half]}
        fontSize={0.8}
        color={yColor}
        anchorX="center"
        anchorY="middle"
        rotation={[0, 0, Math.PI / 2]}
      >
        Amplitude
      </Text>
      <Text
        position={[-half - 1, -1.2, 0]}
        fontSize={0.8}
        color={zColor}
        anchorX="center"
        anchorY="middle"
        rotation={[0, Math.PI / 2, 0]}
      >
        Frequency
      </Text>

      {/* === X axis ticks + labels (along bottom-front) === */}
      {ticks.map((t, i) => {
        const x = -half + t * size;
        return (
          <group key={`x-${i}`}>
            {/* Tick line */}
            <Line
              points={[[x, 0, half], [x, 0, half + 0.4]]}
              color={lineColor}
              lineWidth={1}
            />
            {/* Grid line going back along Z */}
            <Line
              points={[[x, 0, half], [x, 0, -half]]}
              color={lineColor}
              lineWidth={0.5}
              transparent
              opacity={0.2}
            />
            {/* Label */}
            <Text
              position={[x, 0, half + 0.8]}
              fontSize={0.4}
              color="#aaaaaa"
              anchorX="center"
              anchorY="middle"
            >
              {t.toFixed(1)}
            </Text>
          </group>
        );
      })}

      {/* === Y axis ticks + labels (vertical left-front) === */}
      {ticks.map((t, i) => {
        const y = t * h;
        return (
          <group key={`y-${i}`}>
            {/* Tick line */}
            <Line
              points={[[-half, y, half], [-half - 0.4, y, half]]}
              color={lineColor}
              lineWidth={1}
            />
            {/* Grid line going across X */}
            <Line
              points={[[-half, y, half], [half, y, half]]}
              color={lineColor}
              lineWidth={0.5}
              transparent
              opacity={0.2}
            />
            {/* Label */}
            <Text
              position={[-half - 0.8, y, half]}
              fontSize={0.4}
              color="#aaaaaa"
              anchorX="right"
              anchorY="middle"
            >
              {t.toFixed(1)}
            </Text>
          </group>
        );
      })}

      {/* === Z axis ticks + labels (along bottom-left going back) === */}
      {ticks.map((t, i) => {
        const z = half - t * size;
        return (
          <group key={`z-${i}`}>
            {/* Tick line */}
            <Line
              points={[[-half, 0, z], [-half - 0.4, 0, z]]}
              color={lineColor}
              lineWidth={1}
            />
            {/* Grid line going across X */}
            <Line
              points={[[-half, 0, z], [half, 0, z]]}
              color={lineColor}
              lineWidth={0.5}
              transparent
              opacity={0.2}
            />
            {/* Label */}
            <Text
              position={[-half - 0.8, 0, z]}
              fontSize={0.4}
              color="#aaaaaa"
              anchorX="right"
              anchorY="middle"
            >
              {t.toFixed(1)}
            </Text>
          </group>
        );
      })}

      {/* === Faint back edges to complete the cage === */}
      <Line points={[[half, 0, half], [half, 0, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, 0, -half], [-half, 0, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      {/* Top edges */}
      <Line points={[[-half, h, half], [half, h, half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[-half, h, half], [-half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, h, half], [half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, h, -half], [-half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      {/* Vertical edges */}
      <Line points={[[half, 0, half], [half, h, half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, 0, -half], [half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[-half, 0, -half], [-half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
    </group>
  );
}

function SoundTerrain({ historyMatrix, terrainColor, cubeSize }) {
  const meshRef = useRef(null);
  const [targetColor] = useState(() => new THREE.Color());

  // Dimensions derived from the matrix
  const rows = historyMatrix.length;
  const cols = rows > 0 && historyMatrix[0] ? historyMatrix[0].length : 0;
  const widthSegs = rows > 1 ? rows - 1 : 1;
  const heightSegs = cols > 1 ? cols - 1 : 1;

  // Generate a key so the mesh remounts whenever the grid dimensions change
  const geoKey = `${widthSegs}-${heightSegs}`;

  // Write vertex heights AFTER the geometry has mounted with the correct dimensions
  useEffect(() => {
    if (!meshRef.current) return;
    if (!historyMatrix || historyMatrix.length === 0) return;

    // Small delay to ensure the new geometry is ready after remount
    const frame = requestAnimationFrame(() => {
      const geometry = meshRef.current?.geometry;
      if (!geometry) return;

      const vertices = geometry.attributes.position.array;
      // planeGeometry has (widthSegs+1) columns per row = rows vertices across
      // and (heightSegs+1) rows = cols vertices deep
      const gridCols = cols;

      // First pass: find the max amplitude so we can normalize to fill the cube
      let maxAmplitude = 0;
      for (let time = 0; time < rows; time++) {
        for (let freq = 0; freq < cols; freq++) {
          if (historyMatrix[time][freq] > maxAmplitude) {
            maxAmplitude = historyMatrix[time][freq];
          }
        }
      }
      // Avoid division by zero when audio is silent
      if (maxAmplitude === 0) maxAmplitude = 1;

      // Second pass: write heights normalized so the peak = cubeSize (top of the cage)
      for (let time = 0; time < rows; time++) {
        for (let freq = 0; freq < cols; freq++) {
          const vi = time * gridCols + freq;
          const zIndex = vi * 3 + 2;

          if (zIndex < vertices.length) {
            const amplitude = historyMatrix[time][freq];
            // Normalize: loudest peak fills the full cube height
            const height = (amplitude / maxAmplitude) * (cubeSize*0.7);
            vertices[zIndex] = height;
          }
        }
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    });

    return () => cancelAnimationFrame(frame);
  }, [historyMatrix, rows, cols, cubeSize]);

  useEffect(() => {
    targetColor.set(terrainColor);
  }, [terrainColor, targetColor]);

  useFrame(() => {
    if(meshRef.current){
      // smoothly lerp the material color towards the target color
      meshRef.current.material.color.lerp(targetColor, 0.05);
    }
  });

  const half = cubeSize / 2;

  return (
    // Position the plane so its corner starts at (-half, 0, -half)
    // matching the cage origin. The plane is rotated so Z becomes Y (height).
    <mesh
      key={geoKey}
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      {/* Plane is created centered at origin, so we translate the geometry
          so its corner aligns with the cage corner */}
      <planeGeometry
        args={[cubeSize, cubeSize, widthSegs, heightSegs]}
        onUpdate={(geo) => {
          // Shift the plane so bottom-left corner is at (-half, -half) in local space
          // After rotation this becomes (-half, 0, -half) in world space — matching the cage
          geo.translate(0, 0, 0); 
        }}
      />
      <meshStandardMaterial
        color={targetColor}
        transparent={true}
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Analyzer({ audioUrl, terrainColor }) {
  const audioCtxRef = useRef(null);
  const [historyMatrix, setHistoryMatrix] = useState([]);


  // Single size constant for all 3 axes
  const cubeSize = 18;

  useEffect(() => {
    return () => {
      //cleans up on unmount
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  function playAndAnalyze() {
    audioCtxRef.current = new AudioContext();

    fetch(audioUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => audioCtxRef.current.decodeAudioData(buffer))
      .then((audioBuffer) => {
        const matrix = precomputeSpectrogram(audioBuffer);
        setHistoryMatrix(matrix);

        // Also play the audio so the user hears it
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtxRef.current.destination);
        source.start();
      })
      .catch((error) => console.error("Error analyzing the audio:", error));
  }

  const half = cubeSize / 2;

  return (
    <div className="analyzer-wrapper">
      <button className="primary-button" onClick={playAndAnalyze}>
        Play Audio
      </button>
      <div className="canvas-wrapper">
        <Canvas
          camera={{
            // Position the camera looking down from front-right
            // so the cage fills the bottom-right area of the viewport
            position: [cubeSize * 1.8, cubeSize * 1.0, cubeSize * 1.8],
            fov: 40,
          }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <pointLight position={[-10, 10, -10]} intensity={0.5} />

          {/* Orbit around the center of the cage, not the world origin */}
          <OrbitControls target={[0, cubeSize * 0.35, 0]} />

          {/* Cube cage */}
          <AxisCage size={cubeSize} tickCount={5} />

          {/* Terrain */}
          <SoundTerrain
            historyMatrix={historyMatrix}
            terrainColor={terrainColor}
            cubeSize={cubeSize}
          />
        </Canvas>
      </div>
    </div>
  );
}

export default Analyzer;
