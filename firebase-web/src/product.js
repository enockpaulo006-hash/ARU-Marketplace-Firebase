import "./style.css";

import { onAuthStateChanged } from "firebase/auth";
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
        // 1. Check the individual product cache first.
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

        // 2. Check the homepage products cache.
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
            // 3. Save it in the individual cache for future visits.
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

        // Do not add a second transformation to an already transformed URL.
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

// --------------------------------------------------
// IMAGE LOADERS
// --------------------------------------------------

function createImageLoader(extraClass = "") {
    const loader = document.createElement("div");

    loader.className =
        `product-image-placeholder ${extraClass}`.trim();

    loader.setAttribute("role", "status");
    loader.setAttribute("aria-label", "Loading image");

    for (let i = 0; i < 3; i++) {
        const dot = document.createElement("span");
        dot.className = "loading-dot";
        loader.appendChild(dot);
    }

    return loader;
}

function showUnavailableImage(
    container,
    message = "Image unavailable"
) {
    container.className = "no-product-image";

    container.innerHTML = `
        <i class="bi bi-image"></i>
        <span>${message}</span>
    `;
}

// --------------------------------------------------
// DISPLAY PRODUCT IMAGES AND THUMBNAILS
// --------------------------------------------------

function displayProductImages() {
    if (!mainImage || !thumbnails) return;

    const imageUrls = currentProduct?.imageUrls || [];

    mainImage.replaceChildren();
    thumbnails.replaceChildren();

    if (!imageUrls.length) {
        showUnavailableImage(mainImage, "No Image");
        return;
    }

    function showMainImage(index) {
        if (!imageUrls[index]) return;

        selectedImageIndex = index;

        const image = document.createElement("img");

        image.id = "selected-product-image";

        image.alt =
            currentProduct.title || `Product image ${index + 1}`;

        image.className = "product-image-loading";
        image.decoding = "async";
        image.loading = "eager";

        image.fetchPriority = index === 0 ? "high" : "auto";

        const loader = createImageLoader();

        mainImage.replaceChildren(loader);

        image.addEventListener("load", () => {
            loader.remove();

            image.classList.remove("product-image-loading");
            image.classList.add("product-image-loaded");

        }, { once: true });

        image.addEventListener("error", () => {
            showUnavailableImage(loader);
            image.remove();

        }, { once: true });

        mainImage.appendChild(image);

        const price = getPhotoPrice(index);

        if (price !== null) {
            const priceLabel = document.createElement("div");

            priceLabel.className = "product-photo-price";
            priceLabel.textContent = formatPrice(price);

            mainImage.appendChild(priceLabel);
        }

        image.src = getOptimizedImageUrl(imageUrls[index], 800);

        thumbnails.querySelectorAll(".product-thumbnail").forEach(
            (thumbnail, thumbnailIndex) => {
                thumbnail.classList.toggle(
                    "active",
                    thumbnailIndex === index
                );
            }
        );

        updateOrderTotal();

        if (productPrice && price !== null) {
            productPrice.textContent = formatPrice(price);
        }
    }

    imageUrls.forEach((url, index) => {
        const thumbnail = document.createElement("button");

        thumbnail.type = "button";
        thumbnail.className = "product-thumbnail";

        thumbnail.setAttribute(
            "aria-label",
            `View product photo ${index + 1}`
        );

        const thumbnailWrapper = document.createElement("span");

        thumbnailWrapper.className = "product-thumbnail-image";

        const loader = createImageLoader("thumbnail-image-loader");

        const image = document.createElement("img");

        image.alt = `Product photo ${index + 1}`;
        image.loading = index === 0 ? "eager" : "lazy";
        image.decoding = "async";

        image.addEventListener("load", () => {
            loader.remove();
            image.classList.add("product-image-loaded");

        }, { once: true });

        image.addEventListener("error", () => {
            showUnavailableImage(loader, "Unavailable");
            image.remove();

        }, { once: true });

        thumbnailWrapper.append(loader, image);
        thumbnail.appendChild(thumbnailWrapper);

        image.src = getOptimizedImageUrl(url, 180);

        const price = getPhotoPrice(index);

        if (price !== null) {
            const label = document.createElement("span");

            label.className = "product-thumbnail-price";
            label.textContent = formatPrice(price);

            thumbnail.appendChild(label);
        }

        thumbnail.addEventListener("click", () => {
            showMainImage(index);
        });

        thumbnails.appendChild(thumbnail);
    });

    showMainImage(0);
}

