const fs = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");

const DATA_FILE = path.join(__dirname, "..", "data", "orders.json");
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "laundryflow";
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || "orders";

let mongoClient;
let mongoCollection;

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

async function getMongoCollection() {
  if (!MONGODB_URI) {
    return null;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10,
      });
      await mongoClient.connect();
    }

    const db = mongoClient.db(MONGODB_DB_NAME);
    await db.command({ ping: 1 });

    if (!mongoCollection) {
      mongoCollection = db.collection(MONGODB_COLLECTION);
      await mongoCollection.createIndex({ id: 1 }, { unique: true });
      await mongoCollection.createIndex({ customerName: 1 });
      await mongoCollection.createIndex({ phone: 1 });
      await mongoCollection.createIndex({ status: 1 });
      await mongoCollection.createIndex({ createdAt: -1 });
    }

    return mongoCollection;
  } catch (error) {
    console.error("MongoDB unavailable, using JSON fallback:", error.message);
    mongoCollection = null;

    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (_closeError) {
        // Ignore close errors during recovery.
      }
      mongoClient = null;
    }

    return null;
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

  const collection = await getMongoCollection();
  if (collection) {
    await collection.insertOne(order);
  } else {
    const orders = await readOrders();
    orders.unshift(order);
    await writeOrders(orders);
  }

  return order;
}

async function getOrders(filters = {}) {
  const collection = await getMongoCollection();
  const searchName = String(filters.customerName || "").trim().toLowerCase();
  const searchPhone = String(filters.phone || "").trim().toLowerCase();
  const status = String(filters.status || "").trim().toUpperCase();

  if (collection) {
    const query = {};

    if (searchName) {
      query.customerName = { $regex: searchName, $options: "i" };
    }

    if (searchPhone) {
      query.phone = { $regex: searchPhone, $options: "i" };
    }

    if (status) {
      query.status = status;
    }

    return collection.find(query).sort({ createdAt: -1 }).toArray();
  }

  const orders = await readOrders();

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
  const collection = await getMongoCollection();

  if (collection) {
    const updateResult = await collection.updateOne(
      { id },
      {
        $set: {
          status: normalizedStatus,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (!updateResult.matchedCount) {
      throw new Error("Order not found");
    }

    return collection.findOne({ id });
  }

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
  const orders = await getOrders({});

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

async function getStorageMode() {
  const collection = await getMongoCollection();
  return collection ? "mongodb" : "json-fallback";
}

module.exports = {
  PRICE_LIST,
  VALID_STATUSES,
  createOrder,
  getOrders,
  updateOrderStatus,
  getDashboard,
  getStorageMode,
};
