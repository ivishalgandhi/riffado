import {
    Briefcase,
    Crown,
    Lightbulb,
    List,
    ListChecks,
    type LucideIcon,
    Sparkles,
    Wrench,
} from "lucide-react";

/** Derive a human-readable title from a camelCase or PascalCase key. */
function keyToTitle(key: string): string {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
}

/** Icon hints for known field names. Unknown fields get List. */
const ICON_HINTS: Record<string, LucideIcon> = {
    keyPoints: ListChecks,
    actionItems: ListChecks,
    aiSuggestions: Sparkles,
    aiTechnicalSuggestions: Wrench,
    recommendations: Lightbulb,
    managementInsights: Briefcase,
    directorInsights: Crown,
};

/**
 * Extract every non-empty string-array field from a summary JSON object.
 * Renders automatically for any field the backend returns — no registration
 * needed. Add an entry to ICON_HINTS to get a custom icon; otherwise falls
 * back to List.
 */
export function getSummaryArrayFields(
    data: Record<string, unknown> | null | undefined,
): Array<{ key: string; title: string; icon: LucideIcon; items: string[] }> {
    if (!data) return [];
    const fields: Array<{
        key: string;
        title: string;
        icon: LucideIcon;
        items: string[];
    }> = [];
    for (const [key, value] of Object.entries(data)) {
        if (key === "summary") continue;
        const items = Array.isArray(value)
            ? value.filter(
                  (item): item is string =>
                      typeof item === "string" && item.trim().length > 0,
              )
            : [];
        if (items.length === 0) continue;
        fields.push({
            key,
            title: keyToTitle(key),
            icon: ICON_HINTS[key] ?? List,
            items,
        });
    }
    return fields;
}
