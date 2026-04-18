const express = require("express");
const path = require("path");
const ordersRouter = require("./routes/orders");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api", ordersRouter);

app.get("/api/health", (_req, res) => {
  res.json({ message: "Server is running" });
});

app.listen(PORT, () => {
  console.log(`Mini Laundry app running on http://localhost:${PORT}`);
});
