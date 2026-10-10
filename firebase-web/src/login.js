import "./style.css";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "firebase/auth";

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";

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

            <input
                type="password"
                id="password"
                placeholder="Password"
                autocomplete="current-password"
                required
            />

            <button type="submit">Login</button>
        </form>

        <button
            id="forgot-password"
            class="secondary-button"
            type="button"
        >
            Forgot Password?
        </button>

        <p id="message" role="status"></p>

        <p class="auth-link">
            Don't have an account?
            <a href="/">Create Account</a>
        </p>
    </div>
`;

const form = document.getElementById("login-form");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgot-password");
const loginButton = form.querySelector('button[type="submit"]');

// ========================================
// LOGIN
// ========================================

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    forgotPassword.disabled = true;
    message.textContent = "Logging in...";

    try {
        // 1. Authenticate the user.
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        console.log("Signed-in UID:", user.uid);
        console.log("Signed-in email:", user.email);

        // 2. Check whether the signed-in UID is an admin.
        let isModerator = false;

        try {
            const adminRef = doc(db, "admins", user.uid);
            const adminSnapshot = await getDoc(adminRef);

            const adminRole = adminSnapshot.exists()
                ? adminSnapshot.data().role
                : null;

            isModerator = adminRole === "ADMIN";

            console.log("Admin document exists:", adminSnapshot.exists());
            console.log("Admin role:", adminRole);
            console.log("Moderator detected:", isModerator);
        } catch (roleError) {
            console.error("Moderator role check failed:", roleError);

            message.textContent =
                "Your login succeeded, but your account role could not be verified. Please refresh and try again.";

            loginButton.disabled = false;
            forgotPassword.disabled = false;
            return;
        }

        // 3. Redirect according to the verified role.
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
        } else {
            message.textContent =
                "Login failed. Please check the browser console.";
        }

        loginButton.disabled = false;
        forgotPassword.disabled = false;
    }
});
// ========================================
// FORGOT PASSWORD
// ========================================

forgotPassword.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();

    if (!email) {
        message.textContent = "Enter your email address first.";
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
            message.textContent = "Please enter a valid email address.";
        } else {
            message.textContent =
                "Could not send password reset email. Please try again.";
        }
    } finally {
        forgotPassword.disabled = false;
    }
});