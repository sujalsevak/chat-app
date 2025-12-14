// public/client.js
const socket = io({ path: '/socket.io/' }); // EXPLICITLY set the path for Vercel routing

// DOM
const joinBtn = document.getElementById("joinBtn");
const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("room");
const chatSection = document.getElementById("chat");
const messagesEl = document.getElementById("messages");
const roomNameEl = document.getElementById("roomName");
const userListEl = document.getElementById("userList");
const msgForm = document.getElementById("msgForm");
const msgInput = document.getElementById("msgInput");
const leaveBtn = document.getElementById("leaveBtn");

function appendMessage(obj){
  const div = document.createElement("div");
  const time = new Date(obj.time).toLocaleTimeString();
  if (obj.system) {
    div.className = "bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-lg";
    div.innerHTML = `<div class="text-xs text-gray-500 mb-1">${time} • system</div><div class="text-gray-700">${escapeHtml(obj.text)}</div>`;
  } else {
    div.className = "bg-white border border-gray-200 p-3 rounded-lg shadow-sm hover:shadow-md transition";
    div.innerHTML = `<div class="text-xs text-gray-500 mb-1">${time} • <strong class="text-blue-600">${escapeHtml(obj.user)}</strong></div><div class="text-gray-800">${escapeHtml(obj.text)}</div>`;
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

// join
joinBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();
  const room = roomInput.value.trim();
  if (!username || !room) return alert("username & room required");
  
  // Emit the join event to the server and wait for acknowledgement (ack)
  socket.emit("join", { username, room }, (res) => {
    if (res && res.status === "ok") {
      // SUCCESS: Hide join form and show chat UI
      roomNameEl.textContent = room;
      chatSection.classList.remove("hidden");
      document.querySelector(".join").classList.add("hidden");
      appendMessage({ system: true, text: `You joined ${room}`, time: new Date().toISOString() });
      updateUserList(res.users || []);
    } else {
      // ERROR: Show server message if joining failed
      alert(res?.message || "Failed to join");
    }
  });
});

// send message
msgForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;
  
  socket.emit("message", { text }, (ack) => {
    if (ack && ack.status === "ok") {
      // Message sent successfully
      msgInput.value = "";
    } else {
      console.warn("message ack:", ack);
    }
  });
});

// leave
leaveBtn.addEventListener("click", () => {
  socket.emit("leave", (res) => {
    // UI reset after leaving
    chatSection.classList.add("hidden");
    document.querySelector(".join").classList.remove("hidden");
    messagesEl.innerHTML = "";
    roomNameEl.textContent = "";
    userListEl.textContent = "";
  });
});

// incoming messages
socket.on("message", (m) => appendMessage(m));

// room data (user list)
socket.on("roomData", ({ room, users }) => {
  updateUserList(users || []);
});

function updateUserList(users){
  userListEl.textContent = (users && users.length) ? users.join(", ") : "—";
}