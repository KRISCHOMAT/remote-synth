const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
let isSynthOnline = false;
let synthId;

const port = process.env.PORT || 3000;

let users = new Map();
let line = new Array();

const rooms = {
  roomA: "free",
  roomB: "free",
};

/**
 * REST
 */
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "index.html");
});

server.listen(port, () => {
  console.log(`listening on *:${port}`);
});

/**
 * Socket connections
 */
io.on("connection", (socket) => {
  socket.on("disconnect", () => {
    if (socket.id === synthId) {
      isSynthOnline = false;
      socket.to("lobby").emit("synth_status", isSynthOnline);
      return;
    }
    const user = users.get(socket.id);
    if (!user) return;
    if (user.room !== "") {
      userLeavesRoom(socket, user.room);
    } else {
      const index = line.indexOf(socket.id);
      if (index > -1) {
        line.splice(index, 1);
      }
      line.forEach((id, i) => {
        const socket = io.sockets.sockets.get(id);
        socket.emit("line-update", { pos: i + 1, length: line.length });
      });
    }
    users.delete(socket.id);
  });

  socket.on("start_local_server", () => {
    socket.join("local_server");
    synthId = socket.id;
    isSynthOnline = true;
    socket.to("lobby").emit("synth_status", isSynthOnline);
  });

  socket.on("user_info", (data) => {
    users.set(socket.id, { name: data.userName, room: data.currentRoom });
  });

  socket.on("user_init", (name) => {
    users.set(socket.id, { name: name, room: "" });
    socket.join("lobby");
    socket.emit("synth_status", isSynthOnline);
    socket.emit("room_status", rooms);
  });

  // send data to teensy
  socket.on("roomA", (coords) => {
    socket.to("local_server").emit("dataA", coords);
  });

  socket.on("roomB", (coords) => {
    socket.to("local_server").emit("dataB", coords);
  });

  socket.on("leave-room", (room) => {
    const user = users.get(socket.id);
    userLeavesRoom(socket, room);
  });

  socket.on("leave-line", () => {
    socket.leave("line");
    const index = line.indexOf(socket.id);
    if (index > -1) {
      line.splice(index, 1);
    }
    line.forEach((id, i) => {
      const socket = io.sockets.sockets.get(id);
      socket.emit("line-update", { pos: i + 1, length: line.length });
    });
  });

  socket.on("join-line", () => {
    const user = users.get(socket.id);
    if (rooms.roomA === "free") {
      user.room = "roomA";
      rooms.roomA = user.name;
      socket.leave("line");
      socket.emit("room-joined", "roomA");
      io.to("lobby").emit("room_status", rooms);

      return;
    } else if (rooms.roomB === "free") {
      user.room = "roomB";
      rooms.roomB = user.name;
      socket.leave("line");
      socket.emit("room-joined", "roomB");
      io.to("lobby").emit("room_status", rooms);

      return;
    }
    line.push(socket.id);
    socket.join("line");
    socket.emit("line-joined", line.length);
    socket.broadcast.to("line").emit("user-joined-line", line.length);
  });
});

function userLeavesRoom(socket, room) {
  socket.emit("room-left");
  const user = users.get(socket.id);
  if (!user) return;
  user.room = "";

  if (line.length === 0) {
    rooms[room] = "free";
    io.to("lobby").emit("room_status", rooms);
    return;
  }

  const next = line.shift();
  const nextSocket = io.sockets.sockets.get(next);
  nextSocket.emit("room-joined", room);

  const nextUser = users.get(nextSocket.id);
  nextUser.room = room;
  rooms[room] = nextUser.name;
  io.to("lobby").emit("room_status", rooms);

  line.forEach((id, i) => {
    const socket = io.sockets.sockets.get(id);
    socket.emit("line-update", { pos: i + 1, length: line.length });
  });
}
