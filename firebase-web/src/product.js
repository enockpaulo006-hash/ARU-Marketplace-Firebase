
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

// --------------------------------------------------
// STATE
// --------------------------------------------------

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
// SHOW PRODUCT ERROR
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

// --------------------------------------------------
// UPDATE ORDER TOTAL
// --------------------------------------------------

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

// --------------------------------------------------
// SHOW ORDER MESSAGE
// --------------------------------------------------

function showOrderMessage(message, type = "info") {
    orderMessage.textContent = message;
    orderMessage.className = `order-message order-message-${type}`;
}

// --------------------------------------------------
// NORMALIZE TANZANIAN PHONE NUMBER
// --------------------------------------------------

function normalizeTanzanianPhone(phone) {
    let digits = String(phone || "").replace(/\D/g, "");

    if (digits.startsWith("0")) {
        digits = "255" + digits.slice(1);
    } else if (!digits.startsWith("255")) {
        return null;
    }

    if (!/^255\d{9}$/.test(digits)) {
        return null;
    }

    return digits;
}

 // --------------------------------------------------
// CONTACT SELLER THROUGH WHATSAPP
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

        const message =
            `Hello, I am interested in your product: ${
                currentProduct.title || "a product"
            } on ARU Marketplace.`;

        whatsappWindow.location.href =
            `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

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

// --------------------------------------------------
// PLACE ORDER
// --------------------------------------------------

async function placeOrder() {
    if (!currentUser || !currentProduct || orderInProgress) {
        return;
    }

    if (isModerator) {
        showOrderMessage(
            "Moderator accounts cannot place orders.",
            "error"
        );
        return;
    }

    if (currentProduct.status !== "active") {
        showOrderMessage(
            "This product is no longer available.",
            "error"
        );
        return;
    }

    if (currentProduct.sellerId === currentUser.uid) {
        showOrderMessage(
            "You cannot place an order for your own product.",
            "error"
        );
        return;
    }

    const quantity = Number.parseInt(quantityInput.value, 10);
    const unitPrice = Number(currentProduct.price);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        showOrderMessage("Please enter a valid quantity.", "error");
        return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        showOrderMessage("This product has an invalid price.", "error");
        return;
    }

    const confirmed = window.confirm(
        `Place an order for ${quantity} item(s) for ` +
        `${formatPrice(unitPrice * quantity)}?`
    );

    if (!confirmed) return;

    orderInProgress = true;
    placeOrderButton.disabled = true;

    placeOrderButton.innerHTML =
        '<i class="bi bi-arrow-repeat"></i> Placing Order...';

    try {
        const productRef = doc(db, "products", productId);
        const latestSnapshot = await getDoc(productRef);

        if (!latestSnapshot.exists()) {
            throw new Error("This product is no longer available.");
        }

        const latestProduct = latestSnapshot.data();

        if (
            latestProduct.status !== "active" ||
            latestProduct.sellerId !== currentProduct.sellerId ||
            Number(latestProduct.price) !== unitPrice
        ) {
            throw new Error(
                "This product has changed. Refresh the page and try again."
            );
        }

        if (latestProduct.sellerId === currentUser.uid) {
            throw new Error("You cannot order your own product.");
        }

        const imageUrls = latestProduct.imageUrls || [];

        await addDoc(collection(db, "orders"), {
            buyerId: currentUser.uid,
            sellerId: latestProduct.sellerId,
            productId: productId,
            productTitle: latestProduct.title || "Product",
            productImage: imageUrls[0] || "",
            unitPrice: unitPrice,
            quantity: quantity,
            totalPrice: unitPrice * quantity,
            status: "pending",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        showOrderMessage(
            "Order placed successfully! You can track it in Orders.",
            "success"
        );

        placeOrderButton.innerHTML =
            '<i class="bi bi-check-circle"></i> Order Placed';

        placeOrderButton.disabled = true;

    } catch (error) {
        console.error("Failed to place order:", error);

        showOrderMessage(
            error.message ||
                "Unable to place your order. Please try again.",
            "error"
        );

        placeOrderButton.disabled = false;

        placeOrderButton.innerHTML =
            '<i class="bi bi-bag-check"></i> Place Order';

    } finally {
        orderInProgress = false;
    }
}

// --------------------------------------------------
// QUANTITY CONTROLS
// --------------------------------------------------

decreaseQuantityButton.addEventListener("click", () => {
    const quantity = Number.parseInt(quantityInput.value, 10) || 1;

    quantityInput.value = String(Math.max(1, quantity - 1));
    updateOrderTotal();
});

increaseQuantityButton.addEventListener("click", () => {
    const quantity = Number.parseInt(quantityInput.value, 10) || 1;

    quantityInput.value = String(Math.min(99, quantity + 1));
    updateOrderTotal();
});

quantityInput.addEventListener("input", updateOrderTotal);

placeOrderButton.addEventListener("click", placeOrder);
contactSellerButton.addEventListener("click", contactSeller);

// --------------------------------------------------
// DISPLAY PRODUCT IMAGES AND PHOTO PRICES
// --------------------------------------------------


function displayProductImages(
    imageUrls,
    imageDetails = [],
    imagePrices = []
) {
    if (!imageUrls || imageUrls.length === 0) {
        mainImage.innerHTML = `
            <div class="no-product-image">
                <i class="bi bi-image"></i>
                <span>No Image</span>
            </div>
        `;

        thumbnails.innerHTML = "";
        return;
    }

    function getPhotoPrice(index) {
        const value =
            imagePrices?.[index] ?? imageDetails?.[index]?.price;

        if (value === null || value === undefined || value === "") {
            return null;
        }

        const numericPrice = Number(value);

        return Number.isFinite(numericPrice) && numericPrice >= 0
            ? numericPrice
            : null;
    }

    // Show the selected product image with a loading placeholder.
    function showMainImage(index) {
        const photoPrice = getPhotoPrice(index);

        const image = document.createElement("img");
        image.alt = `Product image ${index + 1}`;
        image.id = "selected-product-image";
        image.className = "product-image-loading";
        image.decoding = "async";

        // The main image should start loading immediately.
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

        // Add the image before setting its source.
        mainImage.appendChild(image);
        image.src = imageUrls[index];

        if (photoPrice !== null) {
            const priceLabel = document.createElement("div");
            priceLabel.className = "product-photo-price";
            priceLabel.textContent = formatPrice(photoPrice);
            priceLabel.style.marginTop = "10px";
            priceLabel.style.fontSize = "18px";
            priceLabel.style.fontWeight = "700";
            priceLabel.style.textAlign = "center";
            priceLabel.style.color = "#166534";

            mainImage.appendChild(priceLabel);
        }
    }

    // Display the first product image immediately.
    showMainImage(0);
    thumbnails.innerHTML = "";

    imageUrls.forEach((imageUrl, index) => {
        const thumbnail = document.createElement("button");

        thumbnail.type = "button";
        thumbnail.className = "product-thumbnail";

        if (index === 0) {
            thumbnail.classList.add("active");
        }

        const thumbnailImage = document.createElement("img");
        thumbnailImage.alt = `Product photo ${index + 1}`;
        thumbnailImage.loading = index === 0 ? "eager" : "lazy";
        thumbnailImage.decoding = "async";

        // Avoid delaying the main product image for thumbnails.
        thumbnailImage.src = imageUrl;

        thumbnail.appendChild(thumbnailImage);

        const photoPrice = getPhotoPrice(index);

        if (photoPrice !== null) {
            const priceLabel = document.createElement("span");

            priceLabel.className = "product-thumbnail-price";
            priceLabel.textContent = formatPrice(photoPrice);
            priceLabel.style.display = "block";
            priceLabel.style.marginTop = "6px";
            priceLabel.style.fontSize = "12px";
            priceLabel.style.fontWeight = "700";
            priceLabel.style.textAlign = "center";

            thumbnail.appendChild(priceLabel);
        }

        thumbnail.addEventListener("click", () => {
            showMainImage(index);

            thumbnails
                .querySelectorAll(".product-thumbnail")
                .forEach((item) => {
                    item.classList.remove("active");
                });

            thumbnail.classList.add("active");
        });

        thumbnails.appendChild(thumbnail);
    });
}

 // --------------------------------------------------
// LOAD PRODUCT
// --------------------------------------------------

async function loadProduct() {
    if (!productId) {
        showProductError();
        return;
    }

    try {
        const productRef = doc(db, "products", productId);
        const productSnapshot = await getDoc(productRef);

        if (!productSnapshot.exists()) {
            showProductError();
            return;
        }

        const product = productSnapshot.data();

        currentProduct = product;

        // Only display approved and active products.
        if (product.status !== "active") {
            showProductError();
            return;
        }

        // ------------------------------------------
        // PRODUCT INFORMATION
        // ------------------------------------------

        productTitle.textContent =
            product.title || "Untitled Product";

        productPrice.textContent =
            formatPrice(product.price);

        productCategory.textContent =
            product.category || "Other";

        productCondition.textContent =
            product.productCondition || "Not specified";

        productLocation.textContent =
            product.location || "Not specified";

        productDescription.textContent =
            product.description || "No description available.";

        // ------------------------------------------
        // PRODUCT IMAGES AND INDIVIDUAL PRICES
        // ------------------------------------------

        displayProductImages(
            product.imageUrls || [],
            product.imageDetails || [],
            product.imagePrices || []
        );

        updateOrderTotal();

        // ------------------------------------------
        // SHOW PRODUCT
        // ------------------------------------------

        loadingMessage.style.display = "none";
        errorMessage.style.display = "none";
        productContent.style.display = "grid";

    } catch (error) {
        console.error("Failed to load product:", error);
        showProductError();
    }
}

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

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

        isModerator =
            adminSnapshot.exists() &&
            adminSnapshot.data().role === "ADMIN";

        if (isModerator) {
            placeOrderButton.disabled = true;

            showOrderMessage(
                "Moderator accounts cannot place orders.",
                "error"
            );
        }

        await loadProduct();

    } catch (error) {
        console.error("Account check failed:", error);
        showProductError();
    }
});
