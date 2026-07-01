const API = "https://shopkart-backend-s7ie.onrender.com/api";
let mode = "login";
let token = localStorage.getItem("token");
let user = null;

try {
  user = JSON.parse(localStorage.getItem("user") || "null");
} catch {
  localStorage.removeItem("user");
  user = null;
}

let products = [];
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

const $ = (id) => document.getElementById(id);

const imageMap = {
  "School Backpack": "images/bag.png",
  "Skybags Backpack": "images/bag.png",
  "Bag": "images/bag.png",

  "Wireless Headphones": "images/headphones.png",
  "Boat Rockerz Wireless Headphones": "images/headphones.png",
  "Gaming Headset": "images/headphones.png",

  "Smart Watch": "images/watch.png",
  "Noise Smart Watch": "images/watch.png",

  "Running Shoes": "images/shoes.png",
  "Campus Running Shoes": "images/shoes.png",

  "Full HD Monitor": "images/monitor.png",
  "HP Full HD Monitor": "images/monitor.png",

  "Badminton Racket": "images/racket.png",
  "Yonex Badminton Racket": "images/racket.png",

  "Study Table Lamp": "images/lamp.png",
  "Wipro Study Table Lamp": "images/lamp.png",

  "Gaming Keyboard": "images/keyboard.png",
  "Zebronics Gaming Keyboard": "images/keyboard.png"
};

function imageSrc(p) {
  return imageMap[p.name] || p.image || "assets/placeholder.svg";
}

function setMode(newMode) {
  mode = newMode;

  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");

  $("name").classList.toggle("hidden", mode === "login");
  $("authBtn").textContent = mode === "login" ? "Login" : "Create Account";
  $("authTitle").textContent = mode === "login" ? "Welcome Back" : "Create Account";
  $("authMsg").textContent = "";
}

