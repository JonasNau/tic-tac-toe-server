const io = require("socket.io")(3000, {
  cors: {
    origin: "*",
  },
  withCredentials: false,
});

//import functions like making a string to json without errors and checking user input
const ObjectFunctions = require("./includes/objectFunctions.js");

const gameRooms = new Map();
gameRooms.set("game1", {
  players: ["SOCKET1", "SOCKET2"],
  gameState: [],
  currentPlayer: "x",
});
gameRooms.clear();

function gameIDExists(gameID) {
  if (io.sockets.adapter.rooms.has(gameID)) return true; //Return true if room exists - socketRoom
  if (gameRooms.has(gameID)) return true; //Return true if room exists - gameRoomsObject
  return false;
}


io.on("connection", (socket) => {
  console.log(socket.id, "connected");
  // console.log("\n")
  // console.log()
  let ticTacToe = new TicTacToe();

  // console.log(io.sockets.adapter.rooms)

  // console.log(io.sockets.sockets.get(socket.id).emit("message", "Infinity"))
  // console.log(io.of("/").sockets.get(socket.id).emit("message", "Hello there"))

  // console.log(io.sockets.adapter.rooms.get("testRoom"))
  // io.sockets.adapter.rooms.get("testRoom").forEach((socketID) => {
  //   io.sockets[socketID].emit("message", "hello there")
  // })
  // console.log(io.sockets)

  socket.on("disconnect", () => {
    console.log(socket.id, "disconnected");

    // let allOtherRooms = gameRooms.entries((gameRoomID, gameRoomData) => {
    //   gameRoomData.players.forEach((player) => {
    //     if (player == socket.id) return gameRoomID;
    //   })
    // })
    // console.log(allOtherRooms);

    // ticTacToe.stopGame(`Player ${socket} left the game`);
    // ticTacToe.clear(gameCode);
  });

  socket.on("createNewGame", (gameCode, isPublic) => {
    if (ObjectFunctions.isEmptyInput(gameCode)) {
      //create random game Code
      gameCode = String(new Date().getTime());
    }

    if (gameIDExists(gameCode)) {
      socket.emit(
        "errorMessage",
        `A game with the id "${gameCode}" already exists.`
      );
      return;
    }

    if (!ticTacToe.initGame(gameCode)) {
      socket.emit("gameStop", "Game could not be initialized");
      return false;
    }

    socket.join(gameCode);
    socket.emit("message", `Created game "${gameCode}"`);
    socket.emit("joinedGame", gameCode, ticTacToe.presets.playerX);
    socket.emit("infoText", "Waiting for opponent...");

    //Add player x to gameRoom
    gameRooms.get(gameCode).players.push(gameCode);
    gameRooms.get(gameCode).isPublic = isPublic;

    //Log gameRooms
    console.log("Current Game Rooms", gameRooms);
  });

  socket.on("joinGame", (gameCode) => {
    if (!gameIDExists(gameCode)) {
      socket.emit("errorMessage", `The game code ${gameCode} doesn't exist`);
      return;
    }
    if (
      gameRooms.get(gameCode).players.length >= 2 ||
      io.sockets.adapter.rooms.get(gameCode) >= 2
    ) {
      socket.emit("errorMessage", "The room is full");
      return false;
    }
    socket.join(gameCode);

    //Add player circle to gameRoom
    gameRooms.get(gameCode).players.push(gameCode);

    socket.emit("joinedGame", gameCode, ticTacToe.presets.playerCircle);
    ticTacToe.startGame(gameCode);
  });

  socket.on("leaveGame", (gameCode) => {
    ticTacToe.stopGame(gameCode, `Player ${socket} left the game`);
    console.log("CLEAR", gameCode);
  });

  socket.on("onMove", (gameCode, player, field) => {
    console.log(gameCode, player, field);
    ticTacToe.makeTurn(gameCode, field, player);
  });

  socket.on("getOpenGameRooms", (limiter) => {
    let openGameRooms = [];
    for (let [currentID, currentData ] of gameRooms) {
      console.log(currentID);
      if (currentData.players.length < 2 && currentData.isPublic) openGameRooms.push(currentID);
    }

    socket.emit("openGameRooms", openGameRooms);
  });
});

class TicTacToe {
  constructor() {
    this.presets = {
      playerX: "x",
      playerCircle: "circle",
    };
    this.gameIsActive = false;
    this.winningContitions = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
  }

