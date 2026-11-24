const ALLOWED_ORIGIN = "https://aru-marketplace.web.app";

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Vary": "Origin"
        }
    });
}

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin");

        if (origin && origin !== ALLOWED_ORIGIN) {
            return jsonResponse(
                { success: false, error: "Origin not allowed" },
                403
            );
        }

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization",
                    "Access-Control-Max-Age": "86400",
                    "Vary": "Origin"
                }
            });
        }

        const url = new URL(request.url);

        if (request.method === "GET" && url.pathname === "/health") {
            return jsonResponse({
                success: true,
                service: "ARU Marketplace Notification Backend",
                status: "running",
                project: env.FIREBASE_PROJECT_ID || "not configured",
                pushDelivery: "not configured yet"
            });
        }

        return jsonResponse(
            { success: false, error: "Endpoint not found" },
            404
        );
    }
};
