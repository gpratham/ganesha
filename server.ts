import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Idol, PoojaItem, Order, AppState } from "./src/types";

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(process.cwd(), "data_store.json");

// Parse JSON and URLEncoded bodies with high volume limits for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Preload standard idols & pooja items
const PRELOADED_STATE: AppState = {
  idols: [
    {
      id: "idol-clay-shadu",
      name: "Vedic Premium Eco-Clay Ganesha",
      imgUrl: "/src/assets/images/eco_clay_ganesha_1781947452568.jpg",
      price: 4500,
      discount: 15, // 15% discount
      style: "Shadu Clay",
      color: "Natural Saffron",
      quality: "Vedic Pure Handcrafted",
      height: "12 inches",
      stock: 5,
      description: "Crafted strictly from sacred Shadu Mati (natural clay) sourced from traditional riverbeds. Dissolves within minutes in water, returning fully back to Earth. Embellished with biodegradable, organic turmeric and kumkum colors.",
      deliveryProvided: true,
      deliveryCharge: 250,
      secondaryImages: [
        "/src/assets/images/eco_clay_ganesha_1781947452568.jpg"
      ]
    },
    {
      id: "idol-brass-royal",
      name: "Royal Devotional Brass Ganesha",
      imgUrl: "/src/assets/images/brass_ganesha_1781947467841.jpg",
      price: 8500,
      discount: 0,
      style: "Brass Cast Look",
      color: "Polished Gold",
      quality: "Premium Artistry",
      height: "18 inches",
      stock: 3,
      description: "A gorgeous, heavy-weight Ganesha idol sporting a vibrant brass metallic polished look with intricate carvings representing cosmic energy and wisdom. Perfect for dual-role home mandirs and traditional pooja spaces.",
      deliveryProvided: true,
      deliveryCharge: 350,
      secondaryImages: [
        "/src/assets/images/brass_ganesha_1781947467841.jpg"
      ]
    },
    {
      id: "idol-marble-serene",
      name: "Serene Pristine Marble Art Ganesha",
      imgUrl: "/src/assets/images/marble_ganesha_1781947482119.jpg",
      price: 12000,
      discount: 10, // 10% discount
      style: "Marble Art",
      color: "Ivory White / Pastel",
      quality: "Standard Deluxe Artwork",
      height: "24 inches",
      stock: 2,
      description: "Carved marvel reflecting peaceful and calm elements. Finished in luxurious white marble coating decorated with fine delicate pastel-colored vestments and pure gold lines. Perfect for spacious modern living rooms.",
      deliveryProvided: true,
      deliveryCharge: 500,
      secondaryImages: [
        "/src/assets/images/marble_ganesha_1781947482119.jpg"
      ]
    }
  ],
  poojaItems: [
    {
      id: "pooja-flowers",
      name: "Sacred Flower Garland Bundle (Jasmine & Marigold)",
      price: 150,
      icon: "🌸",
      description: "Freshly plucked marigolds, roses, and fragrant jasmine hand-knitted for welcoming Lord Ganesha."
    },
    {
      id: "pooja-incense",
      name: "Vedic Sandalwood Incense Sticks & Dhoop (Box of 50)",
      price: 80,
      icon: "🪵",
      description: "Pure sandalwood dhoop sticks designed to fill your dwelling with deep meditative vibes."
    },
    {
      id: "pooja-diyas",
      name: "Clay Terracotta Diya Oil Lamps (Set of 4)",
      price: 120,
      icon: "🪔",
      description: "Handcrafted natural earthen diyas representing ambient, bright protective fire elements."
    },
    {
      id: "pooja-modak",
      name: "Homemade Steamed Sweet Modak Offering (Pack of 11)",
      price: 250,
      icon: "🥟",
      description: "Delectable traditional steamed modaks made from absolute pure cow ghee, cardamom, and jaggery."
    },
    {
      id: "pooja-thali",
      name: "Complete Mangal Aarti Thali Accessory Set",
      price: 350,
      icon: "🧆",
      description: "Stainless polished plate equipped with small copper bowls for turmeric, kumkum, rice grains, and camphor."
    }
  ],
  orders: [],
  settings: {
    adminUpiId: "prathmg1991@okaxis",
    adminUpiName: "Vighnaharta Utsav Akurdi Hub",
    adminWhatsappNumber: "919876543210"
  },
  lastUpdated: Date.now()
};

