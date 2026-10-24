require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const groupRoutes = require("./routes/group.routes");

const requiredEnvironmentVariables = ["MONGO_URI", "JWT_SECRET"];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
  (name) => !process.env[name]
);

if (missingEnvironmentVariables.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvironmentVariables.join(", ")}`);
  process.exit(1);
}

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "SplitFair" });
});

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

const clientBuildPath = fs.existsSync(path.join(__dirname, "public", "index.html"))
  ? path.join(__dirname, "public")
  : path.join(__dirname, "../client/dist");

if (fs.existsSync(path.join(clientBuildPath, "index.html"))) {
  app.use(express.static(clientBuildPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    const port = Number(process.env.PORT) || 5000;
    app.listen(port, "0.0.0.0", () => {
      console.log(`SplitFair API running on port ${port}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection failed:", error.message);
    process.exit(1);
  });
