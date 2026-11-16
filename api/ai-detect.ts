import type { Request, Response } from "express";
import { analyzeTextWithAiorNot } from "../server/aiDetection.ts";

export default async function handler(req: Request, res: Response): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const authorization = req.headers.authorization;
  const result = await analyzeTextWithAiorNot(
    typeof authorization === "string" ? authorization : undefined,
    req.body?.text
  );
  res.status(result.status).json(result.body);
}