async function handleAuth(e) {
  e.preventDefault();

  const body = {
    email: $("email").value.trim(),
    password: $("password").value.trim()
  };

  if (mode === "register") {
    body.name = $("name").value.trim();
    if (!body.name) {
      $("authMsg").textContent = "Please enter full name";
      return;
    }
  }

  try {
    $("authMsg").textContent = "Please wait...";

    const res = await fetch(`${API}/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Login/Register failed");

    token = data.token;
    user = data.user;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    startApp();
  } catch (err) {
    $("authMsg").textContent = err.message;
  }
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

function money(n) {
  return Number(n || 0).toLocaleString("en-IN");
}

async function startApp() {
  if (!token) {
    $("authPage").classList.remove("hidden");
    $("appPage").classList.add("hidden");
    return;
  }

  $("authPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");

  updateCart();
  await loadProducts();
}

function logout() {
  localStorage.clear();
  location.reload();
}

async function loadProducts() {
  try {
    const q = $("searchInput").value.trim();
    const category = $("categoryFilter").value;

    const res = await fetch(`${API}/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`, {
      headers: authHeaders()
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Products not loading");

    products = data;
    console.log("Products from backend:", products);

    renderCategories();
    renderProducts();
  } catch (err) {
    $("msg").textContent = err.message;
  }
}

function renderCategories() {
  const current = $("categoryFilter").value;
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))];

  $("categoryFilter").innerHTML =
    `<option value="">All Categories</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join("");

  $("categoryFilter").value = current;
}

function renderProducts() {
  $("products").innerHTML = products.map(p => `
    <div class="card">
      <img src="${imageSrc(p)}" onerror="this.src='assets/placeholder.svg'" alt="${p.name}">
      <h3>${p.name}</h3>
      <p class="brand">${p.brand || "ShopKart"} • ⭐ ${p.rating || 4.5}</p>
      <div>
        <span class="price">₹${money(p.price)}</span>
        <span class="old">₹${money(p.old_price)}</span>
      </div>
      <p class="stock">${Number(p.stock) > 0 ? "In stock" : "Out of stock"}</p>
      <div class="actions">
        <button onclick="addToCart('${p.id}')">Add Cart</button>
        <button onclick="viewDetails('${p.id}')">Details</button>
      </div>
    </div>
  `).join("");
}

function addToCart(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;

  const item = cart.find(x => String(x.id) === String(id));

  if (item) {
    item.qty++;
    item.image = imageSrc(p);
  } else {
    cart.push({
      id: p.id,
      name: p.name,
      price: p.price,
      image: imageSrc(p),
      qty: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCart();

  $("msg").textContent = "Product added to cart";
}

function changeQty(id, diff) {
  const item = cart.find(x => String(x.id) === String(id));
  if (!item) return;

  item.qty += diff;

  if (item.qty <= 0) {
    cart = cart.filter(x => String(x.id) !== String(id));
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCart();
}

function updateCart() {
  $("cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);

  $("cartTotal").textContent = money(
    cart.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0)
  );

  $("cartItems").innerHTML = cart.length
    ? cart.map(i => `
      <div class="cart-row">
        <img src="${i.image || "assets/placeholder.svg"}" onerror="this.src='assets/placeholder.svg'" alt="${i.name}">
        <div>
          <b>${i.name}</b><br>
          ₹${money(i.price)}
        </div>
        <div class="qty">
          <button onclick="changeQty('${i.id}', -1)">-</button>
          <b>${i.qty}</b>
          <button onclick="changeQty('${i.id}', 1)">+</button>
        </div>
      </div>
    `).join("")
    : "<p>Your cart is empty</p>";
}

function toggleCart() {
  $("cartPanel").classList.toggle("open");
}

function viewDetails(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;

  $("detailsView").innerHTML = `
    <div class="details">
      <img src="${imageSrc(p)}" onerror="this.src='assets/placeholder.svg'" alt="${p.name}">
      <div>
        <h1>${p.name}</h1>
        <p>${p.brand || "ShopKart"} • ${p.category || "Product"}</p>
        <h2 class="price">₹${money(p.price)}</h2>
        <p>${p.description || "Best quality product from ShopKart India."}</p>
        <p>Stock: ${p.stock || 0}</p>
        <button class="primary" onclick="addToCart('${p.id}')">Add to Cart</button>
        <br><br>
        <button onclick="showView('home')">Back</button>
      </div>
    </div>
  `;

  showView("details");
}

function showView(view) {
  $("homeView").classList.toggle("hidden", view !== "home");
  $("detailsView").classList.toggle("hidden", view !== "details");
  $("ordersView").classList.toggle("hidden", view !== "orders");

  if (view === "orders") loadOrders();
}

async function placeOrder() {
  const address = $("address").value.trim();
  const phone = $("phone").value.trim();

  if (!address || !phone) {
    $("msg").textContent = "Enter address and phone number";
    return;
  }

  if (cart.length === 0) {
    $("msg").textContent = "Cart is empty";
    return;
  }

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ items: cart, address, phone })
  });

  const data = await res.json();

  if (!res.ok) {
    $("msg").textContent = data.message || "Order failed";
    return;
  }

  cart = [];
  localStorage.setItem("cart", "[]");
  updateCart();

  $("address").value = "";
  $("phone").value = "";

  toggleCart();
  showView("orders");
}

async function loadOrders() {
  const res = await fetch(`${API}/orders/my`, {
    headers: authHeaders()
  });

  const orders = await res.json();

  $("ordersList").innerHTML = orders.length
    ? orders.map(o => `
      <div class="order">
        <h3>Order #${String(o.id).slice(0, 8)}</h3>
        <p>Status: <b>${o.status || "Placed"}</b></p>
        <p>Total: ₹${money(o.total)}</p>
        <p>${o.address}</p>
      </div>
    `).join("")
    : `<p class="order">No orders yet</p>`;
}

document.addEventListener("DOMContentLoaded", () => {
  $("loginTab").onclick = () => setMode("login");
  $("registerTab").onclick = () => setMode("register");
  $("authForm").onsubmit = handleAuth;

  $("searchInput").oninput = loadProducts;
  $("categoryFilter").onchange = loadProducts;

  setMode("login");
  startApp();
});