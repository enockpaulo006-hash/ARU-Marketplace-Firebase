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
                    <p>Be the first to sell something on ARU Marketplace.</p>
                </div>
            `;

            return;
        }


        // Convert Firestore documents to normal objects
        const products =
            snapshot.docs.map((productDoc) => ({
                id: productDoc.id,
                ...productDoc.data()
            }));


        // Sort newest products first
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


        products.forEach((product) => {

            const productCard =
                document.createElement("div");

            productCard.className =
                "product-card";


            const imageUrl =
                product.imageUrl ||
                "https://via.placeholder.com/300x220?text=No+Image";


            const title =
                product.title || "Untitled Product";


            const price =
                product.price != null
                    ? `TZS ${Number(product.price).toLocaleString()}`
                    : "Price not available";


            const location =
                product.location || "Location not specified";


            const category =
                product.category || "Other";


            productCard.innerHTML = `
                <img
                    src="${imageUrl}"
                    alt="${title}"
                    class="product-image"
                    loading="lazy"
                >

                <div class="product-card-content">

                    <h3>${title}</h3>

                    <p class="product-price">
                        ${price}
                    </p>

                    <p class="product-category">
                        ${category}
                    </p>

                    <p class="product-location">
                        📍 ${location}
                    </p>

                    <button
                        class="view-product-button"
                        data-product-id="${product.id}"
                    >
                        View Product
                    </button>

                </div>
            `;


            productsContainer.appendChild(productCard);

        });


        // ====================================
        // PRODUCT BUTTONS
        // ====================================

        const productButtons =
            document.querySelectorAll(
                ".view-product-button"
            );


        productButtons.forEach((button) => {

            button.addEventListener(
                "click",
                () => {

                    const productId =
                        button.dataset.productId;

                    console.log(
                        "Selected product:",
                        productId
                    );

                    // Product details page
                    // will be added next.

                }
            );

        });


    } catch (error) {

        console.error(
            "Could not load products:",
            error
        );


        productsContainer.innerHTML = `
            <div class="empty-products">
                <p>Unable to load products.</p>
                <p>Please try again later.</p>
            </div>
        `;

    }

}


// ========================================
// LOGOUT
// ========================================

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