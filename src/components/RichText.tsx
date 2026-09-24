"use client";

import React from "react";

/**
 * Minimal markdown renderer for chat replies: **bold**, *italic*,
 * "- " bullet lines, blank-line paragraphs. No HTML passthrough.
 */
export default function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-1.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const isList = lines.every((l) => l.trim().startsWith("-") || l.trim() === "");
        if (isList && lines.some((l) => l.trim().startsWith("-"))) {
          return (
            <ul key={bi} className="ml-1 space-y-1">
              {lines
                .filter((l) => l.trim().startsWith("-"))
                .map((line, li) => (
                  <li key={li} className="flex gap-1.5">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-50" />
                    <span>{inline(line.replace(/^\s*-\s*/, ""))}</span>
                  </li>
                ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="whitespace-pre-wrap">
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 ? <br /> : null}
                {inline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
      return (
        <em key={i} className="opacity-80">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
