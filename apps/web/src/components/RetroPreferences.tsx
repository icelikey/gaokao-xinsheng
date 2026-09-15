"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "gx-reading-mode-v1";

/** A presentation-only preference. Never reads answers, scores or account data. */
export default function RetroPreferences() {
  const [clean, setClean] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY) === "clean";
      document.documentElement.dataset.reading = value ? "clean" : "retro";
      setClean(value);
    } catch {
      // Browsers may block persistence; the control still works for this visit.
    }
  }, []);

  function toggleReading() {
    const next = !clean;
    setClean(next);
    document.documentElement.dataset.reading = next ? "clean" : "retro";
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "clean" : "retro");
    } catch {
      // A storage failure must not prevent answering a question.
    }
  }

  return (
    <aside className="retroTools" aria-label="阅读设置">
      <button type="button" aria-pressed={clean} onClick={toggleReading}
        title="仅调整画面纹理，不影响试卷、作答或评分">
        <span aria-hidden="true">{clean ? "▤" : "▧"}</span>
        {clean ? "恢复复古纹理" : "专注阅读"}
      </button>
    </aside>
  );
}
