import "./style.css";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "firebase/auth";

import {
    doc,
    getDoc
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

// ========================================
// LOGIN FORM
// ========================================

document.getElementById("app").innerHTML = `
    <div class="auth-container">
        <h1>ARU Marketplace</h1>
        <h2>Login</h2>

        <form id="login-form">
            <input
                type="email"
                id="email"
                placeholder="Email Address"
                autocomplete="username"
                required
            />

            <div class="password-field">
                <input
                    type="password"
                    id="password"
                    placeholder="Password"
                    autocomplete="current-password"
                    required
                />

                <button
                    type="button"
                    class="password-toggle"
                    id="password-toggle"
                    aria-label="Show password"
                    aria-pressed="false"
                    title="Show password"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path
                            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
                        ></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>

            <button type="submit" id="login-button">
                Login
            </button>
        </form>

        <button
            id="forgot-password"
            class="secondary-button"
            type="button"
        >
            Forgot Password?
        </button>

        <p id="message" role="status" aria-live="polite"></p>

        <p class="auth-link">
            Don't have an account?
            <a href="/register.html">Create Account</a>
        </p>
    </div>
`;


// PASSWORD VISIBILITY TOGGLE
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("password-toggle");

passwordToggle.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";

    passwordInput.type = showPassword ? "text" : "password";

    passwordToggle.setAttribute(
        "aria-label",
        showPassword ? "Hide password" : "Show password"
    );

    passwordToggle.setAttribute(
        "title",
        showPassword ? "Hide password" : "Show password"
    );

    passwordToggle.setAttribute(
        "aria-pressed",
        String(showPassword)
    );

    passwordToggle.innerHTML = showPassword
        ? `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
            >
                <path d="M3 3l18 18"></path>
                <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
                <path d="M9.9 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7s-1.2 2.4-3.1 3.9"></path>
                <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.3 3.3-.7"></path>
            </svg>
        `
        : `
            <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
            >
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
});

// FORM ELEMENTS
const form = document.getElementById("login-form");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgot-password");
const loginButton = document.getElementById("login-button");


// LOGIN
form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;

    loginButton.disabled = true;
    forgotPassword.disabled = true;

    message.textContent = "Logging in...";

    try {
        // 1. Authenticate the user with Firebase
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        console.log("Signed-in UID:", user.uid);
        console.log("Signed-in email:", user.email);

        // 2. Verify the user's moderator/admin role
        let isModerator = false;

        try {
            const adminRef = doc(db, "admins", user.uid);
            const adminSnapshot = await getDoc(adminRef);

            const adminRole = adminSnapshot.exists()
                ? adminSnapshot.data().role
                : null;

            isModerator = adminRole === "ADMIN";

            console.log(
                "Admin document exists:",
                adminSnapshot.exists()
            );

            console.log("Admin role:", adminRole);
            console.log("Moderator detected:", isModerator);

        } catch (roleError) {
            console.error("Moderator role check failed:", roleError);

            message.textContent =
                "Your login succeeded, but your account role could not be verified. Please check your connection and try again.";

            loginButton.disabled = false;
            forgotPassword.disabled = false;

            return;
        }

        // 3. Redirect based on the verified role
        if (isModerator) {
            message.textContent = "Opening Moderator Dashboard...";
            window.location.replace("/moderator.html");
        } else {
            message.textContent = "Opening ARU Marketplace...";
            window.location.replace("/home.html");
        }

    } catch (error) {
        console.error("Login failed:", error);

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
        ) {
            message.textContent = "Incorrect email or password.";

        } else if (error.code === "auth/invalid-email") {
            message.textContent = "Please enter a valid email address.";

        } else if (error.code === "auth/too-many-requests") {
            message.textContent =
                "Too many attempts. Please try again later.";

        } else if (error.code === "auth/network-request-failed") {
            message.textContent =
                "Network error. Check your internet connection and try again.";

        } else {
            message.textContent =
                "Login failed. Please try again.";
        }

        loginButton.disabled = false;
        forgotPassword.disabled = false;
    }
});

// FORGOT PASSWORD

forgotPassword.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();

    if (!email) {
        message.textContent = "Enter your email address first.";
        document.getElementById("email").focus();
        return;
    }

    forgotPassword.disabled = true;
    message.textContent = "Sending password reset email...";

    try {
        await sendPasswordResetEmail(auth, email);

        message.textContent =
            "Password reset email sent. Check your email.";

    } catch (error) {
        console.error("Password reset failed:", error);

        if (error.code === "auth/invalid-email") {
            message.textContent =
                "Please enter a valid email address.";

        } else if (error.code === "auth/network-request-failed") {
            message.textContent =
                "Network error. Check your internet connection.";

        } else {
            message.textContent =
                "Could not send the password reset email. Please try again.";
        }

    } finally {
        forgotPassword.disabled = false;
    }
});
