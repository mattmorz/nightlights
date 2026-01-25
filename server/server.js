require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http'); // Import HTTP
const { Server } = require('socket.io'); // Import Socket.io
const Sentiment = require('sentiment');
const rateLimit = require('express-rate-limit'); 
const Filter = require('bad-words'); 

// --- CONFIG: PHILIPPINE CITIES DATA ---
const CITIES = [
  // --- NCR & LUZON ---
  { name: "Manila", lat: 14.5995, lng: 120.9842 },
  { name: "Quezon City", lat: 14.6760, lng: 121.0437 },
  { name: "Makati", lat: 14.5547, lng: 121.0244 },
  { name: "Taguig", lat: 14.5176, lng: 121.0509 },
  { name: "Baguio", lat: 16.4023, lng: 120.5960 },
  { name: "Tagaytay", lat: 14.1153, lng: 120.9621 },
  { name: "Vigan", lat: 17.5702, lng: 120.3870 },
  { name: "Laoag", lat: 18.1960, lng: 120.5927 },
  { name: "Tuguegarao", lat: 17.6131, lng: 121.7269 },
  { name: "Angeles (Pampanga)", lat: 15.1484, lng: 120.5844 },
  { name: "Olongapo", lat: 14.8386, lng: 120.2842 },
  { name: "Batangas City", lat: 13.7565, lng: 121.0583 },
  { name: "Lucena", lat: 13.9374, lng: 121.6172 },
  { name: "Naga", lat: 13.6218, lng: 123.1948 },
  { name: "Legazpi", lat: 13.1391, lng: 123.7438 },
  { name: "Puerto Princesa", lat: 9.7392, lng: 118.7350 },
  { name: "El Nido", lat: 11.2543, lng: 119.4293 },

  // --- VISAYAS ---
  { name: "Cebu City", lat: 10.3157, lng: 123.8854 },
  { name: "Lapu-Lapu", lat: 10.3103, lng: 123.9494 },
  { name: "Iloilo City", lat: 10.7202, lng: 122.5621 },
  { name: "Bacolod", lat: 10.6765, lng: 122.9509 },
  { name: "Tacloban", lat: 11.2433, lng: 124.9988 },
  { name: "Ormoc", lat: 11.0050, lng: 124.6075 },
  { name: "Dumaguete", lat: 9.3068, lng: 123.3045 },
  { name: "Tagbilaran (Bohol)", lat: 9.6500, lng: 123.8500 },
  { name: "Roxas City", lat: 11.5853, lng: 122.7511 },
  { name: "Boracay", lat: 11.9674, lng: 121.9248 },

  // --- MINDANAO ---
  { name: "Davao City", lat: 7.1907, lng: 125.4553 },
  { name: "Cagayan de Oro", lat: 8.4542, lng: 124.6319 },
  { name: "Zamboanga City", lat: 6.9214, lng: 122.0790 },
  { name: "General Santos", lat: 6.1127, lng: 125.1716 },
  { name: "Iligan", lat: 8.2280, lng: 124.2452 },
  { name: "Butuan", lat: 8.9492, lng: 125.5430 },
  { name: "Cotabato City", lat: 7.2244, lng: 124.2460 },
  { name: "Surigao City", lat: 9.8027, lng: 125.4989 },
  { name: "Siargao", lat: 9.8695, lng: 126.0465 }
];

// --- HELPER: Identify Region (Nearest Neighbor) ---
const getRegionName = (lat, lng) => {
  let closestCity = "the Unknown";
  let minDistance = Infinity;

  // Simple Euclidean distance approximation
  // (Efficient enough for this purpose)
  const calculateDist = (lat1, lng1, lat2, lng2) => {
    return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
  };

  CITIES.forEach(city => {
    const dist = calculateDist(lat, lng, city.lat, city.lng);
    
    // If this city is closer than the last one found...
    if (dist < minDistance) {
      minDistance = dist;
      closestCity = city.name;
    }
  });

  // OPTIONAL: If the user is excessively far (e.g., > 2.0 degrees / ~220km) from ANY city
  // you can revert to "the Philippines" or "the Ocean"
  if (minDistance > 2.0) {
    return "the Philippines";
  }

  return closestCity;
};

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 5001;

// 1. Create the HTTP Server
const server = http.createServer(app);

