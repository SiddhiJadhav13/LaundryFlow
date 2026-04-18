const API_BASE = "/api";

const PRICE_LIST = {
  Shirt: 50,
  Pants: 70,
  Saree: 120,
  TShirt: 40,
  Blazer: 150,
  Kurta: 90,
};

const VALID_STATUSES = ["RECEIVED", "PROCESSING", "READY", "DELIVERED"];

const THEME_PREF_KEY = "laundry-theme-preference";
const ROLE_PREF_KEY = "laundry-role-preference";
const SIDEBAR_COLLAPSED_KEY = "laundry-sidebar-collapsed";
const MENU_VIEW_KEY = "laundry-menu-view";

const orderForm = document.getElementById("orderForm");
const garmentsContainer = document.getElementById("garmentsContainer");
const addGarmentBtn = document.getElementById("addGarmentBtn");
const formTotal = document.getElementById("formTotal");
const alertArea = document.getElementById("alertArea");
const ordersTableBody = document.getElementById("ordersTableBody");
const ordersCountBadge = document.getElementById("ordersCountBadge");
const filterStatus = document.getElementById("filterStatus");
const searchName = document.getElementById("searchName");
const searchPhone = document.getElementById("searchPhone");
const sidebarTotalOrders = document.getElementById("sidebarTotalOrders");
const sidebarLinks = Array.from(document.querySelectorAll(".sidebar-link"));
const sidebarToggle = document.getElementById("sidebarToggle");

const themeButtons = Array.from(document.querySelectorAll(".theme-option"));
const roleButtons = Array.from(document.querySelectorAll(".role-option"));
const quickFilterButtons = Array.from(document.querySelectorAll(".quick-filter"));

const cardTotalOrders = document.getElementById("cardTotalOrders");
const cardTotalRevenue = document.getElementById("cardTotalRevenue");
const adminPendingOrders = document.getElementById("adminPendingOrders");
const adminDeliveredOrders = document.getElementById("adminDeliveredOrders");
const adminAverageOrderValue = document.getElementById("adminAverageOrderValue");
const adminTodayOrders = document.getElementById("adminTodayOrders");
const recentOrdersCount = document.getElementById("recentOrdersCount");
const recentOrdersBody = document.getElementById("recentOrdersBody");

const systemDarkMode = window.matchMedia("(prefers-color-scheme: dark)");
const mobileCompactQuery = window.matchMedia("(max-width: 767.98px)");

let chartRefs = {
  dailyRevenue: null,
  weeklyRevenue: null,
  orderTrend: null,
  statusPie: null,
};

let appState = {
  role: localStorage.getItem(ROLE_PREF_KEY) || "admin",
  themePreference: localStorage.getItem(THEME_PREF_KEY),
  currentTheme: "light",
  sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  currentMenuView: localStorage.getItem(MENU_VIEW_KEY) || "dashboard",
  allOrdersCache: [],
};

const VIEW_SECTION_MAP = {
  dashboard: ["dashboardCards", "adminCharts"],
  "create-order": ["createOrderSection"],
  "search-filters": ["searchFilterSection"],
  "order-status": ["ordersSection"],
  "total-orders": ["ordersSection"],
  "recent-orders": ["recentOrdersSection"],
};

const MANAGED_SECTION_IDS = [
  "dashboardCards",
  "adminCharts",
  "recentOrdersSection",
  "createOrderSection",
  "searchFilterSection",
  "ordersSection",
];

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;
}

function showAlert(message, type = "success") {
  alertArea.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;
}

function statusBadgeClass(status) {
  if (status === "RECEIVED") return "text-bg-secondary";
  if (status === "PROCESSING") return "text-bg-warning";
  if (status === "READY") return "text-bg-info";
  return "text-bg-success";
}

function getSystemTheme() {
  return systemDarkMode.matches ? "dark" : "light";
}

function applyTheme(themePreference, persist = true) {
  const resolvedTheme = themePreference || getSystemTheme();
  appState.themePreference = themePreference;
  appState.currentTheme = resolvedTheme;

  document.documentElement.setAttribute("data-bs-theme", resolvedTheme);

  if (persist) {
    if (themePreference) {
      localStorage.setItem(THEME_PREF_KEY, themePreference);
    } else {
      localStorage.removeItem(THEME_PREF_KEY);
    }
  }

  themeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === resolvedTheme);
  });

  refreshCharts(appState.allOrdersCache);
}

