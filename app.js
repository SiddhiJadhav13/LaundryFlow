const express = require("express");
const path = require("path");
const ordersRouter = require("./routes/orders");
const { getStorageMode } = require("./services/orderService");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", ordersRouter);

app.get("/api/health", async (_req, res) => {
  const storageMode = await getStorageMode();
  res.json({
    message: "Server is running",
    storageMode,
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;