// 2. Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://nightlights-eight.vercel.app"], // Allow connections from your React app
    methods: ["GET", "POST", "PUT"]
  }
});

// 3. Socket.io Logic
io.on('connection', (socket) => {
  console.log(`New soul connected: ${socket.id}`);

  // Listen for location updates from a client
  socket.on('update_location', (data) => {
    // Broadcast this user's location to everyone else
    // We send 'socket.id' so the frontend can track unique fireflies
    socket.broadcast.emit('firefly_update', {
      id: socket.id,
      lat: data.lat,
      lng: data.lng
    });
  });

  // Handle Disconnection
  socket.on('disconnect', () => {
    // Tell everyone to remove this specific firefly
    io.emit('firefly_remove', socket.id);
    console.log(`Soul departed: ${socket.id}`);
  });
});

// 4. CHANGE app.listen TO server.listen
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const sentimentAnalyzer = new Sentiment();
const filter = new Filter(); 

// Middleware
app.use(cors());
app.use(express.json());
app.set('trust proxy', 1); 

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://<user>:<pass>@cluster.mongodb.net/nightlights?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- SCHEMA & MODEL ---
const ThoughtSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 500 },
  sentiment: { 
    type: String, 
    enum: ['positive', 'distressed'], 
    required: true 
  },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true } 
  },
  isHealed: { type: Boolean, default: false },
  lightCount: { type: Number, default: 0 },
  resonanceCount: { type: Number, default: 0 }, // <--- NEW FIELD ADDED
  createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

ThoughtSchema.index({ location: '2dsphere' });
const Thought = mongoose.model('Thought', ThoughtSchema);

// --- SECURITY & MODERATION TOOLS ---

// 1. RATE LIMITER: Allow 20 posts per hour per IP
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 20, 
  message: { error: "You are sending too many signals. Please rest for a while and try again later." },
  standardHeaders: true, 
  legacyHeaders: false, 
});

// 2. CONTENT VALIDATION FUNCTION
const containsSensitiveInfo = (text) => {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/;
   
  if (emailRegex.test(text)) return "Privacy Alert: Please do not post email addresses.";
  if (phoneRegex.test(text)) return "Privacy Alert: Please do not post phone numbers.";
  return null;
};

// --- ROUTES ---
// =========================================================
app.get('/health', (req, res) => {
  const { key } = req.query;
  const validSecret = process.env.CRON_SECRET;

  // 1. Safety Check: Ensure the variable exists in Render
  if (!validSecret) {
    console.error("❌ CRON_SECRET is missing in Render Environment Variables!");
    return res.status(500).send("Server Configuration Error");
  }

  // 2. Validate Key
  if (key !== validSecret) {
    return res.status(403).send('Unauthorized');
  }

  // 3. Success
  res.send('OK'); 
});

