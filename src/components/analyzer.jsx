// acts as rendererer
// gets audioURL from app and handles everything related to sound and graphics
import React, { useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import "./analyzer.css";
import * as THREE from "three";

function SoundTerrain({ analyzerRef, terrainColor }) {
  // this component creates a 3d mesh reacting to the audio data passed through
  const meshRef = useRef(null);

  const color = new THREE.Color(terrainColor);
  
  useFrame(() => {
    if(!meshRef.current) {
      console.log("Mesh reference not set yet");
      return;
    }
    if(!analyzerRef.current) {
      console.log("Analyzer reference not set yet");
      return;
    }
    // some values to control how the audio data affects the terrain
    const spreadFactor = 5; // controls how the frequency data is spread across the mesh.
    // higher spreadFactor-> more stretched out data
    // lower spreadFactor-> more concentrated data.
    const maxHeight = 5; // maximum height of the terrain

    //grab frequency data
    // creates a new array to hold the frequency data, the size of the array is determined by the analyzer's frequencyBinCount, which is half of the fftSize (128 in this case)
    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount); 
    analyzerRef.current.getByteFrequencyData(dataArray); // tells the analyzer to fill the dataArray with the current frequency data
    // array size = half of fftSize. In this case it is 128, so i have 128 frequency bins.
    // Each bin represents a range of frequencies, and the value in each bin represents the amplitude of the frequencies in that range.
    // The values are between 0 and 255, where 0 means no sound and 255 means maximum amplitude.
    
    // manipulating the geometry. get the vertices of the mesh through the geometry
    const geometry = meshRef.current.geometry;
    // creating a flat array of vertex positions. each vertex has an x,y,and z coordinate
    // the array is structured as [x1, y1, z1, x2, y2, z2, ...]
    // every three values represent the position of one vertex in 3D space.
    const vertices = geometry.attributes.position.array;

    // looping through the vertices and modifying z based on frequency data
    for (let i = 0; i < vertices.length; i += 3) {
      const currentX = vertices[i];
      const currentY = vertices[i + 1];
      // need to alter the z value of each vertex based on the corresponding frequency data.
      //getting distance from the center of the plane to pick a bin.
      const distanceFromArrayCenter = Math.abs(currentX) + Math.abs(currentY);
      
      //converting distance into a valid array. Then multiplying by a spread factor to stretch the data across the mesh.
      let dataIndex = Math.floor(distanceFromArrayCenter * spreadFactor) % dataArray.length;

      // amplitude
      let audioValue = dataArray[dataIndex];
      
      // calculating new z value
      // normalize the audio value(0-1) and then scale it to a desired height. set it at the same time.
      vertices[i + 2] = (audioValue/255) * maxHeight;
    }
    geometry.attributes.position.needsUpdate = true;
    // tells three.js that the vertex positions have changed and it needs to update the mesh. 
  });

  // plane geometry args: width, height, widthSegments, heightSegments
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10, 64, 64]} />
      <meshStandardMaterial color={color} wireframe={true} />
    </mesh>
  );
}

function Analyzer({ audioUrl }) {
  const audioCtxRef = useRef(null);
  const analyzerRef = useRef(null);

  useEffect(() => {
    return () => {
      //cleans up on unmount
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  function playAndAnalyze() {
    //creating the audio context and analyzer
    audioCtxRef.current = new AudioContext();
    analyzerRef.current = audioCtxRef.current.createAnalyser();
    analyzerRef.current.fftSize = 256; // represents the window size in audio samples. Higher values give better frequency resolution but worse time resolution.

    fetch(audioUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => audioCtxRef.current.decodeAudioData(buffer))
      .then((audioBuffer) => {
        // initializing the audio source and connecting it to the analyzer
        // creating a buffer source for the audio and connecting it to the analyzer, then to the destination (speakers)
        const source = audioCtxRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyzerRef.current);
        analyzerRef.current.connect(audioCtxRef.current.destination); // destination is the output (speakers)
        source.start();
        //create byte array to store frequency data
        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
        let animationID = null; // function to read data
        function readData() {
          analyzerRef.current.getByteFrequencyData(dataArray);
          console.log("frequency data:", Array.from(dataArray));
          animationID = requestAnimationFrame(readData); // schedule the next read
        }
        readData(); // start reading data

        source.onended = () => {
          cancelAnimationFrame(animationID);
          console.log("Audio finished, stopped reading data");
        };
      })
      .catch((error) => console.error("Error analyzing the audio:", error));
  }

  return (
    <div className="analyzer-wrapper">
      <button className="primary-button" onClick={playAndAnalyze}>
        Play Audio
      </button>
      <div className="canvas-wrapper">
        <Canvas>
          <ambientLight intensity={0.5} />
          <OrbitControls />
          <SoundTerrain analyzerRef={analyzerRef} />
        </Canvas>
      </div>
    </div>
  );
}

export default Analyzer;
