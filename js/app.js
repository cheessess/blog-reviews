console.log("✅ app.js cargó");

// --- TMDB ---
const TMDB_KEY = "5ae6a264fee9e701870f16ffb3cc71cc";
const IMG_URL = "https://image.tmdb.org/t/p/w500";

// --- DOM ---
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

// --- Estado ---
let isAdmin = false;
let reviews = [];

// --- Helpers ---
function escapeQuotes(str) {
  return String(str).replace(/'/g, "\\'");
}

function generateStars(rating) {
  const fullStars = Math.floor(rating / 2);
  const halfStar = rating % 2 >= 1;
  let stars = "";

  for (let i = 0; i < fullStars; i++) stars += "★";
  if (halfStar) stars += "☆";
  while (stars.length < 5) stars += "☆";

  return stars;
}

// --- Supabase: verificar si el usuario actual es admin ---
async function checkIsAdmin() {
  const { data, error } = await window.supabase.auth.getSession();

  if (error) {
    console.warn("getSession error:", error.message);
    return false;
  }

  const user = data?.session?.user;
  if (!user) return false;

  const { data: adminRow, error: adminErr } = await window.supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    console.warn("admin check error:", adminErr.message);
    return false;
  }

  return !!adminRow;
}

// --- UI permisos ---
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

// --- Supabase: cargar reviews (para todos) ---
async function loadReviewsFromDB() {
  const { data, error } = await window.supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ DB load error:", error.message);
    return [];
  }
  return data ?? [];
}

// --- Supabase: insertar review (solo admin por RLS) ---
async function insertReviewToDB(item) {
  const { error } = await window.supabase.from("reviews").insert([item]);
  if (error) throw new Error(error.message);
}

// --- Supabase: borrar review (solo admin por RLS) ---
async function deleteReviewFromDB(id) {
  const { error } = await window.supabase.from("reviews").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// --- TMDB: buscar película con filtro opcional por año ---
async function fetchMovie(title, year) {
  const url =
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}` +
    `&query=${encodeURIComponent(title)}` +
    `&language=es-ES&include_adult=false`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const results = data.results ?? [];
  if (results.length === 0) return null;

  if (year) {
    const match = results.find(r => (r.release_date || "").startsWith(String(year)));
    return match ?? results[0];
  }

  return results[0];
}
async function fetchTV(title, year) {
  const url =
    `https://api.themoviedb.org/3/search/tv?api_key=${API_KEY}` +
    `&query=${encodeURIComponent(title)}` +
    `&language=es-MX&include_adult=false`;

  console.log("📺 buscando TV:", title, year ? `(año ${year})` : "");

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  const results = data.results ?? [];
  if (results.length === 0) return null;

  // si pones año, intentamos matchear por first_air_date
  if (year) {
    const match = results.find(r => (r.first_air_date || "").startsWith(String(year)));
    return match ?? results[0];
  }

  return results[0];
}

