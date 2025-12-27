import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  getDocs,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ============ FIREBASE CONFIG ============
const firebaseConfig = {
  apiKey: "AIzaSyDLZFqweqXYqqKjva20LdYAjG5EMslOt-A",
  authDomain: "lost-and-found-b6768.firebaseapp.com",
  projectId: "lost-and-found-b6768",
  storageBucket: "lost-and-found-b6768.firebasestorage.app",
  messagingSenderId: "151005190970",
  appId: "1:151005190970:web:8a3cd9f28ae94192fbce03"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============ APP STATE ============
let currentUser = null;
// ============ MAP GLOBAL STATE ============
let lostMap, foundMap;
let lostMarker = null;
let foundMarker = null;
let lostLat = null, lostLng = null;
let foundLat = null, foundLng = null;
let userLat = null;
let userLng = null;
let userMarkerLost = null;
let userMarkerFound = null;


const STORAGE_KEY = 'lf_items_v1';

// Helper to generate random ID
function id() { return Math.random().toString(36).slice(2, 10); }

// columns definition
const columns = [
  { key: 'lost', title: 'Lost Items', type: 'lost' },
  { key: 'found', title: 'Found Items', type: 'found' }
];

// Load/Save State
let state = loadState() || {
  lost: [
    { id: id(), name: "Black Wallet", category: "Wallet", location: "Library", contact: "555-1010", desc: "Leather wallet with cards and ID." },
    { id: id(), name: "Silver Ring", category: "Jewelry", location: "Cafeteria", contact: "555-2020", desc: "Thin silver ring with small engraving." }
  ],
  found: [
    { id: id(), name: "Blue Umbrella", category: "Accessory", location: "Bus Stop", contact: "555-3030", desc: "Foldable umbrella with wooden handle." },
    { id: id(), name: "White Earbuds", category: "Electronics", location: "Lecture Hall A", contact: "555-4040", desc: "Wired earbuds in a small pouch." }
  ]
};

function saveState() { 
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { } 
}

function loadState() { 
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null } catch (e) { return null } 
}

// Toast notifications
function showToast(text, type = 'info', ms = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
  t.textContent = text;
  t.classList.remove('hidden');
  t.style.opacity = '1';
  setTimeout(() => { t.classList.add('hidden'); }, ms);
}

// ============ FIREBASE AUTHENTICATION ============

// SIGN UP
window.signup = async function () {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const msgEl = document.getElementById("authMessage");

  if (!email || !password) {
    if (msgEl) {
      msgEl.innerText = "Please enter email and password.";
      msgEl.className = "msg error";
    }
    return;
  }

  if (password.length < 6) {
    if (msgEl) {
      msgEl.innerText = "Password must be at least 6 characters.";
      msgEl.className = "msg error";
    }
    return;
  }

  if (msgEl) msgEl.innerText = "Creating account...";

  createUserWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      currentUser = userCredential.user;
      // Create user profile with points
await setDoc(doc(db, "users", currentUser.uid), {
  email: currentUser.email,
  points: 0,
  createdAt: serverTimestamp()
});

      
      if (msgEl) {
        msgEl.innerText = `Account created! Welcome, ${email}!`;
        msgEl.className = "msg success";
      }
      showToast("Signup successful!", "success");
      document.getElementById("email").value = "";
      document.getElementById("password").value = "";
      updateAuthUI();
      setTimeout(() => showSection('home'), 800);
    })
    .catch(error => {
      if (msgEl) {
        msgEl.innerText = error.message;
        msgEl.className = "msg error";
      }
      showToast(error.message, "error");
    });
};

// LOGIN
window.login = function () {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const msgEl = document.getElementById("authMessage");

  if (!email || !password) {
    if (msgEl) {
      msgEl.innerText = "Please enter email and password.";
      msgEl.className = "msg error";
    }
    return;
  }

  if (msgEl) msgEl.innerText = "Logging in...";

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      currentUser = userCredential.user;
      if (msgEl) {
        msgEl.innerText = `Welcome back, ${email}!`;
        msgEl.className = "msg success";
      }
      showToast("Login successful!", "success");
      document.getElementById("email").value = "";
      document.getElementById("password").value = "";
      updateAuthUI();
      setTimeout(() => showSection('home'), 800);
    })
    .catch(error => {
      if (msgEl) {
        msgEl.innerText = error.message;
        msgEl.className = "msg error";
      }
      showToast(error.message, "error");
    });
};

