
import "./style.css";

import { onAuthStateChanged } from "firebase/auth";

import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

// PAGE ELEMENTS

const list = document.getElementById("moderator-products-list");
const count = document.getElementById("moderator-count");
const searchInput = document.getElementById("moderator-search-input");
const filterButtons = document.querySelectorAll(".moderator-filters button");
const refreshButton = document.getElementById("moderator-refresh-button");

// ORDERS DASHBOARD ELEMENTS

const productsSection = document.getElementById("moderator-products-section");
const ordersSection = document.getElementById("moderator-orders-section");
const ordersList = document.getElementById("moderator-orders-list");
const ordersCount = document.getElementById("moderator-orders-count");
const ordersSearchInput = document.getElementById("moderator-orders-search-input");
const ordersRefreshButton = document.getElementById("moderator-orders-refresh-button");

const moderatorTabs = document.querySelectorAll(
    ".moderator-tab, [data-moderator-tab]"
);

const orderFilterButtons = document.querySelectorAll(".order-filter");

let products = [];
let selectedStatus = "pending";
let authorized = false;
let loading = false;

let marketplaceOrders = [];
let ordersLoading = false;
let selectedOrderStatus = "all";

// INITIALIZE

if (!list || !count || !searchInput) {
    console.error(
        "Moderator dashboard elements are missing. Check moderator.html IDs."
    );
} else {
    initializeModeratorDashboard();
}

// INITIALIZE AND AUTHORIZE

function initializeModeratorDashboard() {
    onAuthStateChanged(auth, async (user) => {
        authorized = false;

        if (!user) {
            window.location.replace("/login.html");
            return;
        }

        try {
            const adminRef = doc(db, "admins", user.uid);
            const adminSnapshot = await getDoc(adminRef);

            if (
                !adminSnapshot.exists() ||
                adminSnapshot.data().role !== "ADMIN"
            ) {
                showMessage(
                    "Access denied. This account is not an authorized moderator."
                );

                count.textContent = "Moderator access required";
                return;
            }

            authorized = true;

            console.log("Moderator authorized:", user.uid);

            await loadProducts();

            if (ordersSection && !ordersSection.hidden) {
                await loadOrders();
            }

        } catch (error) {
            console.error("Moderator authorization failed:", error);

            showMessage(
                `Unable to verify moderator access: ${
                    error.code || error.message || "Unknown error"
                }`
            );

            count.textContent = "Authorization failed";
        }
    });

    // PRODUCT STATUS FILTERS

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            selectedStatus = button.dataset.status || "pending";

            filterButtons.forEach((item) => {
                const active = item === button;

                item.classList.toggle("active", active);
                item.setAttribute("aria-pressed", String(active));
            });

            renderProducts();
        });
    });

    // PRODUCT SEARCH

    searchInput.addEventListener("input", renderProducts);

    // PRODUCT REFRESH

    if (refreshButton) {
        refreshButton.addEventListener("click", loadProducts);
    }

    // ORDERS SEARCH AND REFRESH

    ordersSearchInput?.addEventListener("input", renderOrders);
    ordersRefreshButton?.addEventListener("click", loadOrders);

    // ORDER FILTERS

    orderFilterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            selectedOrderStatus = button.dataset.status || "all";

            orderFilterButtons.forEach((item) => {
                const active = item === button;

                item.classList.toggle("active", active);
                item.setAttribute("aria-pressed", String(active));
            });

            renderOrders();
        });
    });

    // DASHBOARD TABS

    moderatorTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target =
                tab.dataset.section || tab.dataset.moderatorTab;

            showModeratorSection(target);
        });
    });
}

// DISPLAY PRODUCT MESSAGES

function showMessage(message) {
    if (!list) return;

    list.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.className = "my-products-message";
    paragraph.textContent = message;

    list.appendChild(paragraph);
}

// LOAD PRODUCTS

