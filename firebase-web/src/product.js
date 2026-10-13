
import "./style.css";

import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";

import {
    doc,
    getDoc,
    addDoc,
    collection,
    serverTimestamp
} from "firebase/firestore";

// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const loadingMessage =
    document.getElementById("product-loading");

const errorMessage =
    document.getElementById("product-error");

const productContent =
    document.getElementById("product-content");

const mainImage =
    document.getElementById("product-main-image");

const thumbnails =
    document.getElementById("product-image-thumbnails");

const productTitle =
    document.getElementById("product-title");

const productPrice =
    document.getElementById("product-price");

const productCategory =
    document.getElementById("product-category");

const productCondition =
    document.getElementById("product-condition");

const productLocation =
    document.getElementById("product-location");

const productDescription =
    document.getElementById("product-description");

const quantityInput =
    document.getElementById("order-quantity");

const decreaseQuantityButton =
    document.getElementById("decrease-quantity");

const increaseQuantityButton =
    document.getElementById("increase-quantity");

const totalPriceElement =
    document.getElementById("order-total-price");

const placeOrderButton =
    document.getElementById("place-order-button");

const contactSellerButton =
    document.getElementById("contact-seller-button");

const orderMessage =
    document.getElementById("order-message");

let currentProduct = null;
let currentUser = null;
let isModerator = false;
let orderInProgress = false;

// --------------------------------------------------
// GET PRODUCT ID FROM URL
// --------------------------------------------------

const urlParams =
    new URLSearchParams(window.location.search);

const productId =
    urlParams.get("id");

// --------------------------------------------------
// SHOW ERROR
// --------------------------------------------------

function showProductError() {
    loadingMessage.style.display = "none";
    productContent.style.display = "none";
    errorMessage.style.display = "block";
}

// --------------------------------------------------
// FORMAT PRICE
// --------------------------------------------------

function formatPrice(price) {
    return `TZS ${Number(price).toLocaleString()}`;
}

function updateOrderTotal() {
    if (!currentProduct) return;

    let quantity = Number.parseInt(quantityInput.value, 10);

    if (!Number.isInteger(quantity) || quantity < 1) {
        quantity = 1;
        quantityInput.value = "1";
    }

    if (quantity > 99) {
        quantity = 99;
        quantityInput.value = "99";
    }

    totalPriceElement.textContent = formatPrice(
        Number(currentProduct.price) * quantity
    );
}

function showOrderMessage(message, type = "info") {
    orderMessage.textContent = message;
    orderMessage.className = `order-message order-message-${type}`;
}

function normalizeTanzanianPhone(phone) {
    let digits = String(phone || "").replace(/\D/g, "");

    if (digits.startsWith("0")) {
        digits = "255" + digits.slice(1);
    } else if (digits.startsWith("255")) {
        // Already has Tanzania's country code.
    } else {
        return null;
    }

    // Accept standard Tanzanian mobile numbers:
    // 255 followed by 9 digits.
    if (!/^255\d{9}$/.test(digits)) {
        return null;
    }

    return digits;
}

// --------------------------------------------------
// CONTACT SELLER
// --------------------------------------------------

async function contactSeller() {
    if (!currentUser || !currentProduct) {
        showOrderMessage(
            "Please wait until the product has loaded.",
            "error"
        );
        return;
    }

    if (currentProduct.sellerId === currentUser.uid) {
        showOrderMessage(
            "This is your own product listing.",
            "error"
        );
        return;
    }

    // Open a tab immediately to avoid popup blockers.
    const whatsappWindow = window.open("about:blank", "_blank");

    if (!whatsappWindow) {
        showOrderMessage(
            "Please allow pop-ups to open WhatsApp.",
            "error"
        );
        return;
    }

    whatsappWindow.opener = null;
    contactSellerButton.disabled = true;

    try {
        // Public contact information is stored separately
        // from the seller's private user profile.
        const contactSnapshot = await getDoc(
            doc(db, "sellerContacts", currentProduct.sellerId)
        );

        if (!contactSnapshot.exists()) {
            throw new Error(
                "This seller has not added a WhatsApp contact yet."
            );
        }

        const contact = contactSnapshot.data();
        const phone = normalizeTanzanianPhone(contact.whatsapp);

        if (!phone) {
            throw new Error(
                "The seller's WhatsApp number is missing or invalid."
            );
        }

        const message = `Hello, I am interested in your product: ${
            currentProduct.title || "a product"
        }`;

        whatsappWindow.location.href =
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    } catch (error) {
        whatsappWindow.close();

        showOrderMessage(
            error.message ||
                "Could not open the seller's WhatsApp contact.",
            "error"
        );

    } finally {
        contactSellerButton.disabled = false;
    }
}

async function contactSeller() {
    if (!currentUser || !currentProduct) {
        showOrderMessage(
            "Please wait until the product has loaded.",
            "error"
        );
        return;
    }

    if (currentProduct.sellerId === currentUser.uid) {
        showOrderMessage(
            "This is your own product listing.",
            "error"
        );
        return;
    }

    // Open a tab immediately to avoid popup blockers.
    const whatsappWindow = window.open("about:blank", "_blank");

    if (!whatsappWindow) {
        showOrderMessage(
            "Please allow pop-ups to open WhatsApp.",
            "error"
        );
        return;
    }

    whatsappWindow.opener = null;
    contactSellerButton.disabled = true;

    try {
        // Public contact information is stored separately
        // from the seller's private user profile.
        const contactSnapshot = await getDoc(
            doc(db, "sellerContacts", currentProduct.sellerId)
        );

        if (!contactSnapshot.exists()) {
            throw new Error(
                "This seller has not added a WhatsApp contact yet."
            );
        }

        const contact = contactSnapshot.data();
        const phone = normalizeTanzanianPhone(contact.whatsapp);

        if (!phone) {
            throw new Error(
                "The seller's WhatsApp number is missing or invalid."
            );
        }

        const message = `Hello, I am interested in your product: ${
            currentProduct.title || "a product"
        } on ARU Marketplace.`;

        const whatsappUrl =
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        whatsappWindow.location.href = whatsappUrl;

        showOrderMessage(
            "Opening WhatsApp to contact the seller...",
            "success"
        );

    } catch (error) {
        whatsappWindow.close();
        console.error("Contact seller failed:", error);

        showOrderMessage(
            error.message || "Unable to contact this seller.",
            "error"
        );

    } finally {
        contactSellerButton.disabled = false;
    }
}
