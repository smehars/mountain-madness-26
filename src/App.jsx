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
  const [round, setRound] = useState(1);
  const [guess, setGuess] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [spriteUrl, setSpriteUrl] = useState(null);

  const MAX_ROUNDS = 5;

  function fetchPokemonName(id = pokemonID) {
    const url = `https://pokeapi.co/api/v2/pokemon/${id}/`;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        setPokemonName(data.name);
        setPokemonTypes(data.types.map((t) => t.type.name));
        setAudioUrl(data.cries?.latest || data.cries?.legacy || null);
        setSpriteUrl(data.sprites?.front_default || null);
      })
      .catch((error) => {
        console.error("Error fetching Pokemon data:", error);
      });
  }

  // useEffect runs once on page load/reload
  useEffect(() => {
    fetchPokemonName();
  }, []);

  function handleGuess() {
    // win condition
    if (guess.toLowerCase().trim() === pokemonName.toLowerCase()) {
      // correct guess
      const rightSound = new Audio("/yayyyyyyyy.mp3");
      rightSound.play().catch((error) => {
        console.error("Error playing sound:", error);
      });
      setWon(true);
      setGameOver(true);
      setRevealed(true);
    } else{
      const wrongSound = new Audio("/fahhhhhhhhhhhhhh.mp3");
      wrongSound.play().catch((error) => {
        console.error("Error playing sound:", error);
      });
      if (round >= MAX_ROUNDS) {
        // wrong guess 
        setGameOver(true);
        setRevealed(true);
      } else {
        // wrong guess
        setRound((prev) => prev + 1);
      }
    }
    setGuess("");
  }

  function getNewPokemon() {
    const newID = getRandomInt(1, 152);
    setPokemonID(newID);
    fetchPokemonName(newID);
    setRevealed(false);
    setAudioUrl(null);
    setSpriteUrl(null);
    setRound(1);
    setGuess("");
    setGameOver(false);
    setWon(false);
  }

  // Build terrain colors — always show type colors (that's the round 1 base hint)
  const terrainColors =
    pokemonTypes.length > 0
      ? pokemonTypes.map((t) => TYPE_COLORS[t] || "#81A596")
      : ["#81A596"];

  // Hint helpers
  const showLetterCount = round >= 2;      // Round 2+
  const showFirstLetter = round >= 3;      // Round 3+
  const showSilhouette = round >= 4;       // Round 4+
  const showFullSprite = round >= 5;       // Round 5

  // Build the name hint
  const nameHint = (() => {
    if (showFirstLetter) {
      return pokemonName.charAt(0).toUpperCase() + " _ ".repeat(pokemonName.length - 1).trim();
    }
    if (showLetterCount) {
      return "_ ".repeat(pokemonName.length).trim();
    }
    return null;
  })();

  return (
    <div id="main-div">
      <h1>Pokemon Cry Wordle</h1>

      <Analyzer audioUrl={audioUrl} terrainColors={terrainColors} />

      {/* Hints area */}
      <div className="hints-area">
        <p className="round-indicator">Round {round} / {MAX_ROUNDS}</p>

        {nameHint && (
          <p className="hint-text">💡 {nameHint} ({pokemonName.length} letters)</p>
        )}

        {spriteUrl && (showSilhouette || showFullSprite) && (
          <div className="sprite-container">
            <img
              src={spriteUrl}
              alt="Pokemon hint"
              className="pokemon-sprite"
              style={{
                filter: showFullSprite ? "none" : "brightness(0)",
                width: "120px",
                imageRendering: "pixelated",
              }}
            />
          </div>
        )}
      </div>

      {/* Input area */}
      {!gameOver ? (
        <div className="guess-area">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuess()}
            placeholder="Enter Pokémon name..."
            className="guess-input"
          />
          <button className="primary-button" onClick={handleGuess}>
            Guess
          </button>
        </div>
      ) : (
        <div className="result-area">
          {won ? (
            <p className="result-text win">🎉 Correct! It's {pokemonName}!</p>
          ) : (
            <p className="result-text lose">😢 It was {pokemonName}!</p>
          )}
          <button className="primary-button" onClick={getNewPokemon}>
            New Pokemon
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
