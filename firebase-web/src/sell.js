import "./style.css";

import {
    onAuthStateChanged
} from "firebase/auth";

import { auth } from "./firebase.js";


const productsList =
    document.getElementById("products-list");

const addProductButton =
    document.getElementById("add-product-button");

const submitAllButton =
    document.getElementById("submit-all-products");

const message =
    document.getElementById("sell-message");


let productCount = 0;


/* ========================================
   AUTHENTICATION
======================================== */

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.href =
            "/login.html";

        return;
    }

});


/* ========================================
   CREATE PRODUCT FORM
======================================== */

function createProductForm() {

    productCount++;

    const productNumber =
        productCount;


    const productCard =
        document.createElement("section");

    productCard.className =
        "sell-form-card product-form-card";

    productCard.dataset.productNumber =
        productNumber;


    productCard.innerHTML = `

        <div class="product-form-header">

            <div>

                <p class="section-label">
                    Listing ${productNumber}
                </p>

                <h3>
                    Product ${productNumber}
                </h3>

            </div>

            ${
                productNumber > 1
                ? `
                    <button
                        type="button"
                        class="remove-product-button"
                        aria-label="Remove product"
                    >
                        <i class="bi bi-trash"></i>
                    </button>
                `
                : ""
            }

        </div>


        <!-- PRODUCT IMAGES -->

        <div class="form-group">

            <label>
                Product Photos
            </label>

            <div class="image-upload">

                <i class="bi bi-images"></i>

                <p>
                   Add a photo of your product
                </p>

                <span>
                    You can select multiple images
                </span>

                <label
                    class="choose-images-button"
                >

                    <i class="bi bi-plus"></i>

                    Add Photos

                    <input
                        type="file"
                        class="product-images-input"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                    >

                </label>

            </div>

            <div class="image-preview-grid"></div>

        </div>


        <!-- PRODUCT NAME -->

        <div class="form-group">

            <label
                for="product-title-${productNumber}"
            >
                Product Name
            </label>

            <input
                type="text"
                id="product-title-${productNumber}"
                class="product-title"
                placeholder="e.g. HP Laptop"
                required
            >

        </div>


        <!-- CATEGORY -->

        <div class="form-group">

            <label
                for="product-category-${productNumber}"
            >
                Category
            </label>

            <select
                id="product-category-${productNumber}"
                class="product-category"
                required
            >

                <option value="">
                    Select a category
                </option>

                <option value="electronics">
                    Electronics
                </option>

                <option value="phones_accessories">
                    Phones & Accessories
                </option>

                <option value="books_notes">
                    Books & Notes
                </option>

                <option value="fashion">
                    Fashion
                </option>

                <option value="hostel_items">
                    Hostel Items
                </option>

                <option value="services">
                    Services
                </option>

                <option value="other">
                    Other
                </option>

            </select>

        </div>


        <!-- PRICE + CONDITION -->

        <div class="form-row">


            <div class="form-group">

                <label
                    for="product-price-${productNumber}"
                >
                    Price (TZS)
                </label>

                <input
                    type="number"
                    id="product-price-${productNumber}"
                    class="product-price"
                    placeholder="e.g. 250000"
                    min="0"
                    required
                >

            </div>


            <div class="form-group">

                <label
                    for="product-condition-${productNumber}"
                >
                    Condition
                </label>

                <select
                    id="product-condition-${productNumber}"
                    class="product-condition"
                    required
                >

                    <option value="">
                        Select condition
                    </option>

                    <option value="new">
                        New
                    </option>

                    <option value="used">
                        Used
                    </option>

                    <option value="like_new">
                        Like New
                    </option>

                </select>

            </div>


        </div>


        <!-- LOCATION -->

        <div class="form-group">

            <label
                for="product-location-${productNumber}"
            >
                Location
            </label>

            <input
                type="text"
                id="product-location-${productNumber}"
                class="product-location"
                placeholder="e.g. Ardhi University"
                required
            >

        </div>


        <!-- DESCRIPTION -->

        <div class="form-group">

            <label
                for="product-description-${productNumber}"
            >
                Description
            </label>

            <textarea
                id="product-description-${productNumber}"
                class="product-description"
                rows="5"
                placeholder="Describe this product..."
                required
            ></textarea>

        </div>


        <!-- INFO -->

        <div class="form-information">

            <i class="bi bi-info-circle"></i>

            <p>
                All photos above belong to this one product.
                Buyers will be able to view them together.
            </p>

        </div>

    `;


    productsList.appendChild(
        productCard
    );


    setupProductImageUpload(
        productCard
    );


    const removeButton =
        productCard.querySelector(
            ".remove-product-button"
        );


    if (removeButton) {

        removeButton.addEventListener(
            "click",
            () => {

                productCard.remove();

                renumberProducts();

            }
        );

    }

}


