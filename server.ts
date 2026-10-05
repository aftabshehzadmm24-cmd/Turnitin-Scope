import express from "express";
import path from "path";
import fs from "fs";
import { convertDocxToPdf } from "./server/docxConverter.ts";
import { getAvailablePort } from "./server/port.ts";

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT) || 3000;
  const PORT = await getAvailablePort(preferredPort);

  if (PORT !== preferredPort) {
    console.warn(`Port ${preferredPort} is busy; using fallback port ${PORT} instead.`);
  }

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isLocalDevelopment = process.env.NODE_ENV !== "production"
      && (origin === "http://localhost:3000" || origin === "http://127.0.0.1:3000");

    if (origin && (configuredOrigins.includes(origin) || isLocalDevelopment)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // API health check (critical for Cloud Run deployment health checks)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // DOCX to PDF conversion using in-memory mammoth and pdf-lib
  app.post("/api/convert-docx", async (req, res) => {
    try {
      const { docxBase64, fileName } = req.body;
      if (!docxBase64) {
        return res.status(400).json({ success: false, error: "Missing docxBase64 payload" });
      }

      const result = await convertDocxToPdf(docxBase64, fileName);
      if (!result.success || !result.pdfBase64) {
        return res.status(500).json({ success: false, error: result.error || "Conversion failed" });
      }

      res.json({
        success: true,
        pdfBase64: result.pdfBase64,
        pageCount: result.pageCount || 1,
        fileName: fileName ? fileName.replace(/\.docx?$/i, ".pdf") : "document.pdf",
      });
    } catch (err: any) {
      console.error("Server /api/convert-docx error:", err);
      res.status(500).json({ success: false, error: err?.message || "Internal server error" });
    }
  });

  // Dev must use Vite even when a previous production build left dist/ behind.
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));
  const isProduction = process.env.NODE_ENV === "production" || process.argv.includes("--serve-dist");

  if (isProduction && hasDist) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Only import and mount Vite middlewares in local dev
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
