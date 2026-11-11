
import "./style.css";

import { onAuthStateChanged, signOut } from "firebase/auth";

import {
    collection,
    getDocsFromServer,
    query,
    where,
    doc,
    getDoc
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

// ========================================
// ELEMENTS
// ========================================

const welcomeMessage = document.getElementById("welcome-message");
const logoutButton = document.getElementById("logout-button");
const productsContainer = document.getElementById("products-container");
const searchInput = document.getElementById("search-input");

const categoriesToggle = document.getElementById("categories-toggle");
const categoryMenu = document.getElementById("category-menu");
const categoryIcons = document.querySelectorAll(".category-icon");
const categoryOptions = document.querySelectorAll(".category-option");

// ========================================
// CACHE CONFIGURATION
// ========================================

// Cache is specific to this Firebase project.
const PRODUCTS_CACHE_KEY =
    "aru_marketplace_active_products_v1";

// ========================================
// FILTER STATE
// ========================================

let allProducts = [];
let selectedCategory = "all";

// ========================================
// CATEGORY NORMALIZATION
// ========================================

function normalizeCategory(value) {
    const category = String(value || "other")
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[\s-]+/g, "_");

    const aliases = {
        phones_and_accessories: "phones_accessories",
        phone_accessories: "phones_accessories",
        books_and_notes: "books_notes",
        all_products: "all"
    };

    return aliases[category] || category;
}

// ========================================
// PRODUCT CACHE
// ========================================

// Read previously saved products.
function getCachedProducts() {
    try {
        const cachedData = localStorage.getItem(
            PRODUCTS_CACHE_KEY
        );

        if (!cachedData) {
            return null;
        }

        const parsedData = JSON.parse(cachedData);

        if (!Array.isArray(parsedData.products)) {
            return null;
        }

        return parsedData.products;

    } catch (error) {
        console.warn("Could not read product cache:", error);
        return null;
    }
}

// Save products for the next visit.
function saveProductsToCache(products) {
    try {
        const cacheData = {
            products: products,
            savedAt: Date.now()
        };

        localStorage.setItem(
            PRODUCTS_CACHE_KEY,
            JSON.stringify(cacheData)
        );

    } catch (error) {
        console.warn("Could not save product cache:", error);
    }
}

// ========================================
// PRODUCT DATE HANDLING
// ========================================

function getCreatedAtMillis(product) {
    const createdAt = product.createdAt;

    if (!createdAt) {
        return 0;
    }

    // Firestore Timestamp.
    if (typeof createdAt.toMillis === "function") {
        return createdAt.toMillis();
    }

    // Serialized Firestore Timestamp.
    if (typeof createdAt.seconds === "number") {
        return createdAt.seconds * 1000;
    }

    // Date or serialized date string.
    const parsedDate = new Date(createdAt).getTime();

    return Number.isFinite(parsedDate) ? parsedDate : 0;
}

// Sort newest products first.
function sortProducts(products) {
    return [...products].sort((a, b) => {
        return getCreatedAtMillis(b) -
            getCreatedAtMillis(a);
    });
}

// ========================================
// AUTHENTICATION
// Guests can browse without an account.
// ========================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        if (welcomeMessage) {
            welcomeMessage.textContent =
                "Welcome to ARU Marketplace";
        }

        if (logoutButton) {
            logoutButton.hidden = true;
        }

        return;
    }

    if (logoutButton) {
        logoutButton.hidden = false;
    }

    if (welcomeMessage) {
        welcomeMessage.textContent =
            "Welcome to ARU Marketplace";
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
            const userData = userSnapshot.data();
            const fullName = userData.fullName || "User";

            if (welcomeMessage) {
                welcomeMessage.textContent =
                    `Welcome, ${fullName}!`;
            }

        } else if (welcomeMessage) {
            welcomeMessage.textContent =
                `Welcome, ${user.email || "User"}!`;
        }

    } catch (error) {
        console.error(
            "Could not load user profile:",
            error
        );

        if (welcomeMessage) {
            welcomeMessage.textContent =
                `Welcome, ${user.email || "User"}!`;
        }
    }
});

