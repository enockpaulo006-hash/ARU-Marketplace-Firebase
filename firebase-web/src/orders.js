import "./style.css";

import {
    onAuthStateChanged,
    signInAnonymously
} from "firebase/auth";

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const ordersList = document.getElementById("orders-list");
const ordersCount = document.getElementById("orders-count");
const buyerTab = document.getElementById("buyer-orders-tab");
const sellerTab = document.getElementById("seller-orders-tab");

const filterButtons = document.querySelectorAll(
    ".orders-filters .product-filter"
);

// Guest order IDs are saved only in this browser.
const GUEST_ORDER_STORAGE_KEY = "aru_marketplace_guest_order_ids_v1";

// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentUser = null;
let currentView = "buyer";
let currentFilter = "all";
let allOrders = [];
let loading = false;
let guestMode = false;
let refreshTimer = null;

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const money = (amount) =>
    new Intl.NumberFormat("en-TZ", {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);

const dateText = (timestamp) => {
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
};

const escapeStatus = (status) =>
    String(status || "pending").toLowerCase();

function readGuestOrderIds() {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(GUEST_ORDER_STORAGE_KEY) || "[]"
        );

        return Array.isArray(parsed)
            ? [...new Set(
                parsed.filter(
                    id => typeof id === "string" && id.trim()
                )
            )]
            : [];

    } catch (error) {
        console.warn("Could not read guest order history:", error);
        return [];
    }
}

function saveGuestOrderIds(ids) {
    try {
        localStorage.setItem(
            GUEST_ORDER_STORAGE_KEY,
            JSON.stringify([...new Set(ids)].slice(0, 100))
        );

    } catch (error) {
        console.warn("Could not update guest order history:", error);
    }
}

function completedMoreThan24HoursAgo(order) {
    if (escapeStatus(order.status) !== "completed") {
        return false;
    }

    const completedMillis = order.completedAt?.toMillis?.();

    if (!completedMillis) return false;

    return Date.now() - completedMillis >= 24 * 60 * 60 * 1000;
}

// Customers can cancel only pending orders during the first five hours.
function canCancelOrder(order) {
    if (escapeStatus(order.status) !== "pending") {
        return false;
    }

    const createdAtMillis = order.createdAt?.toMillis?.();

    if (!createdAtMillis) return false;

    const elapsedTime = Date.now() - createdAtMillis;
    const fiveHours = 5 * 60 * 60 * 1000;

    return elapsedTime >= 0 && elapsedTime < fiveHours;
}

// --------------------------------------------------
// MESSAGES
// --------------------------------------------------

function showMessage(title, description) {
    if (!ordersList) return;

    ordersList.replaceChildren();

    const box = document.createElement("div");
    box.className = "my-products-message";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const paragraph = document.createElement("p");
    paragraph.textContent = description;

    box.append(heading, paragraph);
    ordersList.appendChild(box);
}

// --------------------------------------------------
// ORDER STATUS LABELS
// --------------------------------------------------

function statusLabel(status) {
    const labels = {
        pending: "Pending",
        accepted: "Accepted",
        rejected: "Rejected",
        completed: "Completed",
        cancelled: "Cancelled"
    };

    return labels[status] || status;
}

// --------------------------------------------------
// ORDER FILTERING
// --------------------------------------------------

function matchesFilter(order) {
    const status = escapeStatus(order.status);

    // Completed orders disappear after 24 hours from the customer's view.
    // Sellers retain their order history.
    if (
        currentView === "buyer" &&
        completedMoreThan24HoursAgo(order)
    ) {
        return false;
    }

    if (currentFilter === "all") return true;

    if (currentFilter === "other") {
        return ["rejected", "cancelled"].includes(status);
    }

    return status === currentFilter;
}

// --------------------------------------------------
// ACTION BUTTONS
// --------------------------------------------------