/* ========================================
   IMAGE SELECTION
======================================== */

function setupProductImageUpload(
    productCard
) {

    const input =
        productCard.querySelector(
            ".product-images-input"
        );

    const previewGrid =
        productCard.querySelector(
            ".image-preview-grid"
        );


    let selectedFiles = [];


    input.addEventListener(
        "change",
        () => {

            const newFiles =
                Array.from(input.files);


            selectedFiles = [
                ...selectedFiles,
                ...newFiles
            ];


            // Remove duplicate files
            selectedFiles =
                selectedFiles.filter(
                    (file, index, array) =>
                        index === array.findIndex(
                            (item) =>
                                item.name === file.name &&
                                item.size === file.size &&
                                item.lastModified === file.lastModified
                        )
                );


            renderImagePreviews();


            // Clear native input
            input.value = "";

        }
    );


    function renderImagePreviews() {

        previewGrid.innerHTML = "";


        selectedFiles.forEach(
            (file, index) => {

                const imageUrl =
                    URL.createObjectURL(file);


                const preview =
                    document.createElement("div");

                preview.className =
                    "image-preview";


                preview.innerHTML = `

                    <img
                        src="${imageUrl}"
                        alt="Product image ${index + 1}"
                    >

                    <button
                        type="button"
                        class="remove-image-button"
                        aria-label="Remove image"
                    >
                        <i class="bi bi-x"></i>
                    </button>

                    <span>
                        Photo ${index + 1}
                    </span>

                `;


                const removeButton =
                    preview.querySelector(
                        ".remove-image-button"
                    );


                removeButton.addEventListener(
                    "click",
                    () => {

                        selectedFiles.splice(
                            index,
                            1
                        );


                        URL.revokeObjectURL(
                            imageUrl
                        );


                        renderImagePreviews();

                    }
                );


                previewGrid.appendChild(
                    preview
                );

            }
        );


        // Store files on the product card
        productCard.selectedFiles =
            selectedFiles;

    }

}


/* ========================================
   RENUMBER PRODUCTS
======================================== */

function renumberProducts() {

    const cards =
        productsList.querySelectorAll(
            ".product-form-card"
        );


    cards.forEach(
        (card, index) => {

            const number =
                index + 1;

            card.dataset.productNumber =
                number;


            const label =
                card.querySelector(
                    ".section-label"
                );

            const title =
                card.querySelector(
                    ".product-form-header h3"
                );


            if (label) {

                label.textContent =
                    `Listing ${number}`;

            }


            if (title) {

                title.textContent =
                    `Product ${number}`;

            }

        }
    );

}


/* ========================================
   ADD PRODUCT
======================================== */

addProductButton.addEventListener(
    "click",
    () => {

        createProductForm();

        const cards =
            productsList.querySelectorAll(
                ".product-form-card"
            );


        const lastCard =
            cards[cards.length - 1];


        lastCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
);


/* ========================================
   SUBMIT ALL PRODUCTS
======================================== */

submitAllButton.addEventListener(
    "click",
    () => {

        const cards =
            productsList.querySelectorAll(
                ".product-form-card"
            );


        if (cards.length === 0) {

            message.textContent =
                "Please add at least one product.";

            return;
        }


        let valid = true;


        cards.forEach(
            (card) => {

                const requiredFields =
                    card.querySelectorAll(
                        "input[required], select[required], textarea[required]"
                    );


                requiredFields.forEach(
                    (field) => {

                        if (!field.value.trim()) {

                            valid = false;

                            field.reportValidity();

                        }

                    }
                );


                if (
                    !card.selectedFiles ||
                    card.selectedFiles.length === 0
                ) {

                    valid = false;

                    alert(
                        "Please add at least one image for every product."
                    );

                }

            }
        );


        if (!valid) {

            message.textContent =
                "Please complete all product details.";

            return;
        }


        message.textContent =
            "All products are ready. Uploading to Firebase will be connected next.";

    }
);


/* ========================================
   INITIAL PRODUCT
======================================== */

createProductForm();