// --------------------------------------------------
// RENDER PRODUCT INFORMATION
// --------------------------------------------------

function renderProduct(product) {
    currentProduct = product;
    selectedImageIndex = 0;

    if (productTitle) {
        productTitle.textContent =
            product.title || "Untitled Product";
    }

    if (productCategory) {
        productCategory.textContent =
            product.category || "Other";
    }

    if (productCondition) {
        productCondition.textContent =
            product.productCondition || "Not specified";
    }

    if (productLocation) {
        productLocation.textContent =
            product.location || "Not specified";
    }

    if (productDescription) {
        productDescription.textContent =
            product.description || "No description available.";
    }

    if (productPrice) {
        productPrice.textContent =
            formatPrice(getPhotoPrice(0) ?? product.price);
    }

    displayProductImages();
    updateOrderTotal();

    showProductContent();
}

// --------------------------------------------------
// LOAD PRODUCT
// CACHE FIRST + BACKGROUND REFRESH
// --------------------------------------------------

async function loadProduct() {
    if (!productId) {
        showProductError("Product link is missing its ID.");
        return;
    }

    // STEP 1: Read cached product immediately.
    const cachedProduct = readCachedProduct(productId);

    const hasCachedProduct = Boolean(cachedProduct);

    if (hasCachedProduct) {
        renderProduct(cachedProduct);

        console.log("Displayed cached product:", productId);

    } else {
        showProductLoader();
    }

    // STEP 2: Check Firestore server in the background.
    try {
        const snapshot = await getDocFromServer(
            doc(db, "products", productId)
        );

        if (!snapshot.exists()) {
            removeProductCache(productId);

            showProductError(
                "This product could not be found."
            );

            return;
        }

        const freshProduct = snapshot.data();

        if (freshProduct.status !== "active") {
            removeProductCache(productId);

            showProductError(
                "This product is no longer available."
            );

            return;
        }

        // STEP 3: Update local cache.
        saveProductCache(productId, freshProduct);

        // STEP 4: Update product information quietly.
        renderProduct(freshProduct);

        console.log(
            "Product refreshed from Firestore:",
            productId
        );

    } catch (error) {
        console.error(
            "Failed to refresh product:",
            error
        );

        if (hasCachedProduct) {
            // Keep cached product visible when offline.
            console.log(
                "Using cached product while offline."
            );

        } else {
            showProductError(
                "Unable to load this product. Please check your connection and try again."
            );
        }
    }
}

// Load product immediately.
loadProduct();

// --------------------------------------------------
// TANZANIAN PHONE NUMBER
// --------------------------------------------------

function normalizeTanzanianPhone(phone) {
    const digits = String(phone || "").trim();

    // Require exactly 10 digits beginning with 06 or 07.
    if (!/^0[67]\d{8}$/.test(digits)) {
        return null;
    }

    // Store in international format for WhatsApp.
    return "255" + digits.slice(1);
}
// --------------------------------------------------
// CONTACT SELLER THROUGH WHATSAPP
// Login is NOT required to contact a seller.
// --------------------------------------------------

