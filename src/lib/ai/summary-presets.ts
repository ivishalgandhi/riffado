export interface CustomSummaryPrompt {
    id: string;
    name: string;
    prompt: string;
    createdAt: string;
}

export interface SummaryPromptConfiguration {
    /** Prompt id — matches a CustomSummaryPrompt.id stored in the DB. */
    selectedPrompt: string;
    customPrompts: CustomSummaryPrompt[];
}

/**
 * Seed data written to the DB on first settings load when no prompts exist.
 * IDs are stable so existing selectedPrompt values in the DB stay valid.
 */
export const DEFAULT_SUMMARY_PROMPTS: CustomSummaryPrompt[] = [
    {
        id: "general",
        name: "General Summary",
        prompt: `Provide a concise summary of this audio transcription. Then extract key points, action items, recommendations, management insights, director insights, and AI suggestions if any exist.

Respond in the following JSON format (no markdown, no code fences):
{
  "summary": "A concise paragraph summarizing the transcription",
  "keyPoints": ["key point 1", "key point 2"],
  "actionItems": ["action item 1", "action item 2"],
  "recommendations": ["recommendation 1"],
  "managementInsights": ["management insight 1"],
  "directorInsights": ["director insight 1"],
  "aiSuggestions": ["AI suggestion 1"]
}

If any array field has no relevant items, return an empty array for that field.

Transcription:
{transcription}`,
        createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
        id: "meeting-notes",
        name: "Meeting Notes",
        prompt: `Summarize this meeting recording. Include attendees mentioned, decisions made, action items, recommendations, management insights, director insights, and AI suggestions.

Respond in the following JSON format (no markdown, no code fences):
{
  "summary": "A structured summary of the meeting including attendees and decisions",
  "keyPoints": ["decision 1", "decision 2", "key discussion point"],
  "actionItems": ["action item with owner if mentioned", "follow-up task"],
  "recommendations": ["recommended next step"],
  "managementInsights": ["management insight"],
  "directorInsights": ["director insight"],
  "aiSuggestions": ["AI suggestion"]
}

If any array field has no relevant items, return an empty array for that field.

Transcription:
{transcription}`,
        createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
        id: "key-points",
        name: "Key Points",
        prompt: `Extract the key points from this transcription. Focus on the most important information, facts, and insights. Also include recommendations, management insights, director insights, and AI suggestions if relevant.

Respond in the following JSON format (no markdown, no code fences):
{
  "summary": "A brief one-sentence overview of the transcription",
  "keyPoints": ["key point 1", "key point 2", "key point 3"],
  "actionItems": [],
  "recommendations": ["recommendation 1"],
  "managementInsights": ["management insight 1"],
  "directorInsights": ["director insight 1"],
  "aiSuggestions": ["AI suggestion 1"]
}

If any array field has no relevant items, return an empty array for that field.

Transcription:
{transcription}`,
        createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
        id: "action-items",
        name: "Action Items",
        prompt: `Extract all action items, tasks, and follow-ups mentioned in this transcription. Include who is responsible if mentioned. Also include recommendations, management insights, director insights, and AI suggestions if relevant.

Respond in the following JSON format (no markdown, no code fences):
{
  "summary": "A brief overview of what was discussed",
  "keyPoints": [],
  "actionItems": ["action item 1 (owner if known)", "task 2", "follow-up 3"],
  "recommendations": ["recommendation 1"],
  "managementInsights": ["management insight 1"],
  "directorInsights": ["director insight 1"],
  "aiSuggestions": ["AI suggestion 1"]
}

If any array field has no relevant items, return an empty array for that field.

Transcription:
{transcription}`,
        createdAt: "2024-01-01T00:00:00.000Z",
    },
];

/** Used by the API route when no prompts are configured at all. */
export const FALLBACK_SUMMARY_PROMPT = DEFAULT_SUMMARY_PROMPTS[0].prompt;

export function getDefaultSummaryPromptConfig(): SummaryPromptConfiguration {
    return {
        selectedPrompt: "general",
        customPrompts: [],
    };
}

export function getAllSummaryPrompts(
    config: SummaryPromptConfiguration,
): Array<{ id: string; name: string; prompt: string }> {
    return config.customPrompts.map((p) => ({
        id: p.id,
        name: p.name,
        prompt: p.prompt,
    }));
}

export function getSummaryPromptById(
    id: string,
    config: SummaryPromptConfiguration,
): string | null {
    return config.customPrompts.find((p) => p.id === id)?.prompt ?? null;
}

export interface AiOutputLanguageOption {
    code: string;
    label: string;
}

export const AI_OUTPUT_LANGUAGES: readonly AiOutputLanguageOption[] = [
    { code: "auto", label: "Auto (match transcript)" },
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "fr", label: "French" },
    { code: "de", label: "German" },
    { code: "it", label: "Italian" },
    { code: "pt", label: "Portuguese" },
    { code: "nl", label: "Dutch" },
    { code: "pl", label: "Polish" },
    { code: "ru", label: "Russian" },
    { code: "tr", label: "Turkish" },
    { code: "uk", label: "Ukrainian" },
    { code: "cs", label: "Czech" },
    { code: "sv", label: "Swedish" },
    { code: "da", label: "Danish" },
    { code: "no", label: "Norwegian" },
    { code: "fi", label: "Finnish" },
    { code: "el", label: "Greek" },
    { code: "ro", label: "Romanian" },
    { code: "hu", label: "Hungarian" },
    { code: "ja", label: "Japanese" },
    { code: "zh", label: "Chinese (Simplified)" },
    { code: "ko", label: "Korean" },
    { code: "ar", label: "Arabic" },
    { code: "he", label: "Hebrew" },
    { code: "hi", label: "Hindi" },
    { code: "id", label: "Indonesian" },
    { code: "vi", label: "Vietnamese" },
    { code: "th", label: "Thai" },
] as const;

const LANGUAGE_CODES = new Set(AI_OUTPUT_LANGUAGES.map((l) => l.code));

/** Validate against `AI_OUTPUT_LANGUAGES`; returns the code or null. */
export function normalizeAiOutputLanguage(value: unknown): string | null {
    if (typeof value !== "string") return null;
    return LANGUAGE_CODES.has(value) ? value : null;
}

/** Directive sentence for the model; null for `auto`/missing/unknown. */
export function getAiOutputLanguageDirective(
    code: string | null | undefined,
): string | null {
    if (!code || code === "auto") return null;
    const match = AI_OUTPUT_LANGUAGES.find((l) => l.code === code);
    if (!match) return null;
    return `IMPORTANT: Write all natural-language output in ${match.label}, regardless of the transcription's language. Keep any JSON keys in English exactly as specified.`;
}
