export function logAuthEvent({ event, success, email, phone, userId, role, ip, reason }) {
  const phoneDigits = phone ? String(phone).replace(/\D/g, "") : "";
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    success,
    ...(email ? { email } : {}),
    ...(phoneDigits ? { phoneLast4: phoneDigits.slice(-4) } : {}),
    ...(userId ? { userId } : {}),
    ...(role ? { role } : {}),
    ...(ip ? { ip } : {}),
    ...(reason ? { reason } : {}),
  };

  if (success) {
    console.log("[audit]", JSON.stringify(entry));
  } else {
    console.warn("[audit]", JSON.stringify(entry));
  }
}
