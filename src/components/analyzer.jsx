// acts as rendererer 
// gets audioURL from app and handles everything related to sound and graphics
import React, { useEffect,useRef } from 'react';

function Analyzer({audioUrl}){
    const audioCtxRef = useRef(null);
    const analyzerRef = useRef(null);

    useEffect(() => {
        return () =>{
            //cleans up on unmount
            audioCtxRef.current.close();
        }
    },[]);

    function playAndAnalyze(){
        //creating the audio context and analyzer
        audioCtxRef.current = new AudioContext();
        analyzerRef.current = audioCtxRef.current.createAnalyser();
    analyzerRef.current.fftSize = 256; // represents the window size in audio samples. Higher values give better frequency resolution but worse time resolution.

      fetch(audioUrl)
        .then(response => response.arrayBuffer())
        .then(buffer => audioCtxRef.current.decodeAudioData(buffer))
        .then(audioBuffer => {
            // initializing the audio source and connecting it to the analyzer
            // creating a buffer source for the audio and connecting it to the analyzer, then to the destination (speakers)
            const source = audioCtxRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(analyzerRef.current);
            analyzerRef.current.connect(audioCtxRef.current.destination); // destination is the output (speakers)
            source.start();
            //create byte array to store frequency data
            const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
            let animationID = null;            // function to read data
            function readData(){
                analyzerRef.current.getByteFrequencyData(dataArray);
                console.log('frequency data:', Array.from(dataArray));
                animationID = requestAnimationFrame(readData); // schedule the next read
            }
            readData(); // start reading data

            source.onended = () => {
              cancelAnimationFrame(animationID);
              console.log('Audio finished, stopped reading data');
            };
        })
        .catch(error => console.error('Error analyzing the audio:', error))
    }

    return(
        <button className='primary-button' onClick={playAndAnalyze}>
            analyze
        </button>
    );
}

export default Analyzer;