async function contactSeller() {
    if (!currentProduct) {
        showOrderMessage("Product information is not ready yet.", "error");
        return;
    }

    if (!authResolved) {
        showOrderMessage("Please wait a moment and try again.", "error");
        return;
    }

    if (currentUser && currentProduct.sellerId === currentUser.uid) {
        showOrderMessage("This is your own product listing.", "error");
        return;
    }

    const whatsappWindow = window.open("about:blank", "_blank");

    if (!whatsappWindow) {
        showOrderMessage("Please allow pop-ups to open WhatsApp.", "error");
        return;
    }

    whatsappWindow.opener = null;

    if (contactSellerButton) contactSellerButton.disabled = true;

    try {
        const snapshot = await getDocFromServer(
            doc(db, "sellerContacts", currentProduct.sellerId)
        );

        if (!snapshot.exists()) {
            throw new Error("This seller has not added a WhatsApp contact yet.");
        }

        const phone = normalizeTanzanianPhone(snapshot.data().whatsapp);

        if (!phone) {
            throw new Error("The seller's WhatsApp number is missing or invalid.");
        }

        const message =
            `Hello, I am interested in your product: ${
                currentProduct.title || "a product"
            } on ARU Marketplace.`;

        whatsappWindow.location.href =
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        showOrderMessage("Opening WhatsApp to contact the seller...", "success");

    } catch (error) {
        whatsappWindow.close();
        console.error("Contact seller failed:", error);

        showOrderMessage(
            error.message || "Unable to contact this seller.",
            "error"
        );

    } finally {
        if (contactSellerButton) contactSellerButton.disabled = false;
    }
}

// --------------------------------------------------
// PLACE ORDER
// Registered buyers use their account.
// Guests can order using their name and phone number.
// --------------------------------------------------

async function placeOrder() {
    if (!currentProduct || orderInProgress) {
        showOrderMessage("Product information is not ready yet.", "error");
        return;
    }

    if (!authResolved) {
        showOrderMessage("Please wait a moment and try again.", "error");
        return;
    }

    if (isModerator) {
        showOrderMessage("Moderator accounts cannot place orders.", "error");
        return;
    }

    if (currentUser && currentProduct.sellerId === currentUser.uid) {
        showOrderMessage("You cannot place an order for your own product.", "error");
        return;
    }

    if (currentProduct.status !== "active") {
        showOrderMessage("This product is no longer available.", "error");
        return;
    }

    const buyerName = guestBuyerNameInput?.value.trim() || "";
    const buyerPhone = normalizeTanzanianPhone(
        guestBuyerPhoneInput?.value
    );

    if (!buyerName) {
        showOrderMessage("Please enter your full name.", "error");
        guestBuyerNameInput?.focus();
        return;
    }

    if (buyerName.length > 80) {
        showOrderMessage("Your name must not exceed 80 characters.", "error");
        guestBuyerNameInput?.focus();
        return;
    }

    if (!buyerPhone) {
        showOrderMessage(
            "Enter exactly 10 digits, starting with 06 or 07.",
            "error"
        );
        guestBuyerPhoneInput?.focus();
        return;
    }

    const quantity = Number.parseInt(quantityInput?.value, 10);
    const unitPrice = getSelectedPrice();

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        showOrderMessage("Please enter a valid quantity.", "error");
        return;
    }

    if (unitPrice === null) {
        showOrderMessage("The selected photo has no valid price.", "error");
        return;
    }

    const confirmed = window.confirm(
        `Place an order for ${quantity} item(s) for ${
            formatPrice(unitPrice * quantity)
        }?`
    );

    if (!confirmed) return;

    orderInProgress = true;

    if (placeOrderButton) {
        placeOrderButton.disabled = true;
        placeOrderButton.innerHTML =
            '<i class="bi bi-arrow-repeat"></i> Placing Order...';
    }

    try {
        const latestSnapshot = await getDocFromServer(
            doc(db, "products", productId)
        );

        if (!latestSnapshot.exists()) {
            throw new Error("This product is no longer available.");
        }

        const latestProduct = latestSnapshot.data();

        if (
            latestProduct.status !== "active" ||
            latestProduct.sellerId !== currentProduct.sellerId
        ) {
            throw new Error(
                "This product has changed. Refresh and try again."
            );
        }

        const latestPrice =
            latestProduct.imagePrices?.[selectedImageIndex] ??
            latestProduct.imageDetails?.[selectedImageIndex]?.price ??
            (selectedImageIndex === 0 ? latestProduct.price : null);

        if (latestPrice === null || Number(latestPrice) !== unitPrice) {
            throw new Error(
                "The photo price has changed. Refresh and try again."
            );
        }

        if (currentUser && latestProduct.sellerId === currentUser.uid) {
            throw new Error("You cannot order your own product.");
        }

        const imageUrls = latestProduct.imageUrls || [];

        const orderData = {
            buyerId: currentUser ? currentUser.uid : "",
            buyerName: buyerName,
            buyerPhone: buyerPhone,
            sellerId: latestProduct.sellerId,
            productId,
            productTitle: latestProduct.title || "Product",
            productImage: imageUrls[selectedImageIndex] || "",
            selectedImageIndex,
            unitPrice,
            quantity,
            totalPrice: unitPrice * quantity,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        if (!currentUser) {
            orderData.buyerName = buyerName;
            orderData.buyerPhone = buyerPhone;
        }

        await addDoc(collection(db, "orders"), orderData);

        showOrderMessage(
            currentUser
                ? "Order placed successfully! You can track it in Orders."
                : "Order placed successfully! The seller can contact you using the phone number you provided.",
            "success"
        );

        if (placeOrderButton) {
            placeOrderButton.innerHTML =
                '<i class="bi bi-check-circle"></i> Order Placed';
            placeOrderButton.disabled = true;
        }

    } catch (error) {
        console.error("Failed to place order:", error);

        showOrderMessage(
            error.message || "Unable to place your order. Please try again.",
            "error"
        );

        if (placeOrderButton) {
            placeOrderButton.disabled = false;
            placeOrderButton.innerHTML =
                '<i class="bi bi-bag-check"></i> Place Order';
        }

    } finally {
        orderInProgress = false;
    }
}
// --------------------------------------------------
// QUANTITY CONTROLS
// --------------------------------------------------

