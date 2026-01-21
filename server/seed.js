const mongoose = require('mongoose');

// --- 1. CONFIGURATION ---
// ⚠️ PASTE YOUR ACTUAL CONNECTION STRING INSIDE THE QUOTES BELOW
const MONGO_URI = "mongodb+srv://eomorales_db_user:jattat-sabcik-2hyqpI@cluster0.zccb56e.mongodb.net/?appName=Cluster0"; 

const validTexts = {
  distressed: [
    "Feeling overwhelmed by everything today.",
    "I just want to feel okay again.",
    "The nights are the hardest.",
    "Struggling to find motivation.",
    "Lost and don't know where to turn.",
    "Anxiety is keeping me awake.",
    "Miss him so much it hurts.",
    "Why does it feel so heavy?",
    "Need a sign that things get better.",
    "Tired of pretending I'm fine."
  ],
  positive: [
    "Saw the most beautiful sunset over Manila Bay.",
    "Grateful for my family's health.",
    "Passed my board exams! So happy!",
    "Coffee and rain, perfect afternoon.",
    "Someone returned my lost wallet today. There is good in the world.",
    "Finally feeling like myself again.",
    "Sending love to everyone fighting silent battles.",
    "My dog always knows how to cheer me up.",
    "Had a great talk with an old friend.",
    "Life is beautiful, don't give up."
  ]
};

// Philippines Bounding Box
const PH_BOUNDS = {
  latMin: 5.5,  // South
  latMax: 18.5, // North
  lngMin: 119.0, // West
  lngMax: 126.0 // East
};

// --- 2. HELPER FUNCTIONS ---
const getRandomLocation = () => {
  const lat = Math.random() * (PH_BOUNDS.latMax - PH_BOUNDS.latMin) + PH_BOUNDS.latMin;
  const lng = Math.random() * (PH_BOUNDS.lngMax - PH_BOUNDS.lngMin) + PH_BOUNDS.lngMin;
  return { type: 'Point', coordinates: [lng, lat] };
};

const getRandomText = (type) => {
  const list = validTexts[type];
  return list[Math.floor(Math.random() * list.length)];
};

// --- 3. DEFINE MODEL DIRECTLY (Fixes your error) ---
const ThoughtSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 500 },
  sentiment: { type: String, enum: ['positive', 'distressed'] },
  isHealed: { type: Boolean, default: false },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] 
  },
  createdAt: { type: Date, default: Date.now, expires: 86400 },
  lightCount: { type: Number, default: 0 }
});

// Use existing model if available, or create new one
const Thought = mongoose.models.Thought || mongoose.model('Thought', ThoughtSchema);

// --- 4. MAIN SCRIPT ---
const seedDB = async () => {
  if (MONGO_URI === "YOUR_MONGODB_CONNECTION_STRING_HERE") {
    console.error("❌ ERROR: You forgot to paste your MongoDB Connection String in seed.js!");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to DB");

    const thoughts = [];

    // Generate 34 Distressed
    console.log("Generating 34 Distressed signals...");
    for (let i = 0; i < 34; i++) {
      thoughts.push({
        text: getRandomText('distressed'),
        sentiment: 'distressed',
        location: getRandomLocation(),
        isHealed: false,
        lightCount: Math.floor(Math.random() * 3)
      });
    }

    // Generate 79 Positive
    console.log("Generating 79 Positive signals...");
    for (let i = 0; i < 79; i++) {
      thoughts.push({
        text: getRandomText('positive'),
        sentiment: 'positive',
        location: getRandomLocation(),
        isHealed: true
      });
    }

    await Thought.insertMany(thoughts);
    console.log(`🎉 Success! Added ${thoughts.length} thoughts to the map.`);

    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error seeding DB:", err);
  }
};

seedDB();