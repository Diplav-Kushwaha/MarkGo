export function logAuthEvent({ event, success, email, userId, role, ip, reason }) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    success,
    ...(email ? { email } : {}),
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
