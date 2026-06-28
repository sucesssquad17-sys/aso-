import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  ALERT_CONDITION_LABELS,
  ALERT_PRESETS,
  COMPETITOR_ASO_ALERT_CONDITION_TYPES,
  COMPETITOR_ASO_ALERT_PRESETS,
  KEYWORD_ALERT_CONDITION_TYPES,
  buildAlertRuleSummary,
  type AlertCondition,
  type AlertConditionType,
  type AlertRule,
  type AlertStoreType,
} from "../../lib/alerts";
import type { TrackedKeywordGroupView } from "../tracking/model";
import {
  conditionNeedsThreshold,
  createAlertRuleId,
  formatAlertEventTime,
} from "./utils";

type CompetitorAsoAlertGroupView = {
  groupId: string;
  title: string;
  store: AlertStoreType;
  competitorApps: Array<{ appId: string }>;
  countries: string[];
};

type UnifiedAlertTarget =
  | { mode: "keyword"; group: TrackedKeywordGroupView }
  | { mode: "competitor_aso"; group: CompetitorAsoAlertGroupView };

export type UnifiedAlertRuleManagerModalProps = {
  isOpen: boolean;
  target: UnifiedAlertTarget | null;
  rules: AlertRule[];
  onClose: () => void;
  onChange: (rules: AlertRule[]) => void;
  notificationPermission: NotificationPermission | "unsupported";
  onRequestPushPermission: () => Promise<NotificationPermission | "unsupported">;
};

const ALL_ALERT_CONDITION_TYPES: AlertConditionType[] = [
  ...KEYWORD_ALERT_CONDITION_TYPES,
  ...COMPETITOR_ASO_ALERT_CONDITION_TYPES,
];

const DEFAULT_THRESHOLDS: Record<AlertConditionType, string> = {
  enter_top_n: "10",
  leave_top_n: "10",
  improve_by: "5",
  drop_by: "5",
  starts_ranking: "",
  stops_ranking: "",
  check_error: "",
  aso_any_change: "",
  aso_title_changed: "",
  aso_description_changed: "",
  aso_screenshots_changed: "",
  aso_icon_changed: "",
  aso_category_changed: "",
};

function getAlertRuleScope(rule: AlertRule) {
  return rule.scope === "competitor_aso" ? "competitor_aso" : "keyword";
}

function createConditionState(
  mode: UnifiedAlertTarget["mode"],
): Record<AlertConditionType, boolean> {
  return ALL_ALERT_CONDITION_TYPES.reduce(
    (acc, conditionType) => {
      acc[conditionType] =
        mode === "competitor_aso" && conditionType === "aso_any_change";
      return acc;
    },
    {} as Record<AlertConditionType, boolean>,
  );
}

function getRuleChannels(rule: AlertRule) {
  const channels = [
    rule.channels.inApp ? "In-app" : null,
    rule.channels.push ? "Push" : null,
    rule.channels.email ? "Email" : null,
  ].filter(Boolean);
  return channels.length ? channels.join(", ") : "No channels";
}

