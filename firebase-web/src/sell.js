import "./style.css";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "./firebase";

import {
    collection,
    addDoc,
    serverTimestamp
} from "firebase/firestore";

const MAX_IMAGES = 10;
const MAX_SOURCE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_OUTPUT_FILE_SIZE = 500 * 1024; // ~500 KB
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

const CLOUDINARY_CLOUD_NAME = "didth7hcw";
const CLOUDINARY_UPLOAD_PRESET = "aru_marketplace_products";
const CLOUDINARY_UPLOAD_URL =
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

const productsList = document.getElementById("products-list");
const addProductButton = document.getElementById("add-product-button");
const submitAllButton = document.getElementById("submit-all-products");
const sellMessage = document.getElementById("sell-message");

let productCount = 0;
let currentUser = null;


// --------------------------------------------------
// AUTH PROTECTION
// --------------------------------------------------

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    currentUser = user;

    if (productsList.children.length === 0) {
        createProductForm();
    }
});


// --------------------------------------------------
// CREATE PRODUCT FORM
// --------------------------------------------------

function createProductForm() {
    productCount++;

    const productCard = document.createElement("div");
    productCard.className = "product-form-card";
    productCard.dataset.productNumber = productCount;

    productCard.innerHTML = `
        <div class="product-form-header">
            <div>
                <span class="product-number">Product ${productCount}</span>
                <h2>Create your listing</h2>
            </div>

            ${
                productCount > 1
                    ? `<button type="button" class="remove-product-button">
                        <i class="bi bi-trash"></i>
                        Remove
                    </button>`
                    : ""
            }
        </div>

        <div class="form-group">
            <label>Product photos</label>

            <div class="image-upload-box">
                <i class="bi bi-images"></i>

                <p>Add a photo of your product</p>

                

                <label class="choose-images-button">
                    <i class="bi bi-plus-circle"></i>
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

        <div class="form-group">
            <label for="title-${productCount}">Product title</label>

            <input
                type="text"
                id="title-${productCount}"
                class="product-title"
                placeholder="e.g. HP Laptop"
                required
            >
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Category</label>

                <select class="product-category" required>
                    <option value="">Select category</option>
                    <option value="electronics">Electronics</option>
                    <option value="phones_accessories">Phones & Accessories</option>
                    <option value="books_notes">Books & Notes</option>
                    <option value="fashion">Fashion</option>
                    <option value="hostel_items">Hostel Items</option>
                    <option value="services">Services</option>
                    <option value="other">Other</option>
                </select>
            </div>

            <div class="form-group">
                <label>Price (TZS)</label>

                <input
                    type="number"
                    class="product-price"
                    placeholder="e.g. 350000"
                    min="0"
                    required
                >
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Condition</label>

                <select class="product-condition" required>
                    <option value="">Select condition</option>
                    <option value="new">New</option>
                    <option value="used">Used</option>
                </select>
            </div>

            <div class="form-group">
                <label>Location</label>

                <input
                    type="text"
                    class="product-location"
                    placeholder="e.g. ARU"
                    required
                >
            </div>
        </div>

        <div class="form-group">
            <label>Description</label>

            <textarea
                class="product-description"
                rows="4"
                placeholder="Describe your product..."
                required
            ></textarea>
        </div>
    `;

    productsList.appendChild(productCard);

    setupProductImageUpload(productCard);

    const removeButton = productCard.querySelector(
        ".remove-product-button"
    );

    if (removeButton) {
        removeButton.addEventListener("click", () => {
            productCard.remove();
            renumberProducts();
        });
    }
}


// --------------------------------------------------
// IMAGE UPLOAD + COMPRESSION
// --------------------------------------------------

