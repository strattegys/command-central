/**
 * Normalize LLM tool arguments before executing tools.
 * Groq/Llama often wraps args in a one-element array or adds a redundant `tool` field;
 * without this, Object.entries turns into { "0": "[whole object as JSON]" } and tools fail.
 */

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Unwrap array-wrapped args and strip `tool` when it matches the invoked tool name.
 */
export function coerceToolArgumentsRecord(
  toolName: string,
  value: unknown
): Record<string, unknown> {
  let obj: Record<string, unknown> | null = null;

  if (value === null || value === undefined) {
    return {};
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      console.warn(`[tool-args] Empty arguments array for tool ${toolName}`);
      return {};
    }
    if (value.length > 1) {
      console.warn(
        `[tool-args] ${value.length} elements in arguments array for ${toolName}; using only the first`
      );
    }
    const first = value[0];
    if (!isPlainObject(first)) {
      console.warn(`[tool-args] First array element is not an object for ${toolName}`);
      return {};
    }
    obj = first;
  } else if (isPlainObject(value)) {
    obj = value;
  } else {
    return {};
  }

  const out = { ...obj };
  const rawTool = out.tool;
  if (typeof rawTool === "string") {
    const want = toolName.replace(/-/g, "_").toLowerCase();
    const got = rawTool.replace(/-/g, "_").toLowerCase();
    if (got === want) {
      delete out.tool;
    }
  }
  return out;
}

export function toolArgumentsToStringRecord(
  toolName: string,
  value: unknown
): Record<string, string> {
  const obj = coerceToolArgumentsRecord(toolName, value);
  const stringArgs: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    stringArgs[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return stringArgs;
}

/** Parse Groq/OpenAI `function.arguments` JSON string into flat string args. */
export function parseGroqToolArgumentsJson(
  toolName: string,
  argumentsJson: string
): Record<string, string> {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(argumentsJson || "{}");
  } catch (e) {
    console.warn(`[tool-args] JSON.parse failed for ${toolName}:`, e);
  }
  return toolArgumentsToStringRecord(toolName, parsed);
}
