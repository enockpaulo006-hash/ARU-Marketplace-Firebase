import "./style.css";

import { onAuthStateChanged } from "firebase/auth";
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

const form = document.getElementById("edit-product-form");
const fields = document.getElementById("edit-fields");
const message = document.getElementById("edit-message");
const saveButton = document.getElementById("save-product-button");
const imagesContainer = document.getElementById("current-images");

const titleInput = document.getElementById("edit-title");
const categoryInput = document.getElementById("edit-category");
const priceInput = document.getElementById("edit-price");
const conditionInput = document.getElementById("edit-condition");
const locationInput = document.getElementById("edit-location");
const descriptionInput = document.getElementById("edit-description");

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

let currentUser = null;
let productRef = null;
let originalProduct = null;

function showMessage(text, type = "info") {
    message.textContent = text;
    message.className = `edit-message edit-message-${type}`;
}

function renderImages(product) {
    imagesContainer.replaceChildren();

    const imageUrls = product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl
            ? [product.imageUrl]
            : [];

    if (imageUrls.length === 0) {
        const text = document.createElement("p");
        text.textContent = "No photos available.";
        imagesContainer.appendChild(text);
        return;
    }

    imageUrls.forEach((url, index) => {
        const image = document.createElement("img");
        image.src = url;
        image.alt = `Product photo ${index + 1}`;
        image.loading = "lazy";

        image.onerror = () => {
            image.alt = "Unable to load this product photo";
        };

        imagesContainer.appendChild(image);
    });
}

async function loadProduct(user) {
    if (!productId) {
        showMessage("Product ID is missing. Return to My Products.", "error");
        return;
    }

    productRef = doc(db, "products", productId);

    try {
        const snapshot = await getDoc(productRef);

        if (!snapshot.exists()) {
            showMessage("This product could not be found.", "error");
            return;
        }

        const product = snapshot.data();

        if (product.sellerId !== user.uid) {
            showMessage("You are not allowed to edit this product.", "error");
            return;
        }

        if (product.status === "sold") {
            showMessage(
                "Sold products cannot be edited. Contact support if you need to correct a listing.",
                "error"
            );
            return;
        }

        originalProduct = product;

        titleInput.value = product.title || "";
        categoryInput.value = product.category || "";
        priceInput.value = product.price ?? "";
        conditionInput.value = product.productCondition || "";
        locationInput.value = product.location || "";
        descriptionInput.value = product.description || "";

        renderImages(product);

        fields.disabled = false;
        showMessage(
            product.status === "active"
                ? "Editing an approved product will send it back for review."
                : "Update the details carefully before saving.",
            "info"
        );
    } catch (error) {
        console.error("Could not load product:", error);
        showMessage(
            "Could not load this product. Check your connection and try again.",
            "error"
        );
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    currentUser = user;
    await loadProduct(user);
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || !productRef || !originalProduct) {
        showMessage("Product details are not ready yet.", "error");
        return;
    }

    const title = titleInput.value.trim();
    const category = categoryInput.value;
    const price = Number(priceInput.value);
    const condition = conditionInput.value;
    const location = locationInput.value.trim();
    const description = descriptionInput.value.trim();

    if (
        !title ||
        !category ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(price) ||
        !condition ||
        !location ||
        !description
    ) {
        showMessage("Please complete all fields with valid information.", "error");
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving changes...";

    try {
        const changes = {
            title,
            category,
            price,
            productCondition: condition,
            location,
            description,
            updatedAt: serverTimestamp()
        };

        // Re-submit changed approved/rejected/hidden products for review.
        if (["active", "rejected", "hidden"].includes(originalProduct.status)) {
            changes.status = "pending";
            changes.rejectionReason = "";
            changes.reviewedBy = "";
            changes.reviewedAt = null;
        }

        await updateDoc(productRef, changes);

        showMessage(
            changes.status === "pending"
                ? "Changes saved. Your product is pending review."
                : "Your changes have been saved.",
            "success"
        );

        originalProduct = {
            ...originalProduct,
            ...changes,
            status: changes.status || originalProduct.status
        };
    } catch (error) {
        console.error("Could not save product changes:", error);

        showMessage(
            "Could not save changes. Firestore permissions may need updating. Your existing product has not been deleted.",
            "error"
        );
    } finally {
        saveButton.disabled = false;
        saveButton.innerHTML =
            '<i class="bi bi-check-circle"></i> Save Changes';
    }
});
