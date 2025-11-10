// File: src/index.js
import express from "express";
import { createServer } from "http";
import cors from "cors";
import path from "path";
import { config } from "dotenv";
import connectionToDatabase from "./db/connection.js";
import routeFunc from "./route/route.js";
import deserializeUser from "./middleware/deserializeuser.middleware.js";
import { initSocket } from "./socket.js";

// ✅ Load environment variables
config();

// ✅ Initialize Express & HTTP server
const app = express();
const server = createServer(app);

// ✅ Core config
const PORT = process.env.PORT || 8000;
const BASE_URL = process.env.BASE_URL || "http://localhost";

// ✅ Middleware setup
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Attach custom middlewares
app.use(deserializeUser);

// ✅ Serve static files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Root route — prevents “Cannot GET /”
app.get("/", (req, res) => {
  res.status(200).send(`
    <html>
      <head><title>Smexpert Backend</title></head>
      <body style="font-family: Arial; text-align: center; padding-top: 50px; background: #0b1220; color: #e6eefc;">
        <h1>✅ Smexpert Backend Running Successfully!</h1>
        <p>Environment: ${process.env.NODE_ENV || "development"}</p>
        <p>Listening on: ${BASE_URL}:${PORT}</p>
        <p>Version: 1.0.0</p>
      </body>
    </html>
  `);
});

// ✅ API Routes
routeFunc(app);

// ✅ Socket.io setup
initSocket(server);

// ✅ Start the server
server.listen(PORT, async () => {
  try {
    await connectionToDatabase();
    console.log(`🚀 Smexpert Server running at ${BASE_URL}:${PORT}`);
  } catch (error) {
    console.error("❌ Server startup error:", error.message);
  }
});