function setupProductImageUpload(productCard) {
    const input = productCard.querySelector(".product-images-input");
    const previewGrid = productCard.querySelector(".image-preview-grid");

    productCard.selectedFiles = [];

    input.addEventListener("change", async (event) => {
        const selectedFiles = Array.from(event.target.files);

        if (!selectedFiles.length) {
            return;
        }

        if (
            productCard.selectedFiles.length + selectedFiles.length >
            MAX_IMAGES
        ) {
            showSellMessage(
                `You can add up to ${MAX_IMAGES} photos per product.`,
                "error"
            );

            input.value = "";
            return;
        }

        for (const file of selectedFiles) {
            if (!file.type.startsWith("image/")) {
                showSellMessage(
                    `${file.name} is not a supported image file.`,
                    "error"
                );
                continue;
            }

            if (file.size > MAX_SOURCE_FILE_SIZE) {
                showSellMessage(
                    `${file.name} is larger than 5 MB. Please choose a smaller photo.`,
                    "error"
                );
                continue;
            }

            const duplicate = productCard.selectedFiles.some(
                (existingFile) =>
                    existingFile.name === file.name &&
                    existingFile.size === file.size &&
                    existingFile.lastModified === file.lastModified
            );

            if (duplicate) {
                continue;
            }

            try {
                const optimizedFile = await optimizeImage(file);

                productCard.selectedFiles.push(optimizedFile);

                addImagePreview(
                    productCard,
                    optimizedFile,
                    previewGrid
                );
            } catch (error) {
                console.error("Image optimization failed:", error);

                showSellMessage(
                    `Could not process ${file.name}. Please try another image.`,
                    "error"
                );
            }
        }

        input.value = "";
    });
}


// --------------------------------------------------
// OPTIMIZE IMAGE
// --------------------------------------------------

async function optimizeImage(file) {
    const image = await loadImage(file);

    let width = image.width;
    let height = image.height;

    // Resize while keeping the original aspect ratio
    if (
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION
    ) {
        const scale = Math.min(
            MAX_IMAGE_DIMENSION / width,
            MAX_IMAGE_DIMENSION / height
        );

        width = Math.round(width * scale);
        height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    context.drawImage(
        image,
        0,
        0,
        width,
        height
    );

    let quality = JPEG_QUALITY;
    let blob = await canvasToBlob(
        canvas,
        "image/jpeg",
        quality
    );

    // Try to keep the output close to 500 KB.
    // Gradually reduce quality if necessary.
    while (
        blob.size > MAX_OUTPUT_FILE_SIZE &&
        quality > 0.5
    ) {
        quality -= 0.05;

        blob = await canvasToBlob(
            canvas,
            "image/jpeg",
            quality
        );
    }

    // If the image is still too large,
    // reduce its dimensions and compress again.
    while (
        blob.size > MAX_OUTPUT_FILE_SIZE &&
        width > 800
    ) {
        width = Math.round(width * 0.85);
        height = Math.round(height * 0.85);

        canvas.width = width;
        canvas.height = height;

        context.drawImage(
            image,
            0,
            0,
            width,
            height
        );

        quality = 0.75;

        blob = await canvasToBlob(
            canvas,
            "image/jpeg",
            quality
        );
    }

    return new File(
        [blob],
        createOptimizedFileName(file.name),
        {
            type: "image/jpeg",
            lastModified: Date.now()
        }
    );
}

// --------------------------------------------------
// UPLOAD IMAGE TO CLOUDINARY
// --------------------------------------------------

async function uploadToCloudinary(file) {
    const formData = new FormData();

    formData.append("file", file);
    formData.append(
        "upload_preset",
        CLOUDINARY_UPLOAD_PRESET
    );

    const response = await fetch(
        CLOUDINARY_UPLOAD_URL,
        {
            method: "POST",
            body: formData
        }
    );

    const result = await response.json();

    if (!response.ok) {
        console.error("Cloudinary upload error:", result);

        throw new Error(
            result.error?.message ||
            "Cloudinary upload failed."
        );
    }

    return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format
    };
}

