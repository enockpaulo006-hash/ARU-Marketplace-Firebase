import "./style.css";

import {
    onAuthStateChanged,
    signOut
} from "firebase/auth";

import {
    doc,
    getDoc
} from "firebase/firestore";

import { auth, db } from "./firebase.js";


// Get elements
const welcomeMessage =
    document.getElementById("welcome-message");

const logoutButton =
    document.getElementById("logout-button");


// Check authentication state
onAuthStateChanged(auth, async (user) => {

    // User is not logged in
    if (!user) {

        window.location.href = "/login.html";

        return;
    }


    // Make sure email is verified
    if (!user.emailVerified) {

        await signOut(auth);

        window.location.href = "/login.html";

        return;
    }


    try {

        // Get user's Firestore profile
        const userRef =
            doc(db, "users", user.uid);

        const userSnapshot =
            await getDoc(userRef);


        if (userSnapshot.exists()) {

            const userData =
                userSnapshot.data();

            const fullName =
                userData.fullName || "User";

            welcomeMessage.textContent =
                `Welcome, ${fullName}!`;

        } else {

            welcomeMessage.textContent =
                `Welcome, ${user.email}!`;

        }

    } catch (error) {

        console.error(
            "Could not load user profile:",
            error
        );

        welcomeMessage.textContent =
            `Welcome, ${user.email}!`;

    }

});


// Logout
logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            window.location.href =
                "/login.html";

        } catch (error) {

            console.error(
                "Logout failed:",
                error
            );

        }

    }
);