// ========================================
// LOADING INDICATOR
// Only shown when there is no cached data.
// ========================================

function showProductsLoading() {
    if (!productsContainer) return;

    productsContainer.innerHTML = `
        <div class="products-loading"
             role="status"
             aria-label="Loading products">

            <span class="loading-dot"></span>
            <span class="loading-dot"></span>
            <span class="loading-dot"></span>

        </div>
    `;
}

// ========================================
// LOAD PUBLISHED PRODUCTS
// CACHE FIRST + BACKGROUND REFRESH
// ========================================

async function loadProducts() {
    if (!productsContainer) {
        console.error(
            "products-container was not found in home.html."
        );
        return;
    }

    // STEP 1: Read cached products immediately.
    const cachedProducts = getCachedProducts();

    const hasCachedProducts =
        Array.isArray(cachedProducts);

    if (hasCachedProducts) {

        allProducts = sortProducts(cachedProducts);

        // Display immediately without waiting for Firestore.
        renderProducts();

        console.log(
            `Displayed ${allProducts.length} cached products.`
        );

    } else {

        // First visit: no cache available.
        showProductsLoading();
    }

    // STEP 2: Refresh products from Firestore.
    // This runs in the background when cached products exist.

    try {
        const productsQuery = query(
            collection(db, "products"),
            where("status", "==", "active")
        );

        const snapshot = await getDocsFromServer(
            productsQuery
        );

        const freshProducts = snapshot.docs.map(
            (productDoc) => ({
                id: productDoc.id,
                ...productDoc.data()
            })
        );

        const sortedProducts = sortProducts(freshProducts);

        // STEP 3: Save the latest products.
        saveProductsToCache(sortedProducts);

        // STEP 4: Update the displayed products.
        allProducts = sortedProducts;

        renderProducts();

        console.log(
            `Successfully refreshed ${allProducts.length} active products.`
        );

    } catch (error) {
        console.error(
            "Could not refresh products from Firestore:",
            error
        );

        // If cached products exist, keep displaying them.
        if (hasCachedProducts) {

            console.log(
                "Continuing with previously cached products."
            );

        } else {

            productsContainer.innerHTML = `
                <div class="empty-products">
                    <p>Unable to load products.</p>
                    <p>Please check your internet connection and try again.</p>
                </div>
            `;
        }
    }
}

// Load products for guests and signed-in users.
loadProducts();

// ========================================
// IMAGE OPTIMIZATION
// Optimizes Cloudinary URLs only.
// ========================================

function getOptimizedImageUrl(url, width = 450) {
    if (typeof url !== "string" || !url) {
        return "";
    }

    try {
        const parsedUrl = new URL(url);

        if (
            !parsedUrl.hostname.endsWith("res.cloudinary.com")
        ) {
            return url;
        }

        const uploadMarker = "/upload/";

        const uploadIndex =
            parsedUrl.pathname.indexOf(uploadMarker);

        if (uploadIndex === -1) {
            return url;
        }

        const pathAfterUpload = parsedUrl.pathname.slice(
            uploadIndex + uploadMarker.length
        );

        const firstPathSegment =
            pathAfterUpload.split("/")[0];

        // Don't add transformations if the URL already has them.
        if (
            /^(w_|h_|c_|f_auto|q_auto|q_[0-9]|ar_|dpr_)/.test(
                firstPathSegment
            )
        ) {
            return url;
        }

        parsedUrl.pathname =
            parsedUrl.pathname.slice(
                0,
                uploadIndex + uploadMarker.length
            ) +
            `w_${width},c_limit,f_auto,q_auto/` +
            pathAfterUpload;

        return parsedUrl.toString();

    } catch {
        return url;
    }
}

// ========================================
// SEARCH AND PRODUCT RENDERING
// ========================================

