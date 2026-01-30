import React from 'react';
import AmplifyBadge from './AmplifyBadge'; // Import your component
import { IoStatsChart, IoBook, IoInformationCircle, IoVolumeHigh, IoVolumeMute, IoPencil } from 'react-icons/io5';
import '../App.css'; 

const FloatingMenu = ({ onToggleSound, isMuted, onOpenAbout, onOpenStats, onOpenStory, onOpenInput,pins, 
  userLocation }) => {
  return (
    <div className="bottom-dock-container">
      
      {/* --- INSERT BADGE HERE --- */}
      {/* We wrap it so we can position it absolutely relative to this dock */}
    <div className="amplify-badge-wrapper">
         {/* Pass the full data arrays */}
         <AmplifyBadge pins={pins} userLocation={userLocation}  />

      </div>

      {/* 1. Stats */}
      <button className="dock-btn" onClick={onOpenStats}>
          <IoStatsChart />
      </button>

      {/* 2. Story */}
      <button className="dock-btn" onClick={onOpenStory}>
          <IoBook />
      </button>

      {/* 3. CENTER: Write */}
      <button className="dock-btn highlight-btn" onClick={onOpenInput}>
          <IoPencil />
      </button>

      {/* 4. About */}
      <button className="dock-btn" onClick={onOpenAbout}>
          <IoInformationCircle />
      </button>

      {/* 5. Sound */}
      <button className="dock-btn" onClick={onToggleSound}>
        {isMuted ? <IoVolumeMute /> : <IoVolumeHigh />}
      </button>
      
    </div>
  );
};

export default FloatingMenu;