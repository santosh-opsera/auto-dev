import type { NextFunction, Request, Response } from 'express';

function getAllowedOrigin(): string {
  return process.env.FRONTEND_URL ?? 'http://localhost:3000';
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigin = getAllowedOrigin();
  const requestOrigin = req.headers.origin;

  if (requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-Correlation-ID,Last-Event-ID',
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}
