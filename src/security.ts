import type { Request, Response, NextFunction } from "express";

const ALLOWED_ORIGIN = "http://localhost:3000";

//this is not production level protections because some legitimate requests may not contain an Origin header
// so common validation strategy
// origin exists? - validate Origin
// origin missing? - check referer
// both missing? - reject sensitive requests or require a CSRF token
// Origin - identifies request origin
// Referer - identifies the referring page (potentially including its path) - can be ommited because of privacy settings or Referrer-Policy
export function checkOrigin(req: Request, res: Response, next: NextFunction) {
  // tells the server which origin initiated a request
  const origin = req.headers.origin;

  if (origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({
      error: "Forbidden origin",
    });
  }

  next();
}