  initGame(gameCode) {
    if (gameCode == null) {
      console.log(
        "Game could not be initialized, because there is a gameCode missing"
      );
      return false;
    }
    let gameState = {
      0: null,
      1: null,
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    };
    let currentPlayer = this.presets.playerX;
    this.gameIsActive = false;

    gameRooms.set(gameCode, {
      gameState: gameState,
      players: [],
      currentPlayer: currentPlayer,
    });

    return true;
  }

  startGame(gameCode) {
    console.log(gameRooms.get(gameCode));
    if (
      gameRooms.get(gameCode).players.length < 2 ||
      io.sockets.adapter.rooms.get(gameCode) < 2
    ) {
      console.log("There are to few players in the room to start");
      return false;
    }
    io.in(gameCode).emit("startGame", gameCode);
    this.gameLoop(gameCode);
  }

  clear(gameCode) {

    //let clients leave socket room
    // io.sockets.in(gameCode).forEach((client) => {
    //   console.log(client.id);
    // })
   
    //delete gameRooms room
    gameRooms.delete(gameCode);
  }

  stopGame(gameCode, reason = "Connection Quit") {
    if (!gameIDExists(gameCode)) return false;
    console.log("GAME CODE ->", gameCode);
    io.in(gameCode).emit("stopGame", reason);
    this.clear(gameCode);
  }

  gameLoop(gameCode) {
    if (!gameIDExists(gameCode)) return false;
    let currentPlayer = gameRooms.get(gameCode).currentPlayer;
    let gameState = gameRooms.get(gameCode).gameState;
    if (this.checkWinner(gameState, currentPlayer)) {
      console.log("Winner: " + currentPlayer);
      io.in(gameCode).emit("gameState", gameState, currentPlayer, true, false);
      this.clear(gameCode);
      return false;
    }
    if (this.checkDraw(gameState)) {
      io.in(gameCode).emit("gameState", gameState, currentPlayer, false, true);
      this.clear(gameCode);
      return false;
    }
    io.in(gameCode).emit("gameState", gameState, currentPlayer, false, false);
    console.log(gameRooms.get(gameCode));

    return true;
  }

  makeTurn(gameCode, cell, player) {
    if (!gameIDExists(gameCode)) return false;
    if (this.cellIsClaimed(gameCode, cell)) {
      return;
    }
    if (gameRooms.get(gameCode).currentPlayer != player) {
      return;
    }
    gameRooms.get(gameCode).gameState[cell] = player
    if (!this.gameLoop(gameCode)) {
      return false;
    }
    this.changePlayer(gameCode);
    this.gameLoop(gameCode)
  }

  changePlayer(gameCode) {
    if (!gameIDExists(gameCode)) return false;
    let currentPlayer = gameRooms.get(gameCode).currentPlayer;
    if (currentPlayer == this.presets.playerX) {
      currentPlayer = this.presets.playerCircle;
    } else {
      currentPlayer = this.presets.playerX;
    }
    gameRooms.get(gameCode).currentPlayer = currentPlayer;
    console.log(this.gameID, this.currentPlayer);
  }

  cellIsClaimed(gameCode, cellNumber) {
    if (!gameIDExists(gameCode)) return false;
    return gameRooms.get(gameCode).gameState[cellNumber] != null;
  }

  checkDraw(gameState) {
    return Object.values(gameState).every((currentCell) => {
      return currentCell != null;
    });
  }

  checkWinner(gameState, currentPlayer) {
    const everyClaimedCellOfPlayer = Object.keys(gameState).filter(
      (currentCell) => {
        if (gameState[currentCell] == currentPlayer) {
          return true;
        }
        return false;
      }
    );
    return this.winningContitions.some((winningCondition) => {
      return winningCondition.every((currentNumber) => {
        return everyClaimedCellOfPlayer.includes(String(currentNumber));
      });
    });
  }
}

io.of("/").adapter.on("create-room", (room) => {
  console.log("Server:", `room ${room} was created`);
});

io.of("/").adapter.on("join-room", (room, id) => {
  console.log("Server", `socket ${id} has joined room ${room}`);
});

io.of("/").adapter.on("leave-room", (room, id) => {
  console.log("Server", `socket ${id} has left room ${room}`);
});
