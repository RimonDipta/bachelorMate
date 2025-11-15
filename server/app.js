// server/app.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const familyRoutes = require("./routes/familyRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const mealRoutes = require("./routes/mealRoutes");
const guestMealRoutes = require("./routes/guestMealRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const summaryRoutes = require("./routes/summaryRoutes");
const errorHandler = require("./middleware/errorMiddleware");
const notFound = require("./middleware/notFoundMiddleware"); // if you added it

dotenv.config();

// Connect DB once on cold start (Vercel will reuse the function when warm)
connectDB();

const app = express();

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS – for now allow all, later you can restrict by domain
const corsOptions = {
  origin: true,
  credentials: true,
};
app.use(cors(corsOptions));

// health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/families", familyRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/guest-meals", guestMealRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/summary", summaryRoutes);

// 404 + error handlers
app.use(notFound);
app.use(errorHandler);

module.exports = app;
