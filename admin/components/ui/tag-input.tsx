"use client";

import { KeyboardEvent, useRef } from "react";

type TagInputProps = {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export function TagInput({ label, tags, onChange, placeholder }: TagInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed)) return;
    onChange([...tags, trimmed]);
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const input = inputRef.current;
    if (!input) return;

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input.value.replace(/,$/, ""));
      input.value = "";
    } else if (e.key === "Backspace" && input.value === "" && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  function onBlur() {
    const input = inputRef.current;
    if (!input || !input.value.trim()) return;
    addTag(input.value);
    input.value = "";
  }

  return (
    <div className="space-y-1.5">
      <span className="admin-label">{label}</span>
      <div
        className="admin-input flex min-h-[2.5rem] cursor-text flex-wrap gap-1.5 py-1.5"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-600/60 bg-slate-800 px-2 py-0.5 text-xs text-slate-200"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(i);
              }}
              className="ml-0.5 text-slate-400 hover:text-slate-100"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="min-w-[8rem] flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-500"
          placeholder={tags.length === 0 ? placeholder : ""}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
}
