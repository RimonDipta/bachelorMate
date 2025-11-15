require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const notFound = require("./middleware/notFoundMiddleware");
const errorHandler = require("./middleware/errorMiddleware");

// Route imports (we'll create files later)
const authRoutes = require("./routes/authRoutes");
const familyRoutes = require("./routes/familyRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const mealRoutes = require("./routes/mealRoutes");
const guestMealRoutes = require("./routes/guestMealRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const summaryRoutes = require("./routes/summaryRoutes");

const app = express();

// Connect to DB
connectDB();

// Middlewares
app.use(
  cors({
    origin: "http://localhost:5173/",
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Bachelor House API is running..." });
});

app.use("/api/auth", authRoutes);
app.use("/api/families", familyRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/guest-meals", guestMealRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/summary", summaryRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 404 handler (after routes)
app.use(notFound);

// Error handler (last middleware)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
