import React from "react";
import { Bell, Loader2, X } from "lucide-react";
import {
  COUNTRY_OPTIONS as COUNTRIES,
  findCountryName,
  PRIORITY_TRACKING_COUNTRY_CODES,
  type CountryOption,
} from "../../lib/countries";

export function CountrySearchSelect({
  value,
  onChange,
  options,
  ariaLabel,
  includeAllOption,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CountryOption[];
  ariaLabel: string;
  includeAllOption?: CountryOption;
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const fullOptions = React.useMemo(
    () => (includeAllOption ? [includeAllOption, ...options] : options),
    [includeAllOption, options],
  );
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return fullOptions;
    return fullOptions.filter(
      (option) =>
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.code.toLowerCase().includes(normalizedQuery),
    );
  }, [fullOptions, query]);
  const selectedLabel = React.useMemo(() => {
    const selected = fullOptions.find((option) => option.code === value);
    return selected ? selected.name : value.toUpperCase();
  }, [fullOptions, value]);
  return (
    <div className={`relative ${className || ""}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="input-field py-2 w-full text-left flex items-center justify-between gap-3"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="text-app-text-muted text-xs uppercase">
          {value.toUpperCase()}
        </span>
      </button>
      {isOpen && (
        <div className="absolute z-40 mt-2 w-full min-w-[16rem] rounded-2xl border border-app-border/70 bg-app-surface/95 p-3 shadow-2xl backdrop-blur-xl">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries..."
            className="input-field py-2 w-full mb-3"
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  onChange(option.code);
                  setIsOpen(false);
                  setQuery("");
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${value === option.code ? "bg-cyan-500/15 text-cyan-200" : "text-app-text-muted hover:bg-app-surface-muted/80"}`}
              >
                <div className="font-medium">{option.name}</div>
                <div className="text-xs text-app-text-muted uppercase">
                  {option.code}
                </div>
              </button>
            ))}
            {filteredOptions.length === 0 && (
              <div className="rounded-xl px-3 py-4 text-sm text-app-text-muted">
                No countries match your search.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CountryMultiSelectModal({
  disabledCountries,
  isOpen,
  keyword,
  selectedCountries,
  onToggleCountry,
  onClose,
  onSubmit,
  options = COUNTRIES,
  isSubmitting,
}: {
  disabledCountries: string[];
  isOpen: boolean;
  keyword: string;
  selectedCountries: string[];
  onToggleCountry: (country: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  options?: CountryOption[];
  isSubmitting: boolean;
}) {
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);
  const priorityOptions = React.useMemo(() => {
    const byCode = new Map(options.map((option) => [option.code, option]));
    return PRIORITY_TRACKING_COUNTRY_CODES.flatMap((countryCode) => {
      const option = byCode.get(countryCode);
      return option ? [option] : [];
    });
  }, [options]);
  const nonPriorityOptions = React.useMemo(() => {
    const priorityCodes = new Set<string>(PRIORITY_TRACKING_COUNTRY_CODES);
    return options.filter((option) => !priorityCodes.has(option.code));
  }, [options]);
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.code.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);
  const renderCountryButton = React.useCallback(
    (option: CountryOption) => {
      const isSelected = selectedCountries.includes(option.code);
      const isDisabled = disabledCountries.includes(option.code);
      return (
        <button
          key={option.code}
          type="button"
          onClick={() => {
            if (!isDisabled) {
              onToggleCountry(option.code);
            }
          }}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${isSelected ? "bg-cyan-500/15 text-cyan-200" : isDisabled ? "cursor-not-allowed text-slate-600" : "text-app-text-muted hover:bg-app-surface-muted/80"}`}
        >
          <div>
            <div className="font-medium">{option.name}</div>
            <div className="text-xs uppercase text-app-text-muted">
              {option.code}
            </div>
          </div>
          <div
            className={`text-xs font-semibold ${isSelected ? "text-cyan-300" : "text-app-text-muted"}`}
          >
            {isSelected ? "Selected" : isDisabled ? "Tracked" : "Add"}
          </div>
        </button>
      );
    },
    [disabledCountries, onToggleCountry, selectedCountries],
  );
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-surface/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-app-border/70 bg-app-surface/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold text-app-text">
              Track keyword by country
            </h3>
            <p className="mt-2 text-sm text-app-text-muted">
              Select countries for{" "}
              <span className="font-medium text-cyan-300">"{keyword}"</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries..."
            className="input-field py-3 w-full"
            autoFocus
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {disabledCountries.map((countryCode) => (
            <span
              key={`tracked-${countryCode}`}
              className="rounded-full border border-app-border/70 bg-app-surface/60 px-3 py-1 text-xs text-app-text-muted"
            >
              {findCountryName(countryCode)} already tracked
            </span>
          ))}
          {selectedCountries.map((countryCode) => (
            <span
              key={countryCode}
              className="badge badge-cyan px-3 py-1 text-xs"
            >
              {findCountryName(countryCode)}
            </span>
          ))}
          {selectedCountries.length === 0 && (
            <span className="text-xs text-app-text-muted">
              Choose at least one country.
            </span>
          )}
        </div>
        <div className="mt-4 max-h-80 overflow-y-auto space-y-3 rounded-2xl border border-app-border/60 bg-app-surface-muted/40 p-3">
          {query.trim() ? (
            <>{filteredOptions.map(renderCountryButton)}</>
          ) : (
            <>
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                  Main Markets
                </p>
                <div className="space-y-2">
                  {priorityOptions.map(renderCountryButton)}
                </div>
              </div>
              <div className="border-t border-app-border/50 pt-3">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                  All Countries
                </p>
                <div className="space-y-2">
                  {nonPriorityOptions.map(renderCountryButton)}
                </div>
              </div>
            </>
          )}
          {filteredOptions.length === 0 && (
            <div className="rounded-xl px-3 py-4 text-sm text-app-text-muted">
              No countries match your search.
            </div>
          )}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-app-text-muted">
            {selectedCountries.length} selected
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={selectedCountries.length === 0 || isSubmitting}
              className="btn-primary px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              Track Countries
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
