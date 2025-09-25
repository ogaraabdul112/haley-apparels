// ==================== Firebase Setup ====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

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
getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// ==================== Loader & Notifications ====================
function showLoader() {
  document.getElementById("loaderOverlay")?.style.setProperty("display", "flex");
}
function hideLoader() {
  document.getElementById("loaderOverlay")?.style.setProperty("display", "none");
}
function showNotification(message, type = "success") {
  const note = document.createElement("div");
  note.className = `custom-notification ${type}`;
  note.innerText = message;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 3000);
}

// ==================== Auth State ====================
let currentUser = null;
onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  if (currentUser) {
    setupCartLogic(currentUser);
    setupCheckoutLogic(currentUser);
    setupAccountPage(currentUser);
  }
});

// ==================== Sign Up ====================
document.getElementById("SignUpform")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const phone = document.getElementById("number").value.trim();
  const msg = document.getElementById("msg");

  if (!name || !email || !password || !phone) {
    msg.innerText = "Please fill in all fields.";
    return;
  }
  if (password.length < 6) {
    msg.innerText = "Password must be at least 6 characters.";
    return;
  }

  try {
    showLoader();
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", user.uid), { name, email, phone, role: "customer" });
    msg.innerText = "Account created! Redirecting...";
    setTimeout(() => window.location.href = "index.html", 1500);
  } catch (err) {
    msg.innerText = err.message;
  } finally {
    hideLoader();
  }
});

// ==================== Login ====================
document.getElementById("LoginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const msg = document.getElementById("msg");

  if (!email || !password) {
    msg.innerText = "Please enter both email and password.";
    return;
  }
  try {
    showLoader();
    await signInWithEmailAndPassword(auth, email, password);
    msg.innerText = "Login successful! Redirecting...";
    setTimeout(() => window.location.href = "index.html", 1500);
  } catch (err) {
    msg.innerText = err.message;
  } finally {
    hideLoader();
  }
});

// ==================== Checkout Auth Prompt ====================
document.addEventListener("DOMContentLoaded", () => {
  const checkoutBtn = document.getElementById("checkoutBtn");
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", (e) => {
      if (!currentUser) {
        e.preventDefault();
        const prompt = document.createElement("div");
        prompt.className = "checkout-auth-prompt";
        prompt.innerHTML = `
          <div class="prompt-box">
            <p>Please create an account or log in to continue to checkout.</p>
            <button id="goToAccount">Go to Account Page</button>
          </div>`;
        document.body.appendChild(prompt);
        document.getElementById("goToAccount").addEventListener("click", () => {
          window.location.href = "account.html";
        });
        setTimeout(() => prompt.remove(), 8000);
      } else {
        window.location.href = "checkout.html";
      }
    });
  }
});

// ==================== Cart Logic ====================
function setupCartLogic(user) {
  const cartRef = doc(db, "carts", user.uid);

  document.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", async () => {
      showLoader();
      try {
        const { id, name } = btn.dataset;
        const price = parseFloat(btn.dataset.price);

        const snap = await getDoc(cartRef);
        let cart = snap.exists() ? snap.data().items : [];
        const existing = cart.find((i) => i.id === id);

        if (existing) existing.quantity++;
        else cart.push({ id, name, price, quantity: 1 });

        await setDoc(cartRef, { items: cart }, { merge: true });
        showNotification(`${name} added to cart!`);
      } catch (err) {
        console.error(err);
        showNotification("Error adding to cart", "error");
      } finally {
        hideLoader();
      }
    });
  });

  onSnapshot(cartRef, (snap) => {
    const cart = snap.exists() ? snap.data().items : [];
    const total = cart.reduce((sum, i) => sum + i.quantity, 0);
    const countEl = document.getElementById("cart-count");
    if (countEl) countEl.textContent = total;
  });
}

