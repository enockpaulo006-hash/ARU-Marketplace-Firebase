
import "./style.css";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";

const profileMessage = document.getElementById("profile-message");
const logoutButton = document.getElementById("logout-button");

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login.html");
        return;
    }

    try {
        const profileRef = doc(db, "users", user.uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
            profileMessage.textContent =
                "Your profile could not be found. Please contact support.";
            document.getElementById("full-name").textContent = "Not available";
            document.getElementById("email-address").textContent =
                user.email || "Not available";
            document.getElementById("whatsapp-number").textContent =
                "Not available";
            document.getElementById("seller-status").textContent =
                "Not available";
            document.getElementById("profile-name").textContent = "My Profile";
            document.getElementById("profile-role").textContent = "";
            return;
        }

        const profile = profileSnap.data();

        document.getElementById("profile-name").textContent =
            profile.fullName || "My Profile";

        document.getElementById("full-name").textContent =
            profile.fullName || "Not provided";

        document.getElementById("email-address").textContent =
            user.email || profile.email || "Not available";

        document.getElementById("whatsapp-number").textContent =
            profile.phoneNumber || "Not provided";

        document.getElementById("profile-role").textContent =
            profile.role || "BUYER";

        document.getElementById("seller-status").textContent =
            profile.sellerApprovalStatus || "NOT_APPLIED";

    } catch (error) {
        console.error("Error loading profile:", error);
        profileMessage.textContent =
            "Unable to load your profile. Please try again.";
    }
});

logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;

    try {
        await signOut(auth);
        window.location.replace("/login.html");
    } catch (error) {
        console.error("Logout failed:", error);
        profileMessage.textContent = "Unable to log out. Please try again.";
        logoutButton.disabled = false;
    }
});