function applyRole(role) {
  appState.role = role;
  localStorage.setItem(ROLE_PREF_KEY, role);

  document.body.classList.toggle("role-staff", role === "staff");
  roleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.role === role);
  });

  updateSensitiveCellsVisibility();
  updateSidebarRoleVisibility();

  // If current menu view is not allowed for this role, move to a safe default.
  if (!isViewAllowedForRole(appState.currentMenuView, role)) {
    setMenuView(getDefaultViewForRole(role));
  } else {
    setMenuView(appState.currentMenuView);
  }
}

function updateSidebarRoleVisibility() {
  sidebarLinks.forEach((link) => {
    const requiresRole = link.getAttribute("data-role-visible");
    const shouldHide = requiresRole === "admin" && appState.role === "staff";
    link.classList.toggle("d-none", shouldHide);
  });
}

function getDefaultViewForRole(role) {
  return role === "staff" ? "order-status" : "dashboard";
}

function isViewAllowedForRole(viewKey, role) {
  const link = sidebarLinks.find((item) => item.dataset.view === viewKey);
  if (!link) {
    return false;
  }
  const requiredRole = link.getAttribute("data-role-visible");
  return !(requiredRole === "admin" && role === "staff");
}

function applyMobileCompactMode() {
  document.body.classList.toggle("mobile-compact", mobileCompactQuery.matches);
}

function applySidebarCollapsedState(isCollapsed) {
  appState.sidebarCollapsed = isCollapsed;
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));

  document.body.classList.toggle("sidebar-collapsed", isCollapsed);

  if (sidebarToggle) {
    sidebarToggle.setAttribute("aria-label", isCollapsed ? "Expand navigation menu" : "Collapse navigation menu");
  }
}

function initializeSidebarToggle() {
  if (!sidebarToggle) {
    return;
  }

  const toggleHandler = () => {
    applySidebarCollapsedState(!appState.sidebarCollapsed);
  };

  sidebarToggle.addEventListener("click", toggleHandler);

  applySidebarCollapsedState(appState.sidebarCollapsed);
}

function createGarmentRow(type = "Shirt", quantity = 1) {
  const row = document.createElement("div");
  row.className = "garment-row";

  row.innerHTML = `
    <select class="form-select garment-type">
      ${Object.keys(PRICE_LIST)
        .map(
          (garment) =>
            `<option value="${garment}" ${garment === type ? "selected" : ""}>${garment} (Rs. ${PRICE_LIST[garment]})</option>`
        )
        .join("")}
    </select>
    <input type="text" class="form-control garment-price" readonly />
    <input type="number" min="1" value="${quantity}" class="form-control garment-quantity" />
    <button type="button" class="btn btn-outline-danger remove-garment">Remove</button>
  `;

  garmentsContainer.appendChild(row);
  updateGarmentRowPrice(row);
}

function updateGarmentRowPrice(row) {
  const garmentType = row.querySelector(".garment-type").value;
  const priceInput = row.querySelector(".garment-price");
  priceInput.value = `Price: ${formatCurrency(PRICE_LIST[garmentType])}`;
}

function getGarmentsFromForm() {
  const rows = Array.from(document.querySelectorAll(".garment-row"));
  return rows
    .map((row) => {
      const type = row.querySelector(".garment-type").value;
      const quantity = Number(row.querySelector(".garment-quantity").value);
      return { type, quantity };
    })
    .filter((item) => item.quantity > 0);
}

function recalculateFormTotal() {
  const garments = getGarmentsFromForm();
  const total = garments.reduce((sum, item) => sum + PRICE_LIST[item.type] * item.quantity, 0);
  formTotal.textContent = formatCurrency(total);
}

function updateSensitiveCellsVisibility() {
  const rows = Array.from(ordersTableBody.querySelectorAll("tr"));
  rows.forEach((row) => {
    const totalCell = row.querySelector("td[data-cell='total']");
    if (totalCell) {
      totalCell.classList.toggle("sensitive-col", appState.role === "staff");
    }
  });
}

