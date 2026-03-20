"use client";

import { useState, useEffect, useRef } from "react";

interface Campaign {
  id: string;
  name: string;
  stage: string;
  spec: string;
  boardId: string | null;
  board: {
    id: string;
    name: string;
    description?: string | null;
    stages?: { key: string; label: string; color: string }[];
    transitions?: Record<string, string[]>;
  } | null;
}

const STAGES = ["PLANNING", "ACTIVE", "PAUSED", "COMPLETED"] as const;

const STAGE_COLORS: Record<string, string> = {
  PLANNING: "#6b8a9e",
  ACTIVE: "#1D9E75",
  PAUSED: "#D85A30",
  COMPLETED: "#22c55e",
};

interface CampaignSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  onCampaignLoaded?: (campaign: Campaign | null) => void;
}

export type { Campaign };

export default function CampaignSelector({ selectedId, onSelect, onCampaignLoaded }: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(false);
  const [saving, setSaving] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/crm/campaigns")
      .then((r) => r.json())
      .then((data) => setCampaigns(data.campaigns || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  // Close popup on outside click
  useEffect(() => {
    if (!showPopup) return;
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPopup]);

  const selected = campaigns.find((c) => c.id === selectedId);

  // Notify parent when the selected campaign (with board data) is resolved
  useEffect(() => {
    onCampaignLoaded?.(selected ?? null);
  }, [selected, onCampaignLoaded]);

  const handleStageChange = async (newStage: string) => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/crm/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, stage: newStage }),
      });
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === selected.id ? { ...c, stage: newStage } : c))
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 relative">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        className="bg-[var(--bg-input)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-1.5 border border-[var(--border-color)] outline-none cursor-pointer min-w-[200px]"
      >
        <option value="">{loading ? "Loading campaigns..." : "Select a campaign"}</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.stage})
          </option>
        ))}
      </select>

      {/* Info button */}
      {selected && (
        <button
          onClick={() => setShowPopup(!showPopup)}
          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] cursor-pointer"
          title="Campaign details"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      )}

      {/* Popup */}
      {showPopup && selected && (
        <div
          ref={popupRef}
          className="absolute top-full left-0 mt-2 w-[500px] max-h-[70vh] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">{selected.name}</h2>
            <button
              onClick={() => setShowPopup(false)}
              className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Stage selector */}
          <div className="px-4 py-3 border-b border-[var(--border-color)]">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2 block">
              Stage
            </label>
            <div className="flex gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  disabled={saving}
                  className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                    selected.stage === s
                      ? "border-transparent text-white font-medium"
                      : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--text-tertiary)]"
                  }`}
                  style={
                    selected.stage === s
                      ? { backgroundColor: STAGE_COLORS[s] || "#555" }
                      : undefined
                  }
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Board details */}
          {selected.board && (
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2 block">
                Board
              </label>
              <div className="text-xs font-medium text-[var(--text-primary)] mb-1">{selected.board.name}</div>
              {selected.board.description && (
                <div className="text-[11px] text-[var(--text-tertiary)] mb-3">{selected.board.description}</div>
              )}

              {/* Stages */}
              {selected.board.stages && selected.board.stages.length > 0 && (
                <div className="mb-3">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-1.5 block">
                    Pipeline Stages
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.board.stages.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-1">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full text-white font-medium"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.label}
                        </span>
                        {i < selected.board!.stages!.length - 1 && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transitions */}
              {selected.board.transitions && selected.board.stages && (
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-1.5 block">
                    Allowed Transitions
                  </label>
                  <div className="space-y-1">
                    {selected.board.stages.map((s) => {
                      const targets = selected.board!.transitions![s.key];
                      if (!targets || targets.length === 0) return (
                        <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-medium text-[var(--text-secondary)]" style={{ color: s.color }}>{s.label}</span>
                          <span className="text-[var(--text-tertiary)] italic">final stage</span>
                        </div>
                      );
                      const stageMap = Object.fromEntries(selected.board!.stages!.map((st) => [st.key, st]));
                      return (
                        <div key={s.key} className="flex items-center gap-1.5 text-[11px] flex-wrap">
                          <span className="font-medium" style={{ color: s.color }}>{s.label}</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                          {targets.map((t, i) => {
                            const target = stageMap[t];
                            return (
                              <span key={t}>
                                <span className="text-[var(--text-secondary)]" style={{ color: target?.color }}>{target?.label || t}</span>
                                {i < targets.length - 1 && <span className="text-[var(--text-tertiary)]">, </span>}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Spec */}
          <div className="px-4 py-3 flex-1 overflow-y-auto min-h-0">
            <label className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2 block">
              Campaign Spec
            </label>
            {selected.spec ? (
              <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {selected.spec}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-tertiary)] italic">
                No spec defined for this campaign.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
