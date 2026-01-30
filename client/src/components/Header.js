import React from 'react';

const Header = ({ isMuted, toggleMute }) => {
  return (
    <>
      <header className="app-header">
        <h1>Night Lights 🌑</h1>
        <p>A collaborative map of hope.</p>
      </header>
    </>
  );
};

export default Header;