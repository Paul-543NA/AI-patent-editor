/**
 * Fault-tolerant streaming JSON parser for AI suggestion responses.
 *
 * The LLM review endpoint streams JSON over WebSocket in chunks. The client
 * accumulates chunks until the sentinel "--- Done sending suggestions ---" arrives,
 * at which point the complete response is parsed. Because chunk boundaries can fall
 * mid-token, the accumulated string may be malformed (truncated strings, missing commas).
 *
 * Recovery strategies applied in priority order:
 *   1. Extract individual issue objects via regex (`{"type": ...}`) and parse each
 *      independently. Failures on individual objects fall through to strategy 2.
 *   2. Attempt structural JSON repair on failed objects (missing commas, unquoted
 *      keys, trailing commas).
 *   3. Last resort: mine key-value patterns from the raw string to reconstruct
 *      suggestion fields (mineValidSuggestions).
 */

export interface SuggestionData {
  type: string;
  severity: 'low' | 'medium' | 'high';
  paragraph: number;
  description: string;
  suggestion: string;
}

/** Validate and normalise a raw parsed object into a SuggestionData, or null if invalid. */
export function validateAndCleanIssue(issue: Record<string, unknown>): SuggestionData | null {
  const cleanIssue = {
    type: String(issue.type ?? issue["         type"] ?? "").trim(),
    severity: String(issue.severity ?? "").trim().toLowerCase(),
    paragraph: parseInt(String(issue.paragraph ?? "0")) || 0,
    description: String(issue.description ?? "").trim(),
    suggestion: String(issue.suggestion ?? "").trim(),
  };

  const isValid = (
    cleanIssue.type &&
    cleanIssue.severity &&
    cleanIssue.paragraph > 0 &&
    cleanIssue.description &&
    cleanIssue.suggestion &&
    ['low', 'medium', 'high'].includes(cleanIssue.severity)
  );

  if (isValid) {
    return {
      type: cleanIssue.type,
      severity: cleanIssue.severity as 'low' | 'medium' | 'high',
      paragraph: cleanIssue.paragraph,
      description: cleanIssue.description,
      suggestion: cleanIssue.suggestion,
    };
  }
  return null;
}

/** Attempt to repair common JSON formatting errors in a single-object string. */
export function attemptRepair(jsonStr: string): SuggestionData | null {
  try {
    const repaired = jsonStr
      .replace(/"\s*([a-zA-Z_])/g, '", "$1')
      .replace(/([a-zA-Z_]+):/g, '"$1":')
      .replace(/,\s*}/g, '}')
      .replace(/" ([a-zA-Z_]+)":/g, '", "$1":');

    const issue = JSON.parse(repaired);
    return validateAndCleanIssue(issue);
  } catch {
    return null;
  }
}

/** Last-resort strategy: mine key-value patterns from a corrupted payload. */
export function mineValidSuggestions(response: string): SuggestionData[] {
  const suggestions: SuggestionData[] = [];

  const typeMatches = response.match(/"type"\s*:\s*"([^"]+)"/g);
  const severityMatches = response.match(/"severity"\s*:\s*"([^"]+)"/g);
  const paragraphMatches = response.match(/"paragraph"\s*:\s*(\d+)/g);
  const descriptionMatches = response.match(/"description"\s*:\s*"([^"]+(?:[^"\\]|\\.)*)"/g);
  const suggestionMatches = response.match(/"suggestion"\s*:\s*"([^"]+(?:[^"\\]|\\.)*)"/g);

  if (
    typeMatches && severityMatches && paragraphMatches &&
    descriptionMatches && suggestionMatches
  ) {
    const maxLength = Math.min(
      typeMatches.length,
      severityMatches.length,
      paragraphMatches.length,
      descriptionMatches.length,
      suggestionMatches.length
    );

    for (let i = 0; i < maxLength; i++) {
      const severity = severityMatches[i].match(/"([^"]+)"/)?.[1] as 'low' | 'medium' | 'high';
      const paragraph = parseInt(paragraphMatches[i].match(/(\d+)/)?.[1] ?? "0");
      const type = typeMatches[i].match(/"([^"]+)"/)?.[1] ?? "";
      const description = descriptionMatches[i].match(/"([^"]+(?:[^"\\]|\\.)*)"/)?.[1] ?? "";
      const suggestion = suggestionMatches[i].match(/"([^"]+(?:[^"\\]|\\.)*)"/)?.[1] ?? "";

      if (
        type && severity && paragraph > 0 &&
        description && suggestion &&
        ['low', 'medium', 'high'].includes(severity)
      ) {
        suggestions.push({ type, severity, paragraph, description, suggestion });
      }
    }
  }

  return suggestions;
}

/**
 * Parse a complete (but potentially malformed) streaming JSON response into
 * an array of validated SuggestionData objects.
 */
export function parseStreamingJSON(fullResponse: string): SuggestionData[] {
  const suggestions: SuggestionData[] = [];

  // Strategy 1: extract individual issue objects via regex and parse each independently
  try {
    const issuePattern = /\{\s*"type"[\s\S]*?\}/g;
    const matches = fullResponse.match(issuePattern);

    if (matches) {
      for (const match of matches) {
        try {
          const issue = JSON.parse(match);
          const valid = validateAndCleanIssue(issue);
          if (valid) suggestions.push(valid);
        } catch {
          // Strategy 2: attempt structural repair on this individual object
          const repaired = attemptRepair(match);
          if (repaired) suggestions.push(repaired);
        }
      }
    }
  } catch {
    // fall through to strategy 3
  }

  // Strategy 3: mine key-value patterns from the raw string
  if (suggestions.length === 0) {
    suggestions.push(...mineValidSuggestions(fullResponse));
  }

  return suggestions;
}
