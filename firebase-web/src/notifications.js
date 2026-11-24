import {
    onAuthStateChanged
} from "firebase/auth";

import {
    addDoc,
    collection,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    doc,
    where,
    getDoc
} from "firebase/firestore";

import { auth, db } from "./firebase.js";

const MAX_VISIBLE_NOTIFICATIONS = 30;
let currentNotifications = [];
let stopListening = null;
let firstSnapshot = true;
let browserPermissionRequested = false;

/**
 * Creates a notification document. A failure here must never undo or make
 * an already completed marketplace action appear to have failed.
 */
export async function createMarketplaceNotification({
    recipientId,
    type,
    title,
    message,
    orderId = "",
    productId = ""
}) {
    try {
        if (!recipientId || !type || !title || !message) return false;

        await addDoc(collection(db, "notifications"), {
            recipientId,
            type,
            title: String(title).slice(0, 100),
            message: String(message).slice(0, 240),
            orderId,
            productId,
            read: false,
            createdAt: serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error("Marketplace notification could not be created:", {
            code: error?.code || "unknown",
            message: error?.message || String(error),
            recipientId,
            type,
            orderId,
            productId
        });

        // Temporary visible diagnostic: the order may already be saved even
        // though Firestore rejected the separate notification write.
        const errorCode = error?.code || "unknown error";
        const errorMessage = error?.message || "No additional details were provided.";
        window.alert(
            `Your marketplace action was saved, but its notification could not be created.\n\n` +
            `Firestore error: ${errorCode}\n${errorMessage}\n\n` +
            `Please send this message to support so we can correct the notification permissions.`
        );
        return false;
    }
}

function ensureNotificationUI() {
    if (document.getElementById("aru-notification-root")) return;

    const root = document.createElement("div");
    root.id = "aru-notification-root";
    root.innerHTML = `
        <button type="button" id="aru-notification-bell" class="aru-notification-bell"
            aria-label="Open notifications" aria-expanded="false">
            <i class="bi bi-bell"></i>
            <span id="aru-notification-count" class="aru-notification-count" hidden>0</span>
        </button>
        <section id="aru-notification-panel" class="aru-notification-panel" hidden
            aria-label="Notifications">
            <div class="aru-notification-heading">
                <div>
                    <strong>Notifications</strong>
                    <small id="aru-notification-summary">Your latest updates</small>
                </div>
                <button type="button" id="aru-notification-close" aria-label="Close notifications">×</button>
            </div>
            <button type="button" id="aru-enable-browser-alerts" class="aru-enable-browser-alerts">
                <i class="bi bi-broadcast"></i> Enable browser alerts
            </button>
            <div id="aru-notification-list" class="aru-notification-list">
                <p class="aru-notification-empty">Sign in to view notifications.</p>
            </div>
        </section>
    `;
    document.body.appendChild(root);

    const bell = root.querySelector("#aru-notification-bell");
    const panel = root.querySelector("#aru-notification-panel");
    const close = root.querySelector("#aru-notification-close");

    const setOpen = (open) => {
        panel.hidden = !open;
        bell.setAttribute("aria-expanded", String(open));
    };

    bell.addEventListener("click", () => setOpen(panel.hidden));
    close.addEventListener("click", () => setOpen(false));

    root.querySelector("#aru-enable-browser-alerts").addEventListener("click", async () => {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notifications.");
            return;
        }
        try {
            const permission = await Notification.requestPermission();
            alert(permission === "granted"
                ? "Browser alerts are enabled while ARU Marketplace is open."
                : "Browser notification permission was not granted.");
        } catch (error) {
            console.warn("Browser notification permission request failed:", error);
        }
    });
}

function formatNotificationTime(timestamp) {
    const date = timestamp?.toDate?.();
    if (!date) return "Just now";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function renderNotifications() {
    const list = document.getElementById("aru-notification-list");
    const count = document.getElementById("aru-notification-count");
    const summary = document.getElementById("aru-notification-summary");
    if (!list || !count || !summary) return;

    const unread = currentNotifications.filter(item => !item.read).length;
    count.textContent = unread > 99 ? "99+" : String(unread);
    count.hidden = unread === 0;
    summary.textContent = unread
        ? `${unread} unread update${unread === 1 ? "" : "s"}`
        : "You're all caught up";

    list.replaceChildren();

    if (!currentNotifications.length) {
        const empty = document.createElement("p");
        empty.className = "aru-notification-empty";
        empty.textContent = "No notifications yet.";
        list.appendChild(empty);
        return;
    }

    currentNotifications.slice(0, MAX_VISIBLE_NOTIFICATIONS).forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `aru-notification-item${item.read ? " is-read" : " is-unread"}`;

        const title = document.createElement("strong");
        title.textContent = item.title || "Marketplace update";
        const message = document.createElement("span");
        message.textContent = item.message || "You have a new update.";
        const time = document.createElement("small");
        time.textContent = formatNotificationTime(item.createdAt);

        button.append(title, message, time);
        button.addEventListener("click", async () => {
            if (!item.read) {
                try {
                    await updateDoc(doc(db, "notifications", item.id), {
                        read: true
                    });
                } catch (error) {
                    console.warn("Could not mark notification as read:", error);
                }
            }
            if (item.orderId) window.location.href = "/orders.html";
            else if (item.productId) window.location.href = "/my-products.html";
        });
        list.appendChild(button);
    });
}

function showBrowserAlert(item) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
        const notification = new Notification(item.title || "ARU Marketplace", {
            body: item.message || "You have a new marketplace update."
        });
        notification.onclick = () => {
            window.focus();
            if (item.orderId) window.location.href = "/orders.html";
            else if (item.productId) window.location.href = "/my-products.html";
        };
    } catch (error) {
        console.warn("Could not display browser notification:", error);
    }
}

async function startNotificationListener(user) {
    if (stopListening) {
        stopListening();
        stopListening = null;
    }
    currentNotifications = [];
    firstSnapshot = true;
    renderNotifications();

    if (!user) return;

    let recipientId = user.uid;
    if (!user.isAnonymous) {
        try {
            const adminSnapshot = await getDoc(doc(db, "admins", user.uid));
            if (adminSnapshot.exists() && adminSnapshot.data().role === "ADMIN") {
                recipientId = "moderators";
            }
        } catch (error) {
            console.warn("Could not check moderator notification access:", error);
        }
    }

    const notificationsQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", recipientId)
    );

    stopListening = onSnapshot(notificationsQuery, snapshot => {
        if (!firstSnapshot) {
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    const item = { id: change.doc.id, ...change.doc.data() };
                    if (!item.read) showBrowserAlert(item);
                }
            });
        }
        firstSnapshot = false;
        currentNotifications = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));
        currentNotifications.sort((a, b) =>
            (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
        );
        renderNotifications();
    }, error => {
        console.error("Could not load marketplace notifications:", error);
    });
}

ensureNotificationUI();
onAuthStateChanged(auth, user => {
    startNotificationListener(user);
});
