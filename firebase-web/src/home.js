
import "./style.css";

import {
    onAuthStateChanged,
    signOut
} from "firebase/auth";

import {
    collection,
    getDocs,
    query,
    where,
    limit,
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
        "phones_and_accessories": "phones_accessories",
        "phone_accessories": "phones_accessories",
        "books_and_notes": "books_notes",
        "all_products": "all"
    };

    return aliases[category] || category;
}

// ========================================
// AUTHENTICATION
// ========================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login.html");
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userRef);

        if (userSnapshot.exists()) {
            const userData = userSnapshot.data();
            const fullName = userData.fullName || "User";

            if (welcomeMessage) {
                welcomeMessage.textContent = `Welcome, ${fullName}!`;
            }
        } else if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${user.email || "User"}!`;
        }
    } catch (error) {
        console.error("Could not load user profile:", error);

        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${user.email || "User"}!`;
        }
    }

    await loadProducts();
});

// ========================================
// LOAD APPROVED PRODUCTS FROM FIRESTORE
// ========================================

async function loadProducts() {
    if (!productsContainer) {
        console.error("products-container was not found in home.html.");
        return;
    }

    productsContainer.innerHTML =
        '<p class="empty-products">Loading products...</p>';

    try {
        const productsQuery = query(
            collection(db, "products"),
            where("status", "==", "active"),
            limit(20)
        );

        const snapshot = await getDocs(productsQuery);

        allProducts = snapshot.docs.map((productDoc) => ({
            id: productDoc.id,
            ...productDoc.data()
        }));

        // Sort newest products first.
        allProducts.sort((a, b) => {
            const dateA = a.createdAt?.toMillis
                ? a.createdAt.toMillis()
                : 0;

            const dateB = b.createdAt?.toMillis
                ? b.createdAt.toMillis()
                : 0;

            return dateB - dateA;
        });

        renderProducts();
    } catch (error) {
        console.error("Could not load products:", error);

        productsContainer.innerHTML = `
            <div class="empty-products">
                <p>Unable to load products.</p>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// ========================================
// SEARCH AND CATEGORY FILTERING
// ========================================

function renderProducts() {
    if (!productsContainer) return;

    const searchTerm = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const filteredProducts = allProducts.filter((product) => {
        const category = normalizeCategory(product.category);
        const title = String(product.title || "").toLowerCase();
        const description = String(product.description || "").toLowerCase();
        const location = String(product.location || "").toLowerCase();

        const matchesCategory =
            selectedCategory === "all" ||
            category === selectedCategory;

        const matchesSearch =
            title.includes(searchTerm) ||
            description.includes(searchTerm) ||
            location.includes(searchTerm) ||
            String(product.category || "").toLowerCase().includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

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

    filteredProducts.forEach((product) => {
        const productCard = document.createElement("div");
        productCard.className = "product-card";

        const imageUrl = product.imageUrls?.[0] ||
            "https://via.placeholder.com/300x220?text=No+Image";

        const title = product.title || "Untitled Product";

        const price = product.price != null
            ? `TZS ${Number(product.price).toLocaleString()}`
            : "Price not available";

        const location = product.location || "Location not specified";
        const category = product.category || "Other";

        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = title;
        image.className = "product-image";
        image.loading = "lazy";

        const content = document.createElement("div");
        content.className = "product-card-content";

        const heading = document.createElement("h3");
        heading.textContent = title;

        const priceElement = document.createElement("p");
        priceElement.className = "product-price";
        priceElement.textContent = price;

        const categoryElement = document.createElement("p");
        categoryElement.className = "product-category";
        categoryElement.textContent = category;

        const locationElement = document.createElement("p");
        locationElement.className = "product-location";

        const locationIcon = document.createElement("i");
        locationIcon.className = "bi bi-geo-alt-fill";

        locationElement.append(
            locationIcon,
            document.createTextNode(` ${location}`)
        );

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "view-product-button";
        viewButton.dataset.productId = product.id;
        viewButton.textContent = "View Product";

        content.append(
            heading,
            priceElement,
            categoryElement,
            locationElement,
            viewButton
        );

        productCard.append(image, content);
        productsContainer.appendChild(productCard);
    });
}

// Search immediately as the user types.
if (searchInput) {
    searchInput.addEventListener("input", renderProducts);
}

// ========================================
// VIEW PRODUCT
// ========================================

if (productsContainer) {
    productsContainer.addEventListener("click", (event) => {
        const button = event.target.closest(".view-product-button");

        if (!button) return;

        const productId = button.dataset.productId;

        if (!productId) {
            console.error("Product ID not found.");
            return;
        }

        window.location.href =
            `/product.html?id=${encodeURIComponent(productId)}`;
    });
}

// ========================================
// LOGOUT
// ========================================

if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            await signOut(auth);
            window.location.replace("/login.html");
        } catch (error) {
            console.error("Logout failed:", error);
            logoutButton.disabled = false;
        }
    });
}

// ========================================
// EXPAND / COLLAPSE CATEGORY MENU
// ========================================

if (categoriesToggle && categoryMenu) {
    categoriesToggle.addEventListener("click", () => {
        const isOpen = !categoryMenu.hasAttribute("hidden");

        if (isOpen) {
            categoryMenu.setAttribute("hidden", "");
            categoriesToggle.classList.remove("open");
            categoriesToggle.querySelector("span").textContent = "View";
            categoriesToggle.setAttribute("aria-expanded", "false");
        } else {
            categoryMenu.removeAttribute("hidden");
            categoriesToggle.classList.add("open");
            categoriesToggle.querySelector("span").textContent = "Hide";
            categoriesToggle.setAttribute("aria-expanded", "true");
        }
    });
}

// ========================================
// CATEGORY SELECTION
// ========================================

function selectCategory(category) {
    selectedCategory = normalizeCategory(category);

    categoryIcons.forEach((button) => {
        button.classList.toggle(
            "active",
            normalizeCategory(button.dataset.category) === selectedCategory
        );
    });

    categoryOptions.forEach((button) => {
        button.classList.toggle(
            "active",
            normalizeCategory(button.dataset.category) === selectedCategory
        );
    });

    renderProducts();

    console.log("Selected category:", selectedCategory);
}

// Compact category buttons.
categoryIcons.forEach((button) => {
    button.addEventListener("click", () => {
        selectCategory(button.dataset.category);
    });
});

// Expanded category menu buttons.
categoryOptions.forEach((button) => {
    button.addEventListener("click", () => {
        selectCategory(button.dataset.category);

        if (categoryMenu) {
            categoryMenu.setAttribute("hidden", "");
        }

        if (categoriesToggle) {
            categoriesToggle.classList.remove("open");
            categoriesToggle.querySelector("span").textContent = "View";
            categoriesToggle.setAttribute("aria-expanded", "false");
        }
    });
});