// ==================== Checkout Logic with Default Color ====================
// ==================== Checkout Logic with Default Color ====================
function setupCheckoutLogic(user) {
  const cartRef = doc(db, "carts", user.uid);
  const container = document.getElementById("cartItemsContainer");
  const totalDisplay = document.getElementById("totalAmount");
  const form = document.getElementById("checkoutForm");
  if (!container || !form) return;

  (async () => {
    try {
      showLoader();
      const snap = await getDoc(cartRef);
      const cart = snap.exists() ? snap.data().items : [];

      const calcTotal = () =>
        cart.reduce((sum, item, i) => {
          const qty = parseInt(document.querySelector(`input[name="quantity-${i}"]`)?.value || 1);
          return sum + item.price * qty;
        }, 0);

      // Build checkout items dynamically
      cart.forEach((item, i) => {
        const div = document.createElement("div");
        div.className = "checkout-item";
        div.innerHTML = `
          <h3>${item.name}</h3>
          <p>Unit Price: €${item.price.toFixed(2)}</p>

          <label>Size:
            <select name="size-${i}" required>
              <option value="">Select</option>
              <option>S</option>
              <option>M</option>
              <option>L</option>
              <option>XL</option>
            </select>
          </label>

          <label>Color:
            <select name="color-${i}">
              <option value="">Select (default will be used)</option>
              <option>Red</option>
              <option>Yellow</option>
              <option>Brown</option>
              <option>Black</option>
              <option>White</option>
            </select>
          </label>

          <span class="color-swatch" id="color-swatch-${i}" 
            style="display:inline-block;width:20px;height:20px;border:1px solid #000;margin-left:10px;">
          </span>

          <label>Quantity:
            <input type="number" name="quantity-${i}" value="${item.quantity}" min="1" required>
          </label>

          <p>Selected: <span id="display-selection-${i}">Size: None, Color: default</span></p>
          <hr/>`;
        container.appendChild(div);

        const sizeSelect = div.querySelector(`select[name="size-${i}"]`);
        const colorSelect = div.querySelector(`select[name="color-${i}"]`);
        const qtyInput = div.querySelector(`input[name="quantity-${i}"]`);
        const displaySelection = div.querySelector(`#display-selection-${i}`);
        const swatch = div.querySelector(`#color-swatch-${i}`);

        const updateSelection = () => {
          const color = colorSelect.value || "default";
          displaySelection.textContent = `Size: ${sizeSelect.value || "None"}, Color: ${color}`;
          swatch.style.backgroundColor = color !== "default" ? color.toLowerCase() : "transparent";
          totalDisplay.textContent = calcTotal().toFixed(2);
        };

        sizeSelect.addEventListener("change", updateSelection);
        colorSelect.addEventListener("change", updateSelection);
        qtyInput.addEventListener("input", updateSelection);
      });

      totalDisplay.textContent = calcTotal().toFixed(2);

      //  Do not create Firestore order on form submit anymore
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        showNotification("Please complete payment to place your order.", "info");
      });

      //  Save order only after PayPal confirms payment
      if (window.paypal) {
        paypal.Buttons({
          createOrder: (_, actions) =>
            actions.order.create({
              purchase_units: [{ amount: { value: calcTotal().toFixed(2) } }]
            }),
          onApprove: (_, actions) =>
            actions.order.capture().then(async (details) => {
              showLoader();
              try {
                const dataForm = new FormData(form);
                const customer = {
                  name: dataForm.get("name"),
                  email: dataForm.get("email"),
                  phone: dataForm.get("phone"),
                  address: dataForm.get("address")
                };

                const items = cart.map((it, i) => ({
                  name: it.name,
                  unitPrice: it.price,
                  quantity: parseInt(dataForm.get(`quantity-${i}`)),
                  size: dataForm.get(`size-${i}`),
                  color: dataForm.get(`color-${i}`) || "default",
                  total: (it.price * parseInt(dataForm.get(`quantity-${i}`))).toFixed(2)
                }));

                const order = {
                  userId: user.uid,
                  customer,
                  items,
                  total: calcTotal().toFixed(2),
                  timestamp: new Date().toISOString(),
                  paymentId: details.id,
                  payerName: details.payer.name.given_name,
                  status: "paid"
                };

                await setDoc(doc(db, "orders", `${user.uid}_${Date.now()}`), order);
                await updateDoc(cartRef, { items: [] });

                showNotification(`Payment completed by ${details.payer.name.given_name}`, "success");
                window.location.href = "delivery.html";
              } finally {
                hideLoader();
              }
            }),
          onError: (err) => {
            console.error("PayPal Error:", err);
            showNotification("Something went wrong with PayPal Checkout.", "error");
          }
        }).render("#paypal-button-container");
      }
    } finally {
      hideLoader();
    }
  })();
}



