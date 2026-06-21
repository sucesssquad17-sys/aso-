import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  ALERT_CONDITION_LABELS,
  ALERT_PRESETS,
  buildAlertRuleSummary,
  KEYWORD_ALERT_CONDITION_TYPES,
  type AlertRuleScope,
  type AlertCondition,
  type AlertConditionType,
  type AlertRule,
} from "../../lib/alerts";
import type { TrackedKeywordGroupView } from "../tracking/model";
import { conditionNeedsThreshold, createAlertRuleId } from "./utils";

export function AlertRuleManagerModal({
  isOpen,
  group,
  rules,
  onClose,
  onChange,
  notificationPermission,
  onRequestPushPermission,
}: {
  isOpen: boolean;
  group: TrackedKeywordGroupView | null;
  rules: AlertRule[];
  onClose: () => void;
  onChange: (rules: AlertRule[]) => void;
  notificationPermission: NotificationPermission | "unsupported";
  onRequestPushPermission: () => Promise<NotificationPermission | "unsupported">;
}) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [conditionStates, setConditionStates] = useState<
    Record<AlertConditionType, boolean>
  >({
    enter_top_n: false,
    leave_top_n: false,
    improve_by: false,
    drop_by: false,
    starts_ranking: false,
    stops_ranking: false,
    check_error: false,
    aso_any_change: false,
    aso_title_changed: false,
    aso_description_changed: false,
    aso_screenshots_changed: false,
    aso_icon_changed: false,
    aso_category_changed: false,
  });
  const [conditionThresholds, setConditionThresholds] = useState<
    Record<AlertConditionType, string>
  >({
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
  });
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const groupRules = React.useMemo(
    () =>
      group
        ? rules
            .filter((rule) => rule.groupId === group.groupId)
            .filter(
              (rule) =>
                ((rule.scope || "keyword") as AlertRuleScope) === "keyword",
            )
            .sort((a, b) =>
              (b.updatedAt || b.createdAt || "").localeCompare(
                a.updatedAt || a.createdAt || "",
              ),
            )
        : [],
    [group, rules],
  );

  const resetBuilder = React.useCallback(() => {
    if (!group) return;
    setEditingRuleId(null);
    setSelectedCountries(group.countries);
    setConditionStates({
      enter_top_n: false,
      leave_top_n: false,
      improve_by: false,
      drop_by: false,
      starts_ranking: false,
      stops_ranking: false,
      check_error: false,
      aso_any_change: false,
      aso_title_changed: false,
      aso_description_changed: false,
      aso_screenshots_changed: false,
      aso_icon_changed: false,
      aso_category_changed: false,
    });
    setConditionThresholds({
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
    });
    setInAppEnabled(true);
    setPushEnabled(notificationPermission === "granted");
    setEmailEnabled(false);
  }, [group, notificationPermission]);

  useEffect(() => {
    if (isOpen) {
      resetBuilder();
    }
  }, [isOpen, resetBuilder]);

  const startEditingRule = React.useCallback((rule: AlertRule) => {
    const nextStates = {
      enter_top_n: false,
      leave_top_n: false,
      improve_by: false,
      drop_by: false,
      starts_ranking: false,
      stops_ranking: false,
      check_error: false,
      aso_any_change: false,
      aso_title_changed: false,
      aso_description_changed: false,
      aso_screenshots_changed: false,
      aso_icon_changed: false,
      aso_category_changed: false,
    };
    const nextThresholds = {
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
  }, [notificationPermission]);

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

  const saveRule = React.useCallback(() => {
    if (!group) return;
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
    const conditions = (
      KEYWORD_ALERT_CONDITION_TYPES
    ).reduce<AlertCondition[]>((acc, conditionType) => {
      if (!conditionStates[conditionType]) return acc;
      if (!conditionNeedsThreshold(conditionType)) {
        acc.push({ type: conditionType });
        return acc;
      }
      const numericValue = Number(conditionThresholds[conditionType]);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return acc;
      }
      acc.push({
        type: conditionType,
        value: Math.round(numericValue),
      });
      return acc;
    }, []);
    if (!conditions.length) {
      toast.error("Choose at least one valid alert condition.");
      return;
    }

    const nowIso = new Date().toISOString();
    const existingRule = editingRuleId
      ? rules.find((rule) => rule.id === editingRuleId)
      : null;
    const nextRule: AlertRule = {
      id: existingRule?.id || createAlertRuleId(),
      enabled: true,
      groupId: group.groupId,
      appId: group.appId,
      keyword: group.keyword,
      store: group.store,
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
    };

    const remainingRules = rules.filter((rule) => rule.id !== nextRule.id);
    onChange([...remainingRules, nextRule]);
    toast.success(
      editingRuleId ? "Alert rule updated." : "Alert rule created.",
    );
    resetBuilder();
  }, [
    conditionStates,
    conditionThresholds,
    editingRuleId,
    emailEnabled,
    group,
    inAppEnabled,
    notificationPermission,
    onChange,
    pushEnabled,
    resetBuilder,
    rules,
    selectedCountries,
  ]);

  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-700/60 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Alerts
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-slate-100">
              {group.appTitle} - "{group.keyword}"
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-6 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {ALERT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    const nextStates = { ...conditionStates };
                    const nextThresholds = { ...conditionThresholds };
                    KEYWORD_ALERT_CONDITION_TYPES.forEach(
                      (conditionType) => {
                        nextStates[conditionType] = false;
                      },
                    );
                    preset.conditions.forEach((condition) => {
                      nextStates[condition.type] = true;
                      if (
                        conditionNeedsThreshold(condition.type) &&
                        condition.value
                      ) {
                        nextThresholds[condition.type] = String(
                          condition.value,
                        );
                      }
                    });
                    setConditionStates(nextStates);
                    setConditionThresholds(nextThresholds);
                    setSelectedCountries(group.countries);
                    setEditingRuleId(null);
                  }}
                  className="rounded-full border border-slate-700/60 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-200"
                  title={preset.description}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Countries
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {group.countries.map((countryCode) => {
                      const isSelected = selectedCountries.includes(countryCode);
                      return (
                        <button
                          key={countryCode}
                          type="button"
                          onClick={() =>
                            setSelectedCountries((prev) =>
                              prev.includes(countryCode)
                                ? prev.filter((entry) => entry !== countryCode)
                                : [...prev, countryCode],
                            )
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isSelected ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200" : "border-slate-700/60 bg-slate-950/50 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
                        >
                          {countryCode.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Delivery
                  </p>
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                      <span>In-app notifications</span>
                      <input
                        type="checkbox"
                        checked={inAppEnabled}
                        onChange={(event) =>
                          setInAppEnabled(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                      <span>Push notifications</span>
                      <input
                        type="checkbox"
                        checked={pushEnabled}
                        onChange={(event) => {
                          void handlePushToggle(event.target.checked);
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
                      <span>Email alerts</span>
                      <input
                        type="checkbox"
                        checked={emailEnabled}
                        onChange={(event) =>
                          setEmailEnabled(event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Conditions
              </p>
              <div className="mt-3 space-y-3">
                {KEYWORD_ALERT_CONDITION_TYPES.map(
                  (conditionType) => (
                    <div
                      key={conditionType}
                      className="rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-3"
                    >
                      <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                        <span>{ALERT_CONDITION_LABELS[conditionType]}</span>
                        <input
                          type="checkbox"
                          checked={conditionStates[conditionType]}
                          onChange={(event) =>
                            setConditionStates((prev) => ({
                              ...prev,
                              [conditionType]: event.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400"
                        />
                      </label>
                      {conditionNeedsThreshold(conditionType) && (
                        <div className="mt-3">
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
                            className="input-field py-2 w-full"
                          />
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
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
                  {editingRuleId ? "Update Rule" : "Create Rule"}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
              <h4 className="text-sm font-semibold text-slate-100">
                Existing rules
              </h4>
              <div className="mt-3 space-y-3">
                {groupRules.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No alert rules yet. Start with a preset or create your own.
                  </p>
                ) : (
                  groupRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-2xl border border-slate-700/60 bg-slate-950/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">
                            {buildAlertRuleSummary(rule)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {rule.countries
                              .map((country) => country.toUpperCase())
                              .join(", ")}
                          </div>
                        </div>
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-300">
                          Always on
                        </span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingRule(rule)}
                          className="btn-ghost rounded-xl px-3 py-1.5 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onChange(rules.filter((entry) => entry.id !== rule.id))
                          }
                          className="rounded-xl border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
