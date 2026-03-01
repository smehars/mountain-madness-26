// acts as rendererer
// gets audioURL from app and handles everything related to sound and graphics
import React, { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import "./analyzer.css";
import * as THREE from "three";

function ScannerWave({ cubeSize, isPlayingRef, startTimeRef, durationRef, audioCtxRef, historyMatrix }) {
  const groupRef = useRef(null);
  const half = cubeSize / 2;
  const cols = historyMatrix.length > 0 && historyMatrix[0] ? historyMatrix[0].length : 0;
  const rows = historyMatrix.length;

  const maxAmplitude = useMemo(() => {
    let max = 0;
    for (let t = 0; t < rows; t++) {
      for (let f = 0; f < cols; f++) {
        if (historyMatrix[t][f] > max) max = historyMatrix[t][f];
      }
    }
    return max || 1;
  }, [historyMatrix, rows, cols]);

  const pointCount = Math.max(cols, 2);

  const { lineObj, glowObj, curtainMesh } = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glowMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color("#88eeff"),
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const positions = new Float32Array(pointCount * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const line = new THREE.Line(geo, material);
    line.visible = false;
    line.frustumCulled = false;

    const glow = new THREE.Line(geo, glowMaterial);
    glow.visible = false;
    glow.frustumCulled = false;

    const curtainPositions = new Float32Array(pointCount * 2 * 3);
    const curtainGeo = new THREE.BufferGeometry();
    curtainGeo.setAttribute("position", new THREE.BufferAttribute(curtainPositions, 3));

    const indices = [];
    for (let i = 0; i < pointCount - 1; i++) {
      const top = i * 2;
      const bottom = i * 2 + 1;
      const nextTop = (i + 1) * 2;
      const nextBottom = (i + 1) * 2 + 1;
      indices.push(top, bottom, nextTop);
      indices.push(bottom, nextBottom, nextTop);
    }
    curtainGeo.setIndex(indices);

    const curtainMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#88eeff"),
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.visible = false;
    curtain.frustumCulled = false;

    return { lineObj: line, glowObj: glow, curtainMesh: curtain };
  }, [pointCount]);

  useFrame(() => {
    if (!isPlayingRef.current || !audioCtxRef.current || rows === 0 || cols === 0) {
      lineObj.visible = false;
      glowObj.visible = false;
      curtainMesh.visible = false;
      return;
    }

    const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
    const duration = durationRef.current;

    if (elapsed > duration) {
      lineObj.visible = false;
      glowObj.visible = false;
      curtainMesh.visible = false;
      return;
    }

    const progress = elapsed / duration; 
    // Invert the time index to match the terrain's inverted row ordering
    const timeIndex = Math.min(Math.floor((1 - progress) * rows), rows - 1);

    // FIX: Wave starts at the front (+half) and moves to the back (-half) along Z
    const currentZ = half - (progress * cubeSize);

    const linePositions = lineObj.geometry.attributes.position.array;
    const curtainPositions = curtainMesh.geometry.attributes.position.array;

    for (let f = 0; f < pointCount; f++) {
      const freqRatio = f / (pointCount - 1);
      const freqIndex = Math.min(Math.floor(freqRatio * (cols - 1)), cols - 1);
      const amplitude = historyMatrix[timeIndex] ? historyMatrix[timeIndex][freqIndex] : 0;
      const normalized = amplitude / maxAmplitude;
      const height = normalized * (cubeSize * 0.7);

      // FIX: Frequencies spread left (-half) to right (+half) along X
      const worldX = -half + freqRatio * cubeSize;

      linePositions[f * 3]     = worldX;
      linePositions[f * 3 + 1] = height + 0.05; 
      linePositions[f * 3 + 2] = currentZ;

      const ci = f * 2;
      curtainPositions[ci * 3]     = worldX;
      curtainPositions[ci * 3 + 1] = height + 0.05;
      curtainPositions[ci * 3 + 2] = currentZ;

      curtainPositions[(ci + 1) * 3]     = worldX;
      curtainPositions[(ci + 1) * 3 + 1] = 0;
      curtainPositions[(ci + 1) * 3 + 2] = currentZ;
    }

    lineObj.geometry.attributes.position.needsUpdate = true;
    lineObj.geometry.computeBoundingBox();
    lineObj.geometry.computeBoundingSphere();

    curtainMesh.geometry.attributes.position.needsUpdate = true;
    curtainMesh.geometry.computeBoundingBox();
    curtainMesh.geometry.computeBoundingSphere();

    lineObj.visible = true;
    glowObj.visible = true;
    curtainMesh.visible = true;
  });

  return (
    <group ref={groupRef}>
      <primitive object={lineObj} />
      <primitive object={glowObj} />
      <primitive object={curtainMesh} />
    </group>
  );
}

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
  const h = size;

  const xColor = "#ff4444";
  const yColor = "#44ff44";
  const zColor = "#4488ff";
  const lineColor = "#555555";

  const ticks = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(i / tickCount);
  }

  return (
    <group>
      <Line points={[[-half, 0, half], [half, 0, half]]} color={xColor} lineWidth={2} />
      <Line points={[[-half, 0, half], [-half, h, half]]} color={yColor} lineWidth={2} />
      <Line points={[[-half, 0, half], [-half, 0, -half]]} color={zColor} lineWidth={2} />

      {/* FIX: X axis is now Frequency */}
      <Text position={[0, -1.2, half + 1]} fontSize={0.8} color={xColor} anchorX="center" anchorY="middle">
        Frequency
      </Text>
      <Text position={[-half - 1.5, h / 2, half]} fontSize={0.8} color={yColor} anchorX="center" anchorY="middle" rotation={[0, 0, Math.PI / 2]}>
        Amplitude
      </Text>
      {/* FIX: Z axis is now Time */}
      <Text position={[-half - 1, -1.2, 0]} fontSize={0.8} color={zColor} anchorX="center" anchorY="middle" rotation={[0, Math.PI / 2, 0]}>
        Time
      </Text>

      {ticks.map((t, i) => {
        const x = -half + t * size;
        return (
          <group key={`x-${i}`}>
            <Line points={[[x, 0, half], [x, 0, half + 0.4]]} color={lineColor} lineWidth={1} />
            <Line points={[[x, 0, half], [x, 0, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.2} />
            <Text position={[x, 0, half + 0.8]} fontSize={0.4} color="#aaaaaa" anchorX="center" anchorY="middle">{t.toFixed(1)}</Text>
          </group>
        );
      })}

      {ticks.map((t, i) => {
        const y = t * h;
        return (
          <group key={`y-${i}`}>
            <Line points={[[-half, y, half], [-half - 0.4, y, half]]} color={lineColor} lineWidth={1} />
            <Line points={[[-half, y, half], [half, y, half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.2} />
            <Text position={[-half - 0.8, y, half]} fontSize={0.4} color="#aaaaaa" anchorX="right" anchorY="middle">{t.toFixed(1)}</Text>
          </group>
        );
      })}

      {ticks.map((t, i) => {
        const z = half - t * size;
        return (
          <group key={`z-${i}`}>
            <Line points={[[-half, 0, z], [-half - 0.4, 0, z]]} color={lineColor} lineWidth={1} />
            <Line points={[[-half, 0, z], [half, 0, z]]} color={lineColor} lineWidth={0.5} transparent opacity={0.2} />
            <Text position={[-half - 0.8, 0, z]} fontSize={0.4} color="#aaaaaa" anchorX="right" anchorY="middle">{t.toFixed(1)}</Text>
          </group>
        );
      })}

      <Line points={[[half, 0, half], [half, 0, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, 0, -half], [-half, 0, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[-half, h, half], [half, h, half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[-half, h, half], [-half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, h, half], [half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, h, -half], [-half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, 0, half], [half, h, half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[half, 0, -half], [half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
      <Line points={[[-half, 0, -half], [-half, h, -half]]} color={lineColor} lineWidth={0.5} transparent opacity={0.3} />
    </group>
  );
}

function SoundTerrain({ historyMatrix, terrainColors, cubeSize }) {
  const meshRef = useRef(null);

  // Dimensions derived from the matrix
  const rows = historyMatrix.length;
  const cols = rows > 0 && historyMatrix[0] ? historyMatrix[0].length : 0;
  const widthSegs = rows > 1 ? rows - 1 : 1;
  const heightSegs = cols > 1 ? cols - 1 : 1;

  const geoKey = `${widthSegs}-${heightSegs}`;

  useEffect(() => {
    if (!meshRef.current) return;
    if (!historyMatrix || historyMatrix.length === 0) return;

    const frame = requestAnimationFrame(() => {
      const geometry = meshRef.current?.geometry;
      if (!geometry) return;

      const vertices = geometry.attributes.position.array;
      const gridCols = cols;

      let maxAmplitude = 0;
      for (let time = 0; time < rows; time++) {
        for (let freq = 0; freq < cols; freq++) {
          if (historyMatrix[time][freq] > maxAmplitude) {
            maxAmplitude = historyMatrix[time][freq];
          }
        }
      }
      if (maxAmplitude === 0) maxAmplitude = 1;

      const colors = new Float32Array(vertices.length);

      const colorBottom = new THREE.Color("#64748b");
      const tempColor = new THREE.Color();

      const isDualType = terrainColors.length >= 2;
      const colorA = new THREE.Color(terrainColors[0]);
      const colorB = isDualType ? new THREE.Color(terrainColors[1]) : null;
      const peakColor = new THREE.Color();

      for (let time = 0; time < rows; time++) {
        for (let freq = 0; freq < cols; freq++) {
          
          // ---> THE FIX: Correctly map Time to X and Frequency to Z <---
          // We also invert the freq so low pitches sit at the front of the cage
          const vi = time*cols+freq;
          
          const zIndex = vi * 3 + 2;

          if (zIndex < vertices.length) {
            const amplitude = historyMatrix[time][freq];

            const normalized = maxAmplitude > 0 ? (amplitude / maxAmplitude) : 0;
            const height = normalized * (cubeSize * 0.7);
            vertices[zIndex] = height;

            // For dual type: gradient across frequency axis (low freq = type1, high freq = type2)
            if (isDualType) {
              const freqRatio = freq / (cols - 1); 
              tempColor.copy(colorA).lerp(colorB, freqRatio);
              const darken = 0.3 + 0.7 * normalized; 
              tempColor.multiplyScalar(darken);
            } else {
              tempColor.copy(colorA);
            }

            colors[vi * 3] = tempColor.r;
            colors[vi * 3 + 1] = tempColor.g;
            colors[vi * 3 + 2] = tempColor.b;
          }
        }
      }
      
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    });

    return () => cancelAnimationFrame(frame);
  }, [historyMatrix, rows, cols, cubeSize, terrainColors]);

  return (
    <mesh
      key={geoKey}
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
    >
      <planeGeometry
        args={[cubeSize, cubeSize, widthSegs, heightSegs]}
        onUpdate={(geo) => {
          geo.translate(0, 0, 0); 
        }}
      />
      <meshStandardMaterial
        vertexColors={true}
        color="#ffffff"
        transparent={true}
        opacity={0.85}
        side={THREE.DoubleSide}
        metalness={0.1} // Lowered to prevent black mirror effect
        roughness={0.6} // Increased to diffuse the light better
      />
    </mesh>
  );
}

const Analyzer = forwardRef(function Analyzer({ audioUrl, terrainColors }, ref) {
  const audioCtxRef = useRef(null);
  const audioBufferRef = useRef(null);
  const [historyMatrix, setHistoryMatrix] = useState([]);
  // playback ref for a wave
  const isPlayingRef = useRef(false);
  const playbackStartTimeRef = useRef(0);
  const playbackDurationRef = useRef(0);


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

  // fetch and calculat the graph the moment a new audioURL arrives
  useEffect(() => {
    if(!audioUrl){
      console.log("No audio URL provided to Analyzer.");
      return;
    }
    if(!audioCtxRef.current){
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    // clear the old graph while the new one calculates
    setHistoryMatrix([]);

    fetch(audioUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => audioCtxRef.current.decodeAudioData(buffer))
      .then((audioBuffer) => {
        // 1. Save the audio to play later
        audioBufferRef.current = audioBuffer; 
        
        // 2. Precompute the graph immediately!
        const matrix = precomputeSpectrogram(audioBuffer);
        setHistoryMatrix(matrix);
      })
      .catch((error) => console.error("Error analyzing the audio:", error));
  }, [audioUrl]); 

  // this function handles playing the sound
  function playAudio() {
    if(!audioBufferRef.current || !audioCtxRef.current){
      console.log("Audio not ready to play.");
      return;
    }

    if(audioCtxRef.current.state === "suspended"){
      audioCtxRef.current.resume();
    }
    
    const sourceNode = audioCtxRef.current.createBufferSource();
    sourceNode.buffer = audioBufferRef.current;
    sourceNode.connect(audioCtxRef.current.destination);
    
    // scanner logic
    playbackDurationRef.current = audioBufferRef.current.duration;
    // audioCtx.currentTime keeps a continuous clock of how long the context has existed
    playbackStartTimeRef.current = audioCtxRef.current.currentTime; 
    isPlayingRef.current = true;

    sourceNode.onended = () => {
      isPlayingRef.current = false;
    };
    
    sourceNode.start(0);
  }

  useImperativeHandle(ref, () => ({
    playAudio,
  }));

  const half = cubeSize / 2;

  return (
    <div className="analyzer-wrapper">
      <div className="canvas-wrapper">
        <Canvas
          camera={{
            position: [cubeSize * 1.8, cubeSize * 1.0, cubeSize * 1.8],
            fov: 40,
          }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 20, 10]} intensity={0.8} />
          <pointLight position={[-10, 10, -10]} intensity={0.5} />

          <OrbitControls target={[0, cubeSize * 0.35, 0]} />

          <AxisCage size={cubeSize} tickCount={5} />

          <SoundTerrain
            historyMatrix={historyMatrix}
            terrainColors={terrainColors}
            cubeSize={cubeSize}
          />

          <ScannerWave 
            cubeSize={cubeSize}
            isPlayingRef={isPlayingRef}
            startTimeRef={playbackStartTimeRef}
            durationRef={playbackDurationRef}
            audioCtxRef={audioCtxRef}
            historyMatrix={historyMatrix}
          />
        </Canvas>
      </div>
    </div>
  );
});

export default Analyzer;