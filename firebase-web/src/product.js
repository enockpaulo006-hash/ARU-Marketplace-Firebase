
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
// GET PRODUCT ID
// --------------------------------------------------

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

// --------------------------------------------------
// UI HELPERS
// --------------------------------------------------

function formatPrice(price) {
    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice)) {
        return "Price not available";
    }

    return `TZS ${numericPrice.toLocaleString()}`;
}

function showOrderMessage(message, type = "info") {
    if (!orderMessage) return;

    orderMessage.textContent = message;
    orderMessage.className = `order-message order-message-${type}`;
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
// IMAGE URL OPTIMIZATION
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

        // Avoid adding transformations to URLs already transformed.
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
// PHOTO PRICES
// --------------------------------------------------

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

// --------------------------------------------------
// ORDER TOTAL
// --------------------------------------------------

function updateOrderTotal() {
    if (!currentProduct || !quantityInput || !totalPriceElement) return;

    let quantity = Number.parseInt(quantityInput.value, 10);

    if (!Number.isInteger(quantity) || quantity < 1) {
        quantity = 1;
        quantityInput.value = "1";
    }

    if (quantity > 99) {
        quantity = 99;
        quantityInput.value = "99";
    }

    const unitPrice = getSelectedPrice();

    totalPriceElement.textContent = unitPrice === null
        ? "Price not available"
        : formatPrice(unitPrice * quantity);
}

// --------------------------------------------------
// TANZANIAN PHONE NUMBER
// --------------------------------------------------

function normalizeTanzanianPhone(phone) {
    let digits = String(phone || "").replace(/\D/g, "");

    if (digits.startsWith("0")) {
        digits = "255" + digits.slice(1);
    } else if (!digits.startsWith("255")) {
        return null;
    }

    return /^255\d{9}$/.test(digits) ? digits : null;
}

// --------------------------------------------------
// PRODUCT IMAGES AND THUMBNAILS
// --------------------------------------------------

function displayProductImages() {
    if (!mainImage || !thumbnails) return;

    const imageUrls = currentProduct?.imageUrls || [];

    mainImage.replaceChildren();
    thumbnails.replaceChildren();

    if (!imageUrls.length) {
        mainImage.innerHTML = `
            <div class="no-product-image">
                <i class="bi bi-image"></i>
                <span>No Image</span>
            </div>
        `;
        return;
    }

    function showMainImage(index) {
        selectedImageIndex = index;

        const image = document.createElement("img");
        image.id = "selected-product-image";
        image.alt = currentProduct.title || `Product image ${index + 1}`;
        image.className = "product-image-loading";
        image.decoding = "async";
        image.loading = "eager";
        image.fetchPriority = index === 0 ? "high" : "auto";

        const placeholder = document.createElement("div");
        placeholder.className = "product-image-placeholder";
        placeholder.innerHTML = `
            <span class="image-loading-spinner"></span>
            <span>Loading image...</span>
        `;

        mainImage.replaceChildren(placeholder);

        image.addEventListener("load", () => {
            placeholder.remove();
            image.classList.remove("product-image-loading");
            image.classList.add("product-image-loaded");
        }, { once: true });

        image.addEventListener("error", () => {
            placeholder.className = "no-product-image";
            placeholder.innerHTML = `
                <i class="bi bi-image"></i>
                <span>Image unavailable</span>
            `;
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

        image.src = getOptimizedImageUrl(imageUrls[index], 1000);

        thumbnails.querySelectorAll(".product-thumbnail").forEach((item, i) => {
            item.classList.toggle("active", i === index);
        });

        updateOrderTotal();

        if (productPrice && price !== null) {
            productPrice.textContent = formatPrice(price);
        }
    }

    imageUrls.forEach((url, index) => {
        const thumbnail = document.createElement("button");
        thumbnail.type = "button";
        thumbnail.className = "product-thumbnail";
        thumbnail.setAttribute("aria-label", `View product photo ${index + 1}`);

        const thumbnailImage = document.createElement("img");
        thumbnailImage.alt = `Product photo ${index + 1}`;
        thumbnailImage.loading = index === 0 ? "eager" : "lazy";
        thumbnailImage.decoding = "async";
        thumbnailImage.src = getOptimizedImageUrl(url, 180);

        thumbnail.appendChild(thumbnailImage);

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
// LOAD PRODUCT
// Starts independently of the authentication check.
// --------------------------------------------------

async function loadProduct() {
    if (!productId) {
        showProductError("Product link is missing its ID.");
        return;
    }

    try {
        const snapshot = await getDoc(doc(db, "products", productId));

        if (!snapshot.exists()) {
            showProductError("This product could not be found.");
            return;
        }

        const product = snapshot.data();

        if (product.status !== "active") {
            showProductError("This product is no longer available.");
            return;
        }

        currentProduct = product;

        if (productTitle) {
            productTitle.textContent = product.title || "Untitled Product";
        }

        if (productCategory) {
            productCategory.textContent = product.category || "Other";
        }

        if (productCondition) {
            productCondition.textContent =
                product.productCondition || "Not specified";
        }

        if (productLocation) {
            productLocation.textContent = product.location || "Not specified";
        }

        if (productDescription) {
            productDescription.textContent =
                product.description || "No description available.";
        }

        selectedImageIndex = 0;

        if (productPrice) {
            productPrice.textContent =
                formatPrice(getPhotoPrice(0) ?? product.price);
        }

        displayProductImages();
        updateOrderTotal();
        showProductContent();
    } catch (error) {
        console.error("Failed to load product:", error);
        showProductError("Unable to load this product. Please try again.");
    }
}

// Begin retrieving product data immediately.
loadProduct();

// --------------------------------------------------
// CONTACT SELLER THROUGH WHATSAPP
// --------------------------------------------------

async function contactSeller() {
    if (!authResolved || !currentUser || !currentProduct) {
        showOrderMessage("Please wait until your account is ready.", "error");
        return;
    }

    if (currentProduct.sellerId === currentUser.uid) {
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
        const snapshot = await getDoc(
            doc(db, "sellerContacts", currentProduct.sellerId)
        );

        if (!snapshot.exists()) {
            throw new Error("This seller has not added a WhatsApp contact yet.");
        }

        const phone = normalizeTanzanianPhone(snapshot.data().whatsapp);

        if (!phone) {
            throw new Error("The seller's WhatsApp number is missing or invalid.");
        }

        const message = `Hello, I am interested in your product: ${
            currentProduct.title || "a product"
        } on ARU Marketplace.`;

        whatsappWindow.location.href =
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

        showOrderMessage("Opening WhatsApp to contact the seller...", "success");
    } catch (error) {
        whatsappWindow.close();
        console.error("Contact seller failed:", error);
        showOrderMessage(error.message || "Unable to contact this seller.", "error");
    } finally {
        if (contactSellerButton) contactSellerButton.disabled = false;
    }
}

// --------------------------------------------------
// PLACE ORDER
// --------------------------------------------------

async function placeOrder() {
    if (!authResolved || !currentUser || !currentProduct || orderInProgress) {
        showOrderMessage("Please wait until your account is ready.", "error");
        return;
    }

    if (isModerator) {
        showOrderMessage("Moderator accounts cannot place orders.", "error");
        return;
    }

    if (currentProduct.sellerId === currentUser.uid) {
        showOrderMessage("You cannot place an order for your own product.", "error");
        return;
    }

    if (currentProduct.status !== "active") {
        showOrderMessage("This product is no longer available.", "error");
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
        const latestSnapshot = await getDoc(doc(db, "products", productId));

        if (!latestSnapshot.exists()) {
            throw new Error("This product is no longer available.");
        }

        const latestProduct = latestSnapshot.data();

        if (
            latestProduct.status !== "active" ||
            latestProduct.sellerId !== currentProduct.sellerId
        ) {
            throw new Error("This product has changed. Refresh and try again.");
        }

        const latestPrice =
            latestProduct.imagePrices?.[selectedImageIndex] ??
            latestProduct.imageDetails?.[selectedImageIndex]?.price ??
            (selectedImageIndex === 0 ? latestProduct.price : null);

        if (latestPrice === null || Number(latestPrice) !== unitPrice) {
            throw new Error("The photo price has changed. Refresh and try again.");
        }

        if (latestProduct.sellerId === currentUser.uid) {
            throw new Error("You cannot order your own product.");
        }

        const imageUrls = latestProduct.imageUrls || [];

        await addDoc(collection(db, "orders"), {
            buyerId: currentUser.uid,
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
        });

        showOrderMessage(
            "Order placed successfully! You can track it in Orders.",
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
    quantityInput.value = String(Math.max(1, quantity - 1));
    updateOrderTotal();
});

increaseQuantityButton?.addEventListener("click", () => {
    const quantity = Number.parseInt(quantityInput.value, 10) || 1;
    quantityInput.value = String(Math.min(99, quantity + 1));
    updateOrderTotal();
});

quantityInput?.addEventListener("input", updateOrderTotal);
placeOrderButton?.addEventListener("click", placeOrder);
contactSellerButton?.addEventListener("click", contactSeller);

// --------------------------------------------------
// AUTHENTICATION
// Protect order actions, but do not delay product display.
// --------------------------------------------------

onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;
    isModerator = false;
    authResolved = true;

    if (!user) {
        window.location.replace("/login.html");
        return;
    }

    try {
        const adminSnapshot = await getDoc(doc(db, "admins", user.uid));

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
