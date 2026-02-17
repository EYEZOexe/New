import type { SubscriptionTier } from "../types";

type TierEditorCardProps = {
  tier: SubscriptionTier;
  onTierChange: (value: SubscriptionTier) => void;
  tierTitle: string;
  onTierTitleChange: (value: string) => void;
  tierSubtitle: string;
  onTierSubtitleChange: (value: string) => void;
  tierBadge: string;
  onTierBadgeChange: (value: string) => void;
  tierDescription: string;
  onTierDescriptionChange: (value: string) => void;
  tierSortOrder: string;
  onTierSortOrderChange: (value: string) => void;
  tierActive: boolean;
  onTierActiveChange: (value: boolean) => void;
  isSavingTier: boolean;
  onSaveTier: () => void;
};

export function TierEditorCard(props: TierEditorCardProps) {
  return (
    <div className="admin-surface-soft space-y-4 border-slate-200/80 bg-white/85 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Tier cards</h2>
      <label className="admin-label">
        Tier
        <select
          className="admin-input"
          value={props.tier}
          onChange={(event) => props.onTierChange(event.target.value as SubscriptionTier)}
        >
          <option value="basic">basic</option>
          <option value="advanced">advanced</option>
          <option value="pro">pro</option>
        </select>
      </label>
      <label className="admin-label">
        Title
        <input
          className="admin-input"
          value={props.tierTitle}
          onChange={(event) => props.onTierTitleChange(event.target.value)}
          placeholder="Starter"
        />
      </label>
      <label className="admin-label">
        Subtitle
        <input
          className="admin-input"
          value={props.tierSubtitle}
          onChange={(event) => props.onTierSubtitleChange(event.target.value)}
          placeholder="For swing traders"
        />
      </label>
      <label className="admin-label">
        Badge
        <input
          className="admin-input"
          value={props.tierBadge}
          onChange={(event) => props.onTierBadgeChange(event.target.value)}
          placeholder="Most Popular"
        />
      </label>
      <label className="admin-label">
        Description
        <textarea
          className="admin-textarea"
          value={props.tierDescription}
          onChange={(event) => props.onTierDescriptionChange(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="admin-label">
          Sort order
          <input
            className="admin-input w-28"
            value={props.tierSortOrder}
            onChange={(event) => props.onTierSortOrderChange(event.target.value)}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={props.tierActive}
            onChange={(event) => props.onTierActiveChange(event.target.checked)}
          />
          Active
        </label>
      </div>
      <button
        type="button"
        onClick={props.onSaveTier}
        disabled={props.isSavingTier}
        className="admin-btn-primary"
      >
        {props.isSavingTier ? "Saving..." : "Save tier"}
      </button>
    </div>
  );
}
