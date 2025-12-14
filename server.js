// server.js (CommonJS)
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
// Use the PORT variable for both development and production
const PORT = process.env.PORT || 5003; 

// Middleware setup
app.use(cors());
// Serve static files (HTML, client.js, etc.) from the 'public' directory
// NOTE: Your current structure assumes index.html is in the root, 
// but it's better practice to put client-side files in a folder like 'public'.
app.use(express.static("public")); 

// Fallback for Vercel deployment: Serve your HTML file
app.get('/', (req, res) => {
    // Assuming you move your HTML file to a 'public/index.html' path
    res.sendFile(__dirname + '/public/index.html');
});

const server = http.createServer(app);

// Configure Socket.IO
// When deploying, you need to set the `origin` to your Vercel domain.
const io = new Server(server, {
  cors: {
    // Allows access from any origin in production (replace with your Vercel URL for security)
    // Or, you can use the origin where your frontend is deployed
    origin: process.env.NODE_ENV === "production" ? "YOUR_VERCEL_FRONTEND_URL" : "*",
    methods: ["GET", "POST"]
  }
});

// In-memory store (simple). For production use DB or Redis.
const usersBySocket = new Map(); 
const usersInRoom = new Map();   

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // Helper function for cleanup
  const cleanUpUser = () => {
    const info = usersBySocket.get(socket.id);
    if (info) {
      const { username, room } = info;
      usersBySocket.delete(socket.id);
      const roomMap = usersInRoom.get(room);
      if (roomMap) {
        roomMap.delete(socket.id);
        if (roomMap.size === 0) usersInRoom.delete(room);
      }
      // Broadcast to the room that the user has left/disconnected
      socket.to(room).emit("message", { system: true, text: `${username} left`, time: new Date().toISOString() });
      // Update user list for the remaining users in the room
      const userList = usersInRoom.get(room) ? Array.from(usersInRoom.get(room).values()) : [];
      io.in(room).emit("roomData", { room, users: userList });
    }
  };

  // join event: { username, room }
  socket.on("join", ({ username, room }, ack) => {
    // ... (existing join logic is fine) ...
    if (!username || !room) {
      if (ack) ack({ status: "error", message: "username and room required" });
      return;
    }
    username = String(username).trim();
    room = String(room).trim();

    // Check if user is already in a room and remove them first (good practice)
    cleanUpUser(); 

    // Save mapping
    usersBySocket.set(socket.id, { username, room });
    if (!usersInRoom.has(room)) usersInRoom.set(room, new Map());
    usersInRoom.get(room).set(socket.id, username);

    socket.join(room);

    // Notify the room
    const payload = {
      system: true,
      text: `${username} joined ${room}`,
      time: new Date().toISOString()
    };
    socket.to(room).emit("message", payload);

    // send updated user list for the room
    const userList = Array.from(usersInRoom.get(room).values());
    io.in(room).emit("roomData", { room, users: userList });

    if (ack) ack({ status: "ok", users: userList });
  });

  // message event: { text }
  // ... (existing message logic is fine) ...
  socket.on("message", ({ text }, ack) => {
    const info = usersBySocket.get(socket.id);
    if (!info) {
      if (ack) ack({ status: "error", message: "Not joined to a room" });
      return;
    }
    const { username, room } = info;
    const msg = {
      system: false,
      text: String(text),
      user: username,
      time: new Date().toISOString(),
    };
    // Broadcast to room
    io.in(room).emit("message", msg);
    if (ack) ack({ status: "ok" });
  });

  // leave room explicitly
  socket.on("leave", (ack) => {
    cleanUpUser();
    if (ack) ack({ status: "ok" });
  });

  // disconnect
  socket.on("disconnect", (reason) => {
    cleanUpUser();
    console.log("socket disconnected:", socket.id, reason);
  });
});

server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));