export function UnifiedAlertRuleManagerModal({
  isOpen,
  target,
  rules,
  onClose,
  onChange,
  notificationPermission,
  onRequestPushPermission,
}: UnifiedAlertRuleManagerModalProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [conditionStates, setConditionStates] = useState<
    Record<AlertConditionType, boolean>
  >(createConditionState("keyword"));
  const [conditionThresholds, setConditionThresholds] =
    useState<Record<AlertConditionType, string>>(DEFAULT_THRESHOLDS);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const mode = target?.mode || "keyword";
  const group = target?.group || null;
  const conditionTypes =
    mode === "keyword"
      ? KEYWORD_ALERT_CONDITION_TYPES
      : COMPETITOR_ASO_ALERT_CONDITION_TYPES;
  const presets = mode === "keyword" ? ALERT_PRESETS : COMPETITOR_ASO_ALERT_PRESETS;

  const groupRules = useMemo(() => {
    if (!target) return [];
    return rules
      .filter((rule) => rule.groupId === target.group.groupId)
      .filter((rule) => getAlertRuleScope(rule) === target.mode)
      .sort((a, b) =>
        (b.updatedAt || b.createdAt || "").localeCompare(
          a.updatedAt || a.createdAt || "",
        ),
      );
  }, [rules, target]);

  const resetBuilder = React.useCallback(() => {
    if (!target) return;
    setEditingRuleId(null);
    setSelectedCountries(target.group.countries);
    setConditionStates(createConditionState(target.mode));
    setConditionThresholds(DEFAULT_THRESHOLDS);
    setInAppEnabled(true);
    setPushEnabled(notificationPermission === "granted");
    setEmailEnabled(false);
  }, [notificationPermission, target]);

  useEffect(() => {
    if (isOpen) {
      resetBuilder();
    }
  }, [isOpen, resetBuilder]);

  const startEditingRule = React.useCallback(
    (rule: AlertRule) => {
      const nextStates = createConditionState(mode);
      ALL_ALERT_CONDITION_TYPES.forEach((conditionType) => {
        nextStates[conditionType] = false;
      });
      const nextThresholds = { ...DEFAULT_THRESHOLDS };
      rule.conditions.forEach((condition) => {
        nextStates[condition.type] = true;
        if (conditionNeedsThreshold(condition.type) && condition.value) {
          nextThresholds[condition.type] = String(condition.value);
        }
      });
      setEditingRuleId(rule.id);
      setSelectedCountries(rule.countries);
      setConditionStates(nextStates);
      setConditionThresholds(nextThresholds);
      setInAppEnabled(rule.channels.inApp);
      setPushEnabled(rule.channels.push && notificationPermission === "granted");
      setEmailEnabled(Boolean(rule.channels.email));
    },
    [mode, notificationPermission],
  );

  const handlePushToggle = React.useCallback(
    async (nextChecked: boolean) => {
      if (!nextChecked) {
        setPushEnabled(false);
        return;
      }
      if (notificationPermission === "granted") {
        setPushEnabled(true);
        return;
      }
      const permission = await onRequestPushPermission();
      setPushEnabled(permission === "granted");
    },
    [notificationPermission, onRequestPushPermission],
  );

  const updateRule = React.useCallback(
    (nextRule: AlertRule, message: string) => {
      onChange([...rules.filter((rule) => rule.id !== nextRule.id), nextRule]);
      toast.success(message);
    },
    [onChange, rules],
  );

  const toggleRuleEnabled = React.useCallback(
    (rule: AlertRule) => {
      updateRule(
        {
          ...rule,
          enabled: rule.enabled === false,
          updatedAt: new Date().toISOString(),
        },
        rule.enabled === false ? "Alert enabled." : "Alert paused.",
      );
    },
    [updateRule],
  );

  const deleteRule = React.useCallback(
    (rule: AlertRule) => {
      onChange(rules.filter((entry) => entry.id !== rule.id));
      if (editingRuleId === rule.id) {
        resetBuilder();
      }
      toast.success(mode === "competitor_aso" ? "ASO alert removed." : "Alert removed.");
    },
    [editingRuleId, mode, onChange, resetBuilder, rules],
  );

  const applyPreset = React.useCallback(
    (conditions: AlertCondition[]) => {
      const nextStates = createConditionState(mode);
      conditionTypes.forEach((conditionType) => {
        nextStates[conditionType] = false;
      });
      const nextThresholds = { ...conditionThresholds };
      conditions.forEach((condition) => {
        nextStates[condition.type] = true;
        if (conditionNeedsThreshold(condition.type) && condition.value) {
          nextThresholds[condition.type] = String(condition.value);
        }
      });
      setConditionStates(nextStates);
      setConditionThresholds(nextThresholds);
      if (group) {
        setSelectedCountries(group.countries);
      }
      setEditingRuleId(null);
    },
    [conditionThresholds, conditionTypes, group, mode],
  );

  const saveRule = React.useCallback(() => {
    if (!target) return;
    if (!selectedCountries.length) {
      toast.error("Select at least one country for the alert rule.");
      return;
    }
    if (!inAppEnabled && !pushEnabled && !emailEnabled) {
      toast.error("Enable at least one delivery channel.");
      return;
    }
    if (pushEnabled && notificationPermission !== "granted") {
      toast.error("Allow browser notifications to enable push alerts.");
      return;
    }

    const conditions = conditionTypes.reduce<AlertCondition[]>(
      (acc, conditionType) => {
        if (!conditionStates[conditionType]) return acc;
        if (!conditionNeedsThreshold(conditionType)) {
          acc.push({ type: conditionType });
          return acc;
        }
        const numericValue = Number(conditionThresholds[conditionType]);
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
          return acc;
        }
        acc.push({ type: conditionType, value: Math.round(numericValue) });
        return acc;
      },
      [],
    );
    if (!conditions.length) {
      toast.error(
        mode === "competitor_aso"
          ? "Choose at least one ASO change condition."
          : "Choose at least one valid alert condition.",
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const existingRule = editingRuleId
      ? rules.find((rule) => rule.id === editingRuleId)
      : null;
    const nextRule: AlertRule =
      target.mode === "keyword"
        ? {
            id: existingRule?.id || createAlertRuleId(),
            enabled: existingRule?.enabled ?? true,
            groupId: target.group.groupId,
            appId: target.group.appId,
            keyword: target.group.keyword,
            store: target.group.store,
            scope: "keyword",
            countries: selectedCountries,
            channels: {
              inApp: inAppEnabled,
              push: pushEnabled,
              email: emailEnabled,
            },
            conditions,
            createdAt: existingRule?.createdAt || nowIso,
            updatedAt: nowIso,
            ...(existingRule?.baselineKeys
              ? { baselineKeys: existingRule.baselineKeys }
              : {}),
          }
        : {
            id: existingRule?.id || createAlertRuleId(),
            enabled: existingRule?.enabled ?? true,
            groupId: target.group.groupId,
            appId: existingRule?.appId || `competitor-aso:${target.group.groupId}`,
            keyword: "Competitor ASO",
            store: target.group.store,
            scope: "competitor_aso",
            countries: selectedCountries,
            channels: {
              inApp: inAppEnabled,
              push: pushEnabled,
              email: emailEnabled,
            },
            conditions,
            targetAppIds: target.group.competitorApps.map((app) => app.appId),
            createdAt: existingRule?.createdAt || nowIso,
            updatedAt: nowIso,
          };

    updateRule(
      nextRule,
      editingRuleId
        ? mode === "competitor_aso"
          ? "ASO alert updated."
          : "Alert rule updated."
        : mode === "competitor_aso"
          ? "ASO alert created."
          : "Alert rule created.",
    );
    resetBuilder();
  }, [
    conditionStates,
    conditionThresholds,
    conditionTypes,
    editingRuleId,
    emailEnabled,
    inAppEnabled,
    mode,
    notificationPermission,
    pushEnabled,
    resetBuilder,
    rules,
    selectedCountries,
    target,
    updateRule,
  ]);

  if (!isOpen || !target || !group) return null;

  const title =
    target.mode === "keyword"
      ? `${target.group.appTitle} - "${target.group.keyword}"`
      : target.group.title;
  const eyebrow = target.mode === "keyword" ? "Alerts" : "Competitor ASO Alerts";
  const description =
    target.mode === "keyword"
      ? "Watch keyword rank movement and choose how alerts are delivered."
      : "Watch daily metadata changes across the competitor apps in this group.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-surface/80 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-app-border/60 bg-app-surface/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-app-border/50 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              {eyebrow}
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-app-text">
              {title}
            </h3>
            <p className="mt-2 text-sm text-app-text-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-app-text-muted transition-colors hover:bg-app-surface-muted hover:text-app-text"
            aria-label="Close alert manager"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid max-h-[calc(92vh-98px)] gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.conditions)}
                  className="rounded-full border border-app-border/60 bg-app-surface-muted/70 px-3 py-1.5 text-xs font-semibold text-app-text-muted transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-app-border/60 bg-app-surface-muted/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-app-text">
                  {editingRuleId ? "Edit rule" : "Create rule"}
                </h4>
                {editingRuleId ? (
                  <button
                    type="button"
                    onClick={resetBuilder}
                    className="text-xs font-semibold text-app-text-muted transition-colors hover:text-app-text"
                  >
                    New rule
                  </button>
                ) : null}
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                    Countries
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.countries.map((country) => {
                      const isSelected = selectedCountries.includes(country);
                      return (
                        <button
                          key={country}
                          type="button"
                          onClick={() =>
                            setSelectedCountries((prev) =>
                              isSelected
                                ? prev.filter((entry) => entry !== country)
                                : [...prev, country],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                            isSelected
                              ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-200"
                              : "border-app-border/60 bg-app-surface/40 text-app-text-muted hover:text-app-text"
                          }`}
                        >
                          {country.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                    {mode === "keyword" ? "Conditions" : "Change types"}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {conditionTypes.map((conditionType) => (
                      <label
                        key={conditionType}
                        className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-3 py-2 text-sm text-app-text-muted"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={conditionStates[conditionType]}
                              onChange={(event) =>
                                setConditionStates((prev) => ({
                                  ...prev,
                                  [conditionType]: event.target.checked,
                                }))
                              }
                              className="h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400"
                            />
                            <span>{ALERT_CONDITION_LABELS[conditionType]}</span>
                          </div>
                          {conditionNeedsThreshold(conditionType) ? (
                            <input
                              type="number"
                              min={1}
                              value={conditionThresholds[conditionType]}
                              onChange={(event) =>
                                setConditionThresholds((prev) => ({
                                  ...prev,
                                  [conditionType]: event.target.value,
                                }))
                              }
                              className="w-16 rounded-lg border border-app-border/60 bg-app-surface-muted px-2 py-1 text-right text-xs text-app-text"
                            />
                          ) : null}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                    Delivery
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-3 py-3 text-sm text-app-text-muted">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-app-text">In-app</p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Workspace feed.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={inAppEnabled}
                          onChange={(event) =>
                            setInAppEnabled(event.target.checked)
                          }
                          className="h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400"
                        />
                      </div>
                    </label>
                    <label className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-3 py-3 text-sm text-app-text-muted">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-app-text">Push</p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Browser notification.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={pushEnabled}
                          onChange={(event) => {
                            void handlePushToggle(event.target.checked);
                          }}
                          className="h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400"
                        />
                      </div>
                    </label>
                    <label className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-3 py-3 text-sm text-app-text-muted">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-app-text">Email</p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Account address.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={emailEnabled}
                          onChange={(event) =>
                            setEmailEnabled(event.target.checked)
                          }
                          className="h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400"
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetBuilder}
                    className="btn-ghost rounded-xl px-4 py-2"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={saveRule}
                    className="btn-primary rounded-xl px-4 py-2"
                  >
                    {editingRuleId
                      ? mode === "competitor_aso"
                        ? "Save ASO Alert"
                        : "Update Rule"
                      : mode === "competitor_aso"
                        ? "Create ASO Alert"
                        : "Create Rule"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-app-border/60 bg-app-surface-muted/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-app-text">
                  Existing rules
                </h4>
                <p className="mt-1 text-xs text-app-text-muted">
                  {mode === "competitor_aso"
                    ? `These rules cover ${
                        target.mode === "competitor_aso"
                          ? target.group.competitorApps.length
                          : 0
                      } competitor app${
                        target.mode === "competitor_aso" &&
                        target.group.competitorApps.length === 1
                          ? ""
                          : "s"
                      }.`
                    : "These rules cover the selected keyword context."}
                </p>
              </div>
              <span className="rounded-full border border-app-border/60 bg-app-surface/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                {groupRules.length} saved
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {groupRules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-app-border/60 bg-app-surface/40 px-4 py-6 text-sm text-app-text-muted">
                  {mode === "competitor_aso"
                    ? "No ASO alert rules yet. Create one to monitor title, description, screenshots, icon, or category changes."
                    : "No alert rules yet. Start with a preset or create your own."}
                </div>
              ) : (
                groupRules.map((rule) => {
                  const isEnabled = rule.enabled !== false;
                  return (
                    <div
                      key={rule.id}
                      className={`rounded-2xl border p-4 transition-colors ${
                        isEnabled
                          ? "border-app-border/60 bg-app-surface/50"
                          : "border-amber-500/25 bg-amber-500/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-app-text">
                              {buildAlertRuleSummary(rule)}
                            </p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
                                isEnabled
                                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                              }`}
                            >
                              {isEnabled ? "Enabled" : "Paused"}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-app-text-muted">
                            {rule.countries
                              .map((country) => country.toUpperCase())
                              .join(", ")}
                          </p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Channels: {getRuleChannels(rule)}
                          </p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Updated{" "}
                            {formatAlertEventTime(
                              rule.updatedAt || rule.createdAt || "",
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => toggleRuleEnabled(rule)}
                            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                              isEnabled
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                                : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                            }`}
                          >
                            {isEnabled ? "Pause" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingRule(rule)}
                            className="rounded-xl border border-app-border/60 bg-app-surface-muted/80 px-3 py-2 text-xs font-semibold text-app-text transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRule(rule)}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
