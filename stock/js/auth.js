import { PERMISSIONS } from "./config.js";
import { getState, persist } from "./store.js";
import { writeAudit } from "./audit.js";

export function currentUser() {
  const s = getState();
  if (!s.session?.userId) return null;
  return s.users.find((u) => u.id === s.session.userId && u.active) || null;
}

/** Open app without PIN login — default admin session */
export function ensureSession() {
  if (currentUser()) return currentUser();
  const s = getState();
  const admin = s.users.find((u) => u.active && u.role === "ADMIN") || s.users.find((u) => u.active);
  if (!admin) return null;
  s.session = { userId: admin.id, loggedInAt: new Date().toISOString() };
  persist(true);
  return admin;
}

export function can(permission) {
  const user = currentUser();
  if (!user) return false;
  const roles = PERMISSIONS[permission];
  if (!roles) return false;
  return roles.includes(user.role);
}

export function requirePermission(permission) {
  if (!can(permission)) {
    const err = new Error("You do not have permission for this action.");
    err.code = "FORBIDDEN";
    throw err;
  }
}

export function login(pin) {
  const s = getState();
  const code = String(pin || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter a 6-digit number." };
  }
  const user = s.users.find((u) => u.pin === code && u.active);
  if (!user) {
    return { ok: false, error: "Invalid code." };
  }
  s.session = { userId: user.id, loggedInAt: new Date().toISOString() };
  persist(true);
  writeAudit({
    userId: user.id,
    action: "LOGIN",
    module: "AUTH",
    recordType: "user",
    recordId: user.id,
    newValue: user.pin,
  });
  return { ok: true, user };
}

export function logout() {
  const user = currentUser();
  const s = getState();
  if (user) {
    writeAudit({
      userId: user.id,
      action: "LOGOUT",
      module: "AUTH",
      recordType: "user",
      recordId: user.id,
      newValue: user.pin || user.username,
    });
  }
  s.session = null;
  persist(true);
}

export function userName(id) {
  return getState().users.find((u) => u.id === id)?.name || id || "—";
}