// --------------------------------------------------
// LOAD IMAGE
// --------------------------------------------------

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        const objectUrl = URL.createObjectURL(file);

        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Unable to load image."));
        };

        image.src = objectUrl;
    });
}


// --------------------------------------------------
// CANVAS TO BLOB
// --------------------------------------------------

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(
                        new Error("Image compression failed.")
                    );
                    return;
                }

                resolve(blob);
            },
            type,
            quality
        );
    });
}


// --------------------------------------------------
// CREATE SAFE FILE NAME
// --------------------------------------------------

function createOptimizedFileName(originalName) {
    const baseName = originalName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .toLowerCase();

    return `${baseName}-optimized.jpg`;
}


// --------------------------------------------------
// IMAGE PREVIEW
// --------------------------------------------------

function addImagePreview(
    productCard,
    file,
    previewGrid
) {
    const preview = document.createElement("div");

    preview.className = "image-preview";

    const image = document.createElement("img");

    const objectUrl = URL.createObjectURL(file);

    image.src = objectUrl;
    image.alt = "Product photo";

    const removeButton = document.createElement("button");

    removeButton.type = "button";
    removeButton.className = "remove-image-button";

    removeButton.innerHTML = `
        <i class="bi bi-x"></i>
    `;

    const imageNumber = document.createElement("span");

    imageNumber.className = "image-number";

    imageNumber.textContent =
        `${productCard.selectedFiles.length}`;

    const imageSize = document.createElement("span");

    imageSize.className = "image-size";

    imageSize.textContent =
        formatFileSize(file.size);

    removeButton.addEventListener("click", () => {
        const index =
            productCard.selectedFiles.indexOf(file);

        if (index !== -1) {
            productCard.selectedFiles.splice(index, 1);
        }

        URL.revokeObjectURL(objectUrl);

        preview.remove();

        refreshImageNumbers(productCard);
    });

    preview.appendChild(image);
    preview.appendChild(removeButton);
    preview.appendChild(imageNumber);
    preview.appendChild(imageSize);

    previewGrid.appendChild(preview);
}


// --------------------------------------------------
// REFRESH IMAGE NUMBERS
// --------------------------------------------------

function refreshImageNumbers(productCard) {
    const previews =
        productCard.querySelectorAll(".image-preview");

    previews.forEach((preview, index) => {
        const number =
            preview.querySelector(".image-number");

        if (number) {
            number.textContent = index + 1;
        }
    });
}


// --------------------------------------------------
// FORMAT FILE SIZE
// --------------------------------------------------

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


// --------------------------------------------------
// RENUMBER PRODUCTS
// --------------------------------------------------

function renumberProducts() {
    const cards =
        productsList.querySelectorAll(".product-form-card");

    cards.forEach((card, index) => {
        const number = index + 1;

        card.dataset.productNumber = number;

        const productNumber =
            card.querySelector(".product-number");

        if (productNumber) {
            productNumber.textContent =
                `Product ${number}`;
        }
    });

    productCount = cards.length;
}


// --------------------------------------------------
// ADD ANOTHER PRODUCT
// --------------------------------------------------