function renderProducts() {
    if (!productsContainer) {
        return;
    }

    const searchTerm = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const filteredProducts = allProducts.filter(
        (product) => {

            const category =
                normalizeCategory(product.category);

            const title =
                String(product.title || "").toLowerCase();

            const description =
                String(product.description || "").toLowerCase();

            const location =
                String(product.location || "").toLowerCase();

            const originalCategory =
                String(product.category || "").toLowerCase();

            const matchesCategory =
                selectedCategory === "all" ||
                category === selectedCategory;

            const matchesSearch =
                title.includes(searchTerm) ||
                description.includes(searchTerm) ||
                location.includes(searchTerm) ||
                originalCategory.includes(searchTerm);

            return matchesCategory && matchesSearch;
        }
    );

    // No matching products.
    if (filteredProducts.length === 0) {

        productsContainer.innerHTML = `
            <div class="empty-products">
                <p>No products found.</p>
                <p>Try another search or select a different category.</p>
            </div>
        `;

        return;
    }

    productsContainer.innerHTML = "";

    filteredProducts.forEach((product, productIndex) => {

        const productCard = document.createElement("div");
        productCard.className = "product-card";

        // ========================================
        // PRODUCT IMAGE
        // ========================================

        const originalImageUrl =
            product.imageUrls?.[0] || "";

        const imageUrl = originalImageUrl
            ? getOptimizedImageUrl(originalImageUrl, 450)
            : "https://via.placeholder.com/300x220?text=No+Image";

        const title =
            product.title || "Untitled Product";

        // First photo's price.
        const firstPhotoPrice =
            product.imagePrices?.[0] ??
            product.imageDetails?.[0]?.price ??
            product.price;

        const validPrice =
            firstPhotoPrice !== null &&
            firstPhotoPrice !== undefined &&
            firstPhotoPrice !== "" &&
            Number.isFinite(Number(firstPhotoPrice));

        const price = validPrice
            ? `TZS ${Number(firstPhotoPrice).toLocaleString()}`
            : "Price not available";

        const location =
            product.location || "Location not specified";

        const category =
            product.category || "Other";

        const imageWrapper =
            document.createElement("div");

        imageWrapper.className =
            "product-image-wrapper";

        const imagePlaceholder =
            document.createElement("div");

        imagePlaceholder.className =
            "product-image-placeholder";

        imagePlaceholder.innerHTML = `
            <span class="image-loading-spinner"></span>
            <span>Loading image...</span>
        `;

        const image = document.createElement("img");

        image.alt = title;

        image.className =
            "product-image product-image-loading";

        image.decoding = "async";

        // First visible images load eagerly.
        image.loading =
            productIndex < 2 ? "eager" : "lazy";

        image.fetchPriority =
            productIndex === 0 ? "high" : "auto";

        image.addEventListener("load", () => {

            imagePlaceholder.remove();

            image.classList.remove(
                "product-image-loading"
            );

            image.classList.add(
                "product-image-loaded"
            );

        }, { once: true });

        image.addEventListener("error", () => {

            imagePlaceholder.className =
                "product-image-placeholder";

            imagePlaceholder.innerHTML = `
                <i class="bi bi-image"></i>
                <span>Image unavailable</span>
            `;

            image.remove();

        }, { once: true });

        imageWrapper.append(
            imagePlaceholder,
            image
        );

        // Set image source after attaching listeners.
        image.src = imageUrl;

        // ========================================
        // PRODUCT INFORMATION
        // ========================================

        const content = document.createElement("div");

        content.className =
            "product-card-content";

        const heading = document.createElement("h3");

        heading.textContent = title;

        const priceElement =
            document.createElement("p");

        priceElement.className = "product-price";
        priceElement.textContent = price;

        const categoryElement =
            document.createElement("p");

        categoryElement.className =
            "product-category";

        categoryElement.textContent = category;

        const locationElement =
            document.createElement("p");

        locationElement.className =
            "product-location";

        const locationIcon =
            document.createElement("i");

        locationIcon.className =
            "bi bi-geo-alt-fill";

        locationElement.append(
            locationIcon,
            document.createTextNode(` ${location}`)
        );

        const viewButton =
            document.createElement("button");

        viewButton.type = "button";

        viewButton.className =
            "view-product-button";

        viewButton.dataset.productId =
            product.id;

        viewButton.textContent =
            "View Product";

        content.append(
            heading,
            priceElement,
            categoryElement,
            locationElement,
            viewButton
        );

        productCard.append(
            imageWrapper,
            content
        );

        productsContainer.appendChild(productCard);
    });
}

