import "./style.css";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase.js";

document.getElementById("app").innerHTML = `
    <div class="auth-container">
        <h1>ARU Marketplace</h1>
        <h2>Create Account</h2>

        <form id="register-form">

            <input
                type="text"
                id="fullName"
                placeholder="Full Name"
                required
            />

            <input
                type="tel"
                id="phoneNumber"
                placeholder="Phone Number (e.g. 0712345678)"
                maxlength="10"
                pattern="(06|07)[0-9]{8}"
                title="Phone number must be exactly 10 digits and start with 06 or 07"
                required
            />

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
                minlength="8"
                required
            />

            <small>
                Password must contain at least 8 characters,
                including a capital letter, small letter,
                number and symbol.
            </small>

            <input
                type="password"
                id="confirmPassword"
                placeholder="Confirm Password"
                minlength="8"
                required
            />

            <button type="submit">Create Account</button>
            <p class="auth-link">
              Already have an account?
              <a href="/login.html">Login</a>
            </p>
        </form>

        <p id="message"></p>
    </div>
`;

const form = document.getElementById("register-form");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
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

    try {
        message.textContent = "Creating account...";

        // Create Firebase Authentication account
        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;

        // Send verification email
        await sendEmailVerification(user);

        // Create marketplace profile
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            fullName: fullName,
            phoneNumber: phoneNumber,

            // Every new user starts as a buyer
            role: "BUYER",

            // Seller approval system
            isVerifiedSeller: false,
            sellerApprovalStatus: "NOT_APPLIED",

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        message.textContent =
            "Account created successfully! Check your email to verify your account.";

        form.reset();

    } catch (error) {
        console.error(error);

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
    }
});