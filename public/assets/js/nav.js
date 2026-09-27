"use strict";

(async () => {
    const userSlot = document.getElementById("navUser");
    const adminLink = document.getElementById("adminLink");
    const historyLink = document.getElementById("historyLink");
    const loginLink = document.getElementById("loginLink");
    if (!userSlot) return;

    try {
        const { user } = await EchoApi.api("/api/auth/me");
        if (!user) {
            userSlot.textContent = "Guest";
            loginLink?.classList.remove("hidden");
            return;
        }

        userSlot.textContent = user.name;
        historyLink?.classList.remove("hidden");
        if (user.role === "admin") adminLink?.classList.remove("hidden");

        const logout = document.createElement("button");
        logout.className = "nav-button";
        logout.type = "button";
        logout.textContent = "Log out";
        logout.addEventListener("click", async () => {
            await EchoApi.api("/api/auth/logout", { method: "POST" });
            window.location.href = "/";
        });
        userSlot.insertAdjacentElement("afterend", logout);
    } catch {
        userSlot.textContent = "Offline";
    }
})();
