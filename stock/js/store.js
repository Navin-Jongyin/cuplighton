import { STORAGE_KEY, SCHEMA_VERSION, DEFAULT_SETTINGS } from "./config.js";
import { buildSeed } from "./seed.js";

let state = null;
let saveTimer = null;
const listeners = new Set();

export function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.variants)) {
        if (parsed.schemaVersion !== SCHEMA_VERSION) {
          state = migrateStoreSchema(parsed);
          persist(true);
        } else {
          state = parsed;
        }
        ensureIndexes();
        return state;
      }
    }
  } catch (err) {
    console.warn("Store load failed, reseeding", err);
  }
  state = buildSeed();
  persist(true);
  return state;
}

/** Drop demo catalog; keep users, settings, and session */
function migrateStoreSchema(previous) {
  const fresh = buildSeed();
  if (previous.settings) {
    fresh.settings = { ...fresh.settings, ...previous.settings };
  }
  if (Array.isArray(previous.users) && previous.users.length) {
    fresh.users = previous.users;
  }
  if (previous.session) {
    fresh.session = previous.session;
  }
  return fresh;
}

export function getState() {
  if (!state) loadStore();
  return state;
}

export function resetStore() {
  state = buildSeed();
  persist(true);
  notify();
  return state;
}

export function persist(immediate = false) {
  const write = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("Store persist failed", err);
    }
  };
  if (immediate) {
    write();
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(write, 250);
}

export function mutate(fn) {
  fn(state);
  persist();
  notify();
}

export function collection(name) {
  return getState()[name];
}

export function findById(name, id) {
  return getState()[name].find((r) => r.id === id) || null;
}

export function addRecord(name, record) {
  getState()[name].push(record);
  persist();
  notify();
  return record;
}

export function updateRecord(name, id, patch) {
  const list = getState()[name];
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
  persist();
  notify();
  return list[i];
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(state); } catch (e) { console.error(e); }
  });
}

function ensureIndexes() {
  if (!state.settings) state.settings = { ...DEFAULT_SETTINGS };
  const seed = buildSeed();
  for (const k of Object.keys(seed)) {
    if (!state[k] && Array.isArray(seed[k])) {
      state[k] = [];
    }
  }
  if (!state.categories) state.categories = [];
  if (!state.brands) state.brands = [];
  if (!state.units) state.units = [];
  if (!state.products) state.products = [];
  if (!state.variants) state.variants = [];
  if (!state.barcodes) state.barcodes = [];
  if (!state.packaging) state.packaging = [];
  if (!state.inventory) state.inventory = [];
  if (!state.movements) state.movements = [];
  if (!state.quotations) state.quotations = [];
  migrateUserPins();
  migrateInvoices();
  migrateLots();
  migrateRemoveSampleQuotations();
}

const SAMPLE_QUOTATION_IDS = new Set(["qt_sample_2850"]);

function migrateRemoveSampleQuotations() {
  if (!Array.isArray(state.quotations)) return;
  const next = state.quotations.filter((q) => !SAMPLE_QUOTATION_IDS.has(q.id));
  if (next.length !== state.quotations.length) {
    state.quotations = next;
    persist(true);
  }
}

function migrateUserPins() {
  if (!Array.isArray(state.users)) return;
  const used = new Set(
    state.users.map((u) => String(u.pin || "")).filter((p) => /^\d{6}$/.test(p))
  );
  let changed = false;
  let next = 100001;
  state.users.forEach((u) => {
    if (/^\d{6}$/.test(String(u.pin || ""))) return;
    changed = true;
    if (u.id === "u_admin" || u.username === "admin") {
      u.pin = "123456";
    } else {
      let pin = String(next).padStart(6, "0");
      while (used.has(pin) || pin === "123456") {
        next += 1;
        pin = String(next).padStart(6, "0");
      }
      u.pin = pin;
      next += 1;
    }
    used.add(u.pin);
  });
  if (changed) persist(true);
}

function migrateInvoices() {
  if (!Array.isArray(state.invoices)) state.invoices = [];
  if (!Array.isArray(state.taxInvoices)) state.taxInvoices = [];
  let changed = false;
  if (Array.isArray(state.quotations)) {
    state.quotations.forEach((q) => {
      if (!q.status) {
        q.status = "PENDING";
        changed = true;
      }
    });
  }
  if (changed) persist(true);
}

function migrateLots() {
  if (!Array.isArray(state.inventory)) return;
  let changed = false;
  state.inventory.forEach((r) => {
    if (r.lot == null) {
      r.lot = "";
      changed = true;
    }
  });
  if (changed) persist(true);
}

export function getSettings() {
  return getState().settings;
}

export function updateSettings(patch) {
  Object.assign(getState().settings, patch);
  persist();
  notify();
}
