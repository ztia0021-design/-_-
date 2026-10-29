import express from "express";
import http from "http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import mongoose from "mongoose";
import authRouter from "./routes/auth.js";
import tutorRouter from "./routes/tutorRouter.js";
import subjectRouter from "./routes/subjectRouer.js";
import slotRouter from "./routes/slotRouter.js";
import bookingRouter from "./routes/bookingRouter.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:4200" },
});
app.set("io", io);

app.use((req, res, next) => {
  if (req.headers.origin === "http://localhost:4200") {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
    res.vary("Origin");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
const PORT = process.env.PORT ?? 8083;
const MONGO_URI = process.env.MONGO_URI;
app.use("/api/34467637/auth", authRouter);
app.use("/api/34467637/tutors",  tutorRouter);
app.use("/api/34467637/subjects",  subjectRouter);
app.use("/api/34467637/slots", slotRouter);
app.use("/api/34467637/bookings", bookingRouter);

const frontendDirectory = fileURLToPath(
  new URL('../frontend/browser/', import.meta.url)
);

app.use(express.static(frontendDirectory));

app.get('/{*splat}', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(frontendDirectory, 'index.html'));
});

async function connectToDatabase() {
  await mongoose.connect(MONGO_URI, { dbName: process.env.DB_NAME });
    console.log("Connected to MongoDB");
    
  }


connectToDatabase()
.then(() => server.listen(PORT, () => console.log(`Listening on port ${PORT}`)))
.catch((err) => {
  console.error("MongoDB connection failed:", err.message);
  process.exit(1);
});