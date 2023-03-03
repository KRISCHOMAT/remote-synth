const socket = io.connect();
const myControl = document.getElementById("my_control");
// const clientId = document.getElementById("client_id");
let currentRoom = null;
const editNameButton = document.getElementById("edit_name");
const clientName = document.getElementById("client_name");
let currentName = "";
const userList = document.getElementById("user_list");
const posIndicator = document.getElementById("pos_indicator");
let users = new Map();

/**
 * Handle Name Change
 */
editNameButton.addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "text";
  input.name = "client_name";
  input.value = currentName;
  input.placeholder = "your name";
  clientName.innerHTML = "";
  clientName.appendChild(input);

  const saveButton = document.createElement("button");
  saveButton.classList.add("mysynth__button");
  saveButton.classList.add("button__small");
  saveButton.innerHTML = "save";
  saveButton.addEventListener("click", function () {
    currentName = input.value;
    clientName.innerHTML = currentName;
    editNameButton.style.display = "inline";
    socket.emit("change_name", currentName);
  });

  editNameButton.style.display = "none";

  clientName.appendChild(saveButton);
});

// handle cue
const cuePos = document.getElementById("cue-pos");
const cueLength = document.getElementById("cue-length");
const cueInfo = document.getElementById("cue-info");

socket.on("cue_init", (pos) => {
  cueInfo.style.display = "block";
  cuePos.innerHTML = pos;
  cueLength.innerHTML = pos;
});

socket.on("cue_update", (length) => {
  console.log(`length ${length}`);
  cueLength.innerHTML = length;
});

const cue = document.getElementById("cue");
const leaveButton = document.getElementById("leave_button");

cue.addEventListener("click", () => {
  cue.style.display = "none";
  leaveButton.style.display = "inline";
  socket.emit("cue", "join");
});

const alert = document.getElementById("alert");
socket.on("no_synth", () => {
  leaveButton.style.display = "none";
  cue.style.display = "inline";
  alert.innerHTML = "Synth is not online.";
  setTimeout(() => {
    alert.innerHTML = "Stand in line to get in!";
  }, 3000);
});

// handle leave button
leaveButton.addEventListener("click", () => {
  leaveButton.style.display = "none";
  cue.style.display = "inline";

  if (!currentRoom) {
    socket.emit("cue", "leave");
    cuePos.innerHTML = "";
    cueLength.innerHTML = "";
  } else {
    socket.emit("leave_room", currentRoom);
    currentRoom = "";
    myControl.style.height = "0";
  }
});

socket.on("force_leaving", () => {
  socket.emit("leave_room", currentRoom);
  currentRoom = "";
  leaveButton.style.display = "none";
  cue.style.display = "inline";
  myControl.style.height = "0";
});

// handle touch
function getCoordinates(e) {
  const rect = myControl.getBoundingClientRect();
  let x, y;
  if (e.touches) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  posIndicator.style.top = y + "px";
  posIndicator.style.left = x + "px";
  const coordinates = {
    x: x / rect.width,
    y: y / rect.height,
  };
  socket.emit(currentRoom, coordinates);
}

// Listen for touchmove event
myControl.addEventListener("touchmove", function (e) {
  e.preventDefault();
  if (currentRoom) {
    getCoordinates(e);
  }
});

// Listen for mousemove event
myControl.addEventListener("mousemove", function (e) {
  if (currentRoom) {
    getCoordinates(e);
  }
});

// Handle Socket Connection
// Client Joins A Room
socket.on("room_joined", (roomName) => {
  currentRoom = roomName;
  myControl.style.height = "400px";
  console.log(`joined ${roomName}`);
  cueInfo.style.display = "none";
  cuePos.innerHTML = "";
  cueLength.innerHTML = "";
});

// Client Leaving back to Lobby
socket.on("left_room", (msg) => {
  currentRoom = null;
  myControl.style.height = "0";
});

socket.on("room_update", (msg) => {
  console.log(msg);
});

// Init new Client
socket.on("init", (payload) => {
  // clientId.innerHTML = payload.id;
  payload.currentUsers.forEach((user) => {
    users.set(user.id, user.name);
    addUserToList({ id: user.id, name: user.name });
  });
});

// Get Active User List
socket.on("user_list_update", (user) => {
  users.set(user.id, user.name);
  wipeUserList();
  for (const [key, value] of users) {
    addUserToList({ id: key, name: value });
  }
});

// Remove Leaving User
socket.on("user_left", (id) => {
  users.delete(id);
  wipeUserList();
  for (const [key, value] of users) {
    addUserToList({ id: key, name: value });
  }
});

function addUserToList(user) {
  const listEntry = document.createElement("div");
  listEntry.classList.add("mysynth__user__list__entry");
  listEntry.id = user.id;

  // const id = document.createElement("p");
  // id.classList.add("mysynth__user__entry");
  // id.innerHTML = user.id;

  const name = document.createElement("p");
  name.classList.add("mysynth__user__entry");
  name.innerHTML = user.name;

  // listEntry.appendChild(id);
  listEntry.appendChild(name);
  userList.appendChild(listEntry);
}

function wipeUserList() {
  const nodeArray = Array.from(userList.children);
  nodeArray.forEach((node, id) => {
    if (id !== 0) {
      node.remove();
    }
  });
}
