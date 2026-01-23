import React, { useEffect, useState } from 'react';
import './App.css'; 

const GlobalPulse = ({ socket }) => {
  const [pulse, setPulse] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [starStyle, setStarStyle] = useState({});

  useEffect(() => {
    if (!socket) return;

    socket.on('pulse_event', (data) => {
      if (animating) return;

      // 1. CALCULATE RANDOM ENTRY POINT
      // We vary the 'right' property to shift where it starts on the top edge
      // Random value between -100px (far right) and 600px (towards center)
      const randomRight = Math.floor(Math.random() * 700) - 100;
      
      // Random speed between 2s and 4s
      const randomDuration = (Math.random() * 2 + 2).toFixed(1);

      setStarStyle({
        right: `${randomRight}px`,
        animationDuration: `${randomDuration}s`
      });

      // 2. TRIGGER ANIMATION
      setAnimating(true);
      setPulse(data);

      // 3. CLEANUP
      const timer = setTimeout(() => {
        setPulse(null);
        setAnimating(false);
      }, parseFloat(randomDuration) * 1000 + 500); // Wait for animation to finish

      return () => clearTimeout(timer);
    });

    return () => {
      socket.off('pulse_event');
    };
  }, [socket, animating]);

  if (!pulse) return null;

  return (
    <>
      {/* 1. TEXT (Fixed Top Center) */}
      <div className="pulse-message-container">
         <span className="pulse-icon">{pulse.sentiment === 'positive' ? '✦' : '★'}</span>
         {pulse.message}
      </div>

      {/* 2. SHOOTING STAR (Styled like your snippet) */}
      <div className="shooting-star-head" style={starStyle}></div>
    </>
  );
};

export default GlobalPulse;