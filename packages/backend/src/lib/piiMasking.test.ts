import { describe, expect, it } from 'vitest';
import { samplePiiValues } from '../fixtures/dataClassification.js';
import { maskEmail, maskName, maskPiiInText } from './piiMasking.js';

describe('piiMasking', () => {
  it('masks email addresses as first-char***@***.tld', () => {
    expect(maskEmail(samplePiiValues.email)).toBe(samplePiiValues.maskedEmail);
    expect(maskEmail('User@Example.COM')).toBe('u***@***.COM');
  });

  it('masks names as initial*** per word', () => {
    expect(maskName(samplePiiValues.fullName)).toBe(samplePiiValues.maskedName);
    expect(maskName(samplePiiValues.multiPartName)).toBe(samplePiiValues.maskedMultiPartName);
  });

  it('masks emails and names inside free-form log text', () => {
    const masked = maskPiiInText(samplePiiValues.logMessage);
    expect(masked).toContain(samplePiiValues.maskedEmail);
    expect(masked).toContain(samplePiiValues.maskedName);
    expect(masked).not.toContain('jane.doe@example.com');
    expect(masked).not.toContain('Jane Doe');
  });
});