// GET: Fetch all thoughts
app.get('/thoughts', async (req, res) => {
  try {
    const thoughts = await Thought.find().sort({ createdAt: -1 }).limit(500);
    res.json(thoughts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch thoughts" });
  }
});

// NEW ROUTE: Handle Resonance (Heartbeat)
app.put('/thoughts/:id/resonate', async (req, res) => {
  try {
    const { id } = req.params;
    // Atomically increment the resonanceCount by 1
    await Thought.findByIdAndUpdate(id, { $inc: { resonanceCount: 1 } });
    res.json({ success: true });
  } catch (err) {
    console.error("Resonance Error:", err);
    res.status(500).json({ error: "Failed to resonate." });
  }
});

// POST: Create a new thought
app.post('/thoughts', postLimiter, async (req, res) => {
  try {
    const { text, trap } = req.body;

    // 1. INPUT VALIDATION
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    if (trap && trap.length > 0) return res.json({ success: true }); 
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid Location Data" });
    }
    if (!text || text.length > 500) return res.status(400).json({ error: "Message too long." });

    if (filter.isProfane(text)) {
      return res.status(400).json({ error: "Your message contains words that are not allowed in this safe space." });
    }

    const privacyError = containsSensitiveInfo(text);
    if (privacyError) {
      return res.status(400).json({ error: privacyError });
    }

   

    // 2. ANALYZE SENTIMENT
    const analysis = sentimentAnalyzer.analyze(text);
    const sentimentType = analysis.score < 0 ? 'distressed' : 'positive';
    
    console.log(`📝 New Thought: "${text}" | Type: ${sentimentType}`);

    // --- 3. DYNAMIC RADIUS CALCULATION ---
    const EARTH_RADIUS_KM = 6378.1;
    const BASE_RADIUS_KM = 5;
    const baseRadiusRadians = BASE_RADIUS_KM / EARTH_RADIUS_KM;

    // Count existing lights nearby
    const nearbyPositiveCount = await Thought.countDocuments({
        sentiment: 'positive',
        location: { $geoWithin: { $centerSphere: [ [lng, lat], baseRadiusRadians ] } }
    });

    // Calculate Boost: Every 10 lights = +2% Range
    const tier = Math.floor(nearbyPositiveCount / 10);
    const boostMultiplier = 1 + (tier * 0.02); 
    const dynamicRadiusKm = BASE_RADIUS_KM * boostMultiplier;
    const dynamicRadiusRadians = dynamicRadiusKm / EARTH_RADIUS_KM;

    console.log(`⚡ Density: ${nearbyPositiveCount} lights | Boost: ${Math.round((boostMultiplier-1)*100)}% | Range: ${dynamicRadiusKm.toFixed(2)}km`);

    // --- 4. CREATE OBJECT ---
    const userLocation = { type: 'Point', coordinates: [lng, lat] }; 

    const newThought = new Thought({
      text,
      sentiment: sentimentType,
      location: userLocation,
      isHealed: sentimentType === 'positive', 
      lightCount: 0,
      resonanceCount: 0 // Initialize resonance
    });

    let message = "";
    let bornHealed = false;

    // --- 5. HEALING LOGIC ---
    if (sentimentType === 'positive') {
      // CASE A: User placed a BEACON
      await newThought.save();

      // Search for distressed pins using the BOOSTED (Dynamic) Radius 
      const nearbyDistressed = await Thought.find({
        sentiment: 'distressed',
        isHealed: false,
        location: { $geoWithin: { $centerSphere: [ [lng, lat], dynamicRadiusRadians ] } }
      });
      
      let actuallyHealedSomeone = false;

      for (const sadPin of nearbyDistressed) {
        // Check how many lights are around the sad pin to see if it heals
        const lightsAroundPin = await Thought.countDocuments({
          sentiment: 'positive',
          location: { $geoWithin: { $centerSphere: [ sadPin.location.coordinates, baseRadiusRadians ] } } 
        });
        
        sadPin.lightCount = lightsAroundPin;
        
        if (sadPin.lightCount >= 5) {
          sadPin.isHealed = true;
          actuallyHealedSomeone = true;
        }
        await sadPin.save();
      }

      if (actuallyHealedSomeone) {
        message = `Your light traveled ${(dynamicRadiusKm).toFixed(1)}km and healed a neighbor.`;
      } else {
        const percentBoost = Math.round((boostMultiplier - 1) * 100);
        
        if (percentBoost > 0) {
           message = `Together we reach further. Your light reaches ${percentBoost}% further because of the glowing community nearby.`;
        } else {
           message = "Your light is placed. Gather more beacons nearby to expand your collective reach.";
        }
      }

    } else {
      // CASE B: User placed a HEAVY HEART
      
      const nearbyLights = await Thought.countDocuments({
        sentiment: 'positive',
        location: { $geoWithin: { $centerSphere: [ [lng, lat], dynamicRadiusRadians ] } }
      });
      
      newThought.lightCount = nearbyLights;

      if (nearbyLights >= 5) {
        newThought.isHealed = true;
        bornHealed = true;
        message = "You are not alone. The surrounding lights have already caught you.";
      } else {
        message = "Signal sent. The world now sees your shadow.";
      }

      await newThought.save();
    }
     // Notify map to refresh pins
    io.emit('beacons_update');

    // --- NEW: GLOBAL PULSE BROADCAST ---
    const region = getRegionName(lat, lng);
    const action = sentimentType === 'positive' ? "lit a beacon" : "sent a signal";
    
    // Broadcast the specific message to all connected clients
    io.emit('pulse_event', {
      message: `Someone in ${region} just ${action}.`,
      sentiment: sentimentType
    });
    res.json({ success: true, sentiment: sentimentType, message, bornHealed });

  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ error: "Server error processing your signal." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});