import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvFile } from "./load_env.mjs";

function getConfig() {
  return {
    defaultLimit: Number(process.env.ERROR_LOG_POLL_LIMIT || "500"),
    defaultIndexPrefix: process.env.OUTPUT_INDEX_PREFIX || "gmok-back-logs",
    defaultService: process.env.DEFAULT_SERVICE || "gmok-back",
    defaultEnvironment: process.env.DEFAULT_ENVIRONMENT || "dev",
    defaultCheckpoint: process.env.ERROR_LOG_CHECKPOINT || path.join(".state", "error_log_checkpoint.json"),
  };
}

function parseArgs(argv) {
  const config = getConfig();
  const args = {
    limit: config.defaultLimit,
    checkpoint: config.defaultCheckpoint,
    output: null,
    sampleInput: null,
    pushOpenSearch: false,
    envFile: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--limit") args.limit = Number(argv[++i]);
    else if (arg === "--checkpoint") args.checkpoint = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--sample-input") args.sampleInput = argv[++i];
    else if (arg === "--push-opensearch") args.pushOpenSearch = true;
    else if (arg === "--env-file") args.envFile = argv[++i];
  }

  return args;
}

function normalizeTimestamp(value) {
  return new Date(value).toISOString();
}

function buildMessage(row) {
  const errorMessage = row.error?.message;
  const errorCode = row.error_code;
  if (errorMessage && errorCode) return `${errorCode} ${errorMessage}`;
  if (errorMessage) return errorMessage;
  if (errorCode) return errorCode;
  return "error_log event";
}

function normalizeRow(row) {
  const config = getConfig();
  const error = typeof row.error === "string" ? JSON.parse(row.error) : (row.error || {});
  const request = typeof row.request === "string" ? JSON.parse(row.request) : (row.request || {});
  const headers = request.headers || {};

  return {
    "@timestamp": normalizeTimestamp(row.create_date),
    service: config.defaultService,
    environment: config.defaultEnvironment,
    source_log: "db_error_log",
    instance_id: process.env.INSTANCE_ID || null,
    instance_name: process.env.INSTANCE_NAME || null,
    level: String(row.severity || "error").toUpperCase(),
    event_type: "error_event",
    message: buildMessage({ ...row, error }),
    request_id: null,
    user_id: row.user_id || null,
    match_id: null,
    route: request.originalUrl || request.url || null,
    method: request.method || null,
    status_code: row.status ?? null,
    latency_ms: null,
    client_ip: row.ip_address || null,
    error_name: error.name || null,
    error_message: error.message || null,
    error_code: row.error_code || null,
    severity: row.severity || null,
    meta: {
      error_type: error.errorType || "unknown",
      user_agent: row.user_agent || headers["user-agent"] || null,
      request_url: request.url || null,
    },
    raw: {
      ...row,
      error,
      request,
    },
  };
}

function buildBulkPayload(documents) {
  const config = getConfig();
  return documents
    .flatMap((document) => {
      const day = document["@timestamp"].slice(0, 10);
      const indexName = `${config.defaultIndexPrefix}-${day}`;
      return [
        JSON.stringify({ index: { _index: indexName } }),
        JSON.stringify(document),
      ];
    })
    .join("\n") + (documents.length ? "\n" : "");
}

async function ensureParentDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readCheckpoint(checkpointPath) {
  try {
    const text = await fs.readFile(checkpointPath, "utf-8");
    return JSON.parse(text);
  } catch {
    return {
      create_date: "1970-01-01T00:00:00.000Z",
      id: 0,
    };
  }
}

async function writeCheckpoint(checkpointPath, row) {
  await ensureParentDirectory(checkpointPath);
  await fs.writeFile(
    checkpointPath,
    JSON.stringify(
      {
        create_date: normalizeTimestamp(row.create_date),
        id: row.id,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

async function loadRowsFromSample(sampleInput) {
  const text = await fs.readFile(sampleInput, "utf-8");
  return JSON.parse(text);
}

async function loadRowsFromDatabase(args) {
  const checkpoint = await readCheckpoint(args.checkpoint);
  let pgModule;
  try {
    pgModule = await import("pg");
  } catch {
    try {
      const fallbackEntry = pathToFileURL(
        path.resolve("poller", "node_modules", "pg", "esm", "index.mjs"),
      ).href;
      pgModule = await import(fallbackEntry);
    } catch {
      throw new Error("The 'pg' package is required to poll error_log from PostgreSQL.");
    }
  }

  const client = new pgModule.Client(
    process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.PGHOST,
          port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
        },
  );

  await client.connect();
  try {
    const result = await client.query(
      `
        SELECT id, error_code, error, request, user_agent, ip_address, user_id, severity, status, create_date
        FROM error_log
        WHERE is_deleted = false
          AND (
            create_date > $1
            OR (create_date = $1 AND id > $2)
          )
        ORDER BY create_date ASC, id ASC
        LIMIT $3
      `,
      [checkpoint.create_date, checkpoint.id, args.limit],
    );
    return result.rows;
  } finally {
    await client.end();
  }
}

async function pushToOpenSearch(documents) {
  const bulkUrl = process.env.OPENSEARCH_BULK_URL;
  if (!bulkUrl) {
    throw new Error("OPENSEARCH_BULK_URL is required when --push-opensearch is used.");
  }

  const headers = {
    "content-type": "application/x-ndjson",
  };

  if (process.env.OPENSEARCH_USERNAME && process.env.OPENSEARCH_PASSWORD) {
    const token = Buffer.from(
      `${process.env.OPENSEARCH_USERNAME}:${process.env.OPENSEARCH_PASSWORD}`,
      "utf-8",
    ).toString("base64");
    headers.authorization = `Basic ${token}`;
  }

  const response = await fetch(bulkUrl, {
    method: "POST",
    headers,
    body: buildBulkPayload(documents),
  });

  if (!response.ok) {
    throw new Error(`OpenSearch bulk push failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const envFileIndex = rawArgs.indexOf("--env-file");
  if (envFileIndex >= 0 && rawArgs[envFileIndex + 1]) {
    loadEnvFile(rawArgs[envFileIndex + 1]);
  }
  const args = parseArgs(rawArgs);
  const rows = args.sampleInput
    ? await loadRowsFromSample(args.sampleInput)
    : await loadRowsFromDatabase(args);

  const documents = rows.map(normalizeRow);

  if (args.output) {
    await ensureParentDirectory(args.output);
    await fs.writeFile(args.output, JSON.stringify(documents, null, 2), "utf-8");
  } else {
    process.stdout.write(`${JSON.stringify(documents, null, 2)}\n`);
  }

  if (args.pushOpenSearch && documents.length > 0) {
    const result = await pushToOpenSearch(documents);
    process.stderr.write(`${JSON.stringify(result)}\n`);
  }

  if (!args.sampleInput && rows.length > 0) {
    await writeCheckpoint(args.checkpoint, rows[rows.length - 1]);
  }

  process.stderr.write(`normalized ${documents.length} error_log rows\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
