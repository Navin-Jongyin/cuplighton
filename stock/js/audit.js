import { getState, addRecord } from "./store.js";
import { uid } from "./utils.js";

export function writeAudit({ userId, action, module, recordType, recordId, oldValue = "", newValue = "" }) {
  addRecord("auditLogs", {
    id: uid("aud"),
    userId,
    action,
    module,
    recordType,
    recordId,
    oldValue: typeof oldValue === "string" ? oldValue : JSON.stringify(oldValue),
    newValue: typeof newValue === "string" ? newValue : JSON.stringify(newValue),
    timestamp: new Date().toISOString(),
  });
}

export function listAudit({ module, userId, q } = {}) {
  let rows = [...getState().auditLogs].reverse();
  if (module) rows = rows.filter((r) => r.module === module);
  if (userId) rows = rows.filter((r) => r.userId === userId);
  if (q) {
    const n = q.toLowerCase();
    rows = rows.filter((r) =>
      `${r.action} ${r.module} ${r.recordId} ${r.newValue} ${r.oldValue}`.toLowerCase().includes(n)
    );
  }
  return rows;
}
