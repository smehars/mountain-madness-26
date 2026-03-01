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
      <h1>Pokémon: Echoes of Kanto</h1>

      {/* The New 2-Column Container */}
      <div className="game-layout">
        
        {/* LEFT SIDE: The 3D Graph */}
        <div className="canvas-section">
          <Analyzer audioUrl={audioUrl} terrainColors={terrainColors} />
        </div>

        {/* RIGHT SIDE: The UI Panel */}
        <div className="ui-section">
          
          <div className="hints-area">
            <p className="round-indicator">Round {round} / {MAX_ROUNDS}</p>
            {nameHint && <p className="hint-text">💡 {nameHint} ({pokemonName.length} letters)</p>}
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

          {!gameOver ? (
            <div className="guess-area">
              {/* Note: I changed this to a flex-column so the input sits neatly above the button in the sidebar */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
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
      </div>

      {/* footer w credits*/}
      <footer className="credits-footer">
        <span className="credits-text">Made by Mehar</span>
        <a href="https://github.com/smehars" target="_blank" rel="noopener noreferrer" className="credits-link" aria-label="GitHub">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.605-.015 2.896-.015 3.286 0 .315.21.694.825.576C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>
        </a>
        <a href="https://www.linkedin.com/in/smeharsaini/" target="_blank" rel="noopener noreferrer" className="credits-link" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
        </a>
      </footer>
    </div>
  );
}

export default App;