function createActionButton(
    label,
    action,
    orderId,
    style = "primary"
) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `order-action order-action-${style}`;
    button.textContent = label;

    button.addEventListener("click", () => {
        handleOrderAction(orderId, action, button);
    });

    return button;
}

// --------------------------------------------------
// CREATE ORDER CARD
// --------------------------------------------------

function createOrderCard(order) {
    const card = document.createElement("article");
    card.className = "order-card";

    const top = document.createElement("div");
    top.className = "order-card-top";

    const product = document.createElement("div");
    product.className = "order-product";

    if (order.productImage) {
        const image = document.createElement("img");

        image.src = order.productImage;
        image.alt = order.productTitle || "Ordered product";
        image.className = "order-product-image";
        image.loading = "lazy";

        image.addEventListener("error", () => image.remove());

        product.appendChild(image);
    }

    const details = document.createElement("div");
    details.className = "order-product-details";

    const title = document.createElement("h3");
    title.textContent = order.productTitle || "Product";

    const price = document.createElement("p");
    price.className = "order-product-price";
    price.textContent = money(order.totalPrice);

    const quantity = document.createElement("p");
    quantity.className = "order-meta";
    quantity.textContent =
        `Quantity: ${Number(order.quantity) || 1}`;

    details.append(title, price, quantity);
    product.appendChild(details);

    const status = document.createElement("span");
    status.className =
        `order-status order-status-${escapeStatus(order.status)}`;

    status.textContent = statusLabel(
        escapeStatus(order.status)
    );

    top.append(product, status);

    const meta = document.createElement("div");
    meta.className = "order-card-meta";

    const orderDate = document.createElement("p");
    orderDate.textContent =
        `Ordered: ${dateText(order.createdAt)}`;

    const orderNumber = document.createElement("p");
    orderNumber.textContent = `Order ID: ${order.id}`;

    meta.append(orderDate, orderNumber);

    let customerDetails = null;

    if (
        currentView === "seller" &&
        (order.buyerName || order.buyerPhone)
    ) {
        customerDetails = document.createElement("div");
        customerDetails.className = "order-customer-details";

        const customerHeading = document.createElement("h4");
        customerHeading.textContent = "Customer Details";

        customerDetails.appendChild(customerHeading);

        if (order.buyerName) {
            const customerName = document.createElement("p");
            customerName.textContent =
                `Name: ${order.buyerName}`;

            customerDetails.appendChild(customerName);
        }

        if (order.buyerPhone) {
            const customerPhone = document.createElement("p");
            const phoneLabel = document.createElement("span");

            phoneLabel.textContent = "Phone: ";

            const phoneLink = document.createElement("a");
            const phoneDigits = String(order.buyerPhone).replace(
                /\D/g,
                ""
            );

            phoneLink.textContent = order.buyerPhone;
            phoneLink.href = `tel:+${phoneDigits}`;

            customerPhone.append(phoneLabel, phoneLink);
            customerDetails.appendChild(customerPhone);
        }
    }

    const actions = document.createElement("div");
    actions.className = "order-actions";

    const orderStatus = escapeStatus(order.status);

    if (currentView === "seller") {
        if (orderStatus === "pending") {
            actions.append(
                createActionButton(
                    "Accept order",
                    "accept",
                    order.id,
                    "primary"
                ),
                createActionButton(
                    "Reject order",
                    "reject",
                    order.id,
                    "danger"
                )
            );

        } else if (orderStatus === "accepted") {
            actions.append(
                createActionButton(
                    "Mark completed",
                    "complete",
                    order.id,
                    "primary"
                )
            );
        }

    } else if (
        orderStatus === "pending" &&
        canCancelOrder(order)
    ) {
        actions.append(
            createActionButton(
                "Cancel order",
                "cancel",
                order.id,
                "danger"
            )
        );
    }

    card.append(top, meta);

    if (customerDetails) {
        card.appendChild(customerDetails);
    }

    if (actions.childElementCount > 0) {
        card.appendChild(actions);
    }

    return card;
}