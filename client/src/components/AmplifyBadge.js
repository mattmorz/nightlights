import React, { useState, useEffect, useMemo } from 'react';
import { IoFlash } from 'react-icons/io5'; 
import { getDistanceMeters, formatPin } from '../utils/helpers';
import '../App.css';

const AmplifyBadge = ({ pins = [], userLocation }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animate, setAnimate] = useState(false);

  // --- MATH CONFIG ---
  const BASE_RADIUS_METERS = 5000;
  const TIER_SIZE = 10;            
  const BOOST_PER_TIER_PERCENT = 20; 
  const BOOST_MULTIPLIER_RATE = 0.20;
  const BASE_RANGE_KM = 5.0;

  // --- MEMOIZED CALCS ---
  const { localCount, currentBoostPercent, currentRangeKm, lightsNeeded, progressPercent } = useMemo(() => {
    if (!userLocation || !userLocation.lat) {
      return { localCount: 0, currentBoostPercent: 0, currentRangeKm: "5.0", lightsNeeded: 10, progressPercent: 0 };
    }

    const nearbyPositiveLights = pins.filter(rawPin => {
      const pin = formatPin(rawPin); 
      if (!pin || pin.sentiment !== 'positive') return false;
      return getDistanceMeters(userLocation.lat, userLocation.lng, pin.position.lat, pin.position.lng) <= BASE_RADIUS_METERS;
    });

    const count = nearbyPositiveLights.length;
    const tier = Math.floor(count / TIER_SIZE);
    
    return {
      localCount: count,
      currentBoostPercent: tier * BOOST_PER_TIER_PERCENT,
      currentRangeKm: (BASE_RANGE_KM * (1 + (tier * BOOST_MULTIPLIER_RATE))).toFixed(1),
      lightsNeeded: TIER_SIZE - (count % TIER_SIZE),
      progressPercent: ((count % TIER_SIZE) / TIER_SIZE) * 100
    };
  }, [pins, userLocation]);

  // Trigger pulse on update
  useEffect(() => {
    if (localCount > 0) {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [localCount]);

  return (
    <div 
      className={`amplify-badge ${isExpanded ? 'expanded' : ''} ${animate && !isExpanded ? 'pulse-border' : ''}`} 
      onClick={() => setIsExpanded(!isExpanded)}
    >
      
      {/* 1. HERO ICON (The Button Face) */}
      <div className="badge-icon-wrapper">
        <IoFlash />
        {/* Show small text next to icon only when Expanded */}
        {isExpanded && <span style={{marginLeft: '8px', fontWeight: 600, color: '#fff'}}>SIGNAL BOOST</span>}
      </div>

      {/* 2. HIDDEN DETAILS (Reveals on Click) */}
      <div className="badge-content">
        
        {/* Header Stats */}
        <div className="badge-title">
          <span>Range: {currentRangeKm}km</span>
          <span style={{color: '#ffd700'}}>+{currentBoostPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="badge-progress-bar">
          <div className="badge-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>

        {/* Footer Text */}
        <div className="badge-subtitle">
          {localCount} active lights nearby.<br/>
          <span style={{color: '#aaa'}}>Get {lightsNeeded} more for next boost.</span>
        </div>

      </div>
    </div>
  );
};

export default AmplifyBadge;