function renderOrders(orders) {
  ordersCountBadge.textContent = String(orders.length);

  if (!orders.length) {
    ordersTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-4 text-secondary">No orders found.</td>
      </tr>
    `;
    return;
  }

  ordersTableBody.innerHTML = orders
    .map((order) => {
      const garmentsText = order.garments
        .map((item) => `${item.type} x${item.quantity}`)
        .join(", ");

      const totalClass = appState.role === "staff" ? "sensitive-col" : "";

      return `
        <tr>
          <td class="fw-semibold">${order.id}</td>
          <td>${order.customerName}</td>
          <td>${order.phone}</td>
          <td>${garmentsText}</td>
          <td class="${totalClass}" data-cell="total">${formatCurrency(order.totalBill)}</td>
          <td><span class="badge ${statusBadgeClass(order.status)}">${order.status}</span></td>
          <td>${order.estimatedDeliveryDate}</td>
          <td>
            <div class="d-flex gap-2">
              <select class="form-select form-select-sm status-select" data-id="${order.id}">
                ${VALID_STATUSES.map(
                  (status) =>
                    `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`
                ).join("")}
              </select>
              <button class="btn btn-sm btn-outline-primary update-status" data-id="${order.id}">Save</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  updateSensitiveCellsVisibility();
}

function renderRecentOrders(orders) {
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  recentOrdersCount.textContent = String(recentOrders.length);

  if (!recentOrders.length) {
    recentOrdersBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-secondary">No recent orders.</td>
      </tr>
    `;
    return;
  }

  recentOrdersBody.innerHTML = recentOrders
    .map((order) => {
      const createdDate = new Date(order.createdAt).toLocaleDateString("en-IN");
      return `
        <tr>
          <td>${order.id}</td>
          <td>${order.customerName}</td>
          <td>${order.phone}</td>
          <td>${formatCurrency(order.totalBill)}</td>
          <td><span class="badge ${statusBadgeClass(order.status)}">${order.status}</span></td>
          <td>${createdDate}</td>
        </tr>
      `;
    })
    .join("");
}

function getDateLabel(dateInput) {
  const date = new Date(dateInput);
  return date.toISOString().slice(0, 10);
}

function getWeekLabel(dateInput) {
  const date = new Date(dateInput);
  const start = new Date(date);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(date.getDate() + offset);
  return start.toISOString().slice(0, 10);
}

function getLastDaysLabels(daysCount) {
  const labels = [];
  for (let index = daysCount - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    labels.push(date.toISOString().slice(0, 10));
  }
  return labels;
}

function getLastWeeksLabels(weeksCount) {
  const labels = [];
  for (let index = weeksCount - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index * 7);
    labels.push(getWeekLabel(date));
  }
  return labels;
}

function aggregateAdminMetrics(orders) {
  const totals = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, order) => sum + Number(order.totalBill || 0), 0),
    pendingOrders: 0,
    deliveredOrders: 0,
    todayOrders: 0,
    byStatus: {
      RECEIVED: 0,
      PROCESSING: 0,
      READY: 0,
      DELIVERED: 0,
    },
  };

  const todayKey = new Date().toISOString().slice(0, 10);

  orders.forEach((order) => {
    totals.byStatus[order.status] = (totals.byStatus[order.status] || 0) + 1;
    if (order.status === "DELIVERED") {
      totals.deliveredOrders += 1;
    } else {
      totals.pendingOrders += 1;
    }
    if (getDateLabel(order.createdAt) === todayKey) {
      totals.todayOrders += 1;
    }
  });

  totals.averageOrderValue = totals.totalOrders ? totals.totalRevenue / totals.totalOrders : 0;
  return totals;
}

function updateMetrics(orders) {
  const totals = aggregateAdminMetrics(orders);

  cardTotalOrders.textContent = totals.totalOrders;
  cardTotalRevenue.textContent = formatCurrency(totals.totalRevenue);
  adminPendingOrders.textContent = totals.pendingOrders;
  adminDeliveredOrders.textContent = totals.deliveredOrders;
  adminAverageOrderValue.textContent = formatCurrency(totals.averageOrderValue);
  adminTodayOrders.textContent = totals.todayOrders;
}

function chartTextColor() {
  return appState.currentTheme === "dark" ? "#dbe5f4" : "#334155";
}

function chartGridColor() {
  return appState.currentTheme === "dark" ? "rgba(148,163,184,0.22)" : "rgba(148,163,184,0.28)";
}

function destroyCharts() {
  Object.keys(chartRefs).forEach((key) => {
    if (chartRefs[key]) {
      chartRefs[key].destroy();
      chartRefs[key] = null;
    }
  });
}

function refreshCharts(orders) {
  if (typeof Chart === "undefined") {
    return;
  }

  destroyCharts();

  const textColor = chartTextColor();
  const gridColor = chartGridColor();

  const dailyLabels = getLastDaysLabels(7);
  const dailyRevenueMap = {};
  const dailyOrdersMap = {};

  dailyLabels.forEach((label) => {
    dailyRevenueMap[label] = 0;
    dailyOrdersMap[label] = 0;
  });

  orders.forEach((order) => {
    const dayKey = getDateLabel(order.createdAt);
    if (dailyRevenueMap[dayKey] !== undefined) {
      dailyRevenueMap[dayKey] += Number(order.totalBill || 0);
      dailyOrdersMap[dayKey] += 1;
    }
  });

  const weeklyLabels = getLastWeeksLabels(6);
  const weeklyRevenueMap = {};
  weeklyLabels.forEach((label) => {
    weeklyRevenueMap[label] = 0;
  });

  orders.forEach((order) => {
    const weekKey = getWeekLabel(order.createdAt);
    if (weeklyRevenueMap[weekKey] !== undefined) {
      weeklyRevenueMap[weekKey] += Number(order.totalBill || 0);
    }
  });

  const statusData = aggregateAdminMetrics(orders).byStatus;

  chartRefs.dailyRevenue = new Chart(document.getElementById("dailyRevenueChart"), {
    type: "bar",
    data: {
      labels: dailyLabels,
      datasets: [
        {
          label: "Revenue",
          data: dailyLabels.map((label) => dailyRevenueMap[label]),
          borderRadius: 8,
          backgroundColor: "rgba(37, 99, 235, 0.72)",
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
    },
  });

  chartRefs.weeklyRevenue = new Chart(document.getElementById("weeklyRevenueChart"), {
    type: "line",
    data: {
      labels: weeklyLabels,
      datasets: [
        {
          label: "Weekly Revenue",
          data: weeklyLabels.map((label) => weeklyRevenueMap[label]),
          borderColor: "rgba(14, 165, 233, 0.95)",
          backgroundColor: "rgba(14, 165, 233, 0.2)",
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
    },
  });

  chartRefs.orderTrend = new Chart(document.getElementById("orderTrendChart"), {
    type: "line",
    data: {
      labels: dailyLabels,
      datasets: [
        {
          label: "Orders",
          data: dailyLabels.map((label) => dailyOrdersMap[label]),
          borderColor: "rgba(99, 102, 241, 0.95)",
          backgroundColor: "rgba(99, 102, 241, 0.2)",
          fill: true,
          tension: 0.35,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
    },
  });

  chartRefs.statusPie = new Chart(document.getElementById("statusPieChart"), {
    type: "pie",
    data: {
      labels: VALID_STATUSES,
      datasets: [
        {
          data: VALID_STATUSES.map((status) => statusData[status] || 0),
          backgroundColor: [
            "rgba(148, 163, 184, 0.8)",
            "rgba(245, 158, 11, 0.85)",
            "rgba(56, 189, 248, 0.85)",
            "rgba(34, 197, 94, 0.85)",
          ],
          borderColor: appState.currentTheme === "dark" ? "#0f172a" : "#f8fafc",
          borderWidth: 2,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor } },
      },
    },
  });
}

async function fetchAllOrders() {
  const response = await fetch(`${API_BASE}/orders`);
  if (!response.ok) {
    throw new Error("Unable to fetch orders");
  }
  return response.json();
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (searchName.value.trim()) params.append("customerName", searchName.value.trim());
  if (searchPhone.value.trim()) params.append("phone", searchPhone.value.trim());
  if (filterStatus.value) params.append("status", filterStatus.value);

  const query = params.toString() ? `?${params.toString()}` : "";

  try {
    const [filteredOrders, allOrders] = await Promise.all([
      fetch(`${API_BASE}/orders${query}`).then((response) => response.json()),
      fetchAllOrders(),
    ]);

    appState.allOrdersCache = allOrders;
    sidebarTotalOrders.textContent = String(allOrders.length);
    renderOrders(filteredOrders);
    renderRecentOrders(allOrders);
    updateMetrics(allOrders);
    refreshCharts(allOrders);
  } catch (_error) {
    showAlert("Unable to load orders", "danger");
  }
}

function setActiveSidebarLinkBySection(sectionId) {
  sidebarLinks.forEach((link) => {
    const isMatch = link.getAttribute("href") === `#${sectionId}`;
    link.classList.toggle("active", isMatch);
  });
}

