import ReactMarkdown from "react-markdown";

interface SummaryMarkdownProps {
    children: string;
    className?: string;
}

/**
 * Renders LLM summary content as markdown. Handles both plain-text strings
 * (from simple presets) and markdown-formatted strings (from custom prompts).
 */
export function SummaryMarkdown({ children, className }: SummaryMarkdownProps) {
    return (
        <div className={className}>
            <ReactMarkdown
                components={{
                    h1: ({ children: c }) => (
                        <h1 className="text-base font-semibold mt-3 mb-1 first:mt-0">
                            {c}
                        </h1>
                    ),
                    h2: ({ children: c }) => (
                        <h2 className="text-sm font-semibold mt-3 mb-1 first:mt-0">
                            {c}
                        </h2>
                    ),
                    h3: ({ children: c }) => (
                        <h3 className="text-sm font-medium mt-2 mb-1 first:mt-0">
                            {c}
                        </h3>
                    ),
                    p: ({ children: c }) => (
                        <p className="text-sm leading-relaxed mb-2 last:mb-0">
                            {c}
                        </p>
                    ),
                    ul: ({ children: c }) => (
                        <ul className="list-disc list-inside space-y-0.5 mb-2 last:mb-0 text-sm">
                            {c}
                        </ul>
                    ),
                    ol: ({ children: c }) => (
                        <ol className="list-decimal list-inside space-y-0.5 mb-2 last:mb-0 text-sm">
                            {c}
                        </ol>
                    ),
                    li: ({ children: c }) => (
                        <li className="leading-relaxed">{c}</li>
                    ),
                    strong: ({ children: c }) => (
                        <strong className="font-semibold">{c}</strong>
                    ),
                    em: ({ children: c }) => <em className="italic">{c}</em>,
                    code: ({ children: c }) => (
                        <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                            {c}
                        </code>
                    ),
                    hr: () => <hr className="my-2 border-border" />,
                }}
            >
                {children}
            </ReactMarkdown>
        </div>
    );
}
