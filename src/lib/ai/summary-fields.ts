import {
    Briefcase,
    Crown,
    Lightbulb,
    ListChecks,
    type LucideIcon,
    Sparkles,
} from "lucide-react";

/**
 * Config for rendering dynamic summary JSON fields. Adding a new field is
 * one line here; the UI iterates over this map and renders any non-empty
 * array returned by the backend.
 */
export const SUMMARY_FIELD_CONFIG: Record<
    string,
    { title: string; icon: LucideIcon }
> = {
    keyPoints: { title: "Key Points", icon: ListChecks },
    actionItems: { title: "Action Items", icon: ListChecks },
    aiSuggestions: { title: "AI Suggestions", icon: Sparkles },
    recommendations: { title: "Recommendations", icon: Lightbulb },
    managementInsights: { title: "Management Insights", icon: Briefcase },
    directorInsights: { title: "Director Insights", icon: Crown },
};

export const SUMMARY_FIELD_ORDER = [
    "keyPoints",
    "actionItems",
    "aiSuggestions",
    "recommendations",
    "managementInsights",
    "directorInsights",
];

/** Extract non-empty array fields from a summary JSON object. */
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
    for (const key of SUMMARY_FIELD_ORDER) {
        const value = data[key];
        const items = Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : [];
        if (items.length === 0) continue;
        const config = SUMMARY_FIELD_CONFIG[key];
        if (!config) continue;
        fields.push({ key, title: config.title, icon: config.icon, items });
    }
    return fields;
}
