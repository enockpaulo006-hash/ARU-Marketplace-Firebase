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

const quantityInput = document.getElementById("order-quantity");
const decreaseQuantityButton = document.getElementById("decrease-quantity");
const increaseQuantityButton = document.getElementById("increase-quantity");
const totalPriceElement = document.getElementById("order-total-price");
const placeOrderButton = document.getElementById("place-order-button");
const contactSellerButton = document.getElementById(
    "contact-seller-button"
);
const orderMessage = document.getElementById("order-message");

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
        // Recheck that the product is still active and unchanged.
        const productRef = doc(db, "products", productId);
        const latestProductSnapshot = await getDoc(productRef);

        if (!latestProductSnapshot.exists()) {
            throw new Error("This product is no longer available.");
        }

        const latestProduct = latestProductSnapshot.data();

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
        const productImage =
            imageUrls.length > 0 ? imageUrls[0] : "";

        await addDoc(collection(db, "orders"), {
            buyerId: currentUser.uid,
            sellerId: latestProduct.sellerId,
            productId: productId,
            productTitle: latestProduct.title || "Product",
            productImage: productImage,
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

        // Prevent accidental duplicate orders from repeated clicks.
        placeOrderButton.disabled = true;

    } catch (error) {
        console.error("Failed to place order:", error);

        showOrderMessage(
            error.message === "Missing or insufficient permissions."
                ? "Firebase denied this order. Check the Orders security rules."
                : error.message || "Unable to place your order. Please try again.",
            "error"
        );

        placeOrderButton.disabled = false;
        placeOrderButton.innerHTML =
            '<i class="bi bi-bag-check"></i> Place Order';

    } finally {
        orderInProgress = false;
    }
}

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
// DISPLAY PRODUCT IMAGES
// --------------------------------------------------

function displayProductImages(imageUrls) {

    if (!imageUrls || imageUrls.length === 0) {

        mainImage.innerHTML = `
            <div class="no-product-image">
                <i class="bi bi-image"></i>
                <span>No Image</span>
            </div>
        `;

        return;
    }


    // First image

    mainImage.innerHTML = `
        <img
            src="${imageUrls[0]}"
            alt="Product image"
            id="selected-product-image"
        >
    `;


    // Thumbnails

    thumbnails.innerHTML = "";


    imageUrls.forEach((imageUrl, index) => {

        const thumbnail =
            document.createElement("button");

        thumbnail.type = "button";

        thumbnail.className =
            "product-thumbnail";

        if (index === 0) {
            thumbnail.classList.add("active");
        }


        thumbnail.innerHTML = `
            <img
                src="${imageUrl}"
                alt="Product photo ${index + 1}"
            >
        `;


        thumbnail.addEventListener(
            "click",
            () => {

                const selectedImage =
                    document.getElementById(
                        "selected-product-image"
                    );

                selectedImage.src =
                    imageUrl;


                document
                    .querySelectorAll(
                        ".product-thumbnail"
                    )
                    .forEach((item) => {

                        item.classList.remove(
                            "active"
                        );

                    });


                thumbnail.classList.add(
                    "active"
                );
            }
        );


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

        const productRef =
            doc(
                db,
                "products",
                productId
            );


        const productSnapshot =
            await getDoc(productRef);


        if (!productSnapshot.exists()) {

            showProductError();

            return;
        }


        const product =
            productSnapshot.data();

        currentProduct = product;
        updateOrderTotal();

        placeOrderButton.disabled = false;
        placeOrderButton.innerHTML =
            '<i class="bi bi-bag-check"></i> Place Order';

        // ------------------------------------------
        // CHECK PRODUCT STATUS
        // ------------------------------------------

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
            product.description ||
            "No description available.";


        // ------------------------------------------
        // PRODUCT IMAGES
        // ------------------------------------------

        displayProductImages(
            product.imageUrls || []
        );


        // ------------------------------------------
        // SHOW PRODUCT
        // ------------------------------------------

        loadingMessage.style.display =
            "none";

        productContent.style.display =
            "grid";

    } catch (error) {

        console.error(
            "Failed to load product:",
            error
        );

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