// LOGOUT
function logout() {
  signOut(auth)
    .then(() => {
      currentUser = null;
      updateAuthUI();
      showToast("Logged out", "success");
      showSection('home');
    })
    .catch(error => {
      showToast(error.message, "error");
    });
}

window.logout = logout;

async function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const pointsEl = document.getElementById('pointsDisplay');

  if (currentUser) {
    if (loginBtn) loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');

    if (pointsEl) {
      const snap = await getDocs(
        query(collection(db, "users"), where("__name__", "==", currentUser.uid))
      );

      if (!snap.empty) {
        const pts = snap.docs[0].data().points || 0;
        pointsEl.textContent = `⭐ Points: ${pts}`;
        pointsEl.classList.remove('hidden');
      }
    }
  } else {
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (pointsEl) pointsEl.classList.add('hidden');
  }
}

async function ensureUserProfile(user) {
  const userRef = doc(db, "users", user.uid);
  await setDoc(
    userRef,
    {
      email: user.email,
      points: 0,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

// LOGIN STATE CHECK
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in as:", user.email);
    currentUser = user;
ensureUserProfile(user);
updateAuthUI();

  } else {
    console.log("User logged out");
    currentUser = null;
    updateAuthUI();
  }
});

// ============ ITEM MANAGEMENT ============
// ============ MAP INITIALIZATION ============
function getUserLocation(callback) {
  if (!navigator.geolocation) {
    alert("Location not supported by browser");
    callback(20.5937, 78.9629);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      callback(userLat, userLng);
    },
    () => {
      callback(20.5937, 78.9629); // fallback
    },
    { enableHighAccuracy: true }
  );
}
function initLostMap() {
  if (lostMap) return;

  getUserLocation((lat, lng) => {
    lostMap = L.map('lostMap').setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(lostMap);

    // User live location (blue dot)
    userMarkerLost = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: "#1e90ff",
      color: "#fff",
      weight: 2,
      fillOpacity: 1
    }).addTo(lostMap).bindPopup("You are here").openPopup();

    lostMap.on('click', (e) => {
      lostLat = e.latlng.lat;
      lostLng = e.latlng.lng;

      if (lostMarker) {
        lostMarker.setLatLng(e.latlng);
      } else {
        lostMarker = L.marker(e.latlng).addTo(lostMap);
      }
    });
  });
}

function initFoundMap() {
  if (foundMap) return;

  getUserLocation((lat, lng) => {
    foundMap = L.map('foundMap').setView([lat, lng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(foundMap);

    userMarkerFound = L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: "#1e90ff",
      color: "#fff",
      weight: 2,
      fillOpacity: 1
    }).addTo(foundMap).bindPopup("You are here").openPopup();

    foundMap.on('click', (e) => {
      foundLat = e.latlng.lat;
      foundLng = e.latlng.lng;

      if (foundMarker) {
        foundMarker.setLatLng(e.latlng);
      } else {
        foundMarker = L.marker(e.latlng).addTo(foundMap);
      }
    });
  });
}


// Firestore items state
let firestoreItems = [];

// Listen for items from Firestore (FOUND items)
onSnapshot(query(collection(db, "items"), where("type", "==", "FOUND")), (snapshot) => {
  firestoreItems = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    type: 'found'
  }));
  renderItems(document.getElementById('search-input')?.value || '');
});
// Listen for LOST items from Firestore
let firestoreLostItems = [];

onSnapshot(
  query(collection(db, "items"), where("type", "==", "LOST")),
  (snapshot) => {
    firestoreLostItems = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      type: 'lost'
    }));
    renderItems(document.getElementById('searchInput')?.value || '');
  }
);

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in KM
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1); // km
}
function timeAgo(timestamp) {
  if (!timestamp || !timestamp.toDate) return "";

  const seconds = Math.floor(
    (new Date() - timestamp.toDate()) / 1000
  );

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 }
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}


