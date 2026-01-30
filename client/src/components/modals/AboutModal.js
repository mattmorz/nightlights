import React from 'react';
import '../../App.css'; 

const AboutModal = ({ onClose, isMuted, isOpen}) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay backdrop-blur">
      <div className="modal-content about-modal-container">
        
        {/* --- FIXED HEADER --- */}
        <div className="about-header">
          <h3>Night Lights 🌑</h3>
          <p className="quote">"We are all just walking each other home."</p>
        </div>

        {/* --- SCROLLABLE BODY --- */}
        <div className="about-scroll-body custom-scrollbar">
          <p className="about-intro">
            An anonymous sanctuary. Share your hidden burdens or offer hope to those suffering in silence.
          </p>
          
          <div className="divider-line"></div>
          
          <h4 className="guide-title">How to Guide the Light:</h4>
          
          <div className="about-steps-grid">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-icon">👀</div>
              <div className="step-content">
                <strong>1. Read the Signals</strong>
                <p>Gray pins (🌑) are <strong>Heavy Hearts</strong>.<br/>Bright pins (✨) are <strong>Beacons</strong>.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="step-card">
              <div className="step-icon">💓</div>
              <div className="step-content">
                <strong>2. Resonate</strong>
                <p>Click <strong>Resonate</strong> to silently tell someone "I feel this too."</p>
              </div>
            </div>

            {/* Step 3 (Highlight) */}
            <div className="step-card highlight-step">
              <div className="step-icon">❤️‍🩹</div>
              <div className="step-content">
                <strong>3. Heal the Darkness</strong>
                <p>Place a light near a Heavy Heart. When <strong>5 lights</strong> gather, the shadow breaks.</p>
              </div>
            </div>

            {/* Step 4 (Boost) */}
            <div className="step-card boost-step">
              <div className="step-icon">⚡</div>
              <div className="step-content">
                <strong>4. Amplify</strong>
                <p>Together we go further. Every <strong>10 lights</strong> expands the signal range by <strong>2%</strong>.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- FIXED FOOTER --- */}
        <div className="about-footer">
          <button onClick={onClose} className="btn-submit enter-btn">
            Enter the Night {isMuted ? "🔇" : "🔊"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AboutModal;