// ==================== Account Page Logic ====================
async function setupAccountPage(user) {
  const dashboard = document.getElementById("user-dashboard");
  const accountPage = document.querySelector(".account-page");
  if (!dashboard) return;

  try {
    showLoader();
    const userRef = await getDoc(doc(db, "users", user.uid));

    const elName = document.getElementById("user-name");
    const elEmail = document.getElementById("user-email");
    const elPhone = document.getElementById("user-phone");
if (userRef.exists()) {
  const data = userRef.data();
  elName.textContent = data?.name || user.displayName || "(no name)";
  elEmail.textContent = data?.email || user.email || "(no email)";
  elPhone.textContent = data?.phone || "(no phone)";
} else {
  // fallback to auth user info
  elName.textContent = user.displayName || "(no name)";
  elEmail.textContent = user.email || "(no email)";
  elPhone.textContent = "(no phone)";
}




    // Fetch Orders
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("userId", "==", user.uid));
    const querySnap = await getDocs(q);
    const ordersList = document.getElementById("orders-list");

    // Instead of wiping the container, only remove its children safely
    while (ordersList.firstChild) {
      ordersList.removeChild(ordersList.firstChild);
    }

    if (querySnap.empty) {
      ordersList.innerHTML = `<p class="empty-orders">You have no orders yet.</p>`;
    } else {
      querySnap.forEach((docSnap) => {
        const order = docSnap.data();
        const div = document.createElement("div");
        div.className = "order-card";
        let itemsHTML = order.items.map(it => {
          const colorValue = it.color && it.color !== "default" ? it.color.toLowerCase() : "transparent";
          return `
    <li>
      ${it.name} - Size: ${it.size}, Color: ${it.color || "default"} 
      <span style="display:inline-block;width:15px;height:15px;background-color:${colorValue};border:1px solid #000;margin-left:5px;"></span>
      , Qty: ${it.quantity}
    </li>`;
        }).join("");

        div.innerHTML = `
  <h4>Order Total: €${order.total}</h4>
  <p>Date: ${new Date(order.timestamp).toLocaleString()}</p>
  <ul>${itemsHTML}</ul>
  <button class="delete-order-btn" data-id="${docSnap.id}">Delete Order</button>
`;

        ordersList.appendChild(div);

        // Attach delete event
        div.querySelector(".delete-order-btn").addEventListener("click", async () => {
          // Create inline confirmation prompt
          const confirmBox = document.createElement("div");
          confirmBox.className = "order-confirm-box";
          confirmBox.innerHTML = `
  <p>Are you sure you want to delete this order?</p>
  <button class="confirm-yes">Yes</button>
  <button class="confirm-no">No</button>
`;

          // Append confirmation to the order card
          div.appendChild(confirmBox);

          // Handle Yes/No clicks
          confirmBox.querySelector(".confirm-yes").addEventListener("click", async () => {
            try {
              showLoader();
              await deleteDoc(doc(db, "orders", docSnap.id));

              // Success inline notif
              const notif = document.createElement("div");
              notif.className = "order-notification success";
              notif.textContent = "Order deleted successfully!";
              div.appendChild(notif);

              setTimeout(() => notif.remove(), 2000);
              setTimeout(() => div.remove(), 2200);

            } catch (err) {
              console.error(err);
              const notif = document.createElement("div");
              notif.className = "order-notification error";
              notif.textContent = "Error deleting order!";
              div.appendChild(notif);
              setTimeout(() => notif.remove(), 3000);
            } finally {
              hideLoader();
            }
            confirmBox.remove();
          });

          confirmBox.querySelector(".confirm-no").addEventListener("click", () => {
            confirmBox.remove(); // Just close the inline confirmation
          });

        });

      });
    }

    if (accountPage) accountPage.style.display = "none";
    dashboard.style.display = "block";

    // Logout
    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      await signOut(auth);
      window.location.href = "index.html";
    });

  } catch (err) {
    console.error(err);
    showNotification("Error loading account data", "error");
  } finally {
    hideLoader();
  }
}

// ==================== Back Button ====================
document.getElementById("back-btn")?.addEventListener("click", () => {
  window.location.href = "index.html";
});
