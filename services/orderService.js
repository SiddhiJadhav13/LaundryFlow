const fs = require("fs/promises");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "orders.json");

const PRICE_LIST = {
  Shirt: 50,
  Pants: 70,
  Saree: 120,
  TShirt: 40,
  Blazer: 150,
  Kurta: 90,
};

const VALID_STATUSES = ["RECEIVED", "PROCESSING", "READY", "DELIVERED"];

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch (_error) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

async function readOrders() {
  await ensureDataFile();
  const content = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(content);
}

async function writeOrders(orders) {
  await fs.writeFile(DATA_FILE, JSON.stringify(orders, null, 2), "utf8");
}

function generateOrderId() {
  const randomSegment = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${Date.now()}-${randomSegment}`;
}

function toISODate(dateObj) {
  return new Date(dateObj).toISOString().slice(0, 10);
}

function calculateGarments(garments = []) {
  if (!Array.isArray(garments) || garments.length === 0) {
    throw new Error("At least one garment is required");
  }

  return garments.map((item) => {
    const garmentType = String(item.type || "").trim();
    const quantity = Number(item.quantity);

    if (!PRICE_LIST[garmentType]) {
      throw new Error(`Unsupported garment type: ${garmentType || "Unknown"}`);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Quantity must be a positive integer");
    }

    const unitPrice = PRICE_LIST[garmentType];
    const subtotal = quantity * unitPrice;

    return {
      type: garmentType,
      quantity,
      unitPrice,
      subtotal,
    };
  });
}

function normalizeStatus(status) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!VALID_STATUSES.includes(normalized)) {
    throw new Error(`Status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  return normalized;
}

function normalizePhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) {
    throw new Error("Phone number is required");
  }
  return raw;
}

async function createOrder(payload = {}) {
  const customerName = String(payload.customerName || "").trim();
  const phone = normalizePhone(payload.phone);

  if (!customerName) {
    throw new Error("Customer name is required");
  }

  const garments = calculateGarments(payload.garments);
  const totalBill = garments.reduce((sum, item) => sum + item.subtotal, 0);

  const defaultDelivery = new Date();
  defaultDelivery.setDate(defaultDelivery.getDate() + 3);

  const estimatedDeliveryDate = payload.estimatedDeliveryDate
    ? toISODate(payload.estimatedDeliveryDate)
    : toISODate(defaultDelivery);

  const now = new Date().toISOString();

  const order = {
    id: generateOrderId(),
    customerName,
    phone,
    garments,
    totalBill,
    status: "RECEIVED",
    estimatedDeliveryDate,
    createdAt: now,
    updatedAt: now,
  };

  const orders = await readOrders();
  orders.unshift(order);
  await writeOrders(orders);

  return order;
}

async function getOrders(filters = {}) {
  const orders = await readOrders();
  const searchName = String(filters.customerName || "").trim().toLowerCase();
  const searchPhone = String(filters.phone || "").trim().toLowerCase();
  const status = String(filters.status || "").trim().toUpperCase();

  return orders.filter((order) => {
    const matchesName = searchName
      ? order.customerName.toLowerCase().includes(searchName)
      : true;

    const matchesPhone = searchPhone
      ? order.phone.toLowerCase().includes(searchPhone)
      : true;

    const matchesStatus = status ? order.status === status : true;

    return matchesName && matchesPhone && matchesStatus;
  });
}

async function updateOrderStatus(id, status) {
  const normalizedStatus = normalizeStatus(status);
  const orders = await readOrders();
  const targetIndex = orders.findIndex((order) => order.id === id);

  if (targetIndex === -1) {
    throw new Error("Order not found");
  }

  orders[targetIndex].status = normalizedStatus;
  orders[targetIndex].updatedAt = new Date().toISOString();

  await writeOrders(orders);
  return orders[targetIndex];
}

async function getDashboard() {
  const orders = await readOrders();

  const totals = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + Number(order.totalBill || 0), 0),
    byStatus: {
      RECEIVED: 0,
      PROCESSING: 0,
      READY: 0,
      DELIVERED: 0,
    },
  };

  orders.forEach((order) => {
    if (totals.byStatus[order.status] !== undefined) {
      totals.byStatus[order.status] += 1;
    }
  });

  return totals;
}

module.exports = {
  PRICE_LIST,
  VALID_STATUSES,
  createOrder,
  getOrders,
  updateOrderStatus,
  getDashboard,
};
