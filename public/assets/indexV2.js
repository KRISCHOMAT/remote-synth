const socket = io();

/**
 * User Info
 */
const modal = document.getElementById("modal");
const nameInput = document.getElementById("name");
const setNameButton = document.getElementById("modal_button");
const nameFromStorage = sessionStorage.getItem("name");
const userNameField = document.getElementById("client_name");
const editNameButton = document.getElementById("edit_name");

let userName = "";
let currentRoom = "";
let isSynthOnline = false;
let timeout;
const playTime = 120000;

socket.emit("user_init", userName);

if (nameFromStorage) {
  userName = nameFromStorage;
  userNameField.innerHTML = userName;
  modal.style.display = "none";
  socket.emit("user_info", { userName, currentRoom });
}

setNameButton.addEventListener("click", () => {
  userName = nameInput.value;
  sessionStorage.setItem("name", userName);
  userNameField.innerHTML = userName;
  modal.style.display = "none";
  socket.emit("user_info", { userName, currentRoom });
});

editNameButton.addEventListener("click", () => {
  modal.style.display = "flex";
  nameInput.value = userName;
});

/**
 * Socket EMITS
 */
const joinLineButton = document.getElementById("join-button");
const leaveLineButton = document.getElementById("leave-button");
const synthStatus = document.getElementById("synth-status");
const roomAStatus = document.getElementById("roomA");
const rommBStatus = document.getElementById("roomB");
const alertElement = document.getElementById("alert");
const lineInfo = document.getElementById("line-info");
const linePos = document.getElementById("line-pos");
const lineLength = document.getElementById("line-length");

joinLineButton.addEventListener("click", () => {
  // if (!isSynthOnline) return;
  joinLineButton.style.display = "none";
  leaveLineButton.style.display = "inline";
  socket.emit("join-line");
});

leaveLineButton.addEventListener("click", () => {
  joinLineButton.style.display = "inline";
  leaveLineButton.style.display = "none";
  if (currentRoom === "") {
    socket.emit("leave-line");
    lineInfo.style.display = "none";
  } else {
    socket.emit("leave-room", currentRoom);
    clearTimeout(timeout);
  }
});

/**
 * Socket ON
 */
socket.on("synth_status", (status) => {
  isSynthOnline = status;
  if (status) {
    // joinLineButton.style.cursor = "pointer";
    synthStatus.innerHTML = "online";
    alertElement.innerHTML =
      "Join the line to control the synth when its your turn!";
  } else {
    // joinLineButton.style.cursor = "not-allowed";
    alertElement.innerHTML = "Synth is currently offline.";
    synthStatus.innerHTML = "offline";
  }
});

socket.on("room_status", (status) => {
  roomAStatus.innerHTML = status.roomA;
  rommBStatus.innerHTML = status.roomB;
});

socket.on("line-joined", (data) => {
  lineInfo.style.display = "inline";
  linePos.innerHTML = data;
  lineLength.innerHTML = data;
});

socket.on("user-joined-line", (data) => {
  lineLength.innerHTML = data;
});

socket.on("line-update", (data) => {
  linePos.innerHTML = data.pos;
  lineLength.innerHTML = data.length;
});

const control = document.getElementById("my_control");
socket.on("room-joined", (room) => {
  currentRoom = room;
  control.style.height = "400px";
  lineInfo.style.display = "none";
  timeout = setTimeout(() => {
    socket.emit("leave-room", currentRoom);
  }, playTime);
});

socket.on("room-left", () => {
  control.style.height = 0;
  currentRoom = "";
  joinLineButton.style.display = "inline";
  leaveLineButton.style.display = "none";
});

/**
 * Handle Touch
 */
const posIndicator = document.getElementById("pos_indicator");
function getCoordinates(e) {
  const rect = control.getBoundingClientRect();
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
    x: Math.round((x / rect.width) * 255),
    y: Math.round((y / rect.height) * 255),
  };
  socket.emit(currentRoom, coordinates);
}

// Listen for touchmove event
control.addEventListener("touchmove", function (e) {
  e.preventDefault();
  if (currentRoom) {
    getCoordinates(e);
  }
});

// Listen for mousemove event
control.addEventListener("mousemove", function (e) {
  if (currentRoom) {
    getCoordinates(e);
  }
});
