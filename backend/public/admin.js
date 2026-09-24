const API = window.location.origin;
const tokenKey = "norcia_admin_token";

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));

const fmt = (value) =>
  new Date(value).toLocaleString("en-IN");

async function api(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${localStorage.getItem(tokenKey)}`
  };

  const response = await fetch(API + path, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

document.querySelector("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const error = document.querySelector("#login-error");
  error.textContent = "Signing in...";

  try {
    const response = await fetch(API + "/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: document.querySelector("#email").value.trim(),
        password: document.querySelector("#password").value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem(tokenKey, data.token);

    document.querySelector("#login-view").classList.add("hidden");
    document.querySelector("#dashboard").classList.remove("hidden");

    loadDashboard();

  } catch (err) {
    error.textContent = err.message;
  }
});

document.querySelector("#logout").addEventListener("click", () => {
  localStorage.removeItem(tokenKey);
  location.reload();
});

async function loadDashboard() {
  try {
    const [summary, leadsData, eventsData] = await Promise.all([
      api("/api/admin/summary"),
      api("/api/admin/leads"),
      api("/api/admin/events")
    ]);

    document.querySelector("#uniqueSessions").textContent =
      summary.uniqueSessions;

    document.querySelector("#totalLeads").textContent =
      summary.totalLeads;

    document.querySelector("#newLeads").textContent =
      summary.newLeads;

    document.querySelector("#totalEvents").textContent =
      summary.totalEvents;

    const services = document.querySelector("#services");

    if (!summary.serviceClicks.length) {
      services.innerHTML = "<p class='muted'>No service clicks yet.</p>";
    } else {
      services.innerHTML = summary.serviceClicks.map(x => `
        <div style="margin:12px 0">
          <b>${esc(x.service)}</b>
          <span class="muted">${x.count}</span>
        </div>
      `).join("");
    }

    document.querySelector("#leads").innerHTML =
      leadsData.leads.map(l => `
        <tr>
          <td>${fmt(l.createdAt)}</td>
          <td>${esc(l.name)}</td>
          <td>${esc(l.phone)}</td>
          <td>${esc(l.service)}</td>
          <td>${esc(l.message)}</td>
          <td>${esc(l.status)}</td>
        </tr>
      `).join("");

    document.querySelector("#events").innerHTML =
      eventsData.events.map(e => `
        <tr>
          <td>${fmt(e.createdAt)}</td>
          <td>${esc(e.event)}</td>
          <td>${esc(e.section)}</td>
          <td>${esc(e.sessionId)}</td>
        </tr>
      `).join("");

  } catch (err) {
    if (err.message.includes("Unauthorized")) {
      localStorage.removeItem(tokenKey);
      location.reload();
    } else {
      alert(err.message);
    }
  }
}