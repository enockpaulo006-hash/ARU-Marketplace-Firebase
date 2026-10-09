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

// ========================================
// PAGE ELEMENTS
// ========================================

const list = document.getElementById("moderator-products-list");
const count = document.getElementById("moderator-count");
const searchInput = document.getElementById("moderator-search-input");
const filterButtons = document.querySelectorAll(".moderator-filters button");
const refreshButton = document.getElementById("moderator-refresh-button");

let products = [];
let selectedStatus = "pending";
let authorized = false;
let loading = false;

// Ensure the expected HTML elements exist.
if (!list || !count || !searchInput) {
    console.error(
        "Moderator dashboard elements are missing. Check moderator.html IDs."
    );
} else {
    initializeModeratorDashboard();
}

// ========================================
// INITIALIZE AND AUTHORIZE
// ========================================

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

    // Status filters.
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

    // Search by title, category, seller UID, or location.
    searchInput.addEventListener("input", renderProducts);

    // Manually refresh the product queue.
    if (refreshButton) {
        refreshButton.addEventListener("click", loadProducts);
    }
}

// ========================================
// DISPLAY MESSAGES
// ========================================

function showMessage(text) {
    if (!list) return;

    list.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.className = "my-products-message";
    paragraph.textContent = text;

    list.appendChild(paragraph);
}

// ========================================
// LOAD PRODUCTS
// ========================================

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
        // The moderator's Firestore rules must permit reading products.
        const snapshot = await getDocs(collection(db, "products"));

        products = snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
        }));

        // Sort the most recently submitted products first.
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

// ========================================
// FILTER AND SEARCH PRODUCTS
// ========================================

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

// ========================================
// CREATE A PRODUCT CARD
// ========================================

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
        statusLabels[product.status] || product.status || "Unknown";

    const seller = document.createElement("p");
    seller.className = "my-product-date";
    seller.textContent = `Seller UID: ${product.sellerId || "Unknown"}`;

    const submitted = document.createElement("p");
    submitted.className = "my-product-date";

    const submittedDate = product.createdAt?.toDate?.();

    submitted.textContent = submittedDate
        ? `Submitted: ${submittedDate.toLocaleString()}`
        : "Submission date unavailable";

    details.append(title, price, status, seller, submitted);

    // Show rejection reason when a product has been rejected.
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

// ========================================
// APPROVE OR REJECT A PRODUCT
// ========================================

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

        // Prevent reviewing a product that has already been reviewed.
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

// ========================================
// REJECT WITH A REASON
// ========================================

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