decreaseQuantityButton?.addEventListener("click", () => {
    const quantity = Number.parseInt(quantityInput.value, 10) || 1;

    quantityInput.value = String(
        Math.max(1, quantity - 1)
    );

    updateOrderTotal();
});

increaseQuantityButton?.addEventListener("click", () => {
    const quantity = Number.parseInt(quantityInput.value, 10) || 1;

    quantityInput.value = String(
        Math.min(99, quantity + 1)
    );

    updateOrderTotal();
});

quantityInput?.addEventListener(
    "input",
    updateOrderTotal
);

placeOrderButton?.addEventListener(
    "click",
    placeOrder
);

contactSellerButton?.addEventListener(
    "click",
    contactSeller
);

// --------------------------------------------------
// AUTHENTICATION
// Product viewing, seller contact, and guest checkout
// do not require a signed-in account.
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    isModerator = false;
    authResolved = true;

    if (guestCheckoutFields) {
        guestCheckoutFields.hidden = false;
    }

    if (!user) {
        return;
    }

    try {
        const adminSnapshot = await getDoc(
            doc(db, "admins", user.uid)
        );

        isModerator =
            adminSnapshot.exists() &&
            adminSnapshot.data().role === "ADMIN";

        if (isModerator) {
            if (placeOrderButton) {
                placeOrderButton.disabled = true;
            }

            showOrderMessage(
                "Moderator accounts cannot place orders.",
                "error"
            );
        }

    } catch (error) {
        console.error("Account check failed:", error);

        showOrderMessage(
            "Could not verify your account permissions. Ordering may be unavailable.",
            "error"
        );
    }
});
