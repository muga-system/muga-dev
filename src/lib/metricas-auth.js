import { createHash, timingSafeEqual } from "node:crypto";

export const METRICAS_SESSION_COOKIE = "muga_metricas_session";

const toBuffer = (value) => Buffer.from(String(value || ""));

const safeEquals = (a, b) => {
  const aBuffer = toBuffer(a);
  const bBuffer = toBuffer(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
};

export const createMetricasSessionToken = (panelPassword, sessionSalt) =>
  createHash("sha256")
    .update(`${String(sessionSalt || "muga-metricas-v1")}:${String(panelPassword || "")}`)
    .digest("hex");

export const isMetricasSessionValid = ({ cookieValue, panelPassword, sessionSalt }) => {
  if (!cookieValue || !panelPassword) return false;
  const expectedToken = createMetricasSessionToken(panelPassword, sessionSalt);
  return safeEquals(cookieValue, expectedToken);
};
