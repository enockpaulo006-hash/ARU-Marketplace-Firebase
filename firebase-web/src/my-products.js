import "./style.css";
import { onAuthStateChanged } from "firebase/auth";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    deleteDoc,
    getDoc
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

const productsList = document.getElementById("my-products-list");
const productCount = document.getElementById("product-count");
const filterButtons = document.querySelectorAll(".product-filter");

let myProducts = [];
let currentFilter = "all";

const statusLabels = {
    pending: "Pending Review",
    active: "Approved",
    rejected: "Rejected",
    hidden: "Hidden",
    sold: "Sold"
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    await loadMyProducts(user.uid);
});

async function loadMyProducts(uid) {
    productsList.replaceChildren();
    showMessage("Loading your products...");

    try {
        // Retrieve only products belonging to the signed-in seller.
        const productsQuery = query(
            collection(db, "products"),
            where("sellerId", "==", uid)
        );

        const snapshot = await getDocs(productsQuery);

        myProducts = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data()
        }));

        // Newest products first.
        myProducts.sort((a, b) => {
            const dateA = a.createdAt?.toMillis?.() ?? 0;
            const dateB = b.createdAt?.toMillis?.() ?? 0;
            return dateB - dateA;
        });

        renderProducts();
    } catch (error) {
        console.error("Failed to load your products:", error);

        showMessage(
            "We could not load your products. Please refresh the page and try again."
        );
    }
}

function renderProducts() {
    productsList.replaceChildren();

    const filteredProducts = myProducts.filter((product) => {
        return currentFilter === "all"
            || product.status === currentFilter;
    });

    productCount.textContent =
        `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`;

    if (filteredProducts.length === 0) {
        showMessage(
            currentFilter === "all"
                ? "You have not submitted any products yet."
                : `You have no ${statusLabels[currentFilter]?.toLowerCase() || currentFilter} products.`
        );
        return;
    }

    filteredProducts.forEach((product) => {
        productsList.appendChild(createProductCard(product));
    });
}

function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "my-product-card";

    const image = document.createElement("img");
    image.className = "my-product-image";
    image.src =
        product.imageUrls?.[0]
        || product.imageUrl
        || "https://placehold.co/300x220?text=No+Image";
    image.alt = product.title || "Product image";
    image.loading = "lazy";

    image.onerror = () => {
        image.onerror = null;
        image.src = "https://placehold.co/300x220?text=No+Image";
    };

    const details = document.createElement("div");
    details.className = "my-product-details";

    const title = document.createElement("h3");
    title.textContent = product.title || "Untitled Product";

    const price = document.createElement("p");
    price.className = "my-product-price";
    price.textContent = product.price != null
        ? `TZS ${Number(product.price).toLocaleString()}`
        : "Price unavailable";

    const status = document.createElement("span");
    const statusKey = statusLabels[product.status]
        ? product.status
        : "pending";

    status.className = `my-product-status status-${statusKey}`;
    status.textContent = statusLabels[statusKey];

    const submitted = document.createElement("p");
    submitted.className = "my-product-date";

    const timestamp = product.createdAt?.toDate?.();

    submitted.textContent = timestamp
        ? `Submitted: ${timestamp.toLocaleString()}`
        : "Submission date unavailable";

    details.append(title, price, status, submitted);

    const actions = document.createElement("div");
actions.className = "my-product-actions";

const editButton = document.createElement("button");
editButton.type = "button";
editButton.className = "my-product-edit-button";
editButton.textContent = "Edit";
editButton.addEventListener("click", () => {
    window.location.href =
        `/edit-product.html?id=${encodeURIComponent(product.id)}`;
});

actions.appendChild(editButton);

const deleteButton = document.createElement("button");
deleteButton.type = "button";
deleteButton.className = "my-product-delete-button";
deleteButton.textContent = "Delete";

if (product.status === "sold") {
    deleteButton.disabled = true;
    deleteButton.title = "Sold products cannot be deleted";
}

deleteButton.addEventListener("click", async () => {
    if (product.status === "sold") {
        alert("Sold products cannot be deleted.");
        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to delete "${product.title || "this product"}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    try {
        const productRef = doc(db, "products", product.id);
        const latestSnapshot = await getDoc(productRef);

        if (!latestSnapshot.exists()) {
            alert("This product has already been deleted.");
            await loadMyProductsAgain();
            return;
        }

        const latestProduct = latestSnapshot.data();

        if (latestProduct.sellerId !== auth.currentUser?.uid) {
            throw new Error("You cannot delete another seller's product.");
        }

        if (latestProduct.status === "sold") {
            throw new Error("Sold products cannot be deleted.");
        }

        await deleteDoc(productRef);

        myProducts = myProducts.filter(
            (item) => item.id !== product.id
        );

        renderProducts();
        alert("Product deleted successfully.");
    } catch (error) {
        console.error("Could not delete product:", error);
        alert(error.message || "Could not delete the product. Please try again.");
        deleteButton.disabled = false;
        deleteButton.textContent = "Delete";
    }
});

actions.appendChild(deleteButton);

details.appendChild(actions);

    if (product.status === "rejected" && product.rejectionReason) {
        const reason = document.createElement("p");
        reason.className = "my-product-rejection";
        reason.textContent = `Reason: ${product.rejectionReason}`;
        details.appendChild(reason);
    }

    card.append(image, details);
    return card;
}

function showMessage(message) {
    productsList.replaceChildren();

    const paragraph = document.createElement("p");
    paragraph.className = "my-products-message";
    paragraph.textContent = message;

    productsList.appendChild(paragraph);
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.status;

        filterButtons.forEach((item) => {
            const isActive = item === button;
            item.classList.toggle("active", isActive);
            item.setAttribute("aria-pressed", String(isActive));
        });

        renderProducts();
    });
});