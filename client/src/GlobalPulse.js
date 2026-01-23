import React, { useEffect, useState, useRef } from 'react';
import './App.css';

const GlobalPulse = ({ socket }) => {
  // The line of waiting messages
  const [queue, setQueue] = useState([]);
  // The currently showing message
  const [activePulse, setActivePulse] = useState(null);
  
  // To track animation styles per message
  const [starStyle, setStarStyle] = useState({});

  // 1. LISTEN & ADD TO QUEUE
  useEffect(() => {
    if (!socket) return;

    socket.on('pulse_event', (data) => {
      setQueue((prevQueue) => [...prevQueue, data]);
    });

    return () => {
      socket.off('pulse_event');
    };
  }, [socket]);

  // 2. PROCESS THE QUEUE
  useEffect(() => {
    // If we are already showing something, or if the queue is empty, do nothing.
    if (activePulse || queue.length === 0) return;

    // --- SETUP NEW ANIMATION ---
    const nextMsg = queue[0];
    const duration = 4; // Seconds per animation

    // Randomize position for this specific star
    const randomRight = Math.floor(Math.random() * 700) - 100;
    
    setStarStyle({
      right: `${randomRight}px`,
      animationDuration: `${duration}s`
    });

    // Start the show
    setActivePulse(nextMsg);
    
    // Remove this item from the waiting list
    setQueue((prev) => prev.slice(1));

    // --- CLEANUP AFTER ANIMATION ---
    const timer = setTimeout(() => {
      setActivePulse(null); // This triggers the useEffect again to pick the next one
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [queue, activePulse]);

  if (!activePulse) return null;

  return (
    <>
      {/* 1. TEXT */}
      <div className="pulse-message-container">
         <span className="pulse-icon">
           {activePulse.sentiment === 'positive' ? '✦' : '★'}
         </span>
         {activePulse.message}
         {/* Optional: Show queue count if busy */}
         {queue.length > 0 && <span style={{fontSize:'0.6rem', opacity:0.7, marginLeft:'8px'}}>+{queue.length} more</span>}
      </div>

      {/* 2. STAR */}
      {/* key={activePulse.message} forces React to destroy and recreate the div, resetting the animation */}
      <div 
        key={activePulse.message} 
        className="shooting-star-head" 
        style={starStyle}
      ></div>
    </>
  );
};

export default GlobalPulse;