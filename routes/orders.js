const express = require("express");
const {
  createOrder,
  getOrders,
  updateOrderStatus,
  getDashboard,
} = require("../services/orderService");

const router = express.Router();

router.post("/orders/create", async (req, res) => {
  try {
    const order = await createOrder(req.body);
    return res.status(201).json(order);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const orders = await getOrders(req.query);
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.put("/orders/:id/status", async (req, res) => {
  try {
    const updatedOrder = await updateOrderStatus(req.params.id, req.body.status);
    return res.json(updatedOrder);
  } catch (error) {
    const statusCode = error.message === "Order not found" ? 404 : 400;
    return res.status(statusCode).json({ error: error.message });
  }
});

router.get("/dashboard", async (_req, res) => {
  try {
    const dashboard = await getDashboard();
    return res.json(dashboard);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

module.exports = router;
