import "./style.css";

import {
    createUserWithEmailAndPassword,
    sendEmailVerification
} from "firebase/auth";

import {
    doc,
    setDoc,
    serverTimestamp
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

// ========================================
// REGISTRATION FORM
// ========================================

document.getElementById("app").innerHTML = `
    <div class="auth-container">
        <h1>ARU Marketplace</h1>
        <h2>Create Account</h2>

        <form id="register-form">

            <input
                type="text"
                id="fullName"
                placeholder="Full Name"
                autocomplete="name"
                required
            />

            <label for="phoneNumber">
                WhatsApp Number *
            </label>

            <input
                type="tel"
                id="phoneNumber"
                placeholder="WhatsApp Number (e.g. 0712345678)"
                maxlength="10"
                pattern="(06|07)[0-9]{8}"
                inputmode="numeric"
                autocomplete="tel"
                title="Enter the WhatsApp number you actively use. Use 10 digits starting with 06 or 07."
                required
            />

            <small>
                Enter the WhatsApp number you actively use.
                Buyers will use it to contact you about your products.
            </small>

            <input
                type="email"
                id="email"
                placeholder="Email Address"
                autocomplete="email"
                required
            />

            <div class="password-field">
                <input
                    type="password"
                    id="password"
                    placeholder="Password"
                    minlength="8"
                    autocomplete="new-password"
                    required
                />

                <button
                    type="button"
                    class="password-toggle"
                    data-target="password"
                    aria-label="Show password"
                    aria-pressed="false"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>

            <small>
                Password must contain at least 8 characters,
                including a capital letter, small letter,
                number and symbol.
            </small>

            <div class="password-field">
                <input
                    type="password"
                    id="confirmPassword"
                    placeholder="Confirm Password"
                    minlength="8"
                    autocomplete="new-password"
                    required
                />

                <button
                    type="button"
                    class="password-toggle"
                    data-target="confirmPassword"
                    aria-label="Show password"
                    aria-pressed="false"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>

            <button type="submit" id="register-button">
                Create Account
            </button>

            <p class="auth-link">
                Already have an account?
                <a href="/login.html">Login</a>
            </p>
        </form>

        <p id="message" role="status" aria-live="polite"></p>
    </div>
`;

// ========================================
// PASSWORD VISIBILITY TOGGLE
// ========================================

document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);

        if (!input) return;

        const showPassword = input.type === "password";

        input.type = showPassword ? "text" : "password";

        button.setAttribute(
            "aria-label",
            showPassword ? "Hide password" : "Show password"
        );

        button.setAttribute(
            "aria-pressed",
            String(showPassword)
        );

        button.innerHTML = showPassword
            ? `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18"></path>
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                    <path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7s-1.2 2.4-3.1 3.9"></path>
                    <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.3 3.3-.7"></path>
                </svg>
            `
            : `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            `;
    });
});

// ========================================
// FORM ELEMENTS
// ========================================

const form = document.getElementById("register-form");
const message = document.getElementById("message");
const registerButton = document.getElementById("register-button");

// ========================================
// REGISTRATION
// ========================================

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName =
        document.getElementById("fullName").value.trim();

    const phoneNumber =
        document.getElementById("phoneNumber").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;

    // Validate phone number
    const phoneRegex = /^(06|07)[0-9]{8}$/;

    if (!phoneRegex.test(phoneNumber)) {
        message.textContent =
            "Phone number must be exactly 10 digits and start with 06 or 07.";
        return;
    }

    // Validate password
    const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!passwordRegex.test(password)) {
        message.textContent =
            "Password must contain at least 8 characters, including a capital letter, small letter, number and symbol.";
        return;
    }

    // Confirm password
    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match.";
        return;
    }

    registerButton.disabled = true;
    message.textContent = "Creating account...";

    try {
        // 1. Create Firebase Authentication account
        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        // 2. Send verification email
        await sendEmailVerification(user);

        // 3. Create marketplace user profile
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            fullName: fullName,
            phoneNumber: phoneNumber,

            // Every new user starts as a buyer firstly. They can apply to become a seller later.
            role: "BUYER",

            // Seller approval system
            isVerifiedSeller: false,
            sellerApprovalStatus: "NOT_APPLIED",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 4. Save WhatsApp contact separately
        await setDoc(doc(db, "sellerContacts", user.uid), {
            whatsapp: phoneNumber,
            updatedAt: serverTimestamp()
        });

        message.textContent =
            "Account created successfully! Check your email to verify your account.";

        form.reset();

    } catch (error) {
        console.error("Registration failed:", error);

        if (error.code === "auth/email-already-in-use") {
            message.textContent =
                "This email is already registered.";

        } else if (error.code === "auth/weak-password") {
            message.textContent =
                "Password is too weak.";

        } else if (error.code === "auth/invalid-email") {
            message.textContent =
                "Please enter a valid email address.";

        } else {
            message.textContent =
                "Registration failed. Please try again.";
        }

    } finally {
        registerButton.disabled = false;
    }
});