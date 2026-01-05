console.log("✅ app.js cargó");

const API_KEY = "5ae6a264fee9e701870f16ffb3cc71cc";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

// Cambia esta clave a la tuya
const ADMIN_PASS = "Blanca";

// Reviews iniciales (si no hay nada guardado aún)
const defaultReviews = [
  { type: "movie", title: "Ghostland", year: 2018, rating: 8, review: "Amazon." },
  { type: "movie", title: "Talk to Me", year: 2022, rating: 10, review: "Muy buena, decisiones tensas y actuaciones sólidas." },
  { type: "movie", title: "A Perfect Getaway", year: 2009, rating: 8, review: "El plot twist te va a sorprender." }
];

// -------- DOM (una sola vez) --------
const container = document.getElementById("reviews-container");

const adminBtn = document.getElementById("admin-btn");
const logoutBtn = document.getElementById("logout-btn");
const addBtn = document.getElementById("add-btn");

// Modal agregar
const modal = document.getElementById("modal");
const closeBtn = document.getElementById("close-btn");
const form = document.getElementById("review-form");

// Modal ver
const viewModal = document.getElementById("view-modal");
const viewTitle = document.getElementById("view-title");
const viewImage = document.getElementById("view-image");
const viewStars = document.getElementById("view-stars");
const viewScore = document.getElementById("view-score");
const viewReview = document.getElementById("view-review");
const viewClose = document.getElementById("view-close");

// -------- Estado --------
let isAdmin = sessionStorage.getItem("isAdmin") === "true";
let reviews = loadReviews();

// -------- Persistencia --------
function loadReviews() {
  const saved = localStorage.getItem("my_reviews");
  return saved ? JSON.parse(saved) : defaultReviews;
}
function saveReviews() {
  localStorage.setItem("my_reviews", JSON.stringify(reviews));
}

// -------- UI Permisos --------
function applyPermissionsUI() {
  if (isAdmin) {
    adminBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    addBtn.classList.remove("hidden");
  } else {
    adminBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    addBtn.classList.add("hidden");
  }
}

// Login / Logout
adminBtn.addEventListener("click", () => {
  const pass = prompt("Clave de administrador:");
  if (pass === ADMIN_PASS) {
    isAdmin = true;
    sessionStorage.setItem("isAdmin", "true");
    applyPermissionsUI();
    renderReviews();
  } else {
    alert("Clave incorrecta.");
  }
});

logoutBtn.addEventListener("click", () => {
  isAdmin = false;
  sessionStorage.removeItem("isAdmin");
  applyPermissionsUI();
  renderReviews();
});

// -------- TMDB --------
async function fetchMovie(title, year) {
  const url =
    `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}` +
    `&query=${encodeURIComponent(title)}` +
    `&language=es-ES&include_adult=false`;

  console.log("🎬 buscando:", title, year ? `(año ${year})` : "");

  const response = await fetch(url);
  if (!response.ok) {
    console.error("❌ TMDB error:", response.status, response.statusText);
    return null;
  }

  const data = await response.json();
  const results = data.results ?? [];
  if (results.length === 0) return null;

  if (year) {
    const match = results.find(r => (r.release_date || "").startsWith(String(year)));
    return match ?? results[0];
  }
  return results[0];
}

// -------- Render --------
async function renderReviews() {
  try {
    container.innerHTML = `<p style="padding:2rem;opacity:.85;">Cargando...</p>`;

    let html = "";
    let rendered = 0;

    for (const item of reviews) {
      if (item.type !== "movie") continue;

      const movie = await fetchMovie(item.title, item.year);
      if (!movie) {
        console.warn("⚠️ No se encontró en TMDB:", item.title);
        continue;
      }

      const stars = generateStars(item.rating);
      const poster = movie.poster_path
        ? IMG_URL + movie.poster_path
        : "https://via.placeholder.com/500x750?text=No+Image";

      html += `
        <article class="card" onclick="openReview('${escapeQuotes(item.title)}')">
          ${isAdmin ? `<button class="delete-btn" onclick="deleteReview(event, '${escapeQuotes(item.title)}')">🗑️</button>` : ""}
          <img src="${poster}" alt="${escapeQuotes(movie.title)}">
          <div class="card-content">
            <h2>${movie.title} (${(movie.release_date || "").slice(0, 4) || "----"})</h2>
            <div class="stars">${stars}</div>
            <div class="score">${item.rating} / 10</div>
            <p class="review-text">${item.review.substring(0, 80)}...</p>
          </div>
        </article>
      `;

      rendered++;
    }

    container.innerHTML =
      rendered > 0
        ? html
        : `<p style="padding:2rem;opacity:.85;">No se cargó nada. Revisa consola (F12) para ver qué título no encontró TMDB.</p>`;
  } catch (err) {
    console.error("💥 Error renderReviews:", err);
    container.innerHTML = `<p style="padding:2rem;opacity:.85;">Error. Abre consola (F12) y copia la primera línea roja.</p>`;
  }
}

// -------- Estrellas --------
function generateStars(rating) {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 >= 1;
  let stars = "";

  for (let i = 0; i < fullStars; i++) stars += "★";
  if (halfStar) stars += "☆";
  while (stars.length < 5) stars += "☆";

  return stars;
}

// -------- Modal ver review --------
function openReview(title) {
  const item = reviews.find(r => r.title === title);
  if (!item) return;

  fetchMovie(item.title, item.year).then(movie => {
    const poster = movie?.poster_path
      ? IMG_URL + movie.poster_path
      : "https://via.placeholder.com/500x750?text=No+Image";

    viewTitle.textContent =
      movie?.title
        ? `${movie.title} (${(movie.release_date || "").slice(0, 4) || "----"})`
        : item.title;

    viewImage.src = poster;
    viewStars.textContent = generateStars(item.rating);
    viewScore.textContent = `${item.rating} / 10`;
    viewReview.textContent = item.review;

    viewModal.classList.remove("hidden");
  });
}

viewClose.addEventListener("click", () => viewModal.classList.add("hidden"));
viewModal.addEventListener("click", (e) => {
  if (e.target === viewModal) viewModal.classList.add("hidden");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") viewModal.classList.add("hidden");
});

// -------- Eliminar (solo admin) --------
function deleteReview(event, title) {
  event.stopPropagation();
  if (!isAdmin) return;

  const confirmed = confirm("¿Seguro que quieres eliminar esta review?");
  if (!confirmed) return;

  reviews = reviews.filter(r => r.title !== title);
  saveReviews();
  renderReviews();
}

// -------- Modal agregar (solo admin) --------
addBtn.addEventListener("click", () => {
  if (!isAdmin) return;
  modal.classList.remove("hidden");
});
closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const type = document.getElementById("type").value;
  const title = document.getElementById("title").value.trim();
  const yearValue = document.getElementById("year").value;
  const year = yearValue ? Number(yearValue) : undefined;
  const rating = Number(document.getElementById("rating").value);
  const review = document.getElementById("review").value.trim();

  if (!title || !review || Number.isNaN(rating)) return;

  reviews.unshift({ type, title, year, rating, review });
  saveReviews();

  form.reset();
  modal.classList.add("hidden");
  renderReviews();
});

// -------- Helpers --------
function escapeQuotes(str) {
  return String(str).replace(/'/g, "\\'");
}

// -------- Init --------
applyPermissionsUI();
renderReviews();
