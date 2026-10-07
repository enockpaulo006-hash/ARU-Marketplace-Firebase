import "./style.css";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification
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


        <div
            id="verification-section"
            class="verification-section"
            style="display: none;"
        >

            <p>
                Your email is not verified yet.
            </p>

            <button
                id="resend-verification"
                class="secondary-button"
                type="button"
            >
                Resend Verification Email
            </button>

        </div>


        <p id="message"></p>


        <p class="auth-link">
            Don't have an account?
            <a href="/">Create Account</a>
        </p>

    </div>
`;


const form = document.getElementById("login-form");

const message = document.getElementById("message");

const passwordInput =
    document.getElementById("password");

const verificationSection =
    document.getElementById("verification-section");

const resendVerification =
    document.getElementById("resend-verification");

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

        message.textContent = "Logging in...";

        verificationSection.style.display = "none";


        const userCredential =
            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user = userCredential.user;


        // Check email verification
        if (!user.emailVerified) {

            verificationSection.style.display = "block";

            message.textContent =
                "Please verify your email before accessing ARU Marketplace.";

            await auth.signOut();

            return;
        }


        // Email is verified
        message.textContent =
            `Welcome back, ${user.email}!`;

        console.log(
            "Logged in user:",
            user.uid
        );


        // Marketplace dashboard will be connected here later.


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
// RESEND VERIFICATION EMAIL
// ========================================

resendVerification.addEventListener(
    "click",
    async () => {

        const email =
            document.getElementById("email").value.trim();

        const password =
            passwordInput.value;


        if (!email || !password) {

            message.textContent =
                "Enter your email and password first.";

            return;
        }


        try {

            message.textContent =
                "Sending verification email...";


            // Sign in temporarily so Firebase
            // gives us access to the user account.
            const userCredential =
                await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );


            const user =
                userCredential.user;


            // Check if already verified
            if (user.emailVerified) {

                message.textContent =
                    "Your email is already verified. You can login.";

                await auth.signOut();

                verificationSection.style.display =
                    "none";

                return;
            }


            // Send verification email
            await sendEmailVerification(user);


            message.textContent =
                "Verification email sent again. Check your inbox and spam folder.";


            // Sign out after sending
            await auth.signOut();


        } catch (error) {

            console.error(error);


            if (
                error.code === "auth/invalid-credential"
            ) {

                message.textContent =
                    "Incorrect email or password.";

            }

            else if (
                error.code === "auth/too-many-requests"
            ) {

                message.textContent =
                    "Too many attempts. Please wait before trying again.";

            }

            else {

                message.textContent =
                    "Could not resend the verification email. Please try again.";

            }

        }

    }
);


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