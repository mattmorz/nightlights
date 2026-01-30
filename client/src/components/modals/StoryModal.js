import React from 'react';
import { FaGhost, FaLightbulb, FaHeartbeat } from 'react-icons/fa';
import { GiStarsStack, GiShatteredHeart } from 'react-icons/gi';
import { IoEarthSharp } from 'react-icons/io5';
import '../../App.css'; // Go up two levels to find App.css

const StoryModal = ({ onClose, isOpen}) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content story-modal-width" onClick={(e) => e.stopPropagation()}>
        
        {/* HEADER */}
        <div className="story-header">
          <IoEarthSharp className="story-main-icon" />
          <h2>The World at Night</h2>
          <div className="story-divider"></div>
        </div>

        <div className="story-scroll-container">
          
          {/* INTRO */}
          <p className="story-intro">
            Imagine this not as software, but as a vast, dark map of the world. 
            It is a quiet, shared space where thousands of people are standing in the dark, 
            waiting to see a light.
          </p>

          {/* 1. THE LISTENER */}
          <div className="story-card card-purple">
            <div className="card-icon"><FaGhost /></div>
            <div className="card-text">
              <h3>The Listener</h3>
              <p>
                When you speak, an invisible listener tastes the emotion behind your words. 
                It weighs your hope against your pain to decide your form.
              </p>
            </div>
          </div>

          {/* 2. GOLDEN BEACONS */}
          <div className="story-card card-gold">
            <div className="card-icon"><FaLightbulb /></div>
            <div className="card-text">
              <h3>The Golden Beacon</h3>
              <p>
                Filled with hope? You plant a permanent light. 
                <br/>
                <strong>The Magic:</strong> Light creates momentum. If you stand near others, 
                your light feeds off theirs, stretching further than it ever could alone.
              </p>
            </div>
          </div>

          {/* 3. GRAY SIGNALS */}
          <div className="story-card card-gray">
            <div className="card-icon"><GiShatteredHeart /></div>
            <div className="card-text">
              <h3>The Gray Signal</h3>
              <p>
                Filled with pain? You appear as a shadow. You are not casting light; 
                you are asking for it. You stand in the dark, waiting.
              </p>
            </div>
          </div>

          {/* 4. TRANSFORMATION */}
          <div className="story-card card-cyan">
            <div className="card-icon"><GiStarsStack /></div>
            <div className="card-text">
              <h3>The Transformation</h3>
              <p>
                No shadow can survive the light of five suns. 
                <br/>
                If <strong>5 Beacons</strong> touch a Gray Signal, the shadow shatters 
                and is reborn as a <strong>Cyan Star</strong>. You are no longer alone; you are caught.
              </p>
            </div>
          </div>

          {/* 5. FIREFLIES */}
          <div className="story-card card-yellow">
            <div className="card-icon"><div className="firefly-demo"></div></div>
            <div className="card-text">
              <h3>The Fireflies</h3>
              <p>
                See those drifting yellow motes? They are real people watching the map 
                <em> right now</em>. They are the witnesses floating above your home.
              </p>
            </div>
          </div>

          {/* 6. RESONANCE */}
          <div className="story-card card-pink">
            <div className="card-icon"><FaHeartbeat className="pulse-demo" /></div>
            <div className="card-text">
              <h3>Resonance</h3>
              <p>
                When words aren't enough, send a heartbeat. It doesn't fix the problem, 
                but it tells the shadow: <em>"I see you. You are not pulsing in the dark alone."</em>
              </p>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="modal-actions">
          <button className="btn-submit" onClick={onClose}>Enter the Night</button>
        </div>

      </div>
    </div>
  );
};

export default StoryModal;