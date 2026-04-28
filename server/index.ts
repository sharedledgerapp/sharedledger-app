import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const captureRawBody = (req: any, _res: any, buf: Buffer) => {
  req.rawBody = buf;
};

app.use(
  express.json({
    limit: "10mb",
    verify: captureRawBody,
  }),
);

app.use(express.urlencoded({ extended: false, verify: captureRawBody } as any));
app.use(express.text({ type: "text/plain", limit: "10mb", verify: captureRawBody } as any));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && res.statusCode >= 400) {
        const snippet = JSON.stringify(capturedJsonResponse).slice(0, 120);
        logLine += ` :: ${snippet}`;
      }

      log(logLine);
    }
  });

  next();
});

async function runPendingMigrations() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _applied_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        `SELECT 1 FROM _applied_migrations WHERE filename = $1`,
        [file]
      );
      if (rows.length > 0) continue;

      const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      const statements = content
        .split(";")
        .map((s: string) => s.replace(/--[^\n]*/g, "").trim())
        .filter((s: string) => s.length > 0);

      for (const stmt of statements) {
        await client.query(stmt);
      }

      await client.query(
        `INSERT INTO _applied_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [file]
      );
      console.log(`[migrations] Applied: ${file}`);
    }
  } finally {
    client.release();
  }
}

(async () => {
  await runPendingMigrations();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[error] ${status} — ${message}`, err.stack || "");
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
