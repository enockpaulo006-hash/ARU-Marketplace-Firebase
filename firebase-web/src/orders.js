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
// --------------------------------------------------
// RENDER ORDERS
// --------------------------------------------------

function renderOrders() {
    if (!ordersList || !ordersCount) return;

    ordersList.replaceChildren();

    const visibleOrders = allOrders.filter(matchesFilter);

    ordersCount.textContent =
        `${visibleOrders.length} order${visibleOrders.length === 1 ? "" : "s"}`;

    if (visibleOrders.length === 0) {
        showMessage(
            "No orders found",
            guestMode
                ? "Orders you place on this browser will appear here."
                : currentView === "buyer"
                    ? "Orders you place will appear here."
                    : "Orders for your products will appear here."
        );

        ordersCount.textContent = "0 orders";
        return;
    }

    visibleOrders.forEach(order => {
        ordersList.appendChild(createOrderCard(order));
    });
}

// --------------------------------------------------
// LOAD GUEST ORDERS
// --------------------------------------------------

async function loadGuestOrders() {
    if (loading) return;

    // Guest orders belong to this exact Firebase anonymous session.
    if (!currentUser || !currentUser.isAnonymous) {
        showMessage(
            "Guest session unavailable",
            "Please refresh this page and try again."
        );
        return;
    }

    loading = true;

    showMessage(
        "Loading your orders",
        "Please wait while we retrieve your orders."
    );

    if (ordersCount) {
        ordersCount.textContent = "Loading...";
    }

    try {
        const savedIds = readGuestOrderIds();

        const fetchedOrders = [];
        const stillTrackedIds = [];

        for (const orderId of savedIds) {
            try {
                const snapshot = await getDoc(
                    doc(db, "orders", orderId)
                );

                if (!snapshot.exists()) continue;

                const order = {
                    id: snapshot.id,
                    ...snapshot.data()
                };

                // Never display an order belonging to another account.
                if (order.buyerId !== currentUser.uid) {
                    continue;
                }

                if (completedMoreThan24HoursAgo(order)) {
                    continue;
                }

                fetchedOrders.push(order);
                stillTrackedIds.push(orderId);

            } catch (error) {
                console.warn(
                    `Could not retrieve guest order ${orderId}:`,
                    error
                );

                // Keep the ID in case this is a temporary connection problem.
                stillTrackedIds.push(orderId);
            }
        }

        saveGuestOrderIds(stillTrackedIds);

        allOrders = fetchedOrders;

        allOrders.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;

            return bTime - aTime;
        });

        renderOrders();

    } catch (error) {
        console.error("Failed to load guest orders:", error);

        showMessage(
            "Unable to load your orders",
            "Check your internet connection and refresh the page."
        );

        if (ordersCount) {
            ordersCount.textContent = "Orders unavailable";
        }

    } finally {
        loading = false;
    }
}

// --------------------------------------------------
// LOAD REGISTERED BUYER / SELLER ORDERS
// --------------------------------------------------

