import React, { useState, useEffect } from 'react';
import '../App.css'; // Goes up one level to find App.css

const LOADING_MESSAGES = [
  "Aligning constellations...",
  "Listening for whispers...",
  "Connecting to the night...",
  "Gathering lost lights...",
  "Entering the sanctuary..."
];

const LoadingScreen = () => {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1200); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen">
      <div className="loading-icon">🌑</div>
      <div className="loading-text">{LOADING_MESSAGES[textIndex]}</div>
    </div>
  );
};

export default LoadingScreen;