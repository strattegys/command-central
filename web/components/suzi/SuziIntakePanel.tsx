"use client";

import { useState, useEffect, useCallback } from "react";
import IntakeCard, { type IntakeCardItem } from "./IntakeCard";
import { panelBus } from "@/lib/events";

const PAGE_SIZE = 9;

interface SuziIntakePanelProps {
  onClose: () => void;
  embedded?: boolean;
}

export default function SuziIntakePanel({ onClose: _onClose, embedded = false }: SuziIntakePanelProps) {
  const [items, setItems] = useState<IntakeCardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [titleIn, setTitleIn] = useState("");
  const [urlIn, setUrlIn] = useState("");
  const [bodyIn, setBodyIn] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("suzi_intake_search");
    if (saved) setSearch(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("suzi_intake_search", search);
  }, [search]);

  const fetchItems = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    try {
      const res = await fetch(`/api/intake?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(typeof data.total === "number" ? data.total : (data.items || []).length);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  const maxPage = total > 0 ? Math.max(0, Math.ceil(total / PAGE_SIZE) - 1) : 0;
  useEffect(() => {
    if (page > maxPage) setPage(maxPage);
  }, [page, maxPage]);

  useEffect(() => {
    setLoading(true);
    fetchItems();
    const unsub = panelBus.on("intake", fetchItems);
    return unsub;
  }, [fetchItems]);

  const handleAdd = async () => {
    const title = titleIn.trim();
    if (!title) return;
    setSaving(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "add",
          title,
          url: urlIn.trim() || undefined,
          body: bodyIn.trim() || undefined,
          source: "ui",
        }),
      });
      if (res.ok) {
        setTitleIn("");
        setUrlIn("");
        setBodyIn("");
        fetchItems();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((x) => x.id !== id));
      try {
        const res = await fetch("/api/intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: "delete", id }),
        });
        await fetchItems();
      } catch {
        await fetchItems();
      }
    },
    [fetchItems]
  );

  return (
    <div className="flex-1 bg-[var(--bg-primary)] flex flex-col overflow-hidden min-w-0">
      {!embedded && (
        <div className="h-10 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center px-3 gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">Intake</span>
          <span className="ml-auto text-xs text-[var(--text-tertiary)] tabular-nums">
            {loading
              ? "Loading…"
              : total === 0
                ? "0 items"
                : total <= PAGE_SIZE
                  ? `${total} item${total !== 1 ? "s" : ""}`
                  : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + items.length} of ${total}`}
          </span>
        </div>
      )}

      <div className="shrink-0 px-3 py-2 border-b border-[var(--border-color)] space-y-2">
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Quick add — or tell Suzi: &quot;add an intake item …&quot;
        </p>
        <input
          type="text"
          value={titleIn}
          onChange={(e) => setTitleIn(e.target.value)}
          placeholder="Title *"
          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-green)]"
        />
        <input
          type="url"
          value={urlIn}
          onChange={(e) => setUrlIn(e.target.value)}
          placeholder="URL (optional)"
          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-green)]"
        />
        <textarea
          value={bodyIn}
          onChange={(e) => setBodyIn(e.target.value)}
          placeholder="Note / snippet (optional)"
          rows={2}
          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-green)] resize-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !titleIn.trim()}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#D85A30] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
        >
          {saving ? "Saving…" : "Add to Intake"}
        </button>
      </div>

      <div className="shrink-0 px-3 py-2 border-b border-[var(--border-color)]">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder="Search intake…"
          className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-green)]"
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-[var(--text-tertiary)]">Loading intake…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-sm text-[var(--text-tertiary)]">
                  {search.trim() ? "No items match" : "Nothing in Intake yet"}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Share from Android, email yourself, or add above.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {items.map((item, index) => (
                <IntakeCard
                  key={item.id}
                  item={item}
                  displayNumber={page * PAGE_SIZE + index + 1}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {total > 0 && (
          <div className="shrink-0 border-t border-[var(--border-color)] px-3 py-2 flex items-center justify-center gap-4 bg-[var(--bg-secondary)]">
            <button
              type="button"
              aria-label="Previous page"
              disabled={page <= 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-sm px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-primary)] disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[var(--bg-primary)]"
            >
              ←
            </button>
            <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums min-w-[7rem] text-center">
              {total <= PAGE_SIZE
                ? `${total} item${total !== 1 ? "s" : ""}`
                : `Page ${page + 1} / ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={(page + 1) * PAGE_SIZE >= total || loading}
              onClick={() => setPage((p) => p + 1)}
              className="text-sm px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-primary)] disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[var(--bg-primary)]"
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