function initializeSidebarNavigation() {
  sidebarLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const viewKey = link.dataset.view;
      if (!viewKey) {
        return;
      }

      event.preventDefault();
      setMenuView(viewKey);
    });
  });

  const initialView = isViewAllowedForRole(appState.currentMenuView, appState.role)
    ? appState.currentMenuView
    : getDefaultViewForRole(appState.role);
  setMenuView(initialView);
}

function setMenuView(viewKey) {
  if (!VIEW_SECTION_MAP[viewKey]) {
    return;
  }

  if (!isViewAllowedForRole(viewKey, appState.role)) {
    return;
  }

  appState.currentMenuView = viewKey;
  localStorage.setItem(MENU_VIEW_KEY, viewKey);

  MANAGED_SECTION_IDS.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    const shouldShow = VIEW_SECTION_MAP[viewKey].includes(sectionId);
    section.classList.toggle("d-none", !shouldShow);
  });

  sidebarLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewKey);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function createOrder(event) {
  event.preventDefault();

  const garments = getGarmentsFromForm();
  if (!garments.length) {
    showAlert("Please add at least one garment with quantity.", "warning");
    return;
  }

  const payload = {
    customerName: document.getElementById("customerName").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    garments,
    estimatedDeliveryDate: document.getElementById("estimatedDeliveryDate").value || undefined,
  };

  try {
    const response = await fetch(`${API_BASE}/orders/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to create order");
    }

    showAlert(`Order created successfully. Order ID: ${data.id}`);
    orderForm.reset();
    garmentsContainer.innerHTML = "";
    createGarmentRow();

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    document.getElementById("estimatedDeliveryDate").value = defaultDate.toISOString().slice(0, 10);

    recalculateFormTotal();
    await loadOrders();
  } catch (error) {
    showAlert(error.message, "danger");
  }
}

async function updateStatus(orderId, newStatus) {
  try {
    const response = await fetch(`${API_BASE}/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to update status");
    }

    showAlert(`Order ${orderId} updated to ${newStatus}`);
    await loadOrders();
  } catch (error) {
    showAlert(error.message, "danger");
  }
}

