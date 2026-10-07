import "./style.css";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "firebase/auth";

import { auth } from "./firebase.js";


document.getElementById("app").innerHTML = `
    <div class="auth-container">

        <h1>ARU Marketplace</h1>

        <h2>Login</h2>

        <form id="login-form">

            <input
                type="email"
                id="email"
                placeholder="Email Address"
                required
            />

            <input
                type="password"
                id="password"
                placeholder="Password"
                required
            />

            <button type="submit">
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

        <p id="message"></p>

        <p class="auth-link">
            Don't have an account?
            <a href="/">Create Account</a>
        </p>

    </div>
`;


const form =
    document.getElementById("login-form");

const message =
    document.getElementById("message");

const passwordInput =
    document.getElementById("password");

const forgotPassword =
    document.getElementById("forgot-password");


// ========================================
// LOGIN
// ========================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        document.getElementById("email").value.trim();

    const password =
        passwordInput.value;

    try {

        message.textContent =
            "Logging in...";


        // Sign in with Firebase Authentication
        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        // Login successful
        message.textContent =
            `Welcome back, ${user.email}!`;


        console.log(
            "Logged in user:",
            user.uid
        );


        // Redirect to marketplace home
        window.location.href = "/home.html";


    } catch (error) {

        console.error(error);


        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
        ) {

            message.textContent =
                "Incorrect email or password.";

        }

        else if (
            error.code === "auth/invalid-email"
        ) {

            message.textContent =
                "Please enter a valid email address.";

        }

        else if (
            error.code === "auth/too-many-requests"
        ) {

            message.textContent =
                "Too many attempts. Please try again later.";

        }

        else {

            message.textContent =
                "Login failed. Please try again.";

        }

    }

});


// ========================================
// FORGOT PASSWORD
// ========================================

forgotPassword.addEventListener(
    "click",
    async () => {

        const email =
            document.getElementById("email").value.trim();


        if (!email) {

            message.textContent =
                "Enter your email address first.";

            return;
        }


        try {

            message.textContent =
                "Sending password reset email...";


            await sendPasswordResetEmail(
                auth,
                email
            );


            message.textContent =
                "Password reset email sent. Check your email.";


        } catch (error) {

            console.error(error);


            if (
                error.code === "auth/user-not-found"
            ) {

                message.textContent =
                    "No account was found with this email.";

            }

            else if (
                error.code === "auth/invalid-email"
            ) {

                message.textContent =
                    "Please enter a valid email address.";

            }

            else {

                message.textContent =
                    "Could not send password reset email.";

            }

        }

    }
);