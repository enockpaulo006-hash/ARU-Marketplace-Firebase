import "./style.css";

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "./firebase.js";

import {
    doc,
    getDoc,
    getDocFromServer,
    addDoc,
    collection,
    serverTimestamp
} from "firebase/firestore";

// --------------------------------------------------
// ELEMENTS
// --------------------------------------------------

const loadingMessage = document.getElementById("product-loading");
const errorMessage = document.getElementById("product-error");
const productContent = document.getElementById("product-content");
const mainImage = document.getElementById("product-main-image");
const thumbnails = document.getElementById("product-image-thumbnails");

const productTitle = document.getElementById("product-title");
const productPrice = document.getElementById("product-price");
const productCategory = document.getElementById("product-category");
const productCondition = document.getElementById("product-condition");
const productLocation = document.getElementById("product-location");
const productDescription = document.getElementById("product-description");

const quantityInput = document.getElementById("order-quantity");
const decreaseQuantityButton = document.getElementById("decrease-quantity");
const increaseQuantityButton = document.getElementById("increase-quantity");
const totalPriceElement = document.getElementById("order-total-price");

const placeOrderButton = document.getElementById("place-order-button");
const contactSellerButton = document.getElementById("contact-seller-button");
const orderMessage = document.getElementById("order-message");

const guestCheckoutFields = document.getElementById("guest-checkout-fields");
const guestBuyerNameInput = document.getElementById("guest-buyer-name");
const guestBuyerPhoneInput = document.getElementById("guest-buyer-phone");

// --------------------------------------------------
// STATE
// --------------------------------------------------

let currentProduct = null;
let currentUser = null;
let authResolved = false;
let isModerator = false;
let orderInProgress = false;
let selectedImageIndex = 0;

// --------------------------------------------------
// PRODUCT ID
// --------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

// --------------------------------------------------
// PRODUCT CACHE
// Each product has its own cache entry.
// --------------------------------------------------

const PRODUCT_CACHE_PREFIX = "aru_marketplace_product_v1_";

function getProductCacheKey(id) {
    return `${PRODUCT_CACHE_PREFIX}${id}`;
}

function readCachedProduct(id) {
    try {
        const individualRaw = localStorage.getItem(
            getProductCacheKey(id)
        );

        if (individualRaw) {
            try {
                const cached = JSON.parse(individualRaw);

                if (
                    cached?.product &&
                    cached.product.status === "active"
                ) {
                    return cached.product;
                }
            } catch (error) {
                console.warn("Invalid individual product cache:", error);
            }
        }

        const homepageRaw = localStorage.getItem(
            "aru_marketplace_active_products_v1"
        );

        if (!homepageRaw) return null;

        const homepageCache = JSON.parse(homepageRaw);

        if (!Array.isArray(homepageCache.products)) {
            return null;
        }

        const product = homepageCache.products.find(
            item =>
                item &&
                String(item.id) === String(id) &&
                item.status === "active"
        );

        if (product) {
            saveProductCache(id, product);
            return product;
        }

        return null;

    } catch (error) {
        console.warn("Could not read product cache:", error);
        return null;
    }
}

function saveProductCache(id, product) {
    try {
        localStorage.setItem(
            getProductCacheKey(id),
            JSON.stringify({
                product,
                savedAt: Date.now()
            })
        );

    } catch (error) {
        console.warn("Could not save product cache:", error);
    }
}

function removeProductCache(id) {
    try {
        localStorage.removeItem(getProductCacheKey(id));
    } catch (error) {
        console.warn("Could not remove product cache:", error);
    }
}

// --------------------------------------------------
// ORDER / CONTACT MESSAGES
// --------------------------------------------------

function showOrderMessage(message, type = "error") {
    if (!orderMessage) return;

    orderMessage.textContent = message;
    orderMessage.className = `order-message ${type}`;
    orderMessage.style.display = "block";
}

// --------------------------------------------------
// LOADING SCREEN
// --------------------------------------------------

function showProductLoader() {
    if (!loadingMessage) return;

    loadingMessage.className =
        "products-loading product-page-loading";

    loadingMessage.setAttribute("role", "status");
    loadingMessage.setAttribute("aria-label", "Loading product");

    loadingMessage.innerHTML = `
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
        <span class="loading-dot"></span>
    `;

    loadingMessage.style.display = "flex";

    if (productContent) {
        productContent.style.display = "none";
    }

    if (errorMessage) {
        errorMessage.style.display = "none";
    }
}

function showProductError(message = "Unable to load this product.") {
    if (loadingMessage) loadingMessage.style.display = "none";

    if (productContent) productContent.style.display = "none";

    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = "block";
    }
}

function showProductContent() {
    if (loadingMessage) loadingMessage.style.display = "none";

    if (errorMessage) errorMessage.style.display = "none";

    if (productContent) {
        productContent.style.display = "grid";
    }
}

// --------------------------------------------------
// PRICE HELPERS
// --------------------------------------------------

function formatPrice(price) {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
        return "Price not available";
    }

    return `TZS ${numericPrice.toLocaleString()}`;
}

function getPhotoPrice(index) {
    if (!currentProduct) return null;

    const value =
        currentProduct.imagePrices?.[index] ??
        currentProduct.imageDetails?.[index]?.price ??
        (index === 0 ? currentProduct.price : null);

    if (value === null || value === undefined || value === "") {
        return null;
    }

    const price = Number(value);

    return Number.isFinite(price) && price >= 0 ? price : null;
}

function getSelectedPrice() {
    return getPhotoPrice(selectedImageIndex);
}

function updateOrderTotal() {
    if (!currentProduct || !quantityInput || !totalPriceElement) {
        return;
    }

    let quantity = Number.parseInt(quantityInput.value, 10);

    if (!Number.isInteger(quantity) || quantity < 1) {
        quantity = 1;
        quantityInput.value = "1";
    }

    if (quantity > 99) {
        quantity = 99;
        quantityInput.value = "99";
    }

    const price = getSelectedPrice();

    totalPriceElement.textContent = price === null
        ? "Price not available"
        : formatPrice(price * quantity);
}

// --------------------------------------------------
// CLOUDINARY IMAGE OPTIMIZATION
// --------------------------------------------------

function getOptimizedImageUrl(url, width = 1000) {
    if (typeof url !== "string" || !url) return "";

    try {
        const parsedUrl = new URL(url);

        if (!parsedUrl.hostname.endsWith("res.cloudinary.com")) {
            return url;
        }

        const marker = "/upload/";
        const markerIndex = parsedUrl.pathname.indexOf(marker);

        if (markerIndex === -1) return url;

        const remainingPath = parsedUrl.pathname.slice(
            markerIndex + marker.length
        );

        const firstSegment = remainingPath.split("/")[0];

        if (/^(w_|h_|c_|f_auto|q_auto|q_[0-9])/.test(firstSegment)) {
            return url;
        }

        parsedUrl.pathname =
            parsedUrl.pathname.slice(0, markerIndex + marker.length) +
            `w_${width},c_limit,f_auto,q_auto/` +
            remainingPath;

        return parsedUrl.toString();

    } catch {
        return url;
    }
}