import "./App.css";
import { useState, useEffect } from "react";
import Analyzer from "./components/analyzer";
import TYPE_COLORS from "./utils/typeColors";

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function App() {
  const [pokemonID, setPokemonID] = useState(getRandomInt(1, 152));
  const [pokemonName, setPokemonName] = useState("");
  const [pokemonTypes, setPokemonTypes] = useState([]);
  const [audioUrl, setAudioUrl] = useState(null);
  const [revealed, setRevealed] = useState(false);
  // game logic
  const [guesses, setGuesses] = useState([]); // Array to hold past guesses
  const [currentGuess, setCurrentGuess] = useState(""); // What the user is typing
  const [gameStatus, setGameStatus] = useState("playing"); // 'playing', 'won', 'lost'

  // A master list of all Gen 1 Pokemon names for the autocomplete dropdown
  const [pokemonList, setPokemonList] = useState([]);
  
  function fetchPokemonName(id = pokemonID) {
    const url = `https://pokeapi.co/api/v2/pokemon/${id}/`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setPokemonName(data.name);
        setPokemonTypes(data.types.map((t) => t.type.name));
        setAudioUrl(data.cries?.latest || data.cries?.legacy || null);
      })
      .catch((error) => {
        console.error("Error fetching Pokemon data:", error);
      });
  }

  // useEffect runs once on page load/reload
  useEffect(() => {
    fetch("https://pokeapi.co/api/v2/pokemon?limit=151")
      .then((res) => res.json())
      .then((data) => setPokemonList(data.results.map((p) => p.name)));

    fetchPokemonName();
  }, []);

  const filteredPokemon = currentGuess.length > 0
    ? pokemonList.filter( p => p.toLowerCase().includes(currentGuess.toLowerCase())).slice(0, 5)
    : [];
  
  function handleGuess(guessName){
    if(gameStatus !== "playing") return; // Ignore guesses if game is over

    const newGuesses = [...guesses, guessName];
    setGuesses(newGuesses);
    setCurrentGuess("");
    
    if(guessName.toLowerCase() === pokemonName.toLowerCase()){
      setGameStatus("won");
    } else if(newGuesses.length >= 5){
      setGameStatus("lost");
    }
  }

  // round 1&2 : show the colored graph
  // round 3: sprite given
  // 
  function getNewPokemon() {
    const newID = getRandomInt(1, 152);
    setPokemonID(newID);
    fetchPokemonName(newID);
    setRevealed(false);
    setAudioUrl(null);
  }

  // Build an array of terrain colors based on revealed types
  const terrainColors =
    revealed && pokemonTypes.length > 0
      ? pokemonTypes.map((t) => TYPE_COLORS[t] || "#81A596")
      : ["#81A596"];

  return (
    <div id="main-div">
      <h1>Pokemon Cry Wordle</h1>

      <Analyzer audioUrl={audioUrl} terrainColors={terrainColors} />

      {/* Buttons arranged horizontally beneath the graph */}
      <div className="button-row">
        <button className="primary-button" onClick={() => setRevealed(true)}>
          Reveal Type
        </button>
        <button className="primary-button" onClick={getNewPokemon}>
          New Pokemon
        </button>
      </div>

      <p className="reveal-text">The pokemon is {pokemonName}</p>
    </div>
  );
}

export default App;
