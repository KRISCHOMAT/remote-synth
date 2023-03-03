const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const port = process.env.PORT || 3000;

let users = new Map();
let cue = new Array();

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "index.html");
});

server.listen(port, () => {
  console.log(`listening on *:${port}`);
});

io.on("connection", (socket) => {
  socket.on("start_local_server", () => {
    socket.join("local_server");
  });
  // init
  const usersArray = Array.from(users.entries()).map(([id, name]) => ({
    id,
    name,
  }));
  socket.join("lobby");
  socket.emit("init", {
    id: socket.id,
    currentUsers: usersArray,
  });
  users.set(socket.id, undefined);
  socket.to("lobby").emit("user_list_update", { id: socket.id }); // send id of new user to clients

  // user is closing browser
  socket.on("disconnect", (data) => {
    users.delete(socket.id);
    socket.to("lobby").emit("user_left", socket.id);
    handleCue();
  });

  // user is changing name
  socket.on("change_name", (name) => {
    console.log(name);
    users.set(socket.id, name);
    socket.to("lobby").emit("user_list_update", { id: socket.id, name });
  });

  // handle Cue
  socket.on("cue", (action) => {
    if (action === "join") {
      let isSynth = io.sockets.adapter.rooms.get("local_server");
      if (!isSynth) {
        socket.emit("no_synth");
        return;
      }
      const result = joinRoomIfFree(socket);
      if (!result) {
        socket.join("cue");
        cue.push(socket.id);
        socket.emit("cue_init", cue.length);
        socket.to("cue").emit("cue_update", cue.length);
      }
    } else if (action === "leave") {
      cue = cue.filter((id) => id !== socket.id);
      cue.forEach((id, i) => {
        const socket = io.sockets.sockets.get(id);
        socket.emit("cue_init", i + 1);
      });
      socket.to("cue").emit("cue_update", cue.length);
    }
  });

  // user leaves room
  socket.on("leave_room", (roomName) => {
    console.log("user left room");
    socket.leave(roomName);
    handleCue();
  });

  // send data to teensy
  socket.on("osc1", (coords) => {
    socket.to("local_server").emit("dataA", coords);
  });

  socket.on("osc2", (coords) => {
    socket.to("local_server").emit("dataB", coords);
  });

  socket.on("audio", (data) => {
    console.log(data);
  });
});

function joinRoomIfFree(socket) {
  let room = "osc1";
  let roomExists = io.sockets.adapter.rooms.get(room);
  if (roomExists) {
    room = "osc2";
    roomExists = io.sockets.adapter.rooms.get(room);
  }
  if (roomExists) {
    console.log("all rooms occupied");
    return false;
  }

  console.log(`${room} is free`);
  socket.leave("cue");
  socket.join(room);
  socket.emit("room_joined", room);
  setTimeout(() => {
    socket.emit("force_leaving");
  }, 100000);
  socket.broadcast
    .to("lobby")
    .emit("room_update", { room: room, isFree: false });
  return true;
}

function handleCue() {
  if (cue.length === 0) return;
  const next = cue.shift();
  const socket = io.sockets.sockets.get(next);
  const result = joinRoomIfFree(socket);
  if (result) {
    cue.forEach((id, i) => {
      const socket = io.sockets.sockets.get(id);
      socket.emit("cue_init", i + 1);
    });
    socket.to("cue").emit("cue_update", cue.length);
  }
}
