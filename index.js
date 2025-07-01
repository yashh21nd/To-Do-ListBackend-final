const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Schemas
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

const taskSchema = new mongoose.Schema({
  text: { type: String, required: true },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

const User = mongoose.model("User", userSchema);
const Task = mongoose.model("Task", taskSchema);

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
};

// Auth Routes
app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashed });
    res.status(201).json({ message: "User created" });
  } catch (err) {
    res.status(500).json({ message: "Signup error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
});

// Task Routes
app.get("/tasks", auth, async (req, res) => {
  const tasks = await Task.find({ userId: req.userId });
  res.json(tasks);
});

app.post("/tasks", auth, async (req, res) => {
  const { text, status = "pending", priority = "medium" } = req.body;
  const newTask = await Task.create({
    text,
    status,
    priority,
    userId: req.userId,
  });
  res.status(201).json(newTask);
});

app.delete("/tasks/:id", auth, async (req, res) => {
  await Task.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ message: "Task deleted" });
});

app.patch("/tasks/:id/status", auth, async (req, res) => {
  const { status } = req.body;
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { status },
    { new: true }
  );
  res.json(task);
});

app.patch("/tasks/:id/priority", auth, async (req, res) => {
  const { priority } = req.body;
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { priority },
    { new: true }
  );
  res.json(task);
});

// Start server
app.listen(PORT, () => {
  console.log('Server running on http://localhost:${PORT}');
});
