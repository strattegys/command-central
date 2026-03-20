"use client";

import { useState, useEffect, useCallback } from "react";
import KanbanBoard from "./KanbanBoard";
import CampaignSelector, { type Campaign } from "./CampaignSelector";
import ContactDetailPanel from "./ContactDetailPanel";
import type { Person, PersonAlert } from "./KanbanCard";
import type { StageConfig } from "@/lib/board-types";

interface KanbanInlinePanelProps {
  onClose: () => void;
}

export default function KanbanInlinePanel({ onClose }: KanbanInlinePanelProps) {
  const [campaignId, setCampaignId] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("kanban_campaign") || "";
    return "";
  });
  const [people, setPeople] = useState<Person[]>([]);
  const [alerts, setAlerts] = useState<Record<string, PersonAlert>>({});
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);
  const [boardStages, setBoardStages] = useState<StageConfig[] | undefined>();
  const [boardTransitions, setBoardTransitions] = useState<Record<string, string[]> | undefined>();

  const fetchPeople = useCallback(async (id: string) => {
    if (!id) {
      setPeople([]);
      setAlerts({});
      return;
    }
    setLoading(true);
    try {
      const [peopleRes, alertsRes] = await Promise.all([
        fetch(`/api/crm/people?campaignId=${id}`),
        fetch(`/api/crm/alerts?campaignId=${id}`),
      ]);
      const peopleData = await peopleRes.json();
      const alertsData = await alertsRes.json();
      setPeople(peopleData.people || []);
      setAlerts(alertsData.alerts || {});
    } catch {
      setPeople([]);
      setAlerts({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedPerson(null);
    fetchPeople(campaignId);
    if (campaignId) localStorage.setItem("kanban_campaign", campaignId);
  }, [campaignId, fetchPeople]);

  const handleCampaignLoaded = useCallback((campaign: Campaign | null) => {
    if (campaign?.board) {
      setBoardStages(campaign.board.stages as StageConfig[] | undefined);
      setBoardTransitions(campaign.board.transitions as Record<string, string[]> | undefined);
    } else {
      setBoardStages(undefined);
      setBoardTransitions(undefined);
    }
  }, []);

  return (
    <div className="flex-1 border-l border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col overflow-hidden min-w-0">
      {/* Header */}
      <div className="h-10 shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center px-3 gap-2">
        <button
          onClick={onClose}
          className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)] cursor-pointer"
          title="Back to info"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>

        <span className="text-xs font-semibold text-[var(--text-primary)]">Pipeline</span>

        <CampaignSelector
          selectedId={campaignId}
          onSelect={setCampaignId}
          onCampaignLoaded={handleCampaignLoaded}
        />

        {loading && (
          <span className="text-xs text-[var(--text-tertiary)]">Loading...</span>
        )}

        <span className="ml-auto text-xs text-[var(--text-tertiary)] shrink-0">
          {people.length > 0 && `${people.length} contacts`}
        </span>
      </div>

      {/* Board */}
      {!campaignId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">Select a campaign to view the pipeline</p>
        </div>
      ) : people.length === 0 && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--text-tertiary)]">No contacts in this campaign</p>
        </div>
      ) : (
        <KanbanBoard
          stages={boardStages}
          transitions={boardTransitions}
          people={people}
          alerts={alerts}
          selectedPersonId={selectedPerson?.id ?? null}
          onSelectPerson={setSelectedPerson}
        />
      )}

      {/* Detail panel */}
      {selectedPerson && (
        <ContactDetailPanel
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}
    </div>
  );
}
