import express from "express";
import connectionToDatabase from "./db/connection.js";
import deserializeUser from "./middleware/deserializeuser.middleware.js";
import cors from "cors";
import routeFunc from "./route/route.js";
import { config } from "dotenv";
import { createServer } from "http";
import { initSocket } from "./socket.js";
import path from "path";

config(); // Load .env variables

const app = express();
const server = createServer(app);
app.use(deserializeUser);
// ✅ Environment variables
const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || "http://localhost";

// ✅ Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ origin: "*" }));
app.use(deserializeUser);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Routes
routeFunc(app);

// ✅ Socket initialization
const io = initSocket(server);

// ✅ Server start
server.listen(PORT, async () => {
  try {
    connectionToDatabase();
    console.log(`✅ Server running on ${BASE_URL}:${PORT}`);
  } catch (error) {
    console.error("❌ Server startup error:", error);
  }
});
