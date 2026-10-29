
const form = document.getElementById("expenseForm");
const itemNameInput = document.getElementById("itemName");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const totalBalance = document.getElementById("totalBalance");
const transactionList = document.getElementById("transactionList");
const canvas = document.getElementById("expenseChart");
const chartLegend = document.getElementById("chartLegend");

const STORAGE_KEY = "expenseVisualizerTransactions";
const COLORS = {
  Food: "#F4A6C1",
  Transport: "#91C9ED",
  Fun: "#F5D77B"
};

let transactions = loadTransactions();
let sortNewestFirst = true;

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];

    return saved.filter((item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Number.isFinite(item.amount) &&
      item.amount > 0 &&
      ["Food", "Transport", "Fun"].includes(item.category) &&
      typeof item.date === "string"
    );
  } catch {
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch {
    alert("Your browser could not save the data. Please check your browser storage settings.");
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(amount);
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function renderTransactions() {
  const sorted = [...transactions].sort((a, b) => {
    return sortNewestFirst
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date);
  });

  if (sorted.length === 0) {
    transactionList.innerHTML =
      '<p class="empty-state">No transactions yet. Add your first expense!</p>';
    return;
  }

  transactionList.innerHTML = sorted.map((item) => `
    <article class="transaction-item">
      <div class="transaction-info">
        <strong>${escapeHTML(item.name)}</strong>
        <span class="transaction-category">${item.category} · ${formatDate(item.date)}</span>
      </div>
      <div class="transaction-right">
        <span class="transaction-amount">${formatCurrency(item.amount)}</span>
        <button class="delete-button" data-delete-id="${item.id}" type="button">
          Delete
        </button>
      </div>
    </article>
  `).join("");
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function updateTotal() {
  const total = transactions.reduce((sum, item) => sum + item.amount, 0);
  totalBalance.textContent = formatCurrency(total);
}

function drawPieChart() {
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);

  const totals = {
    Food: 0,
    Transport: 0,
    Fun: 0
  };

  transactions.forEach((item) => {
    totals[item.category] += item.amount;
  });

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.42;

  if (total === 0) {
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = "#E9E4F5";
    context.fill();

    context.fillStyle = "#77738A";
    context.font = "13px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("No spending yet", centerX, centerY);

    chartLegend.innerHTML = "";
    return;
  }

  let startAngle = -Math.PI / 2;

  Object.entries(totals).forEach(([category, amount]) => {
    if (amount === 0) return;

    const sliceAngle = (amount / total) * Math.PI * 2;

    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(
      centerX,
      centerY,
      radius,
      startAngle,
      startAngle + sliceAngle
    );
    context.closePath();
    context.fillStyle = COLORS[category];
    context.fill();

    startAngle += sliceAngle;
  });

  chartLegend.innerHTML = Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => `
      <span class="legend-item">
        <span class="legend-color" style="background:${COLORS[category]}"></span>
        ${category}: ${Math.round(amount / total * 100)}%
      </span>
    `).join("");
}

function renderApp() {
  renderTransactions();
  updateTotal();
  drawPieChart();
  renderMonthlySummary();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = itemNameInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;

  if (!name || !Number.isFinite(amount) || amount <= 0 ||
      !["Food", "Transport", "Fun"].includes(category)) {
    alert("Please enter a valid item name, positive amount, and category.");
    return;
  }

  transactions.push({
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    amount,
    category,
    date: new Date().toISOString()
  });

  saveTransactions();
  form.reset();
  renderApp();
});

transactionList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-id]");
  if (!button) return;

  transactions = transactions.filter(
    (item) => item.id !== button.dataset.deleteId
  );

  saveTransactions();
  renderApp();
});

function renderMonthlySummary() {
  let summary = document.getElementById("monthlySummary");

  if (!summary) {
    summary = document.createElement("section");
    summary.id = "monthlySummary";
    summary.className = "panel";
    summary.innerHTML = `
      <h2>Monthly Summary</h2>
      <p id="monthlyTotal"></p>
      <p id="monthlyCount"></p>
    `;

    const dashboard = document.querySelector(".dashboard");
    dashboard.appendChild(summary);
  }

  const now = new Date();
  const monthlyTransactions = transactions.filter((item) => {
    const date = new Date(item.date);
    return date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
  });

  const monthlyTotal = monthlyTransactions.reduce(
    (sum, item) => sum + item.amount, 0
  );

  summary.querySelector("#monthlyTotal").textContent =
    `This month: ${formatCurrency(monthlyTotal)}`;

  summary.querySelector("#monthlyCount").textContent =
    `Transactions: ${monthlyTransactions.length}`;
}

function addSortControl() {
  const heading = transactionList.parentElement.querySelector("h2");
  if (!heading || document.getElementById("sortTransactions")) return;

  const button = document.createElement("button");
  button.id = "sortTransactions";
  button.type = "button";
  button.className = "delete-button";
  button.textContent = "Sort: Newest first";
  button.style.marginBottom = "14px";

  heading.insertAdjacentElement("afterend", button);

  button.addEventListener("click", () => {
    sortNewestFirst = !sortNewestFirst;
    button.textContent = sortNewestFirst
      ? "Sort: Newest first"
      : "Sort: Oldest first";
    renderTransactions();
  });
}

function addThemeControl() {
  const header = document.querySelector(".header");
  if (document.getElementById("themeToggle")) return;

  const button = document.createElement("button");
  button.id = "themeToggle";
  button.type = "button";
  button.textContent = "🌙 Dark mode";
  button.style.cssText =
    "margin-top:18px;padding:9px 14px;border:1px solid #e9e4f5;border-radius:10px;background:white;color:#28243a;";

  header.appendChild(button);

  button.addEventListener("click", () => {
    const dark = document.body.classList.toggle("dark-mode");
    button.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
  });
}

function addDarkModeStyles() {
  if (document.getElementById("darkModeStyles")) return;

  const style = document.createElement("style");
  style.id = "darkModeStyles";
  style.textContent = `
    body.dark-mode {
      --background: #191727;
      --surface: #262338;
      --text: #f5f2ff;
      --muted: #c0b9d4;
      --border: #403953;
    }
    body.dark-mode #expenseForm input,
    body.dark-mode #expenseForm select {
      background: #302b43;
      color: #f5f2ff;
      border-color: #514766;
    }
    body.dark-mode .transaction-item {
      background: #302b43;
    }
  `;
  document.head.appendChild(style);
}

addSortControl();
addThemeControl();
addDarkModeStyles();
renderApp();

window.addEventListener("resize", drawPieChart);
