import "./style.css";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "./firebase";

import {
    doc,
    getDoc
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

onAuthStateChanged(
    auth,
    (user) => {

        if (!user) {

            window.location.href =
                "/login.html";

            return;
        }


        loadProduct();

    }
);