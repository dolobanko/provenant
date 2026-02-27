// Pricing in USD per 1M tokens (input / output)
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  // Anthropic Claude 4.x
  'claude-opus-4':          { inputPer1M: 15.0,  outputPer1M: 75.0  },
  'claude-opus-4-5':        { inputPer1M: 15.0,  outputPer1M: 75.0  },
  'claude-sonnet-4':        { inputPer1M: 3.0,   outputPer1M: 15.0  },
  'claude-sonnet-4-5':      { inputPer1M: 3.0,   outputPer1M: 15.0  },
  'claude-haiku-4':         { inputPer1M: 0.8,   outputPer1M: 4.0   },
  'claude-haiku-4-5':       { inputPer1M: 0.8,   outputPer1M: 4.0   },
  // Anthropic Claude 3.x
  'claude-3-opus':          { inputPer1M: 15.0,  outputPer1M: 75.0  },
  'claude-3-5-sonnet':      { inputPer1M: 3.0,   outputPer1M: 15.0  },
  'claude-3-5-haiku':       { inputPer1M: 0.8,   outputPer1M: 4.0   },
  'claude-3-haiku':         { inputPer1M: 0.25,  outputPer1M: 1.25  },
  // OpenAI GPT-4o family
  'gpt-4o':                 { inputPer1M: 2.5,   outputPer1M: 10.0  },
  'gpt-4o-mini':            { inputPer1M: 0.15,  outputPer1M: 0.60  },
  'gpt-4-turbo':            { inputPer1M: 10.0,  outputPer1M: 30.0  },
  'gpt-4':                  { inputPer1M: 30.0,  outputPer1M: 60.0  },
  'gpt-3.5-turbo':          { inputPer1M: 0.5,   outputPer1M: 1.5   },
  // Google Gemini
  'gemini-1.5-pro':         { inputPer1M: 3.5,   outputPer1M: 10.5  },
  'gemini-1.5-flash':       { inputPer1M: 0.075, outputPer1M: 0.30  },
  'gemini-2.0-flash':       { inputPer1M: 0.10,  outputPer1M: 0.40  },
};

/**
 * Estimates the cost in USD for a given model and token counts.
 * Returns 0 if the model is unknown.
 * Handles version suffixes (e.g. "claude-sonnet-4-5-20251101" → "claude-sonnet-4-5").
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!modelId || (!inputTokens && !outputTokens)) return 0;

  // Try exact match first
  let pricing = PRICING[modelId];

  // Try prefix match for version-suffixed model IDs
  if (!pricing) {
    const matchKey = Object.keys(PRICING).find((k) => modelId.startsWith(k));
    if (matchKey) pricing = PRICING[matchKey];
  }

  if (!pricing) return 0;

  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}