async function loadOrders() {
    if (guestMode) {
        await loadGuestOrders();
        return;
    }

    if (!currentUser || loading) return;

    loading = true;

    showMessage(
        "Loading orders",
        "Please wait while we retrieve your orders."
    );

    try {
        const field =
            currentView === "buyer" ? "buyerId" : "sellerId";

        const ordersQuery = query(
            collection(db, "orders"),
            where(field, "==", currentUser.uid)
        );

        const snapshot = await getDocs(ordersQuery);

        allOrders = snapshot.docs.map(orderDoc => ({
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
            `Check your connection and Firestore permissions. ${error.code || ""}`
        );

        if (ordersCount) {
            ordersCount.textContent = "Orders unavailable";
        }

    } finally {
        loading = false;
    }
}
// --------------------------------------------------
// HANDLE SELLER / BUYER ACTIONS
// --------------------------------------------------

async function handleOrderAction(orderId, action, button) {
    const order = allOrders.find(item => item.id === orderId);

    if (!order) return;

    const isSeller = currentView === "seller";

    // Seller actions require a registered seller account.
    if (isSeller && (!currentUser || currentUser.isAnonymous)) {
        return;
    }

    // Registered and anonymous buyers can act only on their own orders.
    if (!isSeller) {
        if (!currentUser || order.buyerId !== currentUser.uid) {
            alert("You cannot cancel another buyer's order.");
            return;
        }
    }

    const nextStatus = {
        accept: "accepted",
        reject: "rejected",
        complete: "completed",
        cancel: "cancelled"
    }[action];

    if (!nextStatus) return;

    if (isSeller && order.sellerId !== currentUser.uid) {
        showMessage(
            "Access denied",
            "You cannot manage this seller's order."
        );
        return;
    }

    const allowed =
        (
            isSeller &&
            order.status === "pending" &&
            ["accepted", "rejected"].includes(nextStatus)
        ) ||
        (
            isSeller &&
            order.status === "accepted" &&
            nextStatus === "completed"
        ) ||
        (
            !isSeller &&
            nextStatus === "cancelled" &&
            canCancelOrder(order)
        );

    if (!allowed) {
        alert(
            nextStatus === "cancelled"
                ? "You can cancel only a pending order within the first 5 hours. An accepted order cannot be cancelled."
                : "This action is not allowed for the current order status."
        );

        await loadOrders();
        return;
    }

    const confirmation = {
        accept: "Accept this order?",
        reject: "Reject this order?",
        complete: "Mark this order as completed?",
        cancel: "Are you sure you want to cancel this order?"
    }[action];

    if (!window.confirm(confirmation)) return;

    button.disabled = true;
    button.textContent = "Updating...";

    try {
        const orderRef = doc(db, "orders", orderId);

        const latestSnapshot = await getDoc(orderRef);

        if (!latestSnapshot.exists()) {
            throw new Error("This order no longer exists.");
        }

        const latestOrder = latestSnapshot.data();

        if (
            isSeller &&
            latestOrder.sellerId !== currentUser.uid
        ) {
            throw new Error("You cannot manage this order.");
        }

        if (
            !isSeller &&
            latestOrder.buyerId !== currentUser.uid
        ) {
            throw new Error("You cannot cancel this order.");
        }

        if (latestOrder.status !== order.status) {
            throw new Error(
                "The order status changed. Reload and try again."
            );
        }

        // Recheck the five-hour restriction using the latest Firestore data.
        if (
            nextStatus === "cancelled" &&
            !canCancelOrder(latestOrder)
        ) {
            throw new Error(
                "This order can no longer be cancelled. Cancellation is allowed only while it is pending and within the first 5 hours."
            );
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
            error.code === "permission-denied"
                ? "Firebase denied this action. The order may no longer be cancellable, or the Firestore rules need updating."
                : error.message || "Unable to update the order."
        );

        await loadOrders();

    } finally {
        button.disabled = false;
    }
}

// --------------------------------------------------
// SWITCH BUYER / SELLER VIEW
// --------------------------------------------------

function setView(view) {
    if (
        view === "seller" &&
        (!currentUser || currentUser.isAnonymous)
    ) {
        return;
    }

    currentView = view;

    buyerTab?.classList.toggle("active", view === "buyer");
    sellerTab?.classList.toggle("active", view === "seller");

    buyerTab?.setAttribute(
        "aria-pressed",
        String(view === "buyer")
    );

    sellerTab?.setAttribute(
        "aria-pressed",
        String(view === "seller")
    );

    allOrders = [];

    loadOrders();
}

buyerTab?.addEventListener("click", () => {
    setView("buyer");
});

sellerTab?.addEventListener("click", () => {
    setView("seller");
});

// --------------------------------------------------
// FILTER BUTTONS
// --------------------------------------------------

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter || "all";

        filterButtons.forEach(item => {
            const active = item === button;

            item.classList.toggle("active", active);

            item.setAttribute(
                "aria-pressed",
                String(active)
            );
        });

        renderOrders();
    });
});
// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

onAuthStateChanged(auth, async user => {
    currentUser = user || null;
    allOrders = [];

    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }

    // If someone opens the Orders page directly without an account,
    // create an anonymous Firebase session.
    if (!user) {
        try {
            await signInAnonymously(auth);

        } catch (error) {
            console.error("Guest authentication failed:", error);

            guestMode = true;

            showMessage(
                "Unable to start guest session",
                "Please check your internet connection and refresh the page."
            );

            if (ordersCount) {
                ordersCount.textContent = "Orders unavailable";
            }
        }

        return;
    }

    guestMode = Boolean(user.isAnonymous);
    currentView = "buyer";

    if (guestMode) {
        // Anonymous buyers can see only their own buyer orders.
        if (sellerTab) {
            sellerTab.hidden = true;
            sellerTab.disabled = true;
        }

        buyerTab?.removeAttribute("hidden");

        if (buyerTab) {
            buyerTab.disabled = false;
        }

        await loadGuestOrders();

    } else {
        // Registered users can access buyer and seller views.
        if (sellerTab) {
            sellerTab.hidden = false;
            sellerTab.disabled = false;
        }

        try {
            const adminSnapshot = await getDoc(
                doc(db, "admins", user.uid)
            );

            if (
                adminSnapshot.exists() &&
                adminSnapshot.data().role === "ADMIN"
            ) {
                window.location.replace("/moderator.html");
                return;
            }

            await loadOrders();

        } catch (error) {
            console.error(
                "Account permissions check failed:",
                error
            );

            showMessage(
                "Unable to verify your account",
                "Please refresh the page and try again."
            );
        }
    }

    // Refresh order status once per minute.
    refreshTimer = setInterval(() => {
        if (guestMode && currentUser?.isAnonymous) {
            loadGuestOrders();

        } else if (
            currentUser &&
            !currentUser.isAnonymous
        ) {
            loadOrders();
        }
    }, 60 * 1000);
});

console.log("ARU Marketplace Orders initialized.");