addProductButton.addEventListener("click", () => {
    createProductForm();

    const cards =
        productsList.querySelectorAll(".product-form-card");

    const lastCard = cards[cards.length - 1];

    lastCard.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


// --------------------------------------------------
// SUBMIT ALL PRODUCTS
// --------------------------------------------------

submitAllButton.addEventListener("click", async () => {
    const cards =
        productsList.querySelectorAll(".product-form-card");

    if (!cards.length) {
        showSellMessage(
            "Please add at least one product.",
            "error"
        );
        return;
    }

    let valid = true;

    cards.forEach((card) => {
        const title =
            card.querySelector(".product-title").value.trim();

        const category =
            card.querySelector(".product-category").value;

        const price =
            card.querySelector(".product-price").value;

        const condition =
            card.querySelector(".product-condition").value;

        const location =
            card.querySelector(".product-location").value.trim();

        const description =
            card.querySelector(".product-description").value.trim();

        const images =
            card.selectedFiles || [];

        if (
            !title ||
            !category ||
            !price ||
            !condition ||
            !location ||
            !description ||
            images.length === 0
        ) {
            valid = false;
        }
    });

    if (!valid) {
        showSellMessage(
            "Please complete all required fields and add at least one photo to each product.",
            "error"
        );
        return;
    }

    submitAllButton.disabled = true;

    submitAllButton.innerHTML = `
        <i class="bi bi-cloud-upload"></i>
        Preparing...
    `;

    try {
        let totalImages = 0;
        let uploadedCount = 0;
        let savedProducts = 0;

        cards.forEach((card) => {
            totalImages +=
                (card.selectedFiles || []).length;
        });

        // ------------------------------------------
        // PROCESS EACH PRODUCT
        // ------------------------------------------

        for (const card of cards) {

            const title =
                card.querySelector(".product-title").value.trim();

            const category =
                card.querySelector(".product-category").value;

            const price =
                Number(
                    card.querySelector(".product-price").value
                );

            const condition =
                card.querySelector(".product-condition").value;

            const location =
                card.querySelector(".product-location").value.trim();

            const description =
                card.querySelector(".product-description").value.trim();

            const images =
                card.selectedFiles || [];

            // --------------------------------------
            // UPLOAD PRODUCT IMAGES
            // --------------------------------------

            const imageUrls = [];
            const imageDetails = [];

            for (const image of images) {

                submitAllButton.innerHTML = `
                    <i class="bi bi-cloud-upload"></i>
                    Uploading ${uploadedCount + 1}/${totalImages}...
                `;

                const result =
                    await uploadToCloudinary(image);

                console.log(
                    "Cloudinary upload successful:",
                    result
                );

                imageUrls.push(result.url);

                imageDetails.push({
                    url: result.url,
                    publicId: result.publicId,
                    width: result.width,
                    height: result.height,
                    bytes: result.bytes,
                    format: result.format
                });

                uploadedCount++;
            }

            // --------------------------------------
            // SAVE PRODUCT TO FIRESTORE
            // --------------------------------------

            submitAllButton.innerHTML = `
                <i class="bi bi-cloud-upload"></i>
                Saving product...
            `;

            const productData = {
                sellerId: currentUser.uid,

                title: title,

                category: category,

                price: price,

                description: description,

                imageUrls: imageUrls,

                imageDetails: imageDetails,

                productCondition: condition,

                location: location,

                status: "active",

                createdAt: serverTimestamp(),

                updatedAt: serverTimestamp()
            };

            const productRef =
                await addDoc(
                    collection(db, "products"),
                    productData
                );

            console.log(
                "Product saved successfully:",
                productRef.id
            );

            savedProducts++;
        }

        // ------------------------------------------
        // SUCCESS
        // ------------------------------------------

        showSellMessage(
            `Successfully listed ${savedProducts} product${savedProducts === 1 ? "" : "s"} with ${uploadedCount} photo${uploadedCount === 1 ? "" : "s"}.`,
            "success"
        );

        // Clear submitted products
        productsList.innerHTML = "";

        productCount = 0;

        createProductForm();

    } catch (error) {

        console.error(
            "Product submission failed:",
            error
        );

        showSellMessage(
            error.message ||
            "Something went wrong while submitting your products.",
            "error"
        );

    } finally {

        submitAllButton.disabled = false;

        submitAllButton.innerHTML = `
            <i class="bi bi-cloud-upload"></i>
            Submit All Products
        `;
    }
});


// --------------------------------------------------
// MESSAGE
// --------------------------------------------------

function showSellMessage(message, type) {
    sellMessage.textContent = message;

    sellMessage.className = `sell-message ${type}`;

    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });
}
// ========================================
// INITIAL PRODUCT FORM
// ========================================

createProductForm();