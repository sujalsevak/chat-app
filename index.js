// index.js (formerly server.js)
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const PORT = process.env.PORT || 5003; 

// Middleware setup
app.use(cors());

// Serve static files (HTML, client.js, etc.) from the 'public' directory
app.use(express.static("public")); 

// Fallback: Serve the main HTML file from the 'public' directory
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); 
});

const server = http.createServer(app);

// Configure Socket.IO (rest of your socket.io setup remains the same)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// ... (ALL your Socket.IO logic: io.on("connection", socket.on("join", etc.)) ...

// ----------------------------------------------------------------------------------
// DUAL CONFIGURATION FOR VERCEL AND LOCAL DEVELOPMENT
// ----------------------------------------------------------------------------------

// 1. LISTEN FOR LOCAL DEVELOPMENT
if (process.env.NODE_ENV !== "production") {
    // Check if the server object exists before listening
    if (server) { 
        server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`)); 
    }
}

// 2. EXPORT THE SERVER HANDLER FOR VERCEL
// This is the essential part for Vercel.
module.exports = server;