// Load all items from Firestore
window.loadItems = async function () {
  const lostContainer = document.getElementById("lostItemsList");
  const foundContainer = document.getElementById("foundItemsList");

  if (lostContainer) lostContainer.innerHTML = "";
  if (foundContainer) foundContainer.innerHTML = "";

  const q = query(collection(db, "items"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const data = doc.data();

    const card = document.createElement("div");
    card.className = "item-card";

  const mapId = `map-${doc.id}`;

card.innerHTML = `
  ${data.imagePreviewUrl ? `<img src="${data.imagePreviewUrl}" class="item-image">` : ""}
  <h4>${data.itemName}</h4>
${currentUser && data.userId !== currentUser.uid ? `
  <button class="btn btn-claim"
    onclick="claimItem('${doc.id}', '${data.type}', '${data.userId}')">
    Claim Item
  </button>
` : ""}


${currentUser && data.userId === currentUser.uid ? `
  <button class="btn btn-approve"
    onclick="approveClaim('${doc.id}')">
    Approve Claim
  </button>
` : ""}


  <p>
    ${data.category} • ${data.locationText}
    ${userLat && data.lat
      ? ` • 📍 ${calculateDistance(userLat, userLng, data.lat, data.lng)} km away`
      : ''}
  </p>

  <p>${data.description || ""}</p>

  ${data.contact ? `<p>📞 ${data.contact}</p>` : ""}

  <small style="color:#64748b; font-size:13px;">
    🕒 ${timeAgo(data.createdAt)}
  </small>

  ${data.lat && data.lng ? `
    <div class="item-map" id="${mapId}"></div>
  ` : ""}
`;


    if (data.type === "LOST") {
      
      if (lostContainer) lostContainer.appendChild(card);
    } else {
      if (foundContainer) foundContainer.appendChild(card);
    }
    if (data.lat && data.lng) {
  setTimeout(() => {
    const map = L.map(mapId, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false
    }).setView([data.lat, data.lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    L.marker([data.lat, data.lng]).addTo(map);
  }, 100);
}


  });
};

// Create item DOM element
function createItemElement(item, type) {
  const container = document.createElement('div');
  container.className = 'item';

  const indicator = document.createElement('div');
  indicator.className = `indicator ${type}`;
  container.appendChild(indicator);
  // Item image (local preview)
if (item.imagePreviewUrl) {
  const img = document.createElement('img');
  img.src = item.imagePreviewUrl;
  img.className = 'item-image';
  img.alt = 'Item image';
  container.appendChild(img);
}

  const body = document.createElement('div');
  body.className = 'item-body';
  

  const title = document.createElement('div');
  title.className = 'item-title';
  title.textContent = item.name || item.itemName || 'Unknown Item';
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'item-meta';
  meta.textContent = `${item.category} • ${item.location || item.locationText} • ${item.contact}`;
  body.appendChild(meta);

  const desc = document.createElement('p');
  body.appendChild(desc);

  container.appendChild(body);
  return container;
}

// Render items with filter
function renderItems(filter = '') {
  const q = (filter || '').toLowerCase().trim();
  const root = document.getElementById('columns-root');
  if (!root) return;

  columns.forEach(col => {
    const list = document.querySelector(`[data-list="${col.key}"]`);
    if (!list) return;

    let itemsToRender = [];

    // Get items from appropriate source
    if (col.key === 'found') {
      // Get from Firestore
      itemsToRender = firestoreItems.filter(it => matchItem(it, q));
    } else if (col.key === 'lost') {
  // Get LOST items from Firestore
  itemsToRender = firestoreLostItems.filter(it => matchItem(it, q));
}


    list.innerHTML = '';
    if (itemsToRender.length === 0) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No items yet.';
      list.appendChild(p);
    } else {
      itemsToRender.forEach(it => {
        const el = createItemElement(it, col.type || 'lost');
        list.appendChild(el);
      });
    }

    // update count in header
    const countEl = document.querySelector(`[data-count="${col.key}"]`);
    if (countEl) countEl.textContent = itemsToRender.length;
  });
}

// Match item against search query
function matchItem(it, q) {
  if (!q) return true;
  const itemName = it.name || it.itemName || '';
  const location = it.location || it.locationText || '';
  const desc = it.desc || it.description || '';
  return (itemName + ' ' + it.category + ' ' + location + ' ' + desc).toLowerCase().includes(q);
}

// Filter items function for search input
window.filterItems = function () {
  const searchText = document.getElementById("searchInput").value.toLowerCase();
  const cards = document.querySelectorAll(".item-card");

  cards.forEach(card => {
    const text = card.innerText.toLowerCase();
    card.style.display = text.includes(searchText) ? "block" : "none";
  });
};

