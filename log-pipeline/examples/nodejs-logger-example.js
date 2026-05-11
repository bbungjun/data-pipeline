const crypto = require("node:crypto");

function baseLog({
  level = "INFO",
  eventType = "application",
  message,
  requestId,
  userId = null,
  matchId = null,
  method = null,
  route = null,
  statusCode = null,
  latencyMs = null,
  clientIp = null,
  meta = {},
  error = null,
}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "mmr-backend",
    environment: process.env.NODE_ENV || "dev",
    event_type: eventType,
    message,
    request_id: requestId || crypto.randomUUID(),
    user_id: userId,
    match_id: matchId,
    method,
    route,
    status_code: statusCode,
    latency_ms: latencyMs,
    client_ip: clientIp,
    meta,
  };

  if (error) {
    payload.error = {
      name: error.name,
      message: error.message,
      stack: String(error.stack || "").split("\n").map((line) => line.trim()),
    };
  }

  console.log(JSON.stringify(payload));
}

function logRequest(req, res, latencyMs) {
  baseLog({
    level: res.statusCode >= 500 ? "ERROR" : "INFO",
    eventType: "request",
    message: "request completed",
    requestId: req.requestId,
    userId: req.user?.id ?? null,
    matchId: req.body?.matchId ?? null,
    method: req.method,
    route: req.route?.path || req.originalUrl,
    statusCode: res.statusCode,
    latencyMs,
    clientIp: req.ip,
    meta: {
      userAgent: req.headers["user-agent"],
    },
  });
}

function logMatchCreated({ requestId, userId, matchId }) {
  baseLog({
    level: "INFO",
    eventType: "business",
    message: "outbox event created",
    requestId,
    userId,
    matchId,
    route: "/api/matches",
    method: "POST",
    meta: {
      action: "create_match",
    },
  });
}

function logError({ err, req, statusCode = 500 }) {
  baseLog({
    level: "ERROR",
    eventType: "exception",
    message: err.message,
    requestId: req?.requestId,
    userId: req?.user?.id ?? null,
    matchId: req?.body?.matchId ?? null,
    method: req?.method ?? null,
    route: req?.route?.path || req?.originalUrl || null,
    statusCode,
    clientIp: req?.ip ?? null,
    meta: {
      action: "unhandled_exception",
    },
    error: err,
  });
}

module.exports = {
  baseLog,
  logRequest,
  logMatchCreated,
  logError,
};