async function loadProducts() {
    if (!authorized || loading) return;

    loading = true;

    if (list) {
        list.setAttribute("aria-busy", "true");
    }

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    showMessage("Loading products...");

    try {
        const snapshot = await getDocs(collection(db, "products"));

        products = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
        }));

        products.sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() ?? 0;
            const dateB = b.createdAt?.toMillis?.() ?? 0;

            return dateB - dateA;
        });

        console.log("Total products loaded:", products.length);

        console.log(
            "Product statuses:",
            products.reduce((totals, product) => {
                const status = product.status || "missing status";

                totals[status] = (totals[status] || 0) + 1;

                return totals;
            }, {})
        );

        renderProducts();

    } catch (error) {
        console.error("Could not load moderator products:", error);

        showMessage(
            `Could not load products: ${
                error.code || error.message || "Unknown error"
            }`
        );

        count.textContent = "Product loading failed";

    } finally {
        loading = false;

        if (list) {
            list.setAttribute("aria-busy", "false");
        }

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}

// FILTER AND SEARCH PRODUCTS

function renderProducts() {
    if (!list || !count || !searchInput) return;

    list.replaceChildren();

    const term = searchInput.value.trim().toLowerCase();

    const filtered = products.filter((product) => {
        const matchesStatus =
            selectedStatus === "all" ||
            product.status === selectedStatus;

        const searchableText = [
            product.title,
            product.category,
            product.sellerId,
            product.location
        ]
            .map((value) => String(value || ""))
            .join(" ")
            .toLowerCase();

        return matchesStatus && searchableText.includes(term);
    });

    count.textContent =
        `${filtered.length} matching product${
            filtered.length === 1 ? "" : "s"
        }`;

    if (filtered.length === 0) {
        showMessage(
            selectedStatus === "pending"
                ? "No products are waiting for review."
                : "No products match this filter or search."
        );

        return;
    }

    filtered.forEach((product) => {
        list.appendChild(createProductCard(product));
    });
}

// CREATE PRODUCT CARD

function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "my-product-card";

    const image = document.createElement("img");
    image.className = "my-product-image";

    image.src =
        product.imageUrls?.[0] ||
        product.imageUrl ||
        "https://placehold.co/300x220?text=No+Image";

    image.alt = product.title || "Product";

    image.onerror = () => {
        image.onerror = null;
        image.src = "https://placehold.co/300x220?text=No+Image";
    };

    const details = document.createElement("div");
    details.className = "my-product-details";

    const title = document.createElement("h3");
    title.textContent = product.title || "Untitled product";

    const price = document.createElement("p");
    price.className = "my-product-price";
    price.textContent =
        `TZS ${Number(product.price || 0).toLocaleString()}`;

    const status = document.createElement("span");
    status.className =
        `my-product-status status-${product.status || "pending"}`;

    const statusLabels = {
        pending: "Pending Review",
        active: "Approved",
        rejected: "Rejected",
        hidden: "Hidden",
        sold: "Sold"
    };

    status.textContent =
        statusLabels[product.status] ||
        product.status ||
        "Unknown";

    const seller = document.createElement("p");
    seller.className = "my-product-date";
    seller.textContent =
        `Seller UID: ${product.sellerId || "Unknown"}`;

    const submitted = document.createElement("p");
    submitted.className = "my-product-date";

    const submittedDate = product.createdAt?.toDate?.();

    submitted.textContent = submittedDate
        ? `Submitted: ${submittedDate.toLocaleString()}`
        : "Submission date unavailable";

    details.append(title, price, status, seller, submitted);

    if (product.status === "rejected" && product.rejectionReason) {
        const reason = document.createElement("p");
        reason.className = "my-product-rejection";

        reason.textContent =
            `Rejection reason: ${product.rejectionReason}`;

        details.appendChild(reason);
    }

    // Only pending products have review buttons.

    if (product.status === "pending") {
        const actions = document.createElement("div");
        actions.className = "my-product-actions";

        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.className = "my-product-edit-button";
        approveButton.textContent = "Approve";

        approveButton.addEventListener("click", () => {
            reviewProduct(product, "active");
        });

        const rejectButton = document.createElement("button");
        rejectButton.type = "button";
        rejectButton.className = "my-product-delete-button";
        rejectButton.textContent = "Reject";

        rejectButton.addEventListener("click", () => {
            rejectProduct(product);
        });

        actions.append(approveButton, rejectButton);
        details.appendChild(actions);
    }

    card.append(image, details);

    return card;
}

