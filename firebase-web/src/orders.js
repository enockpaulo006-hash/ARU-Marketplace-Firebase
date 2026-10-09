
import "./style.css";

import {
    onAuthStateChanged
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

const ordersList = document.getElementById("orders-list");
const ordersCount = document.getElementById("orders-count");

const buyerTab = document.getElementById("buyer-orders-tab");
const sellerTab = document.getElementById("seller-orders-tab");

const filterButtons = document.querySelectorAll(
    ".orders-filters .product-filter"
);

let currentUser = null;
let currentView = "buyer";
let currentFilter = "all";
let allOrders = [];
let loading = false;

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

    return timestamp.toDate().toLocaleDateString("en-TZ", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
};

const escapeStatus = (status) =>
    String(status || "pending").toLowerCase();

function showMessage(title, description) {
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


    function matchesFilter(order) {
        const status = escapeStatus(order.status);

        // Hide completed orders 24 hours after completion.
        if (status === "completed") {
            const completedTime =
                order.completedAt?.toMillis?.();

            // Keep older completed orders visible until they have
            // a completion timestamp, so existing records aren't hidden.
            if (
                completedTime &&
                Date.now() - completedTime >= 24 * 60 * 60 * 1000
            ) {
                return false;
            }
        }

        if (currentFilter === "all") {
            return true;
        }

        if (currentFilter === "other") {
            return ["rejected", "cancelled"].includes(status);
        }

        return status === currentFilter;
    }


function createActionButton(label, action, orderId, style = "primary") {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `order-action order-action-${style}`;
    button.textContent = label;

    button.addEventListener("click", () => {
        handleOrderAction(orderId, action, button);
    });

    return button;
}

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

        image.addEventListener("error", () => {
            image.remove();
        });

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

    status.textContent = statusLabel(order.status);

    top.append(product, status);

    const meta = document.createElement("div");
    meta.className = "order-card-meta";

    const orderDate = document.createElement("p");
    orderDate.textContent = `Ordered: ${dateText(order.createdAt)}`;

    const orderNumber = document.createElement("p");
    orderNumber.textContent = `Order ID: ${order.id}`;

    meta.append(orderDate, orderNumber);

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
    } else if (orderStatus === "pending") {
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

    if (actions.childElementCount > 0) {
        card.appendChild(actions);
    }

    return card;
}

function renderOrders() {
    ordersList.replaceChildren();

    const visibleOrders = allOrders.filter(matchesFilter);

    ordersCount.textContent =
        `${visibleOrders.length} order${visibleOrders.length === 1 ? "" : "s"}`;

    if (visibleOrders.length === 0) {
        showMessage(
            "No orders found",
            currentView === "buyer"
                ? "Orders you place will appear here."
                : "Orders for your products will appear here."
        );

        ordersCount.textContent = "0 orders";
        return;
    }

    visibleOrders.forEach((order) => {
        ordersList.appendChild(createOrderCard(order));
    });
}

async function loadOrders() {
    if (!currentUser || loading) {
        return;
    }

    loading = true;

    showMessage("Loading orders", "Please wait while we retrieve your orders.");

    try {
        const field = currentView === "buyer" ? "buyerId" : "sellerId";

        const ordersQuery = query(
            collection(db, "orders"),
            where(field, "==", currentUser.uid)
        );

        const snapshot = await getDocs(ordersQuery);

        allOrders = snapshot.docs.map((orderDoc) => ({
            id: orderDoc.id,
            ...orderDoc.data()
        }));

        allOrders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
        });

        renderOrders();
    } catch (error) {
        console.error("Failed to load orders:", error);

        showMessage(
            "Unable to load orders",
            "Check your connection and Firestore permissions, then try again."
        );

        ordersCount.textContent = "Orders unavailable";
    } finally {
        loading = false;
    }
}

async function handleOrderAction(orderId, action, button) {
    const order = allOrders.find((item) => item.id === orderId);

    if (!order || !currentUser) {
        return;
    }

    const isSeller = currentView === "seller";

    const nextStatus = {
        accept: "accepted",
        reject: "rejected",
        complete: "completed",
        cancel: "cancelled"
    }[action];

    if (!nextStatus) {
        return;
    }

    // Check that the user is acting on their own order.
    if (isSeller && order.sellerId !== currentUser.uid) {
        showMessage("Access denied", "You cannot manage this seller's order.");
        return;
    }

    if (!isSeller && order.buyerId !== currentUser.uid) {
        showMessage("Access denied", "You cannot cancel another buyer's order.");
        return;
    }

    // Validate allowed status transitions before sending the request.
    const allowed =
        (isSeller && order.status === "pending"
            && ["accepted", "rejected"].includes(nextStatus))
        ||
        (isSeller && order.status === "accepted"
            && nextStatus === "completed")
        ||
        (!isSeller && order.status === "pending"
            && nextStatus === "cancelled");

    if (!allowed) {
        alert("This action is not allowed for the current order status.");
        return;
    }

    const confirmation = {
        accept: "Accept this order?",
        reject: "Reject this order?",
        complete: "Mark this order as completed?",
        cancel: "Cancel this order?"
    }[action];

    if (!window.confirm(confirmation)) {
        return;
    }

    button.disabled = true;
    button.textContent = "Updating...";

    try {
        // Re-read the order before updating it.
        const orderRef = doc(db, "orders", orderId);
        const latestSnapshot = await getDoc(orderRef);

        if (!latestSnapshot.exists()) {
            throw new Error("This order no longer exists.");
        }

        const latestOrder = latestSnapshot.data();

        if (isSeller && latestOrder.sellerId !== currentUser.uid) {
            throw new Error("You cannot manage this order.");
        }

        if (!isSeller && latestOrder.buyerId !== currentUser.uid) {
            throw new Error("You cannot cancel this order.");
        }

        if (latestOrder.status !== order.status) {
            throw new Error("The order status changed. Reload and try again.");
        }


        const updateData = {
            status: nextStatus,
            updatedAt: serverTimestamp()
        };

        if (nextStatus === "completed") {
            updateData.completedAt = serverTimestamp();
        }

        await updateDoc(orderRef, updateData);

        await loadOrders();
    } catch (error) {
        console.error("Order update failed:", error);

        alert(
            error.message === "Missing or insufficient permissions."
                ? "Firebase denied this action. Check the published Orders rules."
                : error.message || "Unable to update the order."
        );

        await loadOrders();
    } finally {
        button.disabled = false;
    }
}

function setView(view) {
    currentView = view;

    buyerTab.classList.toggle("active", view === "buyer");
    sellerTab.classList.toggle("active", view === "seller");

    buyerTab.setAttribute("aria-pressed", String(view === "buyer"));
    sellerTab.setAttribute("aria-pressed", String(view === "seller"));

    loadOrders();
}

buyerTab.addEventListener("click", () => setView("buyer"));
sellerTab.addEventListener("click", () => setView("seller"));

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter || "all";

        filterButtons.forEach((item) => {
            const active = item === button;

            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });

        renderOrders();
    });
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login.html");
        return;
    }

    currentUser = user;

    try {
        const adminSnapshot = await getDoc(
            doc(db, "admins", user.uid)
        );

        if (
            adminSnapshot.exists()
            && adminSnapshot.data().role === "ADMIN"
        ) {
            window.location.replace("/moderator.html");
            return;
        }

        await loadOrders();
    } catch (error) {
        console.error("Account permissions check failed:", error);

        showMessage(
            "Unable to verify your account",
            "Please refresh the page or sign in again."
        );
    }
});

console.log("ARU Marketplace Orders initialized.");
