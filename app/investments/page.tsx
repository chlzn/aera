"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, History, Layers, LayoutGrid, Plus } from "lucide-react";
import { useCurrency } from "@/context/currency-context";
import {
  formatPeriodLabel,
  getAvailablePeriodsFromCurrentYear,
  getCurrentPeriodKey,
  isSamePeriod,
} from "@/lib/period";

type AssetType =
  | "crypto"
  | "stock"
  | "etf"
  | "real_estate"
  | "fixed_income"
  | "cash"
  | "other";

type PortfolioTab = "overview" | "holdings" | "activity" | "review";

type LegacyInvestment = {
  id: string;
  name: string;
  type: AssetType;
  invested: number;
  currentValue: number;
  ticker?: string;
  notes?: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
};

type InvestmentEntry = {
  id: string;
  name: string;
  type: AssetType;
  amount: number;
  ticker?: string;
  notes?: string;
  date: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
};

type PortfolioActivityEntry = {
  id: string;
  holdingKey: string;
  name: string;
  type: AssetType;
  activityType: "sell";
  amount: number;
  date: string;
  ticker?: string;
  notes?: string;
  investedAtSale?: number;
  realizedProfit?: number;
  closesPosition?: boolean;
  createdAt: string;
};

type PortfolioHolding = {
  key: string;
  name: string;
  type: AssetType;
  invested: number;
  currentValue: number;
  profit: number;
  profitPct: number;
  ticker?: string;
  latestDate: string;
  entries: InvestmentEntry[];
};

type PortfolioGroup = {
  type: AssetType;
  label: string;
  invested: number;
  currentValue: number;
  profit: number;
  profitPct: number;
  allocationPct: number;
  holdings: PortfolioHolding[];
};

type MonthlyReview = {
  period: string;
  openingValue?: number;
  closingValue?: number;
  contributionsOverride?: number;
  notes?: string;
  updatedAt: string;
};

