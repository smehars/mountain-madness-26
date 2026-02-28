import './App.css'
import { useState, useEffect } from 'react';
import Analyzer from './components/analyzer';

function getRandomInt(min,max){
  return Math.floor(Math.random() * (max - min)) + min;
}

function App() {
  const [pokemonID, setPokemonID] = useState(getRandomInt(1, 1025));
  const [pokemonName, setPokemonName] = useState('');
  const audioUrl = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonID}.ogg`;

  // function playAudio(){
  //   const audio = new Audio(audioUrl);
  //   audio.play().catch(error => {
  //     console.error('Error playing audio:', error);
  //   });
  // }

  function fetchPokemonName(id = pokemonID){
    const url = `https://pokeapi.co/api/v2/pokemon/${id}/`;
    fetch(url)
      .then(response => response.json())
      .then(data => {
        setPokemonName(data.name);
      })
      .catch(error => {
        console.error('Error fetching Pokemon data:', error);
      });
  }

  // useEffect runs once on page load/reload
  useEffect(() => {
    fetchPokemonName();
  }, []);

  function getNewPokemon(){
    const newID = getRandomInt(1, 1025);
    setPokemonID(newID);
    fetchPokemonName(newID);
  }

  return (
    <div id="main-div">
      <h1>Pokemon Cry Wordle</h1>
      <button className="primary-button" onClick={getNewPokemon}>
        New Pokemon
      </button>
      <p> The pokemon is {pokemonName}</p>

      {/* <button id='primary-button' onClick={playAudio}>
        Play Sound
      </button> */}
      <Analyzer audioUrl={audioUrl}/>
    </div> 
  )
}

export default App