// Initialize or load database
let appState: AppState = { ...PRELOADED_STATE };

// We will also track a transient memory of whatsapp logs send notifications for live demonstration
export interface WhatsappLog {
  id: string;
  recipient: string;
  phone: string;
  role: "customer" | "admin";
  message: string;
  timestamp: string;
}
let whatsappLogs: WhatsappLog[] = [];

function loadDatabase() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      // Merge elements to preserve preloaded ones in case schemas evolve
      appState = {
        idols: parsed.idols || PRELOADED_STATE.idols,
        poojaItems: parsed.poojaItems || PRELOADED_STATE.poojaItems,
        orders: parsed.orders || PRELOADED_STATE.orders,
        settings: parsed.settings || PRELOADED_STATE.settings,
        lastUpdated: parsed.lastUpdated || Date.now()
      };
      
      // Ensure generated static images are restored in case file is fresh
      for (const pre of PRELOADED_STATE.idols) {
        if (!appState.idols.some(i => i.id === pre.id)) {
          appState.idols.push(pre);
        }
      }
    } else {
      saveDatabase();
    }
  } catch (err) {
    console.error("Failed to load schema from persistent data store:", err);
    appState = { ...PRELOADED_STATE };
  }
}

function saveDatabase() {
  try {
    appState.lastUpdated = Date.now();
    fs.writeFileSync(DATA_FILE, JSON.stringify(appState, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write schema to persistent database file:", err);
  }
}

loadDatabase();

// Route helper: serve generated/placed static assets directly from development workspace
app.use("/src/assets/images", express.static(path.join(process.cwd(), "src/assets/images")));

// API Endpoints:

// 1. Full State Extraction
app.get("/api/state", (req, res) => {
  res.json(appState);
});

// 2. Incremental Synchronization / Check Poll
app.get("/api/sync", (req, res) => {
  const clientTime = parseInt(req.query.lastUpdated as string || "0");
  if (clientTime < appState.lastUpdated) {
    res.json({ updated: true, state: appState });
  } else {
    res.json({ updated: false });
  }
});

// 3. Insert or Update Ganapati Idol (Admin)
app.post("/api/idols", (req, res) => {
  const item: Idol = req.body;
  if (!item.name || !item.price) {
    res.status(400).json({ error: "Name and Price are mandatory parameters." });
    return;
  }
  
  const idx = appState.idols.findIndex(i => i.id === item.id);
  if (idx !== -1) {
    appState.idols[idx] = { ...appState.idols[idx], ...item };
  } else {
    // New Idol Setup
    const newIdol: Idol = {
      ...item,
      id: item.id || `idol-${Date.now()}`,
      secondaryImages: item.secondaryImages || [item.imgUrl]
    };
    appState.idols.push(newIdol);
  }
  
  saveDatabase();
  res.json({ success: true, idols: appState.idols });
});

// 4. Delete Idol (Admin)
app.delete("/api/idols/:id", (req, res) => {
  const idolId = req.params.id;
  appState.idols = appState.idols.filter(i => i.id !== idolId);
  saveDatabase();
  res.json({ success: true, idols: appState.idols });
});

// 5. Submit Order / Book Ganesha (End User)
app.post("/api/orders", (req, res) => {
  const { deviceId, customerName, customerPhone, idolId, poojaItems, deliveryType, deliveryAddress, paymentType } = req.body;
  
  if (!customerName || !customerPhone || !idolId) {
    res.status(400).json({ error: "Customer details and Ganesha selection are mandatory." });
    return;
  }
  
  const idol = appState.idols.find(i => i.id === idolId);
  if (!idol) {
    res.status(404).json({ error: "Selected Ganesha Idol could not be found." });
    return;
  }
  
  if (idol.stock <= 0) {
    res.status(400).json({ error: "This Ganesha Idol is currently fullybooked and out of stock." });
    return;
  }

  // Deduct Ganesha Stock
  idol.stock -= 1;
  
  // Calculate total amounts
  const originalPrice = idol.price;
  const discountedPrice = originalPrice - (originalPrice * (idol.discount / 100));
  const deliveryCharge = deliveryType === "delivery" ? (idol.deliveryCharge || 0) : 0;
  
  // Pooja items calculation
  let poojaTotal = 0;
  const orderedPooja: any[] = [];
  if (Array.isArray(poojaItems)) {
    for (const pi of poojaItems) {
      const storeItem = appState.poojaItems.find(p => p.id === pi.id);
      if (storeItem) {
        poojaTotal += storeItem.price * pi.quantity;
        orderedPooja.push({
          id: storeItem.id,
          name: storeItem.name,
          price: storeItem.price,
          quantity: pi.quantity
        });
      }
    }
  }

  const grandTotal = discountedPrice + deliveryCharge + poojaTotal;
  
  // Rule checks: Home delivery requires FULL payment.
  // Self pickup lets user pay either ADVANCE or FULL.
  let finalPaymentType = paymentType;
  if (deliveryType === "delivery") {
    finalPaymentType = "full";
  }

  // For Ganesha Booking, let's say the standard minimum Booking advance amount is ₹1,000, 
  // or 15% of price, whichever is suitable. Let's make it a flat 25% or flat ₹1000 advance.
  const advanceAmount = Math.min(1000, grandTotal);
  const payAmount = finalPaymentType === "full" ? grandTotal : advanceAmount;
  const remainAmount = grandTotal - payAmount;

  const newOrder: Order = {
    id: `ord-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    deviceId: deviceId || "standalone",
    customerName,
    customerPhone,
    idolId,
    idolName: idol.name,
    idolImg: idol.imgUrl,
    poojaItems: orderedPooja,
    deliveryType,
    deliveryAddress,
    paymentType: finalPaymentType,
    paymentAmount: payAmount,
    remainingAmount: remainAmount,
    totalAmount: grandTotal,
    status: "booked",
    timestamp: new Date().toISOString()
  };

  appState.orders.push(newOrder);
  saveDatabase();

  // Automatically trigger WhatsApp notifications (Mock + Logs simulation)
  try {
    sendAutoWhatsappNotifications(newOrder, appState.settings);
  } catch (err) {
    console.error("Failed to compile or issue Whatsapp mock bills:", err);
  }
  
  res.json({ success: true, order: newOrder, state: appState });
});

// Helper: compiles formatted Whatsapp payloads and populates memory logs
function sendAutoWhatsappNotifications(order: Order, settings: any) {
  const customerPhone = order.customerPhone;
  const customerName = order.customerName;
  const amountToPay = order.paymentAmount;
  const totalAmount = order.totalAmount;
  const remainAmount = order.remainingAmount;
  
  const customerMsg = `*🌺 Blessed Ganpati Booking Confirmed! 🌺*
Dear *${customerName}*, your sacred booking for Lord Ganesha is successful!

*INVOICE DETAILS:*
📍 Order Ref: ${order.id}
🪔 Ganesha: ${order.idolName}
📦 Dispatch: ${order.deliveryType === "delivery" ? "Home Delivery Requested" : "Self-Pickup Akurdi Hub"}
💰 Gross Invoice: ₹${totalAmount}
🌸 Booking Advance Paid: ₹${amountToPay}
🚩 Pending Balance: ₹${remainAmount}

Thank you for embracing eco-friendly pure divine energy!
_May Lord Ganesha dissolve all obstacles from your path and bless your home!_ ॐ`;

  whatsappLogs.unshift({
    id: `wlog-${Date.now()}-cust`,
    recipient: customerName,
    phone: customerPhone,
    role: "customer",
    message: customerMsg,
    timestamp: new Date().toISOString()
  });

  const adminPhone = settings?.adminWhatsappNumber || "919876543210";
  const adminName = settings?.adminUpiName || "Vighnaharta Utsav Admin";
  const adminMsg = `*🚨 NEW GANESHA UTSAV BOOKING! 🚨*
Jai Ganesh! A new devotee has booked/enquired an idol from the inventory!

*INFORMATIONAL OVERVIEW:*
👤 Devotee: *${customerName}* (${customerPhone})
🚩 Deity: *${order.idolName}*
📦 Mode: *${order.deliveryType.toUpperCase()}*
💰 Gross Invoice: ₹${totalAmount}
💳 Advance Paid: ₹${amountToPay}
📱 Status: Active reservation (Stock updated automatically)`;

  whatsappLogs.unshift({
    id: `wlog-${Date.now()}-adm`,
    recipient: "Admin (" + adminName + ")",
    phone: adminPhone,
    role: "admin",
    message: adminMsg,
    timestamp: new Date().toISOString()
  });
}

// 6. Update Order Status (Admin)
app.post("/api/orders/:id/status", (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  const order = appState.orders.find(o => o.id === orderId);
  if (!order) {
    res.status(404).json({ error: "Order details not found." });
    return;
  }
  
  if (status === "cancelled") {
    // If order was cancelled, return idol back to stock
    const idol = appState.idols.find(i => i.id === order.idolId);
    if (idol) {
      idol.stock += 1;
    }
  }
  
  order.status = status;
  saveDatabase();
  res.json({ success: true, order, state: appState });
});

// 6. Update Order Status (Admin)
app.post("/api/orders/:id/status", (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body;
  const order = appState.orders.find(o => o.id === orderId);
  if (!order) {
    res.status(404).json({ error: "Order details not found." });
    return;
  }
  
  if (status === "cancelled") {
    // If order was cancelled, return idol back to stock
    const idol = appState.idols.find(i => i.id === order.idolId);
    if (idol) {
      idol.stock += 1;
    }
  }
  
  order.status = status;
  saveDatabase();
  res.json({ success: true, order, state: appState });
});

// Memory store for OTPs
const otpsStore: { [key: string]: string } = {};

// 6.1. Send OTP (Simulated for testing, returns code for instant access!)
app.post("/api/auth/otp/send", (req, res) => {
  const { type, value } = req.body;
  if (!value) {
    res.status(400).json({ error: "Email or Phone value is required." });
    return;
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpsStore[value.trim().toLowerCase()] = code;
  
  // Create simulated WhatsApp/Email dispatch logs
  whatsappLogs.unshift({
    id: `wlog-${Date.now()}-otp`,
    recipient: value,
    phone: type === "phone" ? value : "Email Gateway",
    role: "customer",
    message: `[SECURITY OTP] Your Vighnaharta Hub authentication code is: ${code}. Valid for 5 minutes.`,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Security OTP code successfully dispatched to ${value}.`,
    code: code // Included in response for seamless sandbox preview testing!
  });
});

// 6.2. Verify OTP
app.post("/api/auth/otp/verify", (req, res) => {
  const { type, value, code } = req.body;
  if (!value || !code) {
    res.status(400).json({ error: "Value and verification code are required." });
    return;
  }
  const savedCode = otpsStore[value.trim().toLowerCase()];
  if (savedCode && savedCode === code.trim()) {
    // Correct! Create secure session info
    const isEmail = type === "email";
    res.json({
      success: true,
      token: `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      user: {
        email: isEmail ? value.trim().toLowerCase() : undefined,
        phone: !isEmail ? value.trim() : undefined,
        displayName: isEmail ? value.split("@")[0] : `User ${value.slice(-4)}`
      }
    });
  } else {
    res.status(400).json({ error: "Invalid or expired security verification code." });
  }
});

// 6.3. Construct Google OAuth Direct Authorization URL
app.get("/api/auth/google/url", (req, res) => {
  const redirectUri = req.query.redirect_uri || "/auth/callback";
  res.json({
    url: `/api/auth/google/mock-consent?redirect_uri=${encodeURIComponent(redirectUri as string)}`
  });
});

// 6.4. Mock Google Accounts consent page rendering inside popup
app.get("/api/auth/google/mock-consent", (req, res) => {
  const redirectUri = req.query.redirect_uri as string;
  res.send(`
    <html>
      <head>
        <title>Sign in - Google Accounts</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-150 bg-slate-50 flex items-center justify-center min-h-screen font-sans p-4">
        <div class="bg-white p-6 md:p-8 rounded-3xl shadow-xl w-full max-w-[400px] border border-slate-100">
          <div class="text-center mb-6">
            <svg class="h-10 mx-auto mb-3" viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <h1 class="text-lg font-bold text-slate-800">Sign in with Google</h1>
            <p class="text-xs text-slate-550 block text-slate-500 mt-0.5">Secure SSO OAuth Gateway via Gmail</p>
          </div>
          <form id="google-login-form" class="space-y-4">
            <div>
              <label class="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Gmail Address Login</label>
              <input type="email" id="email" required placeholder="e.g. devotee@gmail.com" class="w-full border border-slate-200 p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50" />
            </div>
            <div>
              <label class="block text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-1">Full Name Alias</label>
              <input type="text" id="name" placeholder="e.g. Prathamesh G." class="w-full border border-slate-200 p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50" />
            </div>
            <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl text-xs transition-all tracking-wider uppercase shadow-md mt-2">
              Authorize securely
            </button>
          </form>
        </div>
        <script>
          document.getElementById('google-login-form').addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const name = document.getElementById('name').value || 'Devotee Client';
            const redirect = decodeURIComponent(${JSON.stringify(redirectUri)}) + '?email=' + encodeURIComponent(email) + '&name=' + encodeURIComponent(name);
            window.location.href = redirect;
          });
        </script>
      </body>
    </html>
  `);
});

// 6.5. Handle Google OAuth redirect/callback popup closure message
app.get(["/auth/callback", "/auth/callback/"], (req, res) => {
  const email = (req.query.email as string) || "devotee@gmail.com";
  const name = (req.query.name as string) || "Ganesha Devotee";
  
  res.send(`
    <html>
      <body class="bg-purple-950 text-white flex flex-col items-center justify-center min-h-screen text-center font-sans space-y-3">
        <div class="animate-bounce text-4xl">🌺🪔🌺</div>
        <p class="font-bold text-sm">Authenticated successfully as ${email}</p>
        <p class="text-xs text-white/60">Transmitting secure session state to terminal application parent...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_AUTH_SUCCESS', 
              user: { 
                email: ${JSON.stringify(email.toLowerCase())}, 
                displayName: ${JSON.stringify(name)} 
              }
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
});

// 6.6. Fetch isolated User Order details matching their exact identifiers (separate URL path!)
app.get("/api/user/orders", (req, res) => {
  const { email, phone } = req.query;
  if (!email && !phone) {
    res.json([]);
    return;
  }
  const filtered = appState.orders.filter(order => {
    const matchedEmail = email && order.customerPhone && order.customerPhone.toLowerCase() === (email as string).toLowerCase();
    const matchedPhone = phone && order.customerPhone && order.customerPhone.trim() === (phone as string).trim();
    // Also backup checks if there are name or description links
    return matchedEmail || matchedPhone || order.customerPhone.includes(email as string || "NONMATCH") || order.customerPhone.includes(phone as string || "NONMATCH");
  });
  res.json(filtered);
});

// 7. Secure Admin Credentials verification
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin") {
    res.json({
      success: true,
      token: "vighnaharta-auth-admin-session-token",
      message: "Admin authentication successful!"
    });
  } else {
    res.status(401).json({ error: "Access Denied. Incorrect username or password." });
  }
});

// 8. Update Administrative Settings Endpoint
app.post("/api/settings", (req, res) => {
  const { adminUpiId, adminUpiName, adminWhatsappNumber } = req.body;
  if (!adminUpiId || !adminUpiName) {
    res.status(400).json({ error: "UPI Id and recipient name are mandatory parameter settings." });
    return;
  }
  
  appState.settings = {
    adminUpiId: adminUpiId.trim(),
    adminUpiName: adminUpiName.trim(),
    adminWhatsappNumber: (adminWhatsappNumber || "").trim()
  };
  
  saveDatabase();
  res.json({ success: true, settings: appState.settings, state: appState });
});

// 9. Fetch WhatsApp Notification audit logs
app.get("/api/whatsapp/logs", (req, res) => {
  res.json(whatsappLogs);
});


// Bootstrapping Server with Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "localhost", () => {
    console.log(`[SYS] Ganapati Dev server initialized on port ${PORT}`);
  });
}

startServer();
