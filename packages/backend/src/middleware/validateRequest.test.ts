import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { validationErrorResponseSchema } from '@autodev/shared-types';
import { validateBody } from './validateRequest.js';
import {
  invalidSampleValidationPayload,
  sampleValidationPayloadSchema,
  validSampleValidationPayload,
} from '../fixtures/validation.js';
import { errorHandler } from './errorHandler.js';

describe('validateBody', () => {
  it('rejects invalid payloads with field-level validation errors', async () => {
    const app = express();
    app.use(express.json());
    app.post('/validate', validateBody(sampleValidationPayloadSchema), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorHandler);

    const response = await request(app)
      .post('/validate')
      .send(invalidSampleValidationPayload);

    expect(response.status).toBe(400);
    const body = validationErrorResponseSchema.parse(response.body);
    expect(body.error).toBe('ValidationError');
    expect(body.fields.length).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('accepts valid payloads', async () => {
    const app = express();
    app.use(express.json());
    app.post('/validate', validateBody(sampleValidationPayloadSchema), (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await request(app)
      .post('/validate')
      .send(validSampleValidationPayload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
