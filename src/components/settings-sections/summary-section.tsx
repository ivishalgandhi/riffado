"use client";

import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsSectionHeader } from "@/components/settings/section-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import {
    AI_OUTPUT_LANGUAGES,
    type CustomSummaryPrompt,
    getAllSummaryPrompts,
    getDefaultSummaryPromptConfig,
    type SummaryPromptConfiguration,
} from "@/lib/ai/summary-presets";

function generateId() {
    return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function SummarySection() {
    const { isLoadingSettings, isSavingSettings, setIsLoadingSettings } =
        useSettings();
    const [summaryPrompt, setSummaryPrompt] =
        useState<SummaryPromptConfiguration>(getDefaultSummaryPromptConfig());
    const [outputLanguage, setOutputLanguage] = useState<string>("auto");
    const [isCustomPromptFormOpen, setIsCustomPromptFormOpen] = useState(false);
    const [editingCustomPrompt, setEditingCustomPrompt] =
        useState<CustomSummaryPrompt | null>(null);
    const [customName, setCustomName] = useState("");
    const [customPromptText, setCustomPromptText] = useState("");

    const allPrompts = getAllSummaryPrompts(summaryPrompt);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch("/api/settings/user");
                if (response.ok) {
                    const data = await response.json();
                    const config =
                        (data.summaryPrompt as SummaryPromptConfiguration | null) ||
                        getDefaultSummaryPromptConfig();
                    setSummaryPrompt({
                        selectedPrompt: config.selectedPrompt || "general",
                        customPrompts: config.customPrompts || [],
                    });
                    if (typeof data.aiOutputLanguage === "string") {
                        setOutputLanguage(data.aiOutputLanguage);
                    } else {
                        setOutputLanguage("auto");
                    }
                }
            } catch (error) {
                console.error("Failed to fetch settings:", error);
            } finally {
                setIsLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [setIsLoadingSettings]);

    const saveSummaryPrompt = async (
        next: SummaryPromptConfiguration,
        onSuccess?: () => void,
    ) => {
        const previous = summaryPrompt;
        setSummaryPrompt(next);

        try {
            const response = await fetch("/api/settings/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ summaryPrompt: next }),
            });

            if (!response.ok) {
                throw new Error("Failed to save settings");
            }
            onSuccess?.();
        } catch {
            setSummaryPrompt(previous);
            toast.error("Failed to save settings. Changes reverted.");
        }
    };

    const handlePresetChange = async (value: string) => {
        await saveSummaryPrompt({
            ...summaryPrompt,
            selectedPrompt: value,
        });
    };

    const handleAddCustomPrompt = async () => {
        if (!customName.trim() || !customPromptText.trim()) return;
        const next: CustomSummaryPrompt = {
            id: generateId(),
            name: customName.trim(),
            prompt: customPromptText.trim(),
            createdAt: new Date().toISOString(),
        };
        await saveSummaryPrompt(
            {
                ...summaryPrompt,
                customPrompts: [...summaryPrompt.customPrompts, next],
                selectedPrompt: summaryPrompt.selectedPrompt || next.id,
            },
            () => {
                setCustomName("");
                setCustomPromptText("");
                setIsCustomPromptFormOpen(false);
            },
        );
    };

    const handleEditCustomPrompt = async () => {
        if (
            !editingCustomPrompt ||
            !customName.trim() ||
            !customPromptText.trim()
        )
            return;
        await saveSummaryPrompt(
            {
                ...summaryPrompt,
                customPrompts: summaryPrompt.customPrompts.map((p) =>
                    p.id === editingCustomPrompt.id
                        ? {
                              ...p,
                              name: customName.trim(),
                              prompt: customPromptText.trim(),
                          }
                        : p,
                ),
            },
            () => {
                setEditingCustomPrompt(null);
                setCustomName("");
                setCustomPromptText("");
            },
        );
    };

    const handleDeleteCustomPrompt = async (id: string) => {
        const nextCustoms = summaryPrompt.customPrompts.filter(
            (p) => p.id !== id,
        );
        await saveSummaryPrompt({
            ...summaryPrompt,
            customPrompts: nextCustoms,
            selectedPrompt:
                summaryPrompt.selectedPrompt === id
                    ? "general"
                    : summaryPrompt.selectedPrompt,
        });
    };

    const openEditForm = (prompt: CustomSummaryPrompt) => {
        setEditingCustomPrompt(prompt);
        setCustomName(prompt.name);
        setCustomPromptText(prompt.prompt);
        setIsCustomPromptFormOpen(true);
    };

    const openAddForm = () => {
        setEditingCustomPrompt(null);
        setCustomName("");
        setCustomPromptText("");
        setIsCustomPromptFormOpen(true);
    };

    const closeForm = () => {
        setIsCustomPromptFormOpen(false);
        setEditingCustomPrompt(null);
        setCustomName("");
        setCustomPromptText("");
    };

    const handleLanguageChange = async (value: string) => {
        const previous = outputLanguage;
        setOutputLanguage(value);

        try {
            // Persist `null` for `auto` so the column reflects "no preference".
            const response = await fetch("/api/settings/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    aiOutputLanguage: value === "auto" ? null : value,
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to save settings");
            }
        } catch {
            setOutputLanguage(previous);
            toast.error("Failed to save settings. Changes reverted.");
        }
    };

    if (isLoadingSettings) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <SettingsSectionHeader
                title="Summary"
                description="Prompt presets and provider used when generating recording summaries."
                icon={ListChecks}
            />
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="summary-preset">
                        Default summary prompt
                    </Label>
                    <Select
                        value={summaryPrompt.selectedPrompt}
                        onValueChange={handlePresetChange}
                        disabled={isSavingSettings}
                    >
                        <SelectTrigger id="summary-preset" className="w-full">
                            <SelectValue>
                                {allPrompts.find(
                                    (p) =>
                                        p.id === summaryPrompt.selectedPrompt,
                                )?.name || "General Summary"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {allPrompts.map((prompt) => (
                                <SelectItem key={prompt.id} value={prompt.id}>
                                    <div>
                                        <div>{prompt.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {prompt.isPreset
                                                ? prompt.description
                                                : "Custom prompt"}
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        The default prompt used when generating summaries. You
                        can override this per-recording.
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Custom prompts</Label>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openAddForm}
                            disabled={isSavingSettings}
                        >
                            <Plus className="size-4 mr-1" />
                            Add
                        </Button>
                    </div>
                    {summaryPrompt.customPrompts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No custom prompts yet.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {summaryPrompt.customPrompts.map((prompt) => (
                                <div
                                    key={prompt.id}
                                    className="flex items-center justify-between rounded-md border p-2"
                                >
                                    <span className="text-sm font-medium">
                                        {prompt.name}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7"
                                            onClick={() => openEditForm(prompt)}
                                            disabled={isSavingSettings}
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 text-destructive hover:text-destructive"
                                            onClick={() =>
                                                handleDeleteCustomPrompt(
                                                    prompt.id,
                                                )
                                            }
                                            disabled={isSavingSettings}
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {isCustomPromptFormOpen && (
                    <div className="space-y-2 rounded-md border p-3">
                        <Label htmlFor="custom-prompt-name">Name</Label>
                        <Input
                            id="custom-prompt-name"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            placeholder="e.g., Standup update"
                            disabled={isSavingSettings}
                        />
                        <Label htmlFor="custom-prompt-text">Prompt</Label>
                        <textarea
                            id="custom-prompt-text"
                            value={customPromptText}
                            onChange={(e) =>
                                setCustomPromptText(e.target.value)
                            }
                            placeholder="Instructions for the summary..."
                            rows={4}
                            disabled={isSavingSettings}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={closeForm}
                                disabled={isSavingSettings}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={
                                    editingCustomPrompt
                                        ? handleEditCustomPrompt
                                        : handleAddCustomPrompt
                                }
                                disabled={
                                    isSavingSettings ||
                                    !customName.trim() ||
                                    !customPromptText.trim()
                                }
                            >
                                {editingCustomPrompt ? "Save" : "Add"}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="ai-output-language">
                        AI output language
                    </Label>
                    <Select
                        value={outputLanguage}
                        onValueChange={handleLanguageChange}
                        disabled={isSavingSettings}
                    >
                        <SelectTrigger
                            id="ai-output-language"
                            className="w-full"
                        >
                            <SelectValue>
                                {AI_OUTPUT_LANGUAGES.find(
                                    (l) => l.code === outputLanguage,
                                )?.label ?? "Auto (match transcript)"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {AI_OUTPUT_LANGUAGES.map((lang) => (
                                <SelectItem key={lang.code} value={lang.code}>
                                    {lang.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Applies to AI-generated summaries and titles. Auto lets
                        the model match the transcript's language.
                    </p>
                </div>
            </div>
        </div>
    );
}
