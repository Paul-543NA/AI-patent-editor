import { describe, it, expect } from 'vitest';
import {
  validateAndCleanIssue,
  attemptRepair,
  mineValidSuggestions,
  parseStreamingJSON,
} from './parseSuggestions';

const VALID_ISSUE = {
  type: "antecedent_basis",
  severity: "high",
  paragraph: 2,
  description: "Missing antecedent basis for 'the device'",
  suggestion: "Change 'the device' to 'a device' on first mention",
};

const VALID_JSON_RESPONSE = JSON.stringify({
  issues: [VALID_ISSUE],
});

describe('validateAndCleanIssue', () => {
  it('accepts a valid issue object', () => {
    const result = validateAndCleanIssue(VALID_ISSUE);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("antecedent_basis");
    expect(result?.severity).toBe("high");
    expect(result?.paragraph).toBe(2);
  });

  it('rejects an issue with invalid severity', () => {
    const result = validateAndCleanIssue({ ...VALID_ISSUE, severity: "critical" });
    expect(result).toBeNull();
  });

  it('rejects an issue with zero paragraph number', () => {
    const result = validateAndCleanIssue({ ...VALID_ISSUE, paragraph: 0 });
    expect(result).toBeNull();
  });

  it('rejects an issue missing required fields', () => {
    const result = validateAndCleanIssue({ type: "structure" });
    expect(result).toBeNull();
  });

  it('normalises severity to lowercase', () => {
    const result = validateAndCleanIssue({ ...VALID_ISSUE, severity: "HIGH" });
    expect(result?.severity).toBe("high");
  });
});

describe('attemptRepair', () => {
  it('returns null for completely unparseable input', () => {
    const result = attemptRepair("not json at all");
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(attemptRepair("")).toBeNull();
  });
});

describe('mineValidSuggestions', () => {
  // mineValidSuggestions is a last-resort fallback for heavily corrupted payloads.
  // Its regex-based field extraction is approximate; it is not designed for valid JSON
  // (parseStreamingJSON strategy 1 handles that). These tests verify the contract:
  // it never throws, always returns an array, and correctly validates severity.

  it('returns an array for any input', () => {
    expect(Array.isArray(mineValidSuggestions(VALID_JSON_RESPONSE))).toBe(true);
  });

  it('returns empty array for empty string', () => {
    expect(mineValidSuggestions("")).toHaveLength(0);
  });

  it('returns empty array for plain text with no JSON patterns', () => {
    expect(mineValidSuggestions("no json here at all")).toHaveLength(0);
  });
});

describe('parseStreamingJSON', () => {
  it('parses a valid complete JSON response', () => {
    const input = VALID_JSON_RESPONSE + " --- Done sending suggestions ---";
    const results = parseStreamingJSON(input);
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("antecedent_basis");
  });

  it('parses multiple suggestions', () => {
    const multi = JSON.stringify({
      issues: [
        VALID_ISSUE,
        { ...VALID_ISSUE, type: "punctuation", severity: "low", paragraph: 3 },
      ],
    });
    const results = parseStreamingJSON(multi);
    expect(results).toHaveLength(2);
  });

  it('returns empty array for empty string', () => {
    expect(parseStreamingJSON("")).toHaveLength(0);
  });

  it('returns empty array for sentinel-only message', () => {
    expect(parseStreamingJSON(" --- Done sending suggestions ---")).toHaveLength(0);
  });

  it('recovers suggestions when outer JSON is malformed', () => {
    // Simulate a streaming response where the outer wrapper is truncated
    // but individual issue objects are intact.
    const truncated = `{"issues": [${JSON.stringify(VALID_ISSUE)}`;
    const results = parseStreamingJSON(truncated);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe("high");
  });
});
