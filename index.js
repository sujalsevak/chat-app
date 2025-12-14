// index.js (Formerly server.js)
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
// The PORT variable is not used by Vercel, but kept for local dev
const PORT = process.env.PORT || 5003; 

// Middleware setup
app.use(cors());

// Serve static files (HTML, client.js, etc.) from the 'public' directory
app.use(express.static("public")); 

// Fallback for Vercel deployment: Serve your HTML file
app.get('/', (req, res) => {
    // Assuming your HTML file is at 'public/index.html'
    res.sendFile(__dirname + '/public/index.html'); 
});

const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
    cors: {
        // Allows access from any origin (Crucial for Vercel/Local testing)
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// In-memory store (simple)
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
            socket.to(room).emit("message", { 
                system: true, 
                text: `${username} left`, 
                time: new Date().toISOString() 
            });
            // Update user list for the remaining users in the room
            const userList = usersInRoom.get(room) ? Array.from(usersInRoom.get(room).values()) : [];
            io.in(room).emit("roomData", { room, users: userList });
        }
    };

    // join event: { username, room }
    socket.on("join", ({ username, room }, ack) => {
        if (!username || !room) {
            if (ack) ack({ status: "error", message: "username and room required" });
            return;
        }
        username = String(username).trim();
        room = String(room).trim();

        // Check if user is already in a room and remove them first
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


// ----------------------------------------------------------------------------------
// DUAL CONFIGURATION FOR VERCEL AND LOCAL DEVELOPMENT
// ----------------------------------------------------------------------------------

// 1. LISTEN FOR LOCAL DEVELOPMENT
if (process.env.NODE_ENV !== "production") {
    if (server) { 
        server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`)); 
    }
}

// 2. EXPORT THE SERVER HANDLER FOR VERCEL (THE FIX)
module.exports = server;