// Submit lost item
window.submitLost = async function () {
  const user = auth.currentUser;
const imageFile = document.getElementById("lostImage").files[0];
const imagePreviewUrl = imageFile ? URL.createObjectURL(imageFile) : "";

console.log(imageFile);

  if (!user) {
    alert("Please login first");
    return;
  }

  const itemName = document.getElementById("lost-item").value;
  const category = document.getElementById("lost-category").value;
  const location = document.getElementById("lost-location").value;
  const description = document.getElementById("lost-desc").value;
  const contact = document.getElementById("lost-contact").value;

  if (!itemName || !category || !location || !contact) {
  alert("Please fill all required fields");
  return;
  }


if (lostLat === null || lostLng === null) {
  alert("Please select the exact lost location on the map");
  return;
}


  try {
    await addDoc(collection(db, "items"), {
      type: "LOST",
      itemName,
      category,
      locationText: location,
      description,
      contact,
      imagePreviewUrl,
      lat: lostLat,
      lng: lostLng,
      userId: user.uid,
      userEmail: user.email,
      createdAt: serverTimestamp()
    });

    alert("Lost item reported successfully!");
    


    document.getElementById("lost-item").value = "";
    document.getElementById("lost-category").value = "";
    document.getElementById("lost-location").value = "";
    document.getElementById("lost-desc").value = "";
    document.getElementById("lost-contact").value = "";

  } catch (error) {
    alert("Error saving lost item");
    console.error(error);
  }
  lostLat = null;
lostLng = null;
if (lostMarker) {
  lostMap.removeLayer(lostMarker);
  lostMarker = null;
}; }; // ✅ closes window.submitLos

// Submit found item
window.submitFound = async function () {
  const user = auth.currentUser;
  const imageFile = document.getElementById("foundImage").files[0];
const imagePreviewUrl = imageFile ? URL.createObjectURL(imageFile) : "";


  if (!user) {
    alert("Please login first");
    return;
  }

  const itemName = document.getElementById("found-item").value;
  const category = document.getElementById("found-category").value;
  const location = document.getElementById("found-location").value;
  const description = document.getElementById("found-desc").value;
  const contact = document.getElementById("found-contact").value;

  if (!itemName || !category || !location || !contact) {
    alert("Please fill all required fields");
    return;
  }
  if (foundLat === null || foundLng === null) {
  alert("Please select the exact found location on the map");
  return;
}


  try {
    await addDoc(collection(db, "items"), {
      type: "FOUND",
      itemName,
      category,
      locationText: location,
      description,
      contact,
      imagePreviewUrl,
      lat: foundLat,
      lng: foundLng,
      userId: user.uid,
      userEmail: user.email,
      createdAt: serverTimestamp()
      
    });

    alert("Found item reported successfully!");
   document.getElementById("foundImage").value = "";

    document.getElementById("found-item").value = "";
    document.getElementById("found-category").value = "";
    document.getElementById("found-location").value = "";
    document.getElementById("found-desc").value = "";
    document.getElementById("found-contact").value = "";

  } catch (error) {
    alert("Error saving found item");
    console.error(error);
  }
  foundLat = null;
foundLng = null;
if (foundMarker) {
  foundMap.removeLayer(foundMarker);
  foundMarker = null;
}


};

// ============ COLUMN MANAGEMENT ============

// Render columns
function renderColumns() {
  const root = document.getElementById('columns-root');
  if (!root) return;
  root.innerHTML = '';
  columns.forEach(col => {
    const colEl = document.createElement('div');
    colEl.className = 'column';

    const header = document.createElement('div');
    header.className = 'col-header';
    const title = document.createElement('h3');
    title.className = 'col-title';
    title.textContent = col.title;
    const controls = document.createElement('div');
    controls.className = 'col-controls';
    const count = document.createElement('span');
    count.className = 'col-count';
    count.setAttribute('data-count', col.key);
    count.textContent = (state[col.key] || []).length;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'secondary';
    removeBtn.title = 'Remove column';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeColumn(col.key));

    controls.appendChild(count);
    controls.appendChild(removeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    const list = document.createElement('div');
    list.className = 'list';
    list.setAttribute('data-list', col.key);

    colEl.appendChild(header);
    colEl.appendChild(list);
    root.appendChild(colEl);
  });
}

