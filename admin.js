// ==================================================
//  Firebase Setup
// ==================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// ==================================================
//  Firebase Config
// ==================================================
const firebaseConfig = {
  apiKey: "AIzaSyBlZnGRWgYvz4pB8vBkODsrH67HT9XlWw0",
  authDomain: "haley-store.firebaseapp.com",
  projectId: "haley-store",
  storageBucket: "haley-store.appspot.com",
  messagingSenderId: "977097123673",
  appId: "1:977097123673:web:ad41af4bbcef4c1344ce48",
  measurementId: "G-2M1ZXGJNNP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================================================
//  UI Helpers (Toast, Confirm, Loader)
// ==================================================
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showConfirm(message, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "confirm-modal";
  modal.innerHTML = `
    <div class="confirm-box">
      <h3>Confirm Action</h3>
      <p>${message}</p>
      <div class="confirm-actions">
        <button class="confirm-btn cancel">Cancel</button>
        <button class="confirm-btn confirm">Confirm</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector(".cancel").onclick = () => modal.remove();
  modal.querySelector(".confirm").onclick = () => {
    modal.remove();
    onConfirm();
  };
}

function showLoader() {
  document.getElementById("loaderOverlay").style.display = "flex";
}
function hideLoader() {
  document.getElementById("loaderOverlay").style.display = "none";
}

// ==================================================
//  Admin UID
// ==================================================
const ADMIN_UID = "bghsPniP1xWZrJ8LNIhSM78UTBd2";
let currentArchivedView = false; // active vs archived

// ==================================================
//  Admin Login
// ==================================================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;
  const errorMsg = document.getElementById("loginError");

  showLoader();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (user.uid !== ADMIN_UID) {
      errorMsg.textContent = "Access denied. Not an admin.";
      await signOut(auth);
    }
  } catch (error) {
    errorMsg.textContent = "Login failed. Check your credentials.";
  } finally {
    hideLoader();
  }
});

// ==================================================
//  Auth State Listener
// ==================================================
onAuthStateChanged(auth, (user) => {
  if (user?.uid === ADMIN_UID) {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminDashboard").style.display = "block";
    loadProducts();
    loadOrders();
  }
});

// ==================================================
//  Logout
// ==================================================
document.getElementById("logoutBtn").addEventListener("click", () => {
  signOut(auth).then(() => location.reload());
});

// ==================================================
//  Add Product
// ==================================================
document.getElementById("addProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const product = {
    name: form.name.value,
    price: parseFloat(form.price.value),
    description: form.description.value,
    imageUrl: form.imageUrl.value,
    timestamp: serverTimestamp()
  };

  showLoader();
  try {
    const docRef = await addDoc(collection(db, "products"), product);
    form.reset();
    showToast(" Product added successfully!", "success");
    previewProduct(product, docRef.id);
  } catch {
    showToast(" Failed to add product.", "error");
  } finally {
    hideLoader();
  }
});

// ==================================================
//  Preview Product
// ==================================================
function previewProduct(product, productId) {
  const preview = document.getElementById("productPreview");
  const card = document.createElement("div");
  card.className = "product-card fade-in";
  card.innerHTML = `
    <div class="badge">New</div>
    <img src="${product.imageUrl}" alt="${product.name}" />
    <h3>${product.name}</h3>
    <p class="price">€${product.price.toFixed(2)}</p>
    <button class="delete-product" data-id="${productId}">Delete</button>
  `;
  preview.appendChild(card);
}

// ==================================================
//  Load & Delete Products
// ==================================================
async function loadProducts() {
  showLoader();
  try {
    const snapshot = await getDocs(collection(db, "products"));
    const preview = document.getElementById("productPreview");
    preview.innerHTML = "";

    snapshot.forEach((docSnap) => {
      previewProduct(docSnap.data(), docSnap.id);
    });

    document.querySelectorAll(".delete-product").forEach((btn) => {
      btn.addEventListener("click", () => {
        showConfirm("Delete this product?", async () => {
          showLoader();
          try {
            await deleteDoc(doc(db, "products", btn.dataset.id));
            showToast(" Product deleted.", "error");
            loadProducts();
          } catch {
            showToast(" Failed to delete product.", "error");
          } finally {
            hideLoader();
          }
        });
      });
    });
  } finally {
    hideLoader();
  }
}

// ==================================================
//  Load Orders
// ==================================================
async function loadOrders(filterUserId = "", filterDate = "", archivedView = currentArchivedView) {
  showLoader();
  try {
    const q = query(collection(db, "orders"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const tbody = document.querySelector("#ordersTable tbody");
    tbody.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const id = docSnap.id;
      const isArchived = !!order.archived;
      if (archivedView !== isArchived) return;

      const orderDate = order.timestamp?.seconds
        ? new Date(order.timestamp.seconds * 1000).toLocaleString()
        : "—";

      const customerInfo = `
        ${order.customer?.name || "—"}<br>
        ${order.customer?.email || "—"}<br>
        ${order.customer?.phone || "—"}<br>
        ${order.customer?.address || "—"}
      `;
      const itemsList = Array.isArray(order.items)
        ? order.items.map(i => `${i.name} (x${i.quantity}, Size: ${i.size}, Color: ${i.color || "default"})`).join("<br>")
        : "—";

      const total = parseFloat(order.total) || 0;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.userId || "—"}</td>
        <td>${customerInfo}</td>
        <td>${itemsList}</td>
        <td>€${total.toFixed(2)}</td>
        <td>${orderDate}</td>
        <td>
          <button class="action-btn btn-view" data-id="${id}">View</button>
          <button class="action-btn btn-archive" data-id="${id}" data-archived="${isArchived}">
            ${isArchived ? "Unarchive" : "Archive"}
          </button>
          <button class="action-btn btn-delete" data-id="${id}">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Actions
    tbody.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", () => {
        showConfirm("Delete this order permanently?", async () => {
          showLoader();
          try {
            await deleteDoc(doc(db, "orders", btn.dataset.id));
            showToast(" Order deleted.", "error");
            loadOrders("", "", archivedView);
          } catch {
            showToast(" Failed to delete order.", "error");
          } finally {
            hideLoader();
          }
        });
      });
    });

    tbody.querySelectorAll(".btn-archive").forEach(btn => {
      btn.addEventListener("click", async () => {
        showLoader();
        try {
          await updateDoc(doc(db, "orders", btn.dataset.id), {
            archived: btn.dataset.archived !== "true"
          });
          showToast(" Archive status updated.", "warning");
          loadOrders("", "", archivedView);
        } catch {
          showToast(" Failed to update archive.", "error");
        } finally {
          hideLoader();
        }
      });
    });


  } finally {
    hideLoader();
  }
}

// ==================================================
//  Order Modal
// ==================================================
async function openOrderModal(orderId) {
  showLoader();
  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) return showToast("Order not found.", "error");
    const order = snap.data();

    const overlay = document.createElement("div");
    overlay.className = "order-modal";
    const orderDate = order.timestamp?.seconds
      ? new Date(order.timestamp.seconds * 1000).toLocaleString()
      : "—";

    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Order: ${orderId}</h3>
        <p><strong>User:</strong> ${order.userId || "—"}</p>
        <p><strong>Name:</strong> ${order.customer?.name || "—"}</p>
        <hr/>
        <h4>Items</h4>
        <div>${Array.isArray(order.items)
        ? order.items.map(it => `<div>${it.name} x${it.quantity} — Size: ${it.size}, Color: ${it.color || "default"} — €${it.total}</div>`).join("")
        : "—"}</div>

        <hr/>
        <p><strong>Total:</strong> €${order.total || 0}</p>
        <p><strong>Date:</strong> ${orderDate}</p>
        <div>
          <button id="modalCloseBtn">Close</button>
          <button id="modalArchiveBtn" data-id="${orderId}" data-archived="${!!order.archived}">
            ${order.archived ? "Unarchive" : "Archive"}
          </button>
          <button id="modalDeleteBtn" data-id="${orderId}">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById("modalCloseBtn").onclick = () => overlay.remove();
    document.getElementById("modalArchiveBtn").onclick = async (e) => {
      showLoader();
      try {
        await updateDoc(doc(db, "orders", e.target.dataset.id), { archived: e.target.dataset.archived !== "true" });
        showToast(" Archive status updated.", "warning");
        overlay.remove();
        loadOrders("", "", currentArchivedView);
      } finally { hideLoader(); }
    };
    document.getElementById("modalDeleteBtn").onclick = () => {
      showConfirm("Delete this order?", async () => {
        showLoader();
        try {
          await deleteDoc(doc(db, "orders", orderId));
          showToast(" Order deleted.", "error");
          overlay.remove();
          loadOrders("", "", currentArchivedView);
        } finally { hideLoader(); }
      });
    };
  } catch {
    showToast(" Failed to load order.", "error");
  } finally {
    hideLoader();
  }
}

// ==================================================
//  Filters
// ==================================================
document.getElementById("filterForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const userId = document.getElementById("filterUserId").value.trim();
  const date = document.getElementById("filterDate").value.trim();
  loadOrders(userId, date, currentArchivedView);
});

// ==================================================
//  Section Toggles
// ==================================================
document.getElementById("showAddProduct").addEventListener("click", () => {
  document.getElementById("addProductSection").style.display = "block";
  document.getElementById("ordersSection").style.display = "none";
});
document.getElementById("showOrders").addEventListener("click", () => {
  currentArchivedView = false;
  document.getElementById("addProductSection").style.display = "none";
  document.getElementById("ordersSection").style.display = "block";
  loadOrders();
});
document.getElementById("showArchived").addEventListener("click", () => {
  currentArchivedView = true;
  document.getElementById("addProductSection").style.display = "none";
  document.getElementById("ordersSection").style.display = "block";
  loadOrders();
});