// APPROVE OR REJECT PRODUCT

async function reviewProduct(
    product,
    newStatus,
    rejectionReason = ""
) {
    if (!authorized || !auth.currentUser) {
        alert("You are not authorized to review products.");
        return;
    }

    const action = newStatus === "active" ? "approve" : "reject";

    if (
        !window.confirm(
            `Are you sure you want to ${action} "${product.title}"?`
        )
    ) {
        return;
    }

    try {
        const productRef = doc(db, "products", product.id);
        const latestSnapshot = await getDoc(productRef);

        if (!latestSnapshot.exists()) {
            alert("This product no longer exists.");
            await loadProducts();
            return;
        }

        if (latestSnapshot.data().status !== "pending") {
            alert(
                "This product is no longer pending review. Refreshing the list."
            );

            await loadProducts();
            return;
        }

        await updateDoc(productRef, {
            status: newStatus,

            rejectionReason:
                newStatus === "rejected" ? rejectionReason : "",

            reviewedBy: auth.currentUser.uid,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        alert(
            newStatus === "active"
                ? "Product approved successfully."
                : "Product rejected. The seller can see the rejection reason."
        );

        await loadProducts();

    } catch (error) {
        console.error("Product review failed:", error);

        alert(
            `Review failed: ${
                error.code || error.message || "Unknown error"
            }. Check your Firestore rules.`
        );
    }
}

// REJECT WITH A REASON

async function rejectProduct(product) {
    const reason = window.prompt(
        `Why are you rejecting "${product.title}"? Enter a clear reason for the seller.`
    );

    if (reason === null) return;

    if (!reason.trim()) {
        alert("Please enter a rejection reason.");
        return;
    }

    await reviewProduct(product, "rejected", reason.trim());
}

// ==================================================
// MODERATOR ORDERS - READ ONLY
// ==================================================

function showModeratorSection(section) {
    const showOrders = section === "orders";

    if (productsSection) {
        productsSection.hidden = showOrders;
    }

    if (ordersSection) {
        ordersSection.hidden = !showOrders;
    }

    moderatorTabs.forEach((tab) => {
        const tabSection =
            tab.dataset.section || tab.dataset.moderatorTab;

        const active = tabSection === section;

        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
    });

    if (showOrders) {
        loadOrders();
    } else {
        loadProducts();
    }
}

// ORDER MESSAGES

function showOrdersMessage(message) {
    if (!ordersList) return;

    ordersList.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.className = "my-products-message";
    paragraph.textContent = message;

    ordersList.appendChild(paragraph);
}

// ORDER DATE

function moderatorOrderDate(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== "function") {
        return "Date unavailable";
    }

    return timestamp.toDate().toLocaleString("en-TZ", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ORDER CURRENCY

function moderatorMoney(value) {
    return new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0
    }).format(Number(value) || 0);
}

// RENDER ALL ORDERS

function renderOrders() {
    if (!ordersList || !ordersCount) return;

    ordersList.replaceChildren();

    const term = (
        ordersSearchInput?.value || ""
    ).trim().toLowerCase();

    const filtered = marketplaceOrders.filter((order) => {
        const status = String(
            order.status || "pending"
        ).toLowerCase();

        const matchesStatus =
            selectedOrderStatus === "all" ||
            status === selectedOrderStatus;

        const searchable = [
            order.id,
            order.buyerName,
            order.buyerPhone,
            order.productTitle,
            order.sellerId,
            order.buyerId,
            order.productId,
            status
        ]
            .map(value => String(value || ""))
            .join(" ")
            .toLowerCase();

        return matchesStatus && searchable.includes(term);
    });

    ordersCount.textContent =
        `${filtered.length} order${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
        showOrdersMessage(
            "No marketplace orders match this filter or search."
        );

        return;
    }

    filtered.forEach((order) => {
        const card = document.createElement("article");
        card.className = "order-card moderator-order-card";

        const top = document.createElement("div");
        top.className = "order-card-top";

        const product = document.createElement("div");
        product.className = "order-product";

        if (order.productImage) {
            const image = document.createElement("img");

            image.className = "order-product-image";
            image.src = order.productImage;
            image.alt = order.productTitle || "Ordered product";
            image.loading = "lazy";

            image.addEventListener("error", () => image.remove());

            product.appendChild(image);
        }

        const productDetails = document.createElement("div");
        productDetails.className = "order-product-details";

        const title = document.createElement("h3");
        title.textContent = order.productTitle || "Product";

        const total = document.createElement("p");
        total.className = "order-product-price";
        total.textContent =
            `Total: ${moderatorMoney(order.totalPrice)}`;

        const quantity = document.createElement("p");
        quantity.className = "order-meta";
        quantity.textContent =
            `Quantity: ${Number(order.quantity) || 1}`;

        productDetails.append(title, total, quantity);
        product.appendChild(productDetails);

        const status = document.createElement("span");

        const statusValue = String(
            order.status || "pending"
        ).toLowerCase();

        status.className = `order-status order-status-${statusValue}`;

        status.textContent =
            statusValue.charAt(0).toUpperCase() +
            statusValue.slice(1);

        top.append(product, status);

        const meta = document.createElement("div");
        meta.className = "order-card-meta";

        const customer = document.createElement("p");
        customer.textContent =
            `Customer: ${
                order.buyerName ||
                (order.buyerId ? "Registered buyer" : "Guest")
            }`;

        const phone = document.createElement("p");
        phone.textContent =
            `Phone: ${order.buyerPhone || "Not provided"}`;

        const seller = document.createElement("p");
        seller.textContent =
            `Seller UID: ${order.sellerId || "Unknown"}`;

        const unitPrice = document.createElement("p");
        unitPrice.textContent =
            `Unit price: ${moderatorMoney(order.unitPrice)}`;

        const ordered = document.createElement("p");
        ordered.textContent =
            `Ordered: ${moderatorOrderDate(order.createdAt)}`;

        const orderId = document.createElement("p");
        orderId.textContent = `Order ID: ${order.id}`;

        meta.append(
            customer,
            phone,
            seller,
            unitPrice,
            ordered,
            orderId
        );

        card.append(top, meta);

        // No order modification or deletion controls are added.
        ordersList.appendChild(card);
    });
}

// LOAD ALL MARKETPLACE ORDERS

async function loadOrders() {
    if (!authorized || ordersLoading || !ordersList) return;

    ordersLoading = true;

    if (ordersRefreshButton) {
        ordersRefreshButton.disabled = true;
    }

    showOrdersMessage("Loading all marketplace orders...");

    if (ordersCount) {
        ordersCount.textContent = "Loading...";
    }

    try {
        const snapshot = await getDocs(collection(db, "orders"));

        marketplaceOrders = snapshot.docs.map((orderDoc) => ({
            id: orderDoc.id,
            ...orderDoc.data()
        }));

        marketplaceOrders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
        });

        console.log(
            "Moderator loaded marketplace orders:",
            marketplaceOrders.length
        );

        renderOrders();

    } catch (error) {
        console.error("Could not load moderator orders:", error);

        showOrdersMessage(
            `Order loading failed: ${
                error.code || error.message || "Unknown error"
            }`
        );

        if (ordersCount) {
            ordersCount.textContent = "Order loading failed";
        }

    } finally {
        ordersLoading = false;

        if (ordersRefreshButton) {
            ordersRefreshButton.disabled = false;
        }
    }
}

console.log("ARU Marketplace Moderator initialized.");
