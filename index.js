const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

const corsOptions = {
  origin: "*", // Frontend URL
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions,
});

// Problem Generation Utility
const generateMathProblem = () => {
  const operators = ["+", "-", "*"];
  const operator = operators[Math.floor(Math.random() * operators.length)];

  let a = Math.floor(Math.random() * 20) + 1;
  let b = Math.floor(Math.random() * 20) + 1;

  let question, answer;

  switch (operator) {
    case "+":
      question = `${a} + ${b}`;
      answer = a + b;
      break;
    case "-":
      [a, b] = [Math.max(a, b), Math.min(a, b)];
      question = `${a} - ${b}`;
      answer = a - b;
      break;
    case "*":
      question = `${a} × ${b}`;
      answer = a * b;
      break;
  }

  return { question, answer };
};

// Game State Management
class GameManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.currentProblem = generateMathProblem();
    this.problemSolved = false;
    this.players = {};
    this.leaderboard = {};
    this.questionCount = 0;
    this.gameEnded = false;
  }

  generateNewProblem() {
    this.currentProblem = generateMathProblem();
    this.problemSolved = false;
    return this.currentProblem;
  }

  updateLeaderboard(username) {
    this.leaderboard[username] = (this.leaderboard[username] || 0) + 1;
    return Object.entries(this.leaderboard)
      .map(([username, score]) => ({ username, score }))
      .sort((a, b) => b.score - a.score);
  }

  checkGameEnd() {
    this.questionCount++;
    return this.questionCount >= 10;
  }
}

const gameManager = new GameManager();

// Socket Connection Handler
io.on("connection", (socket) => {
  // Send current problem to newly connected client
  socket.emit("newProblem", gameManager.currentProblem);

  socket.on("joinGame", (data) => {
    const { username } = data;
    gameManager.players[socket.id] = username;

    // Broadcast player join
    io.emit("playerJoined", { username });
  });

  socket.on("submitAnswer", (data) => {
    // Game already ended
    if (gameManager.gameEnded) return;

    // Prevent multiple winners
    if (gameManager.problemSolved) return;

    if (data.answer === gameManager.currentProblem.answer) {
      gameManager.problemSolved = true;

      // Update leaderboard
      const updatedLeaderboard = gameManager.updateLeaderboard(data.username);

      // Check if game should end
      const gameEnded = gameManager.checkGameEnd();

      if (gameEnded) {
        // Determine winner
        const winner = updatedLeaderboard[0];
        gameManager.gameEnded = true;

        io.emit("gameOver", {
          winner,
          leaderboard: updatedLeaderboard,
        });
      } else {
        // Continue game
        io.emit("winner", {
          username: data.username,
          leaderboard: updatedLeaderboard,
          questionCount: gameManager.questionCount,
        });

        // Generate new problem
        setTimeout(() => {
          const newProblem = gameManager.generateNewProblem();
          io.emit("newProblem", newProblem);
        }, 2000);
      }
    }
  });

  socket.on("disconnect", () => {
    const username = gameManager.players[socket.id];
    if (username) {
      delete gameManager.players[socket.id];
      io.emit("playerLeft", { username });
    }
  });
});

app.get("/", (req, res) => {
  return res.send("Hello node js");
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
