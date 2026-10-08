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

const welcomeMessage =
    document.getElementById("welcome-message");

const logoutButton =
    document.getElementById("logout-button");

const productsContainer =
    document.getElementById("products-container");


// ========================================
// AUTHENTICATION
// ========================================

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "/login.html";

        return;
    }


    // ====================================
    // LOAD USER PROFILE
    // ====================================

    try {

        const userRef =
            doc(db, "users", user.uid);

        const userSnapshot =
            await getDoc(userRef);


        if (userSnapshot.exists()) {

            const userData =
                userSnapshot.data();

            const fullName =
                userData.fullName || "User";

            welcomeMessage.textContent =
                `Welcome, ${fullName}!`;

        } else {

            welcomeMessage.textContent =
                `Welcome, ${user.email}!`;
        }

    } catch (error) {

        console.error(
            "Could not load user profile:",
            error
        );

        welcomeMessage.textContent =
            `Welcome, ${user.email}!`;
    }


    // ====================================
    // LOAD PRODUCTS
    // ====================================

    loadProducts();
});


// ========================================
// LOAD PRODUCTS FROM FIRESTORE
// ========================================

async function loadProducts() {

    // Make sure the HTML element exists
    if (!productsContainer) {

        console.error(
            "products-container was not found in home.html."
        );

        return;
    }


    try {

        productsContainer.innerHTML =
            `<p class="empty-products">Loading products...</p>`;


        const productsQuery =
            query(
                collection(db, "products"),
                where("status", "==", "active"),
                limit(20)
            );


        const snapshot =
            await getDocs(productsQuery);


        if (snapshot.empty) {

            productsContainer.innerHTML = `
                <div class="empty-products">
                    <p>No products available yet.</p>
                    <p>
                        Be the first to sell something
                        on ARU Marketplace.
                    </p>
                </div>
            `;

            return;
        }


        // Convert Firestore documents
        // to normal JavaScript objects

        const products =
            snapshot.docs.map((productDoc) => ({
                id: productDoc.id,
                ...productDoc.data()
            }));


        // ====================================
        // SORT NEWEST PRODUCTS FIRST
        // ====================================

        products.sort((a, b) => {

            const dateA =
                a.createdAt?.toMillis
                    ? a.createdAt.toMillis()
                    : 0;

            const dateB =
                b.createdAt?.toMillis
                    ? b.createdAt.toMillis()
                    : 0;

            return dateB - dateA;
        });


        productsContainer.innerHTML = "";


        // ====================================
        // CREATE PRODUCT CARDS
        // ====================================

        products.forEach((product) => {

            const productCard =
                document.createElement("div");

            productCard.className =
                "product-card";


            // First Cloudinary image

            const imageUrl =
                product.imageUrls?.[0] ||
                "https://via.placeholder.com/300x220?text=No+Image";


            const title =
                product.title ||
                "Untitled Product";


            const price =
                product.price != null
                    ? `TZS ${Number(
                        product.price
                    ).toLocaleString()}`
                    : "Price not available";


            const location =
                product.location ||
                "Location not specified";


            const category =
                product.category ||
                "Other";


            productCard.innerHTML = `
                <img
                    src="${imageUrl}"
                    alt="${title}"
                    class="product-image"
                    loading="lazy"
                >

                <div class="product-card-content">

                    <h3>
                        ${title}
                    </h3>

                    <p class="product-price">
                        ${price}
                    </p>

                    <p class="product-category">
                        ${category}
                    </p>

                    <p class="product-location">
                        <i class="bi bi-geo-alt-fill"></i>
                        ${location}
                    </p>

                    <button
                        type="button"
                        class="view-product-button"
                        data-product-id="${product.id}"
                    >
                        View Product
                    </button>

                </div>
            `;


            productsContainer.appendChild(
                productCard
            );
        });

    } catch (error) {

        console.error(
            "Could not load products:",
            error
        );


        if (productsContainer) {

            productsContainer.innerHTML = `
                <div class="empty-products">
                    <p>Unable to load products.</p>
                    <p>
                        Please try again later.
                    </p>
                </div>
            `;
        }
    }
}


// ========================================
// VIEW PRODUCT
// ========================================

if (productsContainer) {

    productsContainer.addEventListener(
        "click",
        (event) => {

            const button =
                event.target.closest(
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


            console.log(
                "Opening product:",
                productId
            );


            window.location.href =
                `/product.html?id=${encodeURIComponent(
                    productId
                )}`;
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

            try {

                await signOut(auth);

                window.location.href =
                    "/login.html";

            } catch (error) {

                console.error(
                    "Logout failed:",
                    error
                );
            }
        }
    );
}
// ========================================
// CATEGORY SELECTOR
// ========================================

const categoriesToggle =
    document.getElementById("categories-toggle");

const categoryMenu =
    document.getElementById("category-menu");

const categoryIcons =
    document.querySelectorAll(".category-icon");

const categoryOptions =
    document.querySelectorAll(".category-option");


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

                categoriesToggle
                    .querySelector("span")
                    .textContent = "View";

            } else {

                categoryMenu.removeAttribute(
                    "hidden"
                );

                categoriesToggle.classList.add(
                    "open"
                );

                categoriesToggle
                    .querySelector("span")
                    .textContent = "Hide";
            }
        }
    );
}


// ========================================
// CATEGORY SELECTION
// ========================================

function selectCategory(category) {

    // Small icon selection

    categoryIcons.forEach((button) => {

        button.classList.toggle(
            "active",
            button.dataset.category === category
        );

    });


    // Expanded menu selection

    categoryOptions.forEach((button) => {

        button.classList.toggle(
            "active",
            button.dataset.category === category
        );

    });


    console.log(
        "Selected category:",
        category
    );
}


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


categoryOptions.forEach((button) => {

    button.addEventListener(
        "click",
        () => {

            selectCategory(
                button.dataset.category
            );


            // Close menu after selection

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

                categoriesToggle
                    .querySelector("span")
                    .textContent = "View";
            }

        }
    );

});