// ========================================
// SEARCH AS USER TYPES
// ========================================

if (searchInput) {
    searchInput.addEventListener(
        "input",
        renderProducts
    );
}

// ========================================
// VIEW PRODUCT
// ========================================

if (productsContainer) {

    productsContainer.addEventListener(
        "click",
        (event) => {

            const button = event.target.closest(
                ".view-product-button"
            );

            if (!button) {
                return;
            }

            const productId =
                button.dataset.productId;

            if (!productId) {
                console.error(
                    "Product ID not found."
                );
                return;
            }

            // Guests can open product details too.
            window.location.href =
                `/product.html?id=${encodeURIComponent(productId)}`;
        }
    );
}

// ========================================
// LOGOUT
// ========================================

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            logoutButton.disabled = true;

            try {
                await signOut(auth);

                // Remain on the home page after signing out.

            } catch (error) {

                console.error(
                    "Logout failed:",
                    error
                );

                logoutButton.disabled = false;
            }
        }
    );
}

// ========================================
// EXPAND / COLLAPSE CATEGORY MENU
// ========================================

if (categoriesToggle && categoryMenu) {

    categoriesToggle.addEventListener(
        "click",
        () => {

            const isOpen =
                !categoryMenu.hasAttribute("hidden");

            if (isOpen) {

                categoryMenu.setAttribute(
                    "hidden",
                    ""
                );

                categoriesToggle.classList.remove(
                    "open"
                );

                const label =
                    categoriesToggle.querySelector("span");

                if (label) {
                    label.textContent = "View";
                }

                categoriesToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );

            } else {

                categoryMenu.removeAttribute(
                    "hidden"
                );

                categoriesToggle.classList.add(
                    "open"
                );

                const label =
                    categoriesToggle.querySelector("span");

                if (label) {
                    label.textContent = "Hide";
                }

                categoriesToggle.setAttribute(
                    "aria-expanded",
                    "true"
                );
            }
        }
    );
}

// ========================================
// CATEGORY SELECTION
// ========================================

function selectCategory(category) {

    selectedCategory =
        normalizeCategory(category);

    categoryIcons.forEach((button) => {

        button.classList.toggle(
            "active",
            normalizeCategory(button.dataset.category) ===
                selectedCategory
        );
    });

    categoryOptions.forEach((button) => {

        button.classList.toggle(
            "active",
            normalizeCategory(button.dataset.category) ===
                selectedCategory
        );
    });

    renderProducts();
}

// ========================================
// COMPACT CATEGORY BUTTONS
// ========================================

categoryIcons.forEach((button) => {

    button.addEventListener(
        "click",
        () => {

            selectCategory(
                button.dataset.category
            );
        }
    );
});

// ========================================
// EXPANDED CATEGORY MENU BUTTONS
// ========================================

categoryOptions.forEach((button) => {

    button.addEventListener(
        "click",
        () => {

            selectCategory(
                button.dataset.category
            );

            if (categoryMenu) {

                categoryMenu.setAttribute(
                    "hidden",
                    ""
                );
            }

            if (categoriesToggle) {

                categoriesToggle.classList.remove(
                    "open"
                );

                const label =
                    categoriesToggle.querySelector("span");

                if (label) {
                    label.textContent = "View";
                }

                categoriesToggle.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }
    );
});
