
import "./style.css";

import { onAuthStateChanged, signOut } from "firebase/auth";
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

const profileMessage = document.getElementById("profile-message");
const logoutButton = document.getElementById("logout-button");
const whatsappForm = document.getElementById("whatsapp-form");
const whatsappInput = document.getElementById("whatsapp-input");
const saveWhatsappButton = document.getElementById("save-whatsapp-button");

let currentUser = null;

function normalizeTanzanianPhone(value) {
    let digits = String(value || "").replace(/\D/g, "");

    if (digits.startsWith("0")) {
        digits = "255" + digits.slice(1);
    }

    if (!/^255\d{9}$/.test(digits)) {
        return null;
    }

    return digits;
}

function showMessage(message, type = "danger") {
    profileMessage.textContent = message;
    profileMessage.className = `small mt-3 text-${type}`;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login.html");
        return;
    }

    currentUser = user;

    try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
            showMessage("Your profile could not be found. Please contact support.");

            document.getElementById("full-name").textContent = "Not available";
            document.getElementById("email-address").textContent =
                user.email || "Not available";
            document.getElementById("whatsapp-number").textContent =
                "Not provided";
            document.getElementById("seller-status").textContent =
                "Not available";
            document.getElementById("profile-name").textContent = "My Profile";
            document.getElementById("profile-role").textContent = "";
            whatsappForm.hidden = true;
            return;
        }

        const profile = profileSnap.data();

        document.getElementById("profile-name").textContent =
            profile.fullName || "My Profile";

        document.getElementById("full-name").textContent =
            profile.fullName || "Not provided";

        document.getElementById("email-address").textContent =
            user.email || profile.email || "Not available";

        document.getElementById("profile-role").textContent =
            profile.role || "BUYER";

        document.getElementById("seller-status").textContent =
            profile.sellerApprovalStatus || "NOT_APPLIED";

        // Load the public seller contact record, if one exists.
        const contactRef = doc(db, "sellerContacts", user.uid);
        const contactSnap = await getDoc(contactRef);

        if (contactSnap.exists()) {
            const whatsapp = contactSnap.data().whatsapp || "";
            whatsappInput.value = whatsapp;
            document.getElementById("whatsapp-number").textContent =
                whatsapp || "Not provided";
        } else {
            // Support older accounts that have a phone number in their profile.
            const oldPhone = profile.phoneNumber || "";
            whatsappInput.value = oldPhone;
            document.getElementById("whatsapp-number").textContent =
                oldPhone || "Not added yet";
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        showMessage("Unable to load your profile or WhatsApp number. Please try again.");
    }
});

whatsappForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
        showMessage("Please sign in again before saving your number.");
        return;
    }

    const normalizedPhone = normalizeTanzanianPhone(whatsappInput.value);

    if (!normalizedPhone) {
        showMessage(
            "Enter a valid Tanzanian mobile number, e.g. 0712345678 or 255712345678."
        );
        whatsappInput.focus();
        return;
    }

    saveWhatsappButton.disabled = true;
    saveWhatsappButton.textContent = "Saving...";

    try {
        const contactRef = doc(db, "sellerContacts", currentUser.uid);

        await setDoc(contactRef, {
            whatsapp: normalizedPhone,
            updatedAt: serverTimestamp()
        });

        whatsappInput.value = normalizedPhone;
        document.getElementById("whatsapp-number").textContent = normalizedPhone;

        showMessage("WhatsApp number saved successfully!", "success");
    } catch (error) {
        console.error("Saving WhatsApp number failed:", error);

        if (error.code === "permission-denied") {
            showMessage(
                "Permission denied. Check your Firestore rules for sellerContacts."
            );
        } else {
            showMessage("Unable to save your WhatsApp number. Please try again.");
        }
    } finally {
        saveWhatsappButton.disabled = false;
        saveWhatsappButton.innerHTML =
            '<i class="bi bi-whatsapp me-2"></i> Save WhatsApp Number';
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        await signOut(auth);
        window.location.replace("/login.html");
    } catch (error) {
        console.error("Logout failed:", error);
        showMessage("Unable to log out. Please try again.");
        logoutButton.disabled = false;
    }
});