function initializeDefaults() {
  createGarmentRow();
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 3);
  document.getElementById("estimatedDeliveryDate").value = defaultDate.toISOString().slice(0, 10);
  recalculateFormTotal();
}

orderForm.addEventListener("submit", createOrder);

addGarmentBtn.addEventListener("click", () => {
  createGarmentRow();
  recalculateFormTotal();
});

garmentsContainer.addEventListener("input", (event) => {
  if (event.target.classList.contains("garment-quantity")) {
    recalculateFormTotal();
  }
});

garmentsContainer.addEventListener("change", (event) => {
  if (event.target.classList.contains("garment-type")) {
    updateGarmentRowPrice(event.target.closest(".garment-row"));
    recalculateFormTotal();
  }
});

garmentsContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("remove-garment")) {
    event.target.closest(".garment-row").remove();
    recalculateFormTotal();
  }
});

ordersTableBody.addEventListener("click", (event) => {
  if (!event.target.classList.contains("update-status")) {
    return;
  }

  const orderId = event.target.dataset.id;
  const selectElement = document.querySelector(`.status-select[data-id="${orderId}"]`);
  updateStatus(orderId, selectElement.value);
});

let searchDebounceTimer;
function debounceLoadOrders() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(loadOrders, 300);
}

function syncQuickFilterButtons(statusValue) {
  quickFilterButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.status === statusValue);
  });
}

filterStatus.addEventListener("change", () => {
  syncQuickFilterButtons(filterStatus.value);
  loadOrders();
});
searchName.addEventListener("input", debounceLoadOrders);
searchPhone.addEventListener("input", debounceLoadOrders);

quickFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterStatus.value = button.dataset.status;
    syncQuickFilterButtons(button.dataset.status);
    loadOrders();
  });
});

themeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
  });
});

roleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyRole(button.dataset.role);
  });
});

if (systemDarkMode.addEventListener) {
  systemDarkMode.addEventListener("change", () => {
    if (!appState.themePreference) {
      applyTheme(null, false);
    }
  });
}

if (mobileCompactQuery.addEventListener) {
  mobileCompactQuery.addEventListener("change", applyMobileCompactMode);
}

if (appState.themePreference === "auto") {
  localStorage.removeItem(THEME_PREF_KEY);
  appState.themePreference = null;
}

applyTheme(appState.themePreference || null, false);
applyRole(appState.role);
applyMobileCompactMode();
initializeSidebarToggle();
initializeSidebarNavigation();
syncQuickFilterButtons(filterStatus.value);
initializeDefaults();
loadOrders();
