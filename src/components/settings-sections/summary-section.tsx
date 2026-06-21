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
    DEFAULT_SUMMARY_PROMPTS,
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
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingPrompt, setEditingPrompt] =
        useState<CustomSummaryPrompt | null>(null);
    const [formName, setFormName] = useState("");
    const [formText, setFormText] = useState("");

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
                    const customPrompts = config.customPrompts || [];

                    // Seed default prompts on first use so they're editable.
                    if (customPrompts.length === 0) {
                        const seeded: SummaryPromptConfiguration = {
                            selectedPrompt: "general",
                            customPrompts: DEFAULT_SUMMARY_PROMPTS,
                        };
                        setSummaryPrompt(seeded);
                        // Fire-and-forget; errors are non-fatal here.
                        fetch("/api/settings/user", {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ summaryPrompt: seeded }),
                        }).catch(() => {});
                    } else {
                        setSummaryPrompt({
                            selectedPrompt: config.selectedPrompt || "general",
                            customPrompts,
                        });
                    }

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

    const savePromptConfig = async (
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
            if (!response.ok) throw new Error();
            onSuccess?.();
        } catch {
            setSummaryPrompt(previous);
            toast.error("Failed to save settings. Changes reverted.");
        }
    };

    const handleDefaultChange = (value: string) =>
        savePromptConfig({ ...summaryPrompt, selectedPrompt: value });

    const handleSaveForm = async () => {
        if (!formName.trim() || !formText.trim()) return;
        if (editingPrompt) {
            await savePromptConfig(
                {
                    ...summaryPrompt,
                    customPrompts: summaryPrompt.customPrompts.map((p) =>
                        p.id === editingPrompt.id
                            ? {
                                  ...p,
                                  name: formName.trim(),
                                  prompt: formText.trim(),
                              }
                            : p,
                    ),
                },
                closeForm,
            );
        } else {
            const next: CustomSummaryPrompt = {
                id: generateId(),
                name: formName.trim(),
                prompt: formText.trim(),
                createdAt: new Date().toISOString(),
            };
            await savePromptConfig(
                {
                    ...summaryPrompt,
                    customPrompts: [...summaryPrompt.customPrompts, next],
                    selectedPrompt: summaryPrompt.selectedPrompt || next.id,
                },
                closeForm,
            );
        }
    };

    const handleDelete = async (id: string) => {
        const nextCustoms = summaryPrompt.customPrompts.filter(
            (p) => p.id !== id,
        );
        const nextSelected =
            summaryPrompt.selectedPrompt === id
                ? (nextCustoms[0]?.id ?? "")
                : summaryPrompt.selectedPrompt;
        await savePromptConfig({
            ...summaryPrompt,
            customPrompts: nextCustoms,
            selectedPrompt: nextSelected,
        });
    };

    const openEditForm = (prompt: CustomSummaryPrompt) => {
        setEditingPrompt(prompt);
        setFormName(prompt.name);
        setFormText(prompt.prompt);
        setIsFormOpen(true);
    };

    const openAddForm = () => {
        setEditingPrompt(null);
        setFormName("");
        setFormText("");
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingPrompt(null);
        setFormName("");
        setFormText("");
    };

    const handleLanguageChange = async (value: string) => {
        const previous = outputLanguage;
        setOutputLanguage(value);
        try {
            const response = await fetch("/api/settings/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    aiOutputLanguage: value === "auto" ? null : value,
                }),
            });
            if (!response.ok) throw new Error();
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
                description="Prompts used when generating recording summaries."
                icon={ListChecks}
            />
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="summary-preset">Default prompt</Label>
                    <Select
                        value={summaryPrompt.selectedPrompt}
                        onValueChange={handleDefaultChange}
                        disabled={isSavingSettings}
                    >
                        <SelectTrigger id="summary-preset" className="w-full">
                            <SelectValue>
                                {allPrompts.find(
                                    (p) =>
                                        p.id === summaryPrompt.selectedPrompt,
                                )?.name || "Select a prompt"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {allPrompts.map((prompt) => (
                                <SelectItem key={prompt.id} value={prompt.id}>
                                    {prompt.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Used by default when generating summaries. Overridable
                        per-recording.
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Prompts</Label>
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
                    {allPrompts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No prompts yet. Add one to get started.
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
                                                handleDelete(prompt.id)
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

                {isFormOpen && (
                    <div className="space-y-2 rounded-md border p-3">
                        <Label htmlFor="prompt-name">Name</Label>
                        <Input
                            id="prompt-name"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="e.g., Standup update"
                            disabled={isSavingSettings}
                        />
                        <Label htmlFor="prompt-text">Prompt</Label>
                        <textarea
                            id="prompt-text"
                            value={formText}
                            onChange={(e) => setFormText(e.target.value)}
                            placeholder="Instructions for the AI..."
                            rows={6}
                            disabled={isSavingSettings}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">
                            Use{" "}
                            <code className="font-mono">
                                {"{transcription}"}
                            </code>{" "}
                            where the transcript should be inserted.
                        </p>
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
                                onClick={handleSaveForm}
                                disabled={
                                    isSavingSettings ||
                                    !formName.trim() ||
                                    !formText.trim()
                                }
                            >
                                {editingPrompt ? "Save" : "Add"}
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
