import "./App.css";
import { useState, useEffect } from "react";
import Analyzer from "./components/analyzer";
import TYPE_COLORS from "./utils/typeColors";

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function App() {
  const [pokemonID, setPokemonID] = useState(getRandomInt(1, 1025));
  const [pokemonName, setPokemonName] = useState("");
  const [pokemonType, setPokemonType] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const audioUrl = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonID}.ogg`;

  // function playAudio(){
  //   const audio = new Audio(audioUrl);
  //   audio.play().catch(error => {
  //     console.error('Error playing audio:', error);
  //   });
  // }

  function fetchPokemonName(id = pokemonID) {
    const url = `https://pokeapi.co/api/v2/pokemon/${id}/`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setPokemonName(data.name);
        setPokemonType(data.types[0].type.name);
      })
      .catch((error) => {
        console.error("Error fetching Pokemon data:", error);
      });
  }

  // useEffect runs once on page load/reload
  useEffect(() => {
    fetchPokemonName();
  }, []);

  function getNewPokemon() {
    const newID = getRandomInt(1, 1025);
    setPokemonID(newID);
    fetchPokemonName(newID);
    setRevealed(false);
  }

  const terrainColor = revealed && pokemonType
    ? TYPE_COLORS[pokemonType] || "#81A596"
    : "#81A596";

  return (
    <div id="main-div">
      <h1>Pokemon Cry Wordle</h1>
      <Analyzer audioUrl={audioUrl} terrainColor={terrainColor} />
      <button className="primary-button" onClick={() => setRevealed(true)}>
        Reveal Type
      </button>
      <button className="primary-button" onClick={getNewPokemon}>
        New Pokemon
      </button>
      <p> The pokemon is {pokemonName}</p>

      {/* <button id='primary-button' onClick={playAudio}>
        Play Sound
      </button> */}
      
    </div>
  );
}

export default App;
