const API_BASE = window.NORCIA_API_BASE || "https://norcia-finance-backend.onrender.com/api";

const menu = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');
menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', open);
});
document.querySelectorAll('#main-nav a').forEach(a =>
  a.addEventListener('click', () => nav.classList.remove('open'))
);

const sessionKey = "norcia_session_id";
let sessionId = localStorage.getItem(sessionKey);
if (!sessionId) {
  sessionId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  localStorage.setItem(sessionKey, sessionId);
}

async function track(event, section = null, metadata = {}) {
  try {
    await fetch(`${API_BASE}/analytics/events`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ sessionId, event, section, metadata })
    });
  } catch (_) {
    // Analytics failure must never break the website.
  }
}

track("page_view", "home");

document.querySelectorAll("a[href^='tel:']").forEach(a =>
  a.addEventListener("click", () => track("phone_click", "contact"))
);
document.querySelectorAll("a[href*='wa.me']").forEach(a =>
  a.addEventListener("click", () => track("whatsapp_click", "contact"))
);

const trackedSections = document.querySelectorAll("main section[id]");
if ("IntersectionObserver" in window) {
  const seen = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !seen.has(entry.target.id)) {
        seen.add(entry.target.id);
        track("section_view", entry.target.id);
      }
    });
  }, { threshold: 0.35 });
  trackedSections.forEach(section => observer.observe(section));
}

document.querySelectorAll('[data-service]').forEach(link => {
  link.addEventListener('click', () => {
    const service = link.dataset.service;
    const select = document.querySelector('#service-select');
    if (select) select.value = service;
    track("service_click", service);
  });
});

document.querySelector('#enquiry-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const form = e.currentTarget;
  const submitButton = form.querySelector("button[type='submit']");
  const data = new FormData(form);
  const payload = {
    name: String(data.get('name') || '').trim(),
    phone: String(data.get('phone') || '').trim(),
    service: String(data.get('service') || '').trim(),
    message: String(data.get('message') || '').trim(),
    sessionId
  };

  if (!/^[0-9+\-\s()]{7,20}$/.test(payload.phone)) {
    alert("Please enter a valid phone number.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    const response = await fetch(`${API_BASE}/leads`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Unable to submit enquiry.");

    track("enquiry_submitted", payload.service);

    const text =
      `Hello Norcia Finance,%0A%0A` +
      `I would like to enquire about: ${encodeURIComponent(payload.service)}.%0A` +
      `Name: ${encodeURIComponent(payload.name)}%0A` +
      `Phone: ${encodeURIComponent(payload.phone)}%0A` +
      `Message: ${encodeURIComponent(payload.message)}`;

    window.open(`https://wa.me/919411187313?text=${text}`, "_blank", "noopener");
    form.reset();
    alert("Thank you. Your enquiry has been received.");
  } catch (error) {
    alert(error.message || "Something went wrong. Please call us directly.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Enquiry on WhatsApp →";
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();
