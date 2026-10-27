// Small helper used by every page to talk to the backend.

export function getUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function saveLogin(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// Where each role lands after signing in.
export function homeFor(role) {
  if (role === "admin") return "/dashboard";
  if (role === "technician") return "/jobs";
  return "/requests";
}

// Turn a backend error into one readable sentence.
function errorMessage(data) {
  if (!data || !data.detail) return "Something went wrong. Try again.";
  if (typeof data.detail === "string") return data.detail;
  // Validation errors arrive as a list, one item per bad field.
  return data.detail
    .map((item) => `${item.loc[item.loc.length - 1]}: ${item.msg}`)
    .join(". ");
}

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers.Authorization = "Bearer " + token;


  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://ict-helpdesk-backend.onrender.com";
  const response = await fetch(API_URL + "/api" + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Session expired or missing: go back to the login page.
  if (response.status === 401 && path !== "/login") {
    clearLogin();
    window.location.href = "/";
    return null;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(data));
  return data;
}