// --- Render ---
async function renderReviews() {
  container.innerHTML = `<p style="padding:2rem;opacity:.85;">Cargando...</p>`;

  let html = "";
  let rendered = 0;

  for (const item of reviews) {
    // por ahora solo movies (si luego metemos tv/books, lo expandimos)
  let media = null;

if (item.type === "movie") {
  media = await fetchMovie(item.title, item.year);
} else if (item.type === "tv") {
  media = await fetchTV(item.title, item.year);
}

if (!media) {
  console.warn("⚠️ No se encontró en TMDB:", item.title, item.type);
  continue;
}

const poster = media.poster_path
  ? IMG_URL + media.poster_path
  : "https://via.placeholder.com/500x750?text=No+Image";

const displayTitle = media.title || media.name || item.title;
const displayYear =
  (media.release_date || media.first_air_date || "").slice(0, 4) || "----";

    const poster = movie?.poster_path
      ? IMG_URL + movie.poster_path
      : "https://via.placeholder.com/500x750?text=No+Image";

    const titleShow = movie?.title ?? item.title;
    const yearShow = movie?.release_date ? movie.release_date.slice(0, 4) : (item.year ?? "----");
    const stars = generateStars(item.rating);

    html += `
      <article class="card" onclick="openReview('${escapeQuotes(item.id)}')">
        ${isAdmin ? `<button class="delete-btn" onclick="deleteReview(event, '${escapeQuotes(item.id)}')">🗑️</button>` : ""}
        <img src="${poster}" alt="${escapeQuotes(titleShow)}">
        <div class="card-content">
          <h2>${titleShow} (${yearShow})</h2>
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
      : `<p style="padding:2rem;opacity:.85;">No hay reviews todavía.</p>`;
}

// --- Modal ver review (usa id ahora) ---
async function openReview(id) {
  const item = reviews.find(r => r.id === id);
  if (!item) return;

  const movie = await fetchMovie(item.title, item.year);

  const poster = movie?.poster_path
    ? IMG_URL + movie.poster_path
    : "https://via.placeholder.com/500x750?text=No+Image";

  const titleShow = movie?.title ?? item.title;
  const yearShow = movie?.release_date ? movie.release_date.slice(0, 4) : (item.year ?? "----");

  viewTitle.textContent = `${titleShow} (${yearShow})`;
  viewImage.src = poster;
  viewStars.textContent = generateStars(item.rating);
  viewScore.textContent = `${item.rating} / 10`;
  viewReview.textContent = item.review;

  viewModal.classList.remove("hidden");
}

// cierre modal ver
viewClose.addEventListener("click", () => viewModal.classList.add("hidden"));
viewModal.addEventListener("click", (e) => {
  if (e.target === viewModal) viewModal.classList.add("hidden");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") viewModal.classList.add("hidden");
});

// --- Admin login/logout (Supabase Auth) ---
adminBtn.addEventListener("click", async () => {
  const email = prompt("Email admin:");
  const password = prompt("Password:");

  const { error } = await window.supabase.auth.signInWithPassword({ email, password });
  if (error) return alert("Login falló: " + error.message);

  isAdmin = await checkIsAdmin();
  applyPermissionsUI();

  reviews = await loadReviewsFromDB();
  renderReviews();
});

logoutBtn.addEventListener("click", async () => {
  await window.supabase.auth.signOut();

  isAdmin = false;
  applyPermissionsUI();

  reviews = await loadReviewsFromDB();
  renderReviews();
});

// --- Modal agregar (solo admin) ---
addBtn.addEventListener("click", () => {
  if (!isAdmin) return;
  modal.classList.remove("hidden");
});
closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

// submit agregar -> DB
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isAdmin) return;

  const type = document.getElementById("type").value;
  const title = document.getElementById("title").value.trim();
  const yearValue = document.getElementById("year").value;
  const year = yearValue ? Number(yearValue) : null;
  const rating = Number(document.getElementById("rating").value);
  const review = document.getElementById("review").value.trim();

  if (!title || !review || Number.isNaN(rating)) return;

  try {
    await insertReviewToDB({ type, title, year, rating, review });
    form.reset();
    modal.classList.add("hidden");

    reviews = await loadReviewsFromDB();
    renderReviews();
  } catch (err) {
    alert("No se pudo guardar: " + err.message);
  }
});

// delete review -> DB
async function deleteReview(event, id) {
  event.stopPropagation();
  if (!isAdmin) return;

  if (!confirm("¿Seguro que quieres eliminar esta review?")) return;

  try {
    await deleteReviewFromDB(id);
    reviews = await loadReviewsFromDB();
    renderReviews();
  } catch (err) {
    alert("No se pudo borrar: " + err.message);
  }
}

// --- Init: estado inicial ---
async function init() {
  // si ya hay sesión guardada
  isAdmin = await checkIsAdmin();
  applyPermissionsUI();

  reviews = await loadReviewsFromDB();
  renderReviews();
}

init();