// Add column
function addColumn(title) {
  const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (!key) return showToast('Invalid column name', 'error');
  if (columns.find(c => c.key === key)) return showToast('Column exists', 'error');
  columns.push({ key, title, type: key });
  state[key] = [];
  saveState();
  renderColumns();
  renderItems(document.getElementById('search-input')?.value || '');
  showToast('Column added', 'success');
}

// Remove column
function removeColumn(key) {
  if (!confirm('Remove column and all its items?')) return;
  const idx = columns.findIndex(c => c.key === key);
  if (idx === -1) return;
  columns.splice(idx, 1);
  delete state[key];
  saveState();
  renderColumns();
  renderItems(document.getElementById('search-input')?.value || '');
  showToast('Column removed', 'success');
}

// ============ NAVIGATION ============

// Show section
function showSection(sectionId) {
  const sections = document.querySelectorAll('.section');
  sections.forEach(s => s.classList.add('hidden'));
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.classList.remove('hidden');
  // Initialize maps when sections open
if (sectionId === 'lost') {
  setTimeout(() => {
    initLostMap();
    lostMap.invalidateSize();
  }, 300);
}

if (sectionId === 'found') {
  setTimeout(() => {
    initFoundMap();
    foundMap.invalidateSize();
  }, 300);
}
  // animate
  el.classList.add('fade-in');
  setTimeout(() => el.classList.remove('fade-in'), 380);

  // nav active
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.classList.remove('active');
    try {
      const onclick = btn.getAttribute('onclick') || '';
      if (onclick.includes(`'${sectionId}'`)) btn.classList.add('active');
    } catch (e) { }
  });
}

// Expose globals
window.showSection = showSection;

// ============ AUTHENTICATION-BASED ACCESS CONTROL ============

// Protected section access function
window.openProtectedSection = function(sectionId) {
  // Check if user is authenticated
  if (!auth.currentUser) {
    // User is NOT logged in
    alert("Please login or signup to continue");
    showSection('auth');
    return;
  }

  // User IS logged in - allow access
  showSection(sectionId);
};

window.approveClaim = async function (itemId) {
  if (!auth.currentUser) {
    alert("Please login first");
    return;
  }

  try {
    const q = query(
      collection(db, "claims"),
      where("itemId", "==", itemId),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("No pending claims found");
      return;
    }

    const claimDoc = snapshot.docs[0];
    const claimData = claimDoc.data();

    // Approve claim
    await setDoc(
      doc(db, "claims", claimDoc.id),
      { status: "approved", approvedAt: serverTimestamp() },
      { merge: true }
    );

    // Add points
    const userRef = doc(db, "users", claimData.claimantId);
    const userSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", claimData.claimantId))
    );

    if (!userSnap.empty) {
      const currentPoints = userSnap.docs[0].data().points || 0;

      await setDoc(
        userRef,
        { points: currentPoints + 10 },
        { merge: true }
      );
    }

    alert("Claim approved 🎉 Points awarded!");

    // 🔥 refresh points
    updateAuthUI();

  } catch (err) {
    console.error(err);
    alert("Failed to approve claim");
  }
};

window.claimItem = async function (itemId, itemType, ownerId) {
  if (!auth.currentUser) {
    alert("Please login first");
    return;
  }

  try {
    await addDoc(collection(db, "claims"), {
      itemId,
      itemType,
      ownerId,
      claimantId: auth.currentUser.uid,
      status: "pending",
      createdAt: serverTimestamp()
    });

    alert("Claim request sent successfully!");
  } catch (error) {
    console.error(error);
    alert("Failed to send claim request");
  }
};


  

document.addEventListener('DOMContentLoaded', () => {
  const submitLostBtn = document.getElementById('submit-lost');
  if (submitLostBtn) submitLostBtn.addEventListener('click', window.submitLost);

  const submitFoundBtn = document.getElementById('submit-found');
  if (submitFoundBtn) submitFoundBtn.addEventListener('click', window.submitFound);

  const search = document.getElementById('searchInput');
  if (search) {
    search.addEventListener('input', (e) => renderItems(e.target.value));
  }

  const addColumnBtn = document.getElementById('add-column');
  if (addColumnBtn) {
    addColumnBtn.addEventListener('click', () => {
      const title = prompt('Column title (e.g. "Found on Campus")');
      if (title && title.trim()) addColumn(title.trim());
    });
  }

  renderColumns();
  renderItems();
  updateAuthUI();
});