const assetTypes: { value: AssetType; label: string }[] = [
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "real_estate", label: "Real Estate" },
  { value: "fixed_income", label: "Fixed Income" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

const assetTypeLabels: Record<AssetType, string> = {
  crypto: "Crypto",
  stock: "Stocks",
  etf: "ETF",
  real_estate: "Real Estate",
  fixed_income: "Fixed Income",
  cash: "Cash",
  other: "Other",
};

const assetTypeOrder: AssetType[] = [
  "crypto",
  "stock",
  "etf",
  "real_estate",
  "fixed_income",
  "cash",
  "other",
];

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatAssetType(type: string) {
  return type
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function generateId() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function getHoldingKey(name: string, ticker?: string) {
  const cleanTicker = ticker?.trim().toUpperCase();

  if (cleanTicker) return cleanTicker;

  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeTicker(value: string) {
  const clean = value.trim().toUpperCase();
  return clean || undefined;
}

function getPreviousPeriodKey(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  const previous = new Date(year, month - 2, 1);

  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function formatSignedCurrency(value: number, currency = "USD") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatCurrency(value, currency)}`;
}

function formatSignedPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function Portfolio() {
  const { currency } = useCurrency();

  const [entries, setEntries] = useState<InvestmentEntry[]>([]);
  const [holdingValues, setHoldingValues] = useState<Record<string, number>>(
    {},
  );
  const [portfolioActivity, setPortfolioActivity] = useState<
    PortfolioActivityEntry[]
  >([]);
  const [closedHoldingKeys, setClosedHoldingKeys] = useState<string[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<
    Record<string, MonthlyReview>
  >({});
  const [entriesHydrated, setEntriesHydrated] = useState(false);

  const [activeTab, setActiveTab] = useState<PortfolioTab>("overview");
  const [expandedGroup, setExpandedGroup] = useState<AssetType | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("crypto");
  const [amount, setAmount] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [ticker, setTicker] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(getTodayDate());

  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey());
  const [reviewOpeningValue, setReviewOpeningValue] = useState("");
  const [reviewClosingValue, setReviewClosingValue] = useState("");
  const [reviewContributionsValue, setReviewContributionsValue] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [isReviewDirty, setIsReviewDirty] = useState(false);
  const [isNewPositionsOpen, setIsNewPositionsOpen] = useState(false);
  const [isReviewEditModalOpen, setIsReviewEditModalOpen] = useState(false);
  const [expandedReviewYear, setExpandedReviewYear] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(
    null,
  );
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isHoldingDetailOpen, setIsHoldingDetailOpen] = useState(false);
  const [isInvestMoreOpen, setIsInvestMoreOpen] = useState(false);
  const [investMoreAmount, setInvestMoreAmount] = useState("");
  const [investMoreDate, setInvestMoreDate] = useState(getTodayDate());

  const [isSellOpen, setIsSellOpen] = useState(false);
  const [sellAmount, setSellAmount] = useState("");
  const [sellDate, setSellDate] = useState(getTodayDate());
  const [sellNotes, setSellNotes] = useState("");

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const [isActivityListOpen, setIsActivityListOpen] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const savedEntries = localStorage.getItem("investmentEntries");
      const savedHoldingValues = localStorage.getItem(
        "investmentHoldingValues",
      );
      const savedMonthlyReviews = localStorage.getItem(
        "investmentMonthlyReviews",
      );
      const savedPortfolioActivity = localStorage.getItem("portfolioActivity");
      const savedClosedHoldingKeys = localStorage.getItem("closedHoldingKeys");

      if (savedPortfolioActivity) {
        const parsedPortfolioActivity = JSON.parse(savedPortfolioActivity);
        setPortfolioActivity(
          Array.isArray(parsedPortfolioActivity) ? parsedPortfolioActivity : [],
        );
      }

      if (savedClosedHoldingKeys) {
        const parsedClosedHoldingKeys = JSON.parse(savedClosedHoldingKeys);
        setClosedHoldingKeys(
          Array.isArray(parsedClosedHoldingKeys) ? parsedClosedHoldingKeys : [],
        );
      }

      if (savedMonthlyReviews) {
        const parsedMonthlyReviews = JSON.parse(savedMonthlyReviews);
        setMonthlyReviews(
          parsedMonthlyReviews && typeof parsedMonthlyReviews === "object"
            ? parsedMonthlyReviews
            : {},
        );
      }

      if (savedEntries) {
        const parsedEntries = JSON.parse(savedEntries);
        setEntries(Array.isArray(parsedEntries) ? parsedEntries : []);

        if (savedHoldingValues) {
          const parsedHoldingValues = JSON.parse(savedHoldingValues);
          setHoldingValues(
            parsedHoldingValues && typeof parsedHoldingValues === "object"
              ? parsedHoldingValues
              : {},
          );
        }
      } else {
        const legacyInvestments = localStorage.getItem("investments");

        if (legacyInvestments) {
          const parsedLegacy = JSON.parse(legacyInvestments);

          if (Array.isArray(parsedLegacy)) {
            const migratedEntries: InvestmentEntry[] = parsedLegacy.map(
              (asset: LegacyInvestment) => ({
                id: asset.id || generateId(),
                name: asset.name,
                type: asset.type,
                amount: asset.invested || 0,
                ticker: asset.ticker,
                notes: asset.notes,
                date: asset.createdAt
                  ? asset.createdAt.slice(0, 10)
                  : getTodayDate(),
                accountId: asset.accountId || "main",
                createdAt: asset.createdAt || new Date().toISOString(),
                updatedAt: asset.updatedAt || new Date().toISOString(),
              }),
            );

            const migratedHoldingValues = parsedLegacy.reduce<
              Record<string, number>
            >((acc, asset: LegacyInvestment) => {
              const key = getHoldingKey(asset.name, asset.ticker);
              acc[key] = asset.currentValue || asset.invested || 0;
              return acc;
            }, {});

            setEntries(migratedEntries);
            setHoldingValues(migratedHoldingValues);
          }
        }
      }
    } catch {
      setEntries([]);
      setHoldingValues({});
      setPortfolioActivity([]);
      setClosedHoldingKeys([]);
      setMonthlyReviews({});
    } finally {
      setEntriesHydrated(true);
    }
  }, []);

  const holdings = useMemo<PortfolioHolding[]>(() => {
    const grouped = entries.reduce<Record<string, InvestmentEntry[]>>(
      (acc, entry) => {
        const key = getHoldingKey(entry.name, entry.ticker);
        acc[key] = [...(acc[key] || []), entry];
        return acc;
      },
      {},
    );

    return (Object.entries(grouped) as [string, InvestmentEntry[]][])
      .map(([key, holdingEntries]) => {
        const sortedEntries = [...holdingEntries].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );

        const latest = sortedEntries[0];
        const invested = holdingEntries.reduce(
          (sum, entry) => sum + entry.amount,
          0,
        );

        const currentValue =
          typeof holdingValues[key] === "number"
            ? holdingValues[key]
            : invested;

        const profit = currentValue - invested;
        const profitPct = invested > 0 ? (profit / invested) * 100 : 0;

        return {
          key,
          name: latest.name,
          type: latest.type,
          ticker: latest.ticker,
          invested,
          currentValue,
          profit,
          profitPct,
          latestDate: latest.updatedAt,
          entries: holdingEntries,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [entries, holdingValues]);

  const activeHoldings = useMemo(() => {
    return holdings.filter(
      (holding) =>
        !closedHoldingKeys.includes(holding.key) && holding.currentValue > 0,
    );
  }, [holdings, closedHoldingKeys]);

  const totals = useMemo(() => {
    const investedTotal = activeHoldings.reduce(
      (acc, holding) => acc + holding.invested,
      0,
    );

    const currentTotal = activeHoldings.reduce(
      (acc, holding) => acc + holding.currentValue,
      0,
    );

    const profit = currentTotal - investedTotal;
    const profitPct = investedTotal > 0 ? (profit / investedTotal) * 100 : 0;

    return {
      investedTotal,
      currentTotal,
      profit,
      profitPct,
    };
  }, [activeHoldings]);

  const groups = useMemo<PortfolioGroup[]>(() => {
    return assetTypeOrder
      .map((assetType) => {
        const groupHoldings = activeHoldings
          .filter((holding) => holding.type === assetType)
          .sort((a, b) => b.currentValue - a.currentValue);

        const invested = groupHoldings.reduce(
          (sum, holding) => sum + holding.invested,
          0,
        );

        const currentValue = groupHoldings.reduce(
          (sum, holding) => sum + holding.currentValue,
          0,
        );

        const profit = currentValue - invested;
        const profitPct = invested > 0 ? (profit / invested) * 100 : 0;
        const allocationPct =
          totals.currentTotal > 0
            ? (currentValue / totals.currentTotal) * 100
            : 0;

        return {
          type: assetType,
          label: assetTypeLabels[assetType],
          invested,
          currentValue,
          profit,
          profitPct,
          allocationPct,
          holdings: groupHoldings,
        };
      })
      .filter((group) => group.holdings.length > 0);
  }, [activeHoldings, totals.currentTotal]);

  useEffect(() => {
    if (!entriesHydrated) return;

    try {
      localStorage.setItem("investmentEntries", JSON.stringify(entries));
      localStorage.setItem(
        "investmentHoldingValues",
        JSON.stringify(holdingValues),
      );
      localStorage.setItem(
        "investmentMonthlyReviews",
        JSON.stringify(monthlyReviews),
      );
      localStorage.setItem("portfolioActivity", JSON.stringify(portfolioActivity));
      localStorage.setItem(
        "closedHoldingKeys",
        JSON.stringify(closedHoldingKeys),
      );

      const compatibleHoldings: LegacyInvestment[] = activeHoldings.map(
        (holding) => ({
          id: holding.key,
          name: holding.name,
          type: holding.type,
          invested: holding.invested,
          currentValue: holding.currentValue,
          ticker: holding.ticker,
          accountId: "main",
          createdAt: holding.latestDate,
          updatedAt: holding.latestDate,
        }),
      );

      localStorage.setItem("investments", JSON.stringify(compatibleHoldings));
    } catch {
      // silent
    }
  }, [
    entries,
    holdingValues,
    monthlyReviews,
    portfolioActivity,
    closedHoldingKeys,
    activeHoldings,
    entriesHydrated,
  ]);

  const availablePeriods = useMemo(() => {
    return getAvailablePeriodsFromCurrentYear();
  }, []);

  const periodEntries = useMemo(() => {
    return entries
      .filter((entry) => isSamePeriod(entry.date, selectedPeriod))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, selectedPeriod]);

  const periodInvested = periodEntries.reduce(
    (acc, entry) => acc + entry.amount,
    0,
  );

  const periodSellEntries = useMemo(() => {
    return portfolioActivity
      .filter((entry) => entry.date.slice(0, 7) === selectedPeriod)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [portfolioActivity, selectedPeriod]);

  const periodActivityEntries = useMemo(() => {
    const buyRows = periodEntries.map((entry) => ({
      id: entry.id,
      kind: "buy" as const,
      name: entry.name,
      type: entry.type,
      ticker: entry.ticker,
      amount: entry.amount,
      date: entry.date,
      source: entry,
    }));

    const sellRows = periodSellEntries.map((entry) => ({
      id: entry.id,
      kind: "sell" as const,
      name: entry.name,
      type: entry.type,
      ticker: entry.ticker,
      amount: entry.amount,
      date: entry.date,
      source: entry,
    }));

    return [...buyRows, ...sellRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [periodEntries, periodSellEntries]);

  const selectedHolding = useMemo(() => {
    return (
      holdings.find((holding) => holding.key === selectedHoldingKey) || null
    );
  }, [holdings, selectedHoldingKey]);

  const topAllocation = groups[0];

  const firstPortfolioPeriod = useMemo(() => {
    const periods = entries
      .map((entry) => entry.date?.slice(0, 7))
      .filter(Boolean)
      .sort();

    return periods[0] || selectedPeriod;
  }, [entries, selectedPeriod]);

  const isFirstPortfolioMonth = selectedPeriod === firstPortfolioPeriod;
  const previousPeriod = getPreviousPeriodKey(selectedPeriod);
  const selectedReview = monthlyReviews[selectedPeriod];
  const previousReview = monthlyReviews[previousPeriod];

  const autoOpeningValue = isFirstPortfolioMonth
    ? 0
    : (previousReview?.closingValue ?? 0);

  const autoClosingValue =
    selectedPeriod === getCurrentPeriodKey()
      ? totals.currentTotal
      : (selectedReview?.closingValue ?? totals.currentTotal);

  const manualOpeningValue = parseOptionalNumber(reviewOpeningValue);
  const manualClosingValue = parseOptionalNumber(reviewClosingValue);
  const manualContributions = parseOptionalNumber(reviewContributionsValue);

  const reviewOpening = selectedReview?.openingValue ?? autoOpeningValue;
  const reviewClosing = selectedReview?.closingValue ?? autoClosingValue;
  const reviewContributions =
    selectedReview?.contributionsOverride ?? periodInvested;

  const displayedReviewOpening = manualOpeningValue ?? reviewOpening;
  const displayedReviewClosing = manualClosingValue ?? reviewClosing;
  const displayedReviewContributions =
    manualContributions ?? reviewContributions;

  const realProfit =
    displayedReviewClosing -
    displayedReviewOpening -
    displayedReviewContributions;
  const realReturn =
    displayedReviewOpening > 0
      ? (realProfit / displayedReviewOpening) * 100
      : null;

  const contributionGroups = useMemo(() => {
    type ContributionGroup = {
      key: string;
      name: string;
      ticker?: string;
      amount: number;
      type: AssetType;
      isNewPosition: boolean;
    };

    const grouped = periodEntries.reduce<Record<string, ContributionGroup>>(
      (acc, entry) => {
        const key = getHoldingKey(entry.name, entry.ticker);
        const hadPreviousPosition = entries.some(
          (item) =>
            getHoldingKey(item.name, item.ticker) === key &&
            item.date.slice(0, 7) < selectedPeriod,
        );

        if (!acc[key]) {
          acc[key] = {
            key,
            name: entry.name,
            ticker: entry.ticker,
            amount: 0,
            type: entry.type,
            isNewPosition: !hadPreviousPosition,
          };
        }

        acc[key].amount += entry.amount;
        return acc;
      },
      {},
    );

    const rows = (Object.values(grouped) as ContributionGroup[]).sort(
      (a, b) => b.amount - a.amount,
    );

    return {
      newPositions: rows.filter((item) => item.isNewPosition),
      addedThisMonth: rows.filter((item) => !item.isNewPosition),
    };
  }, [entries, periodEntries, selectedPeriod]);

  const reviewHistory = useMemo(() => {
    const periods = Array.from(
      new Set([
        ...entries.map((entry) => entry.date.slice(0, 7)),
        ...Object.keys(monthlyReviews),
      ]),
    ).sort((a, b) => b.localeCompare(a));

    return periods.map((period) => {
      const review = monthlyReviews[period];
      const monthContributions = entries
        .filter((entry) => entry.date.slice(0, 7) === period)
        .reduce((sum, entry) => sum + entry.amount, 0);
      const opening = review?.openingValue ?? 0;
      const closing =
        review?.closingValue ??
        (period === getCurrentPeriodKey() ? totals.currentTotal : 0);
      const contributions = review?.contributionsOverride ?? monthContributions;
      const profit = closing - opening - contributions;
      const returnPct = opening > 0 ? (profit / opening) * 100 : null;

      return {
        period,
        opening,
        contributions,
        closing,
        profit,
        returnPct,
      };
    });
  }, [entries, monthlyReviews, totals.currentTotal]);

  const annualReviewGroups = useMemo(() => {
    const grouped = reviewHistory.reduce<
      Record<string, typeof reviewHistory>
    >((acc, item) => {
      const year = item.period.slice(0, 4);
      acc[year] = [...(acc[year] || []), item];
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([year, months]) => {
        const sortedMonths = [...months].sort((a, b) =>
          b.period.localeCompare(a.period),
        );
        const latestMonth = sortedMonths[0];

        return {
          year,
          months: sortedMonths,
          latestReturnPct: latestMonth?.returnPct ?? null,
        };
      })
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [reviewHistory]);

  useEffect(() => {
    const review = monthlyReviews[selectedPeriod];

    setReviewOpeningValue(
      typeof review?.openingValue === "number"
        ? String(review.openingValue)
        : "",
    );
    setReviewClosingValue(
      typeof review?.closingValue === "number"
        ? String(review.closingValue)
        : "",
    );
    setReviewContributionsValue(
      typeof review?.contributionsOverride === "number"
        ? String(review.contributionsOverride)
        : "",
    );
    setReviewNotes(review?.notes || "");
    setIsReviewDirty(false);
    setIsNewPositionsOpen(false);
    setIsReviewEditModalOpen(false);
    setExpandedReviewYear(null);
  }, [monthlyReviews, selectedPeriod]);

  const markReviewDirty = () => {
    setIsReviewDirty(true);
  };

  const handleSaveReviewChanges = () => {
    const opening = parseOptionalNumber(reviewOpeningValue);
    const closing = parseOptionalNumber(reviewClosingValue);
    const contributions = parseOptionalNumber(reviewContributionsValue);

    setMonthlyReviews((prev) => ({
      ...prev,
      [selectedPeriod]: {
        period: selectedPeriod,
        openingValue: opening ?? autoOpeningValue,
        closingValue: closing ?? autoClosingValue,
        contributionsOverride: contributions ?? undefined,
        notes: reviewNotes.trim() || undefined,
        updatedAt: new Date().toISOString(),
      },
    }));

    setIsReviewDirty(false);
  };

  const resetAssetForm = () => {
    setName("");
    setType("crypto");
    setAmount("");
    setCurrentValue("");
    setTicker("");
    setNotes("");
    setDate(getTodayDate());
    setEditingEntryId(null);
    setError("");
  };

  const openCreateAssetModal = () => {
    resetAssetForm();
    setIsAssetModalOpen(true);
  };

  const openEditEntryModal = (entry: InvestmentEntry) => {
    const key = getHoldingKey(entry.name, entry.ticker);

    setName(entry.name);
    setType(entry.type);
    setAmount(String(entry.amount));
    setCurrentValue(
      typeof holdingValues[key] === "number" ? String(holdingValues[key]) : "",
    );
    setTicker(entry.ticker || "");
    setNotes(entry.notes || "");
    setDate(entry.date);
    setEditingEntryId(entry.id);
    setError("");
    setIsAssetModalOpen(true);
  };

  const closeAssetModal = () => {
    setIsAssetModalOpen(false);
    resetAssetForm();
  };

  const handleAssetSubmit = () => {
    const now = new Date().toISOString();
    const amountNumber = Number(amount);
    const cleanName = name.trim();
    const cleanTicker = normalizeTicker(ticker);

    if (!cleanName) {
      setError("Please add an asset name.");
      return;
    }

    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Please enter a valid invested amount.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    const newKey = getHoldingKey(cleanName, cleanTicker);

    if (editingEntryId) {
      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === editingEntryId
            ? {
                ...entry,
                name: cleanName,
                type,
                amount: amountNumber,
                ticker: cleanTicker,
                notes: notes.trim() || undefined,
                date,
                updatedAt: now,
              }
            : entry,
        ),
      );
    } else {
      const newEntry: InvestmentEntry = {
        id: generateId(),
        name: cleanName,
        type,
        amount: amountNumber,
        ticker: cleanTicker,
        notes: notes.trim() || undefined,
        date,
        accountId: "main",
        createdAt: now,
        updatedAt: now,
      };

      setEntries((prev) => [newEntry, ...prev]);
    }

    setClosedHoldingKeys((prev) => prev.filter((key) => key !== newKey));

    if (currentValue.trim()) {
      const currentValueNumber = Number(currentValue);

      if (Number.isNaN(currentValueNumber) || currentValueNumber < 0) {
        setError("Please enter a valid current value.");
        return;
      }

      setHoldingValues((prev) => ({
        ...prev,
        [newKey]: currentValueNumber,
      }));
    }

    closeAssetModal();
  };

  const handleDeleteEntry = () => {
    if (!editingEntryId) return;
    setIsDeleteConfirmOpen(true);
  };

  const handlePermanentDeleteEntry = () => {
    if (!editingEntryId) return;

    setEntries((prev) => prev.filter((entry) => entry.id !== editingEntryId));
    setIsDeleteConfirmOpen(false);
    closeAssetModal();
  };

  const openSellInsteadFromEntry = () => {
    if (!editingEntryId) return;

    const entry = entries.find((item) => item.id === editingEntryId);
    if (!entry) return;

    const key = getHoldingKey(entry.name, entry.ticker);
    const holding = holdings.find((item) => item.key === key);
    if (!holding) return;

    closeAssetModal();
    setIsDeleteConfirmOpen(false);
    openHoldingDetail(holding);
    setSellAmount(String(holding.currentValue));
    setSellDate(getTodayDate());
    setSellNotes("");
    setIsSellOpen(true);
  };

  const openHoldingDetail = (holding: PortfolioHolding) => {
    setSelectedHoldingKey(holding.key);
    setCurrentValue(String(holding.currentValue));
    setError("");
    setIsHoldingDetailOpen(true);
  };

  const closeHoldingDetail = () => {
    setIsHoldingDetailOpen(false);
    setSelectedHoldingKey(null);
    setCurrentValue("");
    setError("");
  };

  const handleSaveHolding = () => {
    if (!selectedHolding) return;

    const parsedCurrentValue = Number(currentValue);

    if (
      !currentValue ||
      Number.isNaN(parsedCurrentValue) ||
      parsedCurrentValue < 0
    ) {
      setError("Please enter a valid current value.");
      return;
    }

    setHoldingValues((prev) => ({
      ...prev,
      [selectedHolding.key]: parsedCurrentValue,
    }));

    closeHoldingDetail();
  };

  const openInvestMore = () => {
    if (!selectedHolding) return;

    setInvestMoreAmount("");
    setInvestMoreDate(getTodayDate());
    setError("");
    setIsInvestMoreOpen(true);
  };

  const closeInvestMore = () => {
    setIsInvestMoreOpen(false);
    setInvestMoreAmount("");
    setInvestMoreDate(getTodayDate());
    setError("");
  };

  const openSellPosition = () => {
    if (!selectedHolding) return;

    setSellAmount(String(selectedHolding.currentValue));
    setSellDate(getTodayDate());
    setSellNotes("");
    setError("");
    setIsSellOpen(true);
  };

  const closeSellPosition = () => {
    setIsSellOpen(false);
    setSellAmount("");
    setSellDate(getTodayDate());
    setSellNotes("");
    setError("");
  };

  const handleSellPosition = () => {
    if (!selectedHolding) return;

    const parsedSellAmount = Number(sellAmount);

    if (!sellAmount || Number.isNaN(parsedSellAmount) || parsedSellAmount <= 0) {
      setError("Please enter a valid sell amount.");
      return;
    }

    if (!sellDate) {
      setError("Please select a sell date.");
      return;
    }

    const currentHoldingValue = selectedHolding.currentValue;
    const safeSellAmount = Math.min(parsedSellAmount, currentHoldingValue);
    const closesPosition = safeSellAmount >= currentHoldingValue;
    const soldRatio =
      currentHoldingValue > 0 ? Math.min(safeSellAmount / currentHoldingValue, 1) : 1;
    const estimatedInvestedAtSale = selectedHolding.invested * soldRatio;
    const realizedProfit = safeSellAmount - estimatedInvestedAtSale;
    const now = new Date().toISOString();

    const sellActivity: PortfolioActivityEntry = {
      id: generateId(),
      holdingKey: selectedHolding.key,
      name: selectedHolding.name,
      type: selectedHolding.type,
      activityType: "sell",
      amount: safeSellAmount,
      date: sellDate,
      ticker: selectedHolding.ticker,
      notes: sellNotes.trim() || undefined,
      investedAtSale: estimatedInvestedAtSale,
      realizedProfit,
      closesPosition,
      createdAt: now,
    };

    setPortfolioActivity((prev) => [sellActivity, ...prev]);

    setHoldingValues((prev) => ({
      ...prev,
      [selectedHolding.key]: closesPosition
        ? 0
        : Math.max(currentHoldingValue - safeSellAmount, 0),
    }));

    if (closesPosition) {
      setClosedHoldingKeys((prev) =>
        prev.includes(selectedHolding.key) ? prev : [...prev, selectedHolding.key],
      );
    }

    closeSellPosition();
    closeHoldingDetail();
  };

  const handleInvestMore = () => {
    if (!selectedHolding) return;

    const parsedAmount = Number(investMoreAmount);

    if (!investMoreAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!investMoreDate) {
      setError("Please select a date.");
      return;
    }

    const now = new Date().toISOString();

    const newEntry: InvestmentEntry = {
      id: generateId(),
      name: selectedHolding.name,
      type: selectedHolding.type,
      amount: parsedAmount,
      ticker: selectedHolding.ticker,
      date: investMoreDate,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
    };

    setEntries((prev) => [newEntry, ...prev]);
    setClosedHoldingKeys((prev) =>
      prev.filter((key) => key !== selectedHolding.key),
    );
    closeInvestMore();
    closeHoldingDetail();
  };

  const handleQuickAction = (tab: PortfolioTab | "add") => {
    if (tab === "add") {
      openCreateAssetModal();
      return;
    }

    setActiveTab(tab);
  };

  const fieldClass =
    "w-full h-[46px] min-h-[46px] appearance-none bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors";

  const quickActions: {
    value: PortfolioTab | "add";
    label: string;
    icon: typeof LayoutGrid;
  }[] = [
    { value: "overview", label: "Overview", icon: LayoutGrid },
    { value: "holdings", label: "Holdings", icon: Layers },
    { value: "activity", label: "Activity", icon: History },
    { value: "review", label: "Review", icon: FileText },
    { value: "add", label: "Add", icon: Plus },
  ];

  return (
    <>
      <main className="min-h-screen bg-black text-white px-5 py-8 pb-32">
        <div className="max-w-4xl mx-auto">
          <header className="mb-4">
            <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
            <p className="text-zinc-500 mt-2">
              See your holdings and performance.
            </p>
          </header>

          <section className="mb-4">
            <p className="text-5xl font-semibold tracking-tight text-white">
              {formatCurrency(totals.currentTotal, currency)}
            </p>
          </section>

          <nav className="mb-5">
            <div className="grid grid-cols-5 gap-2">
              {quickActions.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.value !== "add" && activeTab === item.value;
                const isAdd = item.value === "add";

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleQuickAction(item.value)}
                    className="flex flex-col items-center justify-center gap-2 py-2 transition-all duration-200 ease-out active:scale-[0.96]"
                  >
                    <Icon
                      size={22}
                      strokeWidth={2}
                      className={`transition-colors duration-200 ${
                        isAdd || isActive
                          ? "text-[var(--accent)]"
                          : "text-zinc-500/80"
                      }`}
                    />

                    <span
                      className={`text-[11px] font-medium transition-colors duration-200 ${
                        isActive
                          ? "text-white"
                          : isAdd
                            ? "text-zinc-300"
                            : "text-zinc-500/80"
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {activeTab === "overview" && (
            <section className="mb-24 space-y-5">
              {groups.length === 0 ? (
                <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
                  <p className="text-zinc-200 text-sm">No holdings yet.</p>
                  <p className="text-zinc-600 text-sm mt-2">
                    Add your first asset to start building your portfolio.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <div className="mb-3">
                      <p className="text-white text-sm font-medium">
                        Allocation
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        How your portfolio is distributed.
                      </p>
                    </div>

                    <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-5 space-y-4">
                      {groups.map((group) => (
                        <div key={group.type}>
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="text-zinc-300 text-sm">
                              {group.label}
                            </span>
                            <span className="text-white text-sm font-medium">
                              {group.allocationPct.toFixed(0)}%
                            </span>
                          </div>

                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]/70"
                              style={{
                                width: `${Math.min(group.allocationPct, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3">
                      <p className="text-white text-sm font-medium">
                        Quick summary
                      </p>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-zinc-500">Holdings</span>
                        <span className="text-white font-medium">
                          {activeHoldings.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-zinc-500">Invested</span>
                        <span className="text-white font-medium">
                          {formatCurrency(totals.investedTotal, currency)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-zinc-500">Largest</span>
                        <span className="text-white font-medium text-right">
                          {topAllocation
                            ? `${topAllocation.label} (${topAllocation.allocationPct.toFixed(0)}%)`
                            : "None"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "holdings" && (
            <section className="mb-24">
              {groups.length === 0 ? (
                <div className="rounded-[28px] bg-zinc-900/45 border border-white/5 p-6">
                  <p className="text-zinc-200 text-sm">No holdings yet.</p>
                  <p className="text-zinc-600 text-sm mt-2">
                    Add assets to start building your portfolio.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-zinc-600 text-xs mb-3">
                    Total Holdings · {activeHoldings.length}
                  </p>

                  <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                    {groups.map((group, groupIndex) => {
                      const isExpanded = expandedGroup === group.type;

                      return (
                        <div
                          key={group.type}
                          className={
                            groupIndex !== groups.length - 1
                              ? "border-b border-white/5"
                              : ""
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedGroup((prev) =>
                                prev === group.type ? null : group.type,
                              )
                            }
                            className="w-full flex items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                          >
                            <div className="min-w-0">
                              <p className="text-zinc-200 font-medium">
                                {group.label}
                              </p>

                              {!isExpanded && (
                                <p className="text-xs text-zinc-600 mt-1">
                                  {group.holdings.length} holding
                                  {group.holdings.length === 1 ? "" : "s"}
                                </p>
                              )}
                            </div>

                            {!isExpanded && (
                              <div className="text-right shrink-0">
                                <p className="text-zinc-300 text-sm font-medium">
                                  {formatCurrency(group.currentValue, currency)}
                                </p>
                                <p
                                  className={`text-xs mt-1 ${
                                    group.profitPct >= 0
                                      ? "text-green-500"
                                      : "text-red-500"
                                  }`}
                                >
                                  {group.profitPct >= 0 ? "+" : ""}
                                  {group.profitPct.toFixed(1)}%
                                </p>
                              </div>
                            )}

                          </button>

                          {isExpanded && (
                            <div className="px-5 pb-5">
                              <div className="space-y-1">
                                {group.holdings.map((holding) => (
                                  <button
                                    key={holding.key}
                                    type="button"
                                    onClick={() => openHoldingDetail(holding)}
                                    className="w-full flex items-center justify-between gap-4 py-3 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-zinc-200 truncate">
                                        {holding.name}
                                      </p>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <p className="text-zinc-300 text-sm font-medium">
                                        {formatCurrency(
                                          holding.currentValue,
                                          currency,
                                        )}
                                      </p>
                                      <p
                                        className={`text-xs mt-1 ${
                                          holding.profitPct >= 0
                                            ? "text-green-500"
                                            : "text-red-500"
                                        }`}
                                      >
                                        {holding.profitPct >= 0 ? "+" : ""}
                                        {holding.profitPct.toFixed(1)}%
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "activity" && (
            <section className="mb-24">
              <div className="mb-3">
                <p className="text-zinc-500 text-sm mb-1">Invested in</p>

                <div className="relative inline-block">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="appearance-none bg-transparent pr-6 text-white text-lg font-medium outline-none cursor-pointer"
                  >
                    {availablePeriods.map((period) => (
                      <option key={period} value={period}>
                        {formatPeriodLabel(period)}
                      </option>
                    ))}
                  </select>

                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--accent)] text-sm">
                    ⌄
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <p className="text-3xl font-semibold tracking-tight text-white">
                  {formatCurrency(periodInvested, currency)}
                </p>
              </div>

              {periodActivityEntries.length === 0 ? (
                <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                  <p className="text-zinc-300 text-sm">
                    No investments added in this period.
                  </p>
                  <p className="text-zinc-600 text-sm mt-1">
                    Select another month or add a new asset.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setIsActivityListOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <p className="text-white text-sm font-medium">
                      Investment entries
                    </p>
                    <span className="text-zinc-500 text-lg">
                      {isActivityListOpen ? "⌃" : "⌄"}
                    </span>
                  </button>

                  {isActivityListOpen && (
                    <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                      {periodActivityEntries.map((entry, index) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            if (entry.kind === "buy") {
                              openEditEntryModal(entry.source as InvestmentEntry);
                            }
                          }}
                          className={`w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02] active:scale-[0.995] ${
                            index !== periodActivityEntries.length - 1
                              ? "border-b border-white/5"
                              : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-zinc-200 truncate">
                                {entry.kind === "sell" ? "Sold " : "Bought "}
                                {entry.name}
                              </p>
                              {entry.ticker && (
                                <span className="text-xs text-zinc-600 uppercase">
                                  {entry.ticker}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                              <span>{formatAssetType(entry.type)}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p
                              className={`text-sm font-medium ${
                                entry.kind === "sell"
                                  ? "text-green-500"
                                  : "text-zinc-300"
                              }`}
                            >
                              {entry.kind === "sell" ? "+" : ""}
                              {formatCurrency(entry.amount, currency)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === "review" && (
            <section className="mb-24">
              <div className="mb-5">
                <p className="text-white text-sm font-medium mb-1">
                  Monthly Review
                </p>

                <div className="relative inline-block">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="appearance-none bg-transparent pr-6 text-white text-lg font-medium outline-none cursor-pointer"
                  >
                    {availablePeriods.map((period) => (
                      <option key={period} value={period}>
                        {formatPeriodLabel(period)}
                      </option>
                    ))}
                  </select>

                  <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[var(--accent)] text-sm">
                    ⌄
                  </span>
                </div>
              </div>

              <div className="mb-7">
                <p className="text-zinc-500 text-sm mb-2">Real Return</p>
                <p
                  className={`text-5xl font-semibold tracking-tight ${
                    realReturn === null
                      ? "text-white"
                      : realReturn >= 0
                        ? "text-green-500"
                        : "text-red-500"
                  }`}
                >
                  {realReturn === null ? "—" : formatSignedPercent(realReturn)}
                </p>
                <p
                  className={`text-sm mt-3 ${
                    realProfit >= 0 ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {formatSignedCurrency(realProfit, currency)} real profit
                </p>

                {displayedReviewOpening === 0 && (
                  <p className="text-zinc-600 text-xs mt-2">
                    Initial month · return starts after the first full month.
                  </p>
                )}
              </div>

              <div className="h-px bg-white/5 mb-6" />

              <div className="mb-3">
                <p className="text-zinc-500 text-xs uppercase tracking-[0.18em]">
                  Review Summary
                </p>
              </div>

              <div className="mb-3 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">Opening Value</span>
                  <span className="text-white font-medium">
                    {formatCurrency(displayedReviewOpening, currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">Contributions</span>
                  <span className="text-white font-medium">
                    {formatCurrency(displayedReviewContributions, currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">Closing Value</span>
                  <span className="text-white font-medium">
                    {formatCurrency(displayedReviewClosing, currency)}
                  </span>
                </div>

                <div className="h-px bg-white/5 my-1" />

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-300">Real Profit</span>
                  <span
                    className={`font-medium ${
                      realProfit >= 0 ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {formatSignedCurrency(realProfit, currency)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-300">Real Return</span>
                  <span
                    className={`font-medium ${
                      realReturn === null
                        ? "text-zinc-500"
                        : realReturn >= 0
                          ? "text-green-500"
                          : "text-red-500"
                    }`}
                  >
                    {realReturn === null
                      ? "—"
                      : formatSignedPercent(realReturn)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsReviewEditModalOpen(true)}
                className="mb-7 text-xs text-zinc-600 transition-colors duration-200 hover:text-zinc-300"
              >
                Edit values
              </button>

              {annualReviewGroups.length > 0 && (
                <>
                  <div className="h-px bg-white/5 mb-6" />

                  <div className="mb-7">
                    <p className="text-zinc-500 text-xs uppercase tracking-[0.18em] mb-3">
                      Annual Review
                    </p>

                    <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 overflow-hidden">
                      {annualReviewGroups.map((yearGroup, yearIndex) => {
                        const isExpanded = expandedReviewYear === yearGroup.year;

                        return (
                          <div
                            key={yearGroup.year}
                            className={
                              yearIndex !== annualReviewGroups.length - 1
                                ? "border-b border-white/5"
                                : ""
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReviewYear((prev) =>
                                  prev === yearGroup.year ? null : yearGroup.year,
                                )
                              }
                              className="w-full flex items-center justify-between gap-4 px-5 py-5 text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                            >
                              <div className="min-w-0">
                                <p className="text-zinc-200 font-medium">
                                  {yearGroup.year}
                                </p>

                                {!isExpanded && (
                                  <p className="text-xs text-zinc-600 mt-1">
                                    {yearGroup.months.length} month
                                    {yearGroup.months.length === 1 ? "" : "s"} tracked
                                  </p>
                                )}
                              </div>

                              {!isExpanded && (
                                <div className="text-right shrink-0">
                                  <p
                                    className={`text-sm font-medium ${
                                      yearGroup.latestReturnPct === null
                                        ? "text-zinc-500"
                                        : yearGroup.latestReturnPct >= 0
                                          ? "text-green-500"
                                          : "text-red-500"
                                    }`}
                                  >
                                    {yearGroup.latestReturnPct === null
                                      ? "—"
                                      : formatSignedPercent(
                                          yearGroup.latestReturnPct,
                                        )}
                                  </p>
                                </div>
                              )}
                            </button>

                            {isExpanded && (
                              <div className="px-5 pb-5">
                                <div className="space-y-4">
                                  {yearGroup.months.map((item) => (
                                    <button
                                      key={item.period}
                                      type="button"
                                      onClick={() => setSelectedPeriod(item.period)}
                                      className="w-full text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                                    >
                                      <div className="flex items-center justify-between gap-4">
                                        <p className="text-zinc-300 font-medium">
                                          {formatPeriodLabel(item.period)}
                                        </p>
                                        <span
                                          className={`font-medium ${
                                            item.returnPct === null
                                              ? "text-zinc-500"
                                              : item.returnPct >= 0
                                                ? "text-green-500"
                                                : "text-red-500"
                                          }`}
                                        >
                                          {item.returnPct === null
                                            ? "—"
                                            : formatSignedPercent(item.returnPct)}
                                        </span>
                                      </div>

                                      <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                                        Opening {formatCurrency(item.opening, currency)} ·
                                        Contributions {" "}
                                        {formatCurrency(item.contributions, currency)} ·
                                        Closing {formatCurrency(item.closing, currency)}
                                      </p>

                                      <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                                        Real Profit {formatSignedCurrency(item.profit, currency)}
                                      </p>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {(contributionGroups.newPositions.length > 0 ||
                contributionGroups.addedThisMonth.length > 0) && (
                <>
                  <div className="h-px bg-white/5 mb-6" />

                  <div className="mb-7">
                    <button
                      type="button"
                      onClick={() => setIsNewPositionsOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">
                          New Positions
                        </p>
                        <p className="text-zinc-600 text-xs mt-1">
                          {contributionGroups.newPositions.length} new position
                          {contributionGroups.newPositions.length === 1
                            ? ""
                            : "s"}
                          {contributionGroups.addedThisMonth.length > 0
                            ? ` · ${contributionGroups.addedThisMonth.length} added`
                            : ""}
                        </p>
                      </div>
                      <span className="text-zinc-500 text-lg">
                        {isNewPositionsOpen ? "⌃" : "⌄"}
                      </span>
                    </button>

                    {isNewPositionsOpen && (
                      <div className="grid gap-5 mt-4">
                        {contributionGroups.newPositions.length > 0 && (
                          <div className="grid gap-3 text-sm">
                            {contributionGroups.newPositions.map((item) => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between gap-4"
                              >
                                <div className="min-w-0">
                                  <p className="text-zinc-300 truncate">
                                    {item.ticker || item.name}
                                  </p>
                                  <p className="text-zinc-600 text-xs mt-1">
                                    {formatAssetType(item.type)}
                                  </p>
                                </div>
                                <span className="text-white font-medium shrink-0">
                                  +{formatCurrency(item.amount, currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {contributionGroups.addedThisMonth.length > 0 && (
                          <div>
                            <p className="text-zinc-500 text-xs mb-3">
                              Added This Month
                            </p>
                            <div className="grid gap-3 text-sm">
                              {contributionGroups.addedThisMonth.map((item) => (
                                <div
                                  key={item.key}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <div className="min-w-0">
                                    <p className="text-zinc-300 truncate">
                                      {item.ticker || item.name}
                                    </p>
                                    <p className="text-zinc-600 text-xs mt-1">
                                      {formatAssetType(item.type)}
                                    </p>
                                  </div>
                                  <span className="text-white font-medium shrink-0">
                                    +{formatCurrency(item.amount, currency)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

            </section>
          )}
        </div>
      </main>


      {isReviewEditModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={() => setIsReviewEditModalOpen(false)}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white text-sm font-medium">
                    Edit monthly review
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Adjust values if the automatic review needs correction.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReviewEditModalOpen(false)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Opening · ${formatCurrency(autoOpeningValue, currency)}`}
                  value={reviewOpeningValue}
                  onChange={(e) => {
                    setReviewOpeningValue(e.target.value);
                    markReviewDirty();
                  }}
                  className={fieldClass}
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Contributions · ${formatCurrency(periodInvested, currency)}`}
                  value={reviewContributionsValue}
                  onChange={(e) => {
                    setReviewContributionsValue(e.target.value);
                    markReviewDirty();
                  }}
                  className={fieldClass}
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Closing · ${formatCurrency(autoClosingValue, currency)}`}
                  value={reviewClosingValue}
                  onChange={(e) => {
                    setReviewClosingValue(e.target.value);
                    markReviewDirty();
                  }}
                  className={fieldClass}
                />

                <button
                  type="button"
                  onClick={() => {
                    handleSaveReviewChanges();
                    setIsReviewEditModalOpen(false);
                  }}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isAssetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeAssetModal}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  {editingEntryId ? "Edit investment" : "New asset"}
                </p>

                <button
                  type="button"
                  onClick={closeAssetModal}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3">
                <input
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Asset type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AssetType)}
                    className={fieldClass}
                  >
                    {assetTypes.map((assetType) => (
                      <option key={assetType.value} value={assetType.value}>
                        {assetType.label}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  placeholder="Ticker (optional)"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  className={fieldClass}
                />

                <input
                  placeholder="Invested amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={fieldClass}
                />

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldClass}
                />

                <input
                  placeholder="Current value (optional)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                  className={fieldClass}
                />

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 py-3 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors resize-none"
                    placeholder="Optional notes"
                  />
                </div>

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleAssetSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  {editingEntryId ? "Save investment" : "Add asset"}
                </button>

                {editingEntryId && (
                  <button
                    type="button"
                    onClick={handleDeleteEntry}
                    className="w-full text-center text-red-400 text-xs py-1.5 mt-1 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                  >
                    Delete investment
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center px-5"
          onClick={() => setIsDeleteConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[26px] bg-zinc-900 border border-white/5 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-sm font-medium mb-2">
              Delete permanently?
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed mb-5">
              This removes the investment entry and its history. Use Sell if you
              sold this asset.
            </p>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="w-full rounded-full bg-zinc-800 text-zinc-300 py-3 text-sm"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={openSellInsteadFromEntry}
                className="w-full rounded-full bg-[var(--accent)] text-black py-3 text-sm font-medium"
              >
                Sell instead
              </button>

              <button
                type="button"
                onClick={handlePermanentDeleteEntry}
                className="w-full text-center text-red-400 text-xs py-1.5 transition-colors duration-200 ease-out hover:text-red-300"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {isHoldingDetailOpen && selectedHolding && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeHoldingDetail}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">Holding detail</p>

                <button
                  type="button"
                  onClick={closeHoldingDetail}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {selectedHolding.name}
                    </h2>

                    {selectedHolding.ticker && (
                      <span className="text-xs text-zinc-600 uppercase">
                        {selectedHolding.ticker}
                      </span>
                    )}
                  </div>

                  <p className="text-zinc-500 text-sm mt-2">
                    {formatAssetType(selectedHolding.type)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] bg-zinc-800/50 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Invested</p>
                    <p className="text-white text-sm font-medium">
                      {formatCurrency(selectedHolding.invested, currency)}
                    </p>
                  </div>

                  <div className="rounded-[22px] bg-zinc-800/50 border border-white/5 p-4">
                    <p className="text-zinc-500 text-xs mb-2">Performance</p>
                    <p
                      className={`text-sm font-medium ${
                        selectedHolding.profitPct >= 0
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {selectedHolding.profitPct >= 0 ? "+" : ""}
                      {selectedHolding.profitPct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 mb-2 block">
                    Current value
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="rounded-[22px] bg-zinc-800/40 border border-white/5 p-4">
                  <p className="text-zinc-500 text-xs mb-2">Profit / Loss</p>
                  <p
                    className={`text-sm font-medium ${
                      selectedHolding.profit >= 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {formatCurrency(selectedHolding.profit, currency)}
                  </p>
                </div>

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={openInvestMore}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Invest more
                </button>

                <button
                  type="button"
                  onClick={openSellPosition}
                  className="w-full text-center text-zinc-400 text-sm py-1.5 transition-colors duration-200 ease-out hover:text-white cursor-pointer"
                >
                  Sell / Close position
                </button>

                <button
                  type="button"
                  onClick={handleSaveHolding}
                  className="w-full text-center text-zinc-400 text-sm py-1.5 transition-colors duration-200 ease-out hover:text-white cursor-pointer"
                >
                  Save holding
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isSellOpen && selectedHolding && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeSellPosition}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white text-sm font-medium">
                    Sell {selectedHolding.name}
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Selling preserves history and records portfolio activity.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeSellPosition}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[22px] bg-zinc-800/40 border border-white/5 p-4">
                  <p className="text-zinc-500 text-xs mb-2">Current value</p>
                  <p className="text-white text-sm font-medium">
                    {formatCurrency(selectedHolding.currentValue, currency)}
                  </p>
                </div>

                <input
                  placeholder="Sell amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  className={fieldClass}
                />

                <input
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  className={fieldClass}
                />

                <textarea
                  value={sellNotes}
                  onChange={(e) => setSellNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 py-3 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors resize-none"
                  placeholder="Optional notes"
                />

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleSellPosition}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Confirm sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isInvestMoreOpen && selectedHolding && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeInvestMore}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-white text-sm font-medium">
                  Invest more in {selectedHolding.name}
                </p>

                <button
                  type="button"
                  onClick={closeInvestMore}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3">
                <input
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={investMoreAmount}
                  onChange={(e) => setInvestMoreAmount(e.target.value)}
                  className={fieldClass}
                />

                <input
                  type="date"
                  value={investMoreDate}
                  onChange={(e) => setInvestMoreDate(e.target.value)}
                  className={fieldClass}
                />

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handleInvestMore}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  Add contribution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
