import "./style.css";

import {
    onAuthStateChanged
} from "firebase/auth";

import { auth } from "./firebase.js";


const form =
    document.getElementById("sell-product-form");

const message =
    document.getElementById("sell-message");


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
   PRODUCT FORM
======================================== */

form.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();


        message.textContent =
            "Product submission will be connected after the seller approval system is ready.";

    }
);