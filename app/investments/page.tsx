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
type InvestmentFundingSource = "external" | "portfolio_cash" | "reallocation";
type SellDestination = "portfolio_cash" | "personal_cash" | "reallocate";
type PortfolioCashMovementType =
  | "deposit"
  | "withdrawal"
  | "sell_proceeds"
  | "buy_from_cash"
  | "reallocation_buy"
  | "adjustment";

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
  fundingSource?: InvestmentFundingSource;
  sourceActivityId?: string;
};

type SpendingEntry = {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category:
    | "salary"
    | "freelance"
    | "bonus"
    | "investment_income"
    | "refund"
    | "housing"
    | "food"
    | "transport"
    | "bills"
    | "subscription"
    | "shopping"
    | "health"
    | "entertainment"
    | "travel"
    | "education"
    | "payments"
    | "investments"
    | "other";
  date: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  portfolioActivityId?: string;
};

type PortfolioCashMovement = {
  id: string;
  type: PortfolioCashMovementType;
  amount: number;
  date: string;
  sourceActivityId?: string;
  investmentEntryId?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
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
  cashDestination: SellDestination;
  investedAtSale?: number;
  realizedProfit?: number;
  closesPosition?: boolean;
  previousCurrentValue?: number;
  cashEntryId?: string;
  linkedBuyEntryId?: string;
  createdAt: string;
  updatedAt?: string;
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
  withdrawalsOverride?: number;
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

function upsertSellProceedsToCashFlow({
  cashEntryId,
  portfolioActivityId,
  name,
  ticker,
  amount,
  date,
  now,
}: {
  cashEntryId?: string;
  portfolioActivityId: string;
  name: string;
  ticker?: string;
  amount: number;
  date: string;
  now: string;
}) {
  const nextCashEntryId = cashEntryId || generateId();

  try {
    const savedEntries = localStorage.getItem("entries");
    const parsedEntries = savedEntries ? JSON.parse(savedEntries) : [];
    const existingEntries: SpendingEntry[] = Array.isArray(parsedEntries)
      ? parsedEntries
      : [];

    const cashFlowEntry: SpendingEntry = {
      id: nextCashEntryId,
      portfolioActivityId,
      description: `Sold ${ticker || name}`,
      amount,
      type: "income",
      category: "investment_income",
      date,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
    };

    const withoutPrevious = existingEntries.filter(
      (entry) =>
        entry.id !== nextCashEntryId &&
        entry.portfolioActivityId !== portfolioActivityId,
    );

    localStorage.setItem(
      "entries",
      JSON.stringify([cashFlowEntry, ...withoutPrevious]),
    );

    window.dispatchEvent(new Event("aera-storage-updated"));
  } catch {
    // silent
  }

  return nextCashEntryId;
}

function removeSellProceedsFromCashFlow({
  cashEntryId,
  portfolioActivityId,
}: {
  cashEntryId?: string;
  portfolioActivityId: string;
}) {
  try {
    const savedEntries = localStorage.getItem("entries");
    const parsedEntries = savedEntries ? JSON.parse(savedEntries) : [];
    const existingEntries: SpendingEntry[] = Array.isArray(parsedEntries)
      ? parsedEntries
      : [];

    const nextEntries = existingEntries.filter(
      (entry) =>
        entry.id !== cashEntryId &&
        entry.portfolioActivityId !== portfolioActivityId,
    );

    localStorage.setItem("entries", JSON.stringify(nextEntries));
    window.dispatchEvent(new Event("aera-storage-updated"));
  } catch {
    // silent
  }
}

function addPortfolioCashWithdrawalToCashFlow({
  portfolioActivityId,
  amount,
  date,
  now,
}: {
  portfolioActivityId: string;
  amount: number;
  date: string;
  now: string;
}) {
  try {
    const savedEntries = localStorage.getItem("entries");
    const parsedEntries = savedEntries ? JSON.parse(savedEntries) : [];
    const existingEntries: SpendingEntry[] = Array.isArray(parsedEntries)
      ? parsedEntries
      : [];

    const cashFlowEntry: SpendingEntry = {
      id: generateId(),
      portfolioActivityId,
      description: "Portfolio cash withdrawal",
      amount,
      type: "income",
      category: "investment_income",
      date,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
    };

    localStorage.setItem(
      "entries",
      JSON.stringify([cashFlowEntry, ...existingEntries]),
    );

    window.dispatchEvent(new Event("aera-storage-updated"));
  } catch {
    // silent
  }
}


function getCashMovementSign(type: PortfolioCashMovementType) {
  if (type === "deposit" || type === "sell_proceeds" || type === "adjustment") return 1;
  return -1;
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
  const [portfolioCashMovements, setPortfolioCashMovements] = useState<
    PortfolioCashMovement[]
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
  const [assetFundingSource, setAssetFundingSource] =
    useState<InvestmentFundingSource>("external");

  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriodKey());
  const [reviewOpeningValue, setReviewOpeningValue] = useState("");
  const [reviewClosingValue, setReviewClosingValue] = useState("");
  const [reviewContributionsValue, setReviewContributionsValue] = useState("");
  const [reviewWithdrawalsValue, setReviewWithdrawalsValue] = useState("");
  const [isReviewDirty, setIsReviewDirty] = useState(false);
  const [isNewPositionsOpen, setIsNewPositionsOpen] = useState(false);
  const [isReviewEditModalOpen, setIsReviewEditModalOpen] = useState(false);
  const [expandedReviewYear, setExpandedReviewYear] = useState<string | null>(
    null,
  );
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(
    null,
  );
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [isHoldingDetailOpen, setIsHoldingDetailOpen] = useState(false);
  const [isInvestMoreOpen, setIsInvestMoreOpen] = useState(false);
  const [investMoreAmount, setInvestMoreAmount] = useState("");
  const [investMoreDate, setInvestMoreDate] = useState(getTodayDate());
  const [investMoreFundingSource, setInvestMoreFundingSource] =
    useState<InvestmentFundingSource>("external");

  const [isSellOpen, setIsSellOpen] = useState(false);
  const [editingSellId, setEditingSellId] = useState<string | null>(null);
  const [sellAmount, setSellAmount] = useState("");
  const [sellDate, setSellDate] = useState(getTodayDate());
  const [sellNotes, setSellNotes] = useState("");
  const [sellDestination, setSellDestination] =
    useState<SellDestination>("portfolio_cash");
  const [reallocateName, setReallocateName] = useState("");
  const [reallocateType, setReallocateType] = useState<AssetType>("stock");
  const [reallocateTicker, setReallocateTicker] = useState("");
  const [reallocateAmount, setReallocateAmount] = useState("");

  const [isManageCashOpen, setIsManageCashOpen] = useState(false);
  const [cashAction, setCashAction] = useState<"deposit" | "withdrawal" | "adjustment">("adjustment");
  const [cashAmount, setCashAmount] = useState("");
  const [cashTargetValue, setCashTargetValue] = useState("");
  const [cashDate, setCashDate] = useState(getTodayDate());
  const [cashNotes, setCashNotes] = useState("");

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
      const savedPortfolioCashMovements = localStorage.getItem(
        "portfolioCashMovements",
      );

      if (savedPortfolioActivity) {
        const parsedPortfolioActivity = JSON.parse(savedPortfolioActivity);
        setPortfolioActivity(
          Array.isArray(parsedPortfolioActivity)
            ? parsedPortfolioActivity.map((activity) => ({
                ...activity,
                cashDestination: activity.cashDestination || "personal_cash",
              }))
            : [],
        );
      }

      if (savedPortfolioCashMovements) {
        const parsedMovements = JSON.parse(savedPortfolioCashMovements);
        setPortfolioCashMovements(
          Array.isArray(parsedMovements) ? parsedMovements : [],
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
                fundingSource: "external",
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
      setPortfolioCashMovements([]);
      setClosedHoldingKeys([]);
      setMonthlyReviews({});
    } finally {
      setEntriesHydrated(true);
    }
  }, []);

  const portfolioCashBalance = useMemo(() => {
    return portfolioCashMovements.reduce(
      (sum, movement) =>
        sum + movement.amount * getCashMovementSign(movement.type),
      0,
    );
  }, [portfolioCashMovements]);

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

  const holdingTotals = useMemo(() => {
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

    return { investedTotal, currentTotal, profit, profitPct };
  }, [activeHoldings]);

  const totals = useMemo(() => {
    const currentTotal = holdingTotals.currentTotal + portfolioCashBalance;
    const investedTotal = holdingTotals.investedTotal;
    const profit = currentTotal - investedTotal;
    const profitPct = investedTotal > 0 ? (profit / investedTotal) * 100 : 0;

    return { investedTotal, currentTotal, profit, profitPct };
  }, [holdingTotals, portfolioCashBalance]);

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
      localStorage.setItem(
        "portfolioActivity",
        JSON.stringify(portfolioActivity),
      );
      localStorage.setItem(
        "portfolioCashMovements",
        JSON.stringify(portfolioCashMovements),
      );
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
    portfolioCashMovements,
    closedHoldingKeys,
    activeHoldings,
    entriesHydrated,
  ]);

  const availablePeriods = useMemo(
    () => getAvailablePeriodsFromCurrentYear(),
    [],
  );

  const periodEntries = useMemo(() => {
    return entries
      .filter((entry) => isSamePeriod(entry.date, selectedPeriod))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, selectedPeriod]);

  const externalPeriodEntries = useMemo(() => {
    return periodEntries.filter(
      (entry) => !entry.fundingSource || entry.fundingSource === "external",
    );
  }, [periodEntries]);

  const reallocatedPeriodEntries = useMemo(() => {
    return periodEntries.filter(
      (entry) =>
        entry.fundingSource === "portfolio_cash" ||
        entry.fundingSource === "reallocation",
    );
  }, [periodEntries]);

  const periodExternalDeposits = externalPeriodEntries.reduce(
    (acc, entry) => acc + entry.amount,
    0,
  );

  const periodReallocated = reallocatedPeriodEntries.reduce(
    (acc, entry) => acc + entry.amount,
    0,
  );

  const periodSellEntries = useMemo(() => {
    return portfolioActivity
      .filter((entry) => entry.date.slice(0, 7) === selectedPeriod)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [portfolioActivity, selectedPeriod]);

  const periodWithdrawals = periodSellEntries
    .filter((entry) => entry.cashDestination === "personal_cash")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const periodPortfolioCashProceeds = periodSellEntries
    .filter(
      (entry) =>
        entry.cashDestination === "portfolio_cash" ||
        entry.cashDestination === "reallocate",
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

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

    const cashRows = portfolioCashMovements
      .filter((movement) => movement.date.slice(0, 7) === selectedPeriod)
      .map((movement) => ({
        id: movement.id,
        kind: "cash" as const,
        name:
          movement.type === "deposit"
            ? "Added portfolio cash"
            : movement.type === "withdrawal"
              ? "Withdrew portfolio cash"
              : movement.type === "sell_proceeds"
                ? "Cash from sale"
                : movement.type === "adjustment"
                  ? "Adjusted portfolio cash"
                  : "Used portfolio cash",
        type: "cash" as AssetType,
        ticker: undefined,
        amount: movement.amount,
        date: movement.date,
        source: movement,
      }));

    return [...buyRows, ...sellRows, ...cashRows].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [
    periodEntries,
    periodSellEntries,
    portfolioCashMovements,
    selectedPeriod,
  ]);

  const selectedHolding = useMemo(() => {
    return (
      holdings.find((holding) => holding.key === selectedHoldingKey) || null
    );
  }, [holdings, selectedHoldingKey]);

  const selectedSellActivity = useMemo(() => {
    return (
      portfolioActivity.find((activity) => activity.id === editingSellId) ||
      null
    );
  }, [portfolioActivity, editingSellId]);

  const sellModalName =
    selectedHolding?.name || selectedSellActivity?.name || "Position";
  const sellModalCurrentValue =
    selectedHolding?.currentValue ??
    selectedSellActivity?.previousCurrentValue ??
    selectedSellActivity?.amount ??
    0;

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
  const manualWithdrawals = parseOptionalNumber(reviewWithdrawalsValue);

  const reviewOpening = selectedReview?.openingValue ?? autoOpeningValue;
  const reviewClosing = selectedReview?.closingValue ?? autoClosingValue;
  const reviewDeposits =
    selectedReview?.contributionsOverride ?? periodExternalDeposits;
  const reviewWithdrawals =
    selectedReview?.withdrawalsOverride ?? periodWithdrawals;

  const displayedReviewOpening = manualOpeningValue ?? reviewOpening;
  const displayedReviewClosing = manualClosingValue ?? reviewClosing;
  const displayedReviewDeposits = manualContributions ?? reviewDeposits;
  const displayedReviewWithdrawals = manualWithdrawals ?? reviewWithdrawals;

  const realProfit =
    displayedReviewClosing -
    displayedReviewOpening -
    displayedReviewDeposits +
    displayedReviewWithdrawals;
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
      fundingSource?: InvestmentFundingSource;
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
            fundingSource: entry.fundingSource || "external",
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
        ...portfolioActivity.map((entry) => entry.date.slice(0, 7)),
        ...Object.keys(monthlyReviews),
      ]),
    ).sort((a, b) => b.localeCompare(a));

    return periods.map((period) => {
      const review = monthlyReviews[period];
      const monthDeposits = entries
        .filter(
          (entry) =>
            entry.date.slice(0, 7) === period &&
            (!entry.fundingSource || entry.fundingSource === "external"),
        )
        .reduce((sum, entry) => sum + entry.amount, 0);
      const monthReallocated = entries
        .filter(
          (entry) =>
            entry.date.slice(0, 7) === period &&
            (entry.fundingSource === "portfolio_cash" ||
              entry.fundingSource === "reallocation"),
        )
        .reduce((sum, entry) => sum + entry.amount, 0);
      const monthWithdrawals = portfolioActivity
        .filter(
          (entry) =>
            entry.date.slice(0, 7) === period &&
            entry.cashDestination === "personal_cash",
        )
        .reduce((sum, entry) => sum + entry.amount, 0);
      const opening = review?.openingValue ?? 0;
      const closing =
        review?.closingValue ??
        (period === getCurrentPeriodKey() ? totals.currentTotal : 0);
      const deposits = review?.contributionsOverride ?? monthDeposits;
      const withdrawals = review?.withdrawalsOverride ?? monthWithdrawals;
      const profit = closing - opening - deposits + withdrawals;
      const returnPct = opening > 0 ? (profit / opening) * 100 : null;

      return {
        period,
        opening,
        deposits,
        withdrawals,
        reallocated: monthReallocated,
        closing,
        profit,
        returnPct,
      };
    });
  }, [entries, portfolioActivity, monthlyReviews, totals.currentTotal]);

  const annualReviewGroups = useMemo(() => {
    const grouped = reviewHistory.reduce<Record<string, typeof reviewHistory>>(
      (acc, item) => {
        const year = item.period.slice(0, 4);
        acc[year] = [...(acc[year] || []), item];
        return acc;
      },
      {},
    );

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
    setReviewWithdrawalsValue(
      typeof review?.withdrawalsOverride === "number"
        ? String(review.withdrawalsOverride)
        : "",
    );
    setIsReviewDirty(false);
    setIsNewPositionsOpen(false);
    setIsReviewEditModalOpen(false);
    setExpandedReviewYear(null);
  }, [monthlyReviews, selectedPeriod]);

  const markReviewDirty = () => setIsReviewDirty(true);

  const handleSaveReviewChanges = () => {
    const opening = parseOptionalNumber(reviewOpeningValue);
    const closing = parseOptionalNumber(reviewClosingValue);
    const deposits = parseOptionalNumber(reviewContributionsValue);
    const withdrawals = parseOptionalNumber(reviewWithdrawalsValue);

    setMonthlyReviews((prev) => ({
      ...prev,
      [selectedPeriod]: {
        period: selectedPeriod,
        openingValue: opening ?? autoOpeningValue,
        closingValue: closing ?? autoClosingValue,
        contributionsOverride: deposits ?? undefined,
        withdrawalsOverride: withdrawals ?? undefined,
        updatedAt: new Date().toISOString(),
      },
    }));

    setIsReviewDirty(false);
  };

  const addPortfolioCashMovement = (
    movement: Omit<PortfolioCashMovement, "id" | "createdAt">,
  ) => {
    const now = new Date().toISOString();
    const id = generateId();

    setPortfolioCashMovements((prev) => [
      {
        id,
        createdAt: now,
        ...movement,
      },
      ...prev,
    ]);

    return id;
  };

  const removePortfolioCashMovementsBySource = (sourceActivityId: string) => {
    setPortfolioCashMovements((prev) =>
      prev.filter((movement) => movement.sourceActivityId !== sourceActivityId),
    );
  };

  const removePortfolioCashMovementByInvestmentEntry = (
    investmentEntryId: string,
  ) => {
    setPortfolioCashMovements((prev) =>
      prev.filter(
        (movement) => movement.investmentEntryId !== investmentEntryId,
      ),
    );
  };

  const resetAssetForm = () => {
    setName("");
    setType("crypto");
    setAmount("");
    setCurrentValue("");
    setTicker("");
    setNotes("");
    setDate(getTodayDate());
    setAssetFundingSource("external");
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
    setAssetFundingSource(entry.fundingSource || "external");
    setEditingEntryId(entry.id);
    setError("");
    setIsAssetModalOpen(true);
  };

  const closeAssetModal = () => {
    setIsAssetModalOpen(false);
    resetAssetForm();
  };

  const createInvestmentEntry = ({
    cleanName,
    assetType,
    amountNumber,
    cleanTicker,
    entryDate,
    entryNotes,
    fundingSource,
    sourceActivityId,
    currentValueInput,
  }: {
    cleanName: string;
    assetType: AssetType;
    amountNumber: number;
    cleanTicker?: string;
    entryDate: string;
    entryNotes?: string;
    fundingSource: InvestmentFundingSource;
    sourceActivityId?: string;
    currentValueInput?: number;
  }) => {
    const now = new Date().toISOString();
    const newEntry: InvestmentEntry = {
      id: generateId(),
      name: cleanName,
      type: assetType,
      amount: amountNumber,
      ticker: cleanTicker,
      notes: entryNotes,
      date: entryDate,
      accountId: "main",
      createdAt: now,
      updatedAt: now,
      fundingSource,
      sourceActivityId,
    };

    setEntries((prev) => [newEntry, ...prev]);

    const key = getHoldingKey(cleanName, cleanTicker);
    setClosedHoldingKeys((prev) =>
      prev.filter((closedKey) => closedKey !== key),
    );

    if (typeof currentValueInput === "number") {
      setHoldingValues((prev) => ({
        ...prev,
        [key]: currentValueInput,
      }));
    }

    if (fundingSource === "portfolio_cash") {
      addPortfolioCashMovement({
        type: "buy_from_cash",
        amount: amountNumber,
        date: entryDate,
        investmentEntryId: newEntry.id,
        notes: `Bought ${cleanTicker || cleanName}`,
      });
    }

    if (fundingSource === "reallocation" && sourceActivityId) {
      addPortfolioCashMovement({
        type: "reallocation_buy",
        amount: amountNumber,
        date: entryDate,
        sourceActivityId,
        investmentEntryId: newEntry.id,
        notes: `Reallocated to ${cleanTicker || cleanName}`,
      });
    }

    return newEntry;
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

    if (
      assetFundingSource === "portfolio_cash" &&
      amountNumber > portfolioCashBalance
    ) {
      setError("Not enough portfolio cash available.");
      return;
    }

    const newKey = getHoldingKey(cleanName, cleanTicker);

    if (editingEntryId) {
      const previousEntry = entries.find(
        (entry) => entry.id === editingEntryId,
      );
      removePortfolioCashMovementByInvestmentEntry(editingEntryId);

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
                fundingSource: assetFundingSource,
                updatedAt: now,
              }
            : entry,
        ),
      );

      if (assetFundingSource === "portfolio_cash") {
        addPortfolioCashMovement({
          type: "buy_from_cash",
          amount: amountNumber,
          date,
          investmentEntryId: editingEntryId,
          notes: `Bought ${cleanTicker || cleanName}`,
        });
      }

      if (previousEntry) {
        const oldKey = getHoldingKey(previousEntry.name, previousEntry.ticker);
        if (oldKey !== newKey) {
          setHoldingValues((prev) => {
            const next = { ...prev };
            delete next[oldKey];
            return next;
          });
        }
      }
    } else {
      createInvestmentEntry({
        cleanName,
        assetType: type,
        amountNumber,
        cleanTicker,
        entryDate: date,
        entryNotes: notes.trim() || undefined,
        fundingSource: assetFundingSource,
        currentValueInput: currentValue.trim()
          ? Number(currentValue)
          : undefined,
      });
    }

    setClosedHoldingKeys((prev) => prev.filter((key) => key !== newKey));

    if (currentValue.trim()) {
      const currentValueNumber = Number(currentValue);

      if (Number.isNaN(currentValueNumber) || currentValueNumber < 0) {
        setError("Please enter a valid current value.");
        return;
      }

      setHoldingValues((prev) => ({ ...prev, [newKey]: currentValueNumber }));
    }

    closeAssetModal();
  };

  const handleDeleteEntry = () => {
    if (!editingEntryId) return;
    setIsDeleteConfirmOpen(true);
  };

  const handlePermanentDeleteEntry = () => {
    if (!editingEntryId) return;
    removePortfolioCashMovementByInvestmentEntry(editingEntryId);
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
    setSellDestination("portfolio_cash");
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
    setInvestMoreFundingSource("external");
    setError("");
    setIsInvestMoreOpen(true);
  };

  const closeInvestMore = () => {
    setIsInvestMoreOpen(false);
    setInvestMoreAmount("");
    setInvestMoreDate(getTodayDate());
    setInvestMoreFundingSource("external");
    setError("");
  };

  const openSellPosition = () => {
    if (!selectedHolding) return;
    setEditingSellId(null);
    setSellAmount(String(selectedHolding.currentValue));
    setSellDate(getTodayDate());
    setSellNotes("");
    setSellDestination("portfolio_cash");
    setReallocateName("");
    setReallocateType("stock");
    setReallocateTicker("");
    setReallocateAmount(String(selectedHolding.currentValue));
    setError("");
    setIsSellOpen(true);
  };

  const openEditSellActivity = (activity: PortfolioActivityEntry) => {
    setEditingSellId(activity.id);
    setSelectedHoldingKey(activity.holdingKey);
    setSellAmount(String(activity.amount));
    setSellDate(activity.date);
    setSellNotes(activity.notes || "");
    setSellDestination(activity.cashDestination || "portfolio_cash");

    const linkedBuy = activity.linkedBuyEntryId
      ? entries.find((entry) => entry.id === activity.linkedBuyEntryId)
      : null;
    setReallocateName(linkedBuy?.name || "");
    setReallocateType(linkedBuy?.type || "stock");
    setReallocateTicker(linkedBuy?.ticker || "");
    setReallocateAmount(
      linkedBuy ? String(linkedBuy.amount) : String(activity.amount),
    );

    setError("");
    setIsSellOpen(true);
  };

  const closeSellPosition = () => {
    setIsSellOpen(false);
    setEditingSellId(null);
    setSellAmount("");
    setSellDate(getTodayDate());
    setSellNotes("");
    setSellDestination("portfolio_cash");
    setReallocateName("");
    setReallocateType("stock");
    setReallocateTicker("");
    setReallocateAmount("");
    setError("");
  };

  const removeSellSideEffects = (activity: PortfolioActivityEntry) => {
    removeSellProceedsFromCashFlow({
      cashEntryId: activity.cashEntryId,
      portfolioActivityId: activity.id,
    });

    removePortfolioCashMovementsBySource(activity.id);

    if (activity.linkedBuyEntryId) {
      setEntries((prev) =>
        prev.filter((entry) => entry.id !== activity.linkedBuyEntryId),
      );
      removePortfolioCashMovementByInvestmentEntry(activity.linkedBuyEntryId);
    }
  };

  const cancelSellActivity = () => {
    if (!selectedSellActivity) return;

    removeSellSideEffects(selectedSellActivity);

    setPortfolioActivity((prev) =>
      prev.filter((activity) => activity.id !== selectedSellActivity.id),
    );

    setHoldingValues((prev) => ({
      ...prev,
      [selectedSellActivity.holdingKey]:
        selectedSellActivity.previousCurrentValue ??
        selectedSellActivity.amount,
    }));

    setClosedHoldingKeys((prev) =>
      prev.filter((key) => key !== selectedSellActivity.holdingKey),
    );

    closeSellPosition();
  };

  const applySellSideEffects = ({
    activity,
    amountNumber,
    dateValue,
    now,
  }: {
    activity: PortfolioActivityEntry;
    amountNumber: number;
    dateValue: string;
    now: string;
  }) => {
    let cashEntryId: string | undefined;
    let linkedBuyEntryId: string | undefined;

    if (activity.cashDestination === "personal_cash") {
      cashEntryId = upsertSellProceedsToCashFlow({
        cashEntryId: activity.cashEntryId,
        portfolioActivityId: activity.id,
        name: activity.name,
        ticker: activity.ticker,
        amount: amountNumber,
        date: dateValue,
        now,
      });
    }

    if (activity.cashDestination === "portfolio_cash") {
      addPortfolioCashMovement({
        type: "sell_proceeds",
        amount: amountNumber,
        date: dateValue,
        sourceActivityId: activity.id,
        notes: `Sold ${activity.ticker || activity.name}`,
      });
    }

    if (activity.cashDestination === "reallocate") {
      const cleanName = reallocateName.trim();
      const cleanTicker = normalizeTicker(reallocateTicker);
      const reallocateAmountNumber = Number(reallocateAmount || amountNumber);

      if (
        !cleanName ||
        Number.isNaN(reallocateAmountNumber) ||
        reallocateAmountNumber <= 0
      ) {
        throw new Error("Please add a valid reallocation target.");
      }

      addPortfolioCashMovement({
        type: "sell_proceeds",
        amount: amountNumber,
        date: dateValue,
        sourceActivityId: activity.id,
        notes: `Sold ${activity.ticker || activity.name}`,
      });

      const buyEntry = createInvestmentEntry({
        cleanName,
        assetType: reallocateType,
        amountNumber: Math.min(reallocateAmountNumber, amountNumber),
        cleanTicker,
        entryDate: dateValue,
        fundingSource: "reallocation",
        sourceActivityId: activity.id,
        currentValueInput: Math.min(reallocateAmountNumber, amountNumber),
      });
      linkedBuyEntryId = buyEntry.id;
    }

    return { cashEntryId, linkedBuyEntryId };
  };

  const handleSellPosition = () => {
    const activeSell = selectedSellActivity;
    const activeHolding = selectedHolding;
    if (!activeHolding && !activeSell) return;

    const parsedSellAmount = Number(sellAmount);
    if (
      !sellAmount ||
      Number.isNaN(parsedSellAmount) ||
      parsedSellAmount <= 0
    ) {
      setError("Please enter a valid sell amount.");
      return;
    }
    if (!sellDate) {
      setError("Please select a sell date.");
      return;
    }

    const now = new Date().toISOString();

    try {
      if (activeSell) {
        removeSellSideEffects(activeSell);

        const previousCurrentValue =
          activeSell.previousCurrentValue ??
          activeHolding?.currentValue ??
          activeSell.amount;
        const safeSellAmount = Math.min(parsedSellAmount, previousCurrentValue);
        const closesPosition = safeSellAmount >= previousCurrentValue;
        const soldRatio =
          previousCurrentValue > 0
            ? Math.min(safeSellAmount / previousCurrentValue, 1)
            : 1;
        const estimatedInvestedAtSale =
          (activeHolding?.invested ??
            activeSell.investedAtSale ??
            safeSellAmount) * soldRatio;
        const realizedProfit = safeSellAmount - estimatedInvestedAtSale;

        const nextActivity: PortfolioActivityEntry = {
          ...activeSell,
          amount: safeSellAmount,
          date: sellDate,
          notes: sellNotes.trim() || undefined,
          cashDestination: sellDestination,
          investedAtSale: estimatedInvestedAtSale,
          realizedProfit,
          closesPosition,
          previousCurrentValue,
          cashEntryId: undefined,
          linkedBuyEntryId: undefined,
          updatedAt: now,
        };

        const sideEffects = applySellSideEffects({
          activity: nextActivity,
          amountNumber: safeSellAmount,
          dateValue: sellDate,
          now,
        });

        setPortfolioActivity((prev) =>
          prev.map((activity) =>
            activity.id === activeSell.id
              ? { ...nextActivity, ...sideEffects }
              : activity,
          ),
        );

        setHoldingValues((prev) => ({
          ...prev,
          [activeSell.holdingKey]: closesPosition
            ? 0
            : Math.max(previousCurrentValue - safeSellAmount, 0),
        }));

        setClosedHoldingKeys((prev) => {
          if (closesPosition) {
            return prev.includes(activeSell.holdingKey)
              ? prev
              : [...prev, activeSell.holdingKey];
          }

          return prev.filter((key) => key !== activeSell.holdingKey);
        });

        closeSellPosition();
        return;
      }

      if (!activeHolding) return;

      const currentHoldingValue = activeHolding.currentValue;
      const safeSellAmount = Math.min(parsedSellAmount, currentHoldingValue);
      const closesPosition = safeSellAmount >= currentHoldingValue;
      const soldRatio =
        currentHoldingValue > 0
          ? Math.min(safeSellAmount / currentHoldingValue, 1)
          : 1;
      const estimatedInvestedAtSale = activeHolding.invested * soldRatio;
      const realizedProfit = safeSellAmount - estimatedInvestedAtSale;
      const activityId = generateId();

      const baseActivity: PortfolioActivityEntry = {
        id: activityId,
        holdingKey: activeHolding.key,
        name: activeHolding.name,
        type: activeHolding.type,
        activityType: "sell",
        amount: safeSellAmount,
        date: sellDate,
        ticker: activeHolding.ticker,
        notes: sellNotes.trim() || undefined,
        cashDestination: sellDestination,
        investedAtSale: estimatedInvestedAtSale,
        realizedProfit,
        closesPosition,
        previousCurrentValue: currentHoldingValue,
        createdAt: now,
        updatedAt: now,
      };

      const sideEffects = applySellSideEffects({
        activity: baseActivity,
        amountNumber: safeSellAmount,
        dateValue: sellDate,
        now,
      });

      setPortfolioActivity((prev) => [
        { ...baseActivity, ...sideEffects },
        ...prev,
      ]);

      setHoldingValues((prev) => ({
        ...prev,
        [activeHolding.key]: closesPosition
          ? 0
          : Math.max(currentHoldingValue - safeSellAmount, 0),
      }));

      if (closesPosition) {
        setClosedHoldingKeys((prev) =>
          prev.includes(activeHolding.key)
            ? prev
            : [...prev, activeHolding.key],
        );
      }

      closeSellPosition();
      closeHoldingDetail();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save sale.");
    }
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
    if (
      investMoreFundingSource === "portfolio_cash" &&
      parsedAmount > portfolioCashBalance
    ) {
      setError("Not enough portfolio cash available.");
      return;
    }

    createInvestmentEntry({
      cleanName: selectedHolding.name,
      assetType: selectedHolding.type,
      amountNumber: parsedAmount,
      cleanTicker: selectedHolding.ticker,
      entryDate: investMoreDate,
      fundingSource: investMoreFundingSource,
    });

    setClosedHoldingKeys((prev) =>
      prev.filter((key) => key !== selectedHolding.key),
    );
    closeInvestMore();
    closeHoldingDetail();
  };

  const openManageCash = () => {
    setCashAction("adjustment");
    setCashAmount("");
    setCashTargetValue(String(Math.max(portfolioCashBalance, 0)));
    setCashDate(getTodayDate());
    setCashNotes("");
    setError("");
    setIsManageCashOpen(true);
  };

  const closeManageCash = () => {
    setIsManageCashOpen(false);
    setCashAction("adjustment");
    setCashAmount("");
    setCashTargetValue("");
    setCashDate(getTodayDate());
    setCashNotes("");
    setError("");
  };

  const handlePortfolioCashSubmit = () => {
    const now = new Date().toISOString();

    if (cashAction === "adjustment") {
      const parsedTarget = Number(cashTargetValue);

      if (cashTargetValue.trim() === "" || Number.isNaN(parsedTarget) || parsedTarget < 0) {
        setError("Please enter a valid cash balance.");
        return;
      }

      const delta = parsedTarget - portfolioCashBalance;

      if (Math.abs(delta) < 0.01) {
        closeManageCash();
        return;
      }

      addPortfolioCashMovement({
        type: "adjustment",
        amount: delta,
        date: getTodayDate(),
        notes:
          cashNotes.trim() ||
          `Portfolio cash adjusted from ${formatCurrency(portfolioCashBalance, currency)} to ${formatCurrency(parsedTarget, currency)}`,
        updatedAt: now,
      });

      closeManageCash();
      return;
    }

    const parsedAmount = Number(cashAmount);

    if (!cashAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!cashDate) {
      setError("Please select a date.");
      return;
    }

    if (cashAction === "withdrawal" && parsedAmount > portfolioCashBalance) {
      setError("Withdrawal cannot be higher than portfolio cash.");
      return;
    }

    const movementId = addPortfolioCashMovement({
      type: cashAction,
      amount: parsedAmount,
      date: cashDate,
      notes: cashNotes.trim() || undefined,
      updatedAt: now,
    });

    if (cashAction === "withdrawal") {
      addPortfolioCashWithdrawalToCashFlow({
        portfolioActivityId: movementId,
        amount: parsedAmount,
        date: cashDate,
        now,
      });
    }

    closeManageCash();
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
            <div className="mt-2 flex items-center gap-3">
              <p className="text-zinc-500 text-sm">
                Portfolio cash {formatCurrency(portfolioCashBalance, currency)}
              </p>
              <button
                type="button"
                onClick={openManageCash}
                className="text-xs text-[var(--accent)]/80 transition-colors duration-200 hover:text-[var(--accent)]"
              >
                Manage
              </button>
            </div>
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
              {groups.length === 0 && portfolioCashBalance <= 0 ? (
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
                      {portfolioCashBalance > 0 && (
                        <div>
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <span className="text-zinc-300 text-sm">
                              Portfolio Cash
                            </span>
                            <span className="text-white text-sm font-medium">
                              {totals.currentTotal > 0
                                ? `${((portfolioCashBalance / totals.currentTotal) * 100).toFixed(0)}%`
                                : "0%"}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-white/30"
                              style={{
                                width: `${
                                  totals.currentTotal > 0
                                    ? Math.min(
                                        (portfolioCashBalance /
                                          totals.currentTotal) *
                                          100,
                                        100,
                                      )
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
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
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500">Portfolio Cash</span>
                          <button
                            type="button"
                            onClick={openManageCash}
                            className="text-[11px] text-[var(--accent)]/75 transition-colors duration-200 hover:text-[var(--accent)]"
                          >
                            Manage
                          </button>
                        </div>
                        <span className="text-white font-medium">
                          {formatCurrency(portfolioCashBalance, currency)}
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
                            : portfolioCashBalance > 0
                              ? "Portfolio Cash"
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
                                  className={`text-xs mt-1 ${group.profitPct >= 0 ? "text-green-500" : "text-red-500"}`}
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
                                        className={`text-xs mt-1 ${holding.profitPct >= 0 ? "text-green-500" : "text-red-500"}`}
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
                <p className="text-zinc-500 text-sm mb-1">Activity in</p>
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
              <div className="mb-5 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">External deposits</span>
                  <span className="text-white font-medium">
                    {formatCurrency(periodExternalDeposits, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">Reallocated</span>
                  <span className="text-white font-medium">
                    {formatCurrency(periodReallocated, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-500">Withdrawn</span>
                  <span className="text-white font-medium">
                    {formatCurrency(periodWithdrawals, currency)}
                  </span>
                </div>
              </div>
              {periodActivityEntries.length === 0 ? (
                <div className="rounded-[26px] bg-zinc-900/35 border border-white/5 p-6">
                  <p className="text-zinc-300 text-sm">
                    No portfolio activity in this period.
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
                      Portfolio activity
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
                              openEditEntryModal(
                                entry.source as InvestmentEntry,
                              );
                              return;
                            }
                            if (entry.kind === "sell") {
                              openEditSellActivity(
                                entry.source as PortfolioActivityEntry,
                              );
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
                                {entry.kind === "sell"
                                  ? "Sold "
                                  : entry.kind === "cash"
                                    ? ""
                                    : "Bought "}
                                {entry.name}
                              </p>
                              {entry.ticker && (
                                <span className="text-xs text-zinc-600 uppercase">
                                  {entry.ticker}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600 flex-wrap">
                              <span>
                                {entry.kind === "cash"
                                  ? "Portfolio Cash"
                                  : formatAssetType(entry.type)}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`text-sm font-medium ${
                                entry.kind === "sell"
                                  ? "text-green-500"
                                  : entry.kind === "cash" &&
                                      (["deposit", "sell_proceeds"].includes((entry.source as PortfolioCashMovement).type) ||
                                        ((entry.source as PortfolioCashMovement).type === "adjustment" && entry.amount > 0))
                                    ? "text-green-500"
                                    : entry.kind === "cash" &&
                                        (["withdrawal", "buy_from_cash", "reallocation_buy"].includes((entry.source as PortfolioCashMovement).type) || entry.amount < 0)
                                      ? "text-red-500"
                                      : "text-zinc-300"
                              }`}
                            >
                              {entry.kind === "sell" ||
                              (entry.kind === "cash" &&
                                ["deposit", "sell_proceeds"].includes((entry.source as PortfolioCashMovement).type)) ||
                              (entry.kind === "cash" &&
                                (entry.source as PortfolioCashMovement).type === "adjustment" &&
                                entry.amount > 0)
                                ? "+"
                                : entry.kind === "cash" &&
                                    (["withdrawal", "buy_from_cash", "reallocation_buy"].includes((entry.source as PortfolioCashMovement).type) || entry.amount < 0)
                                  ? "-"
                                  : ""}
                              {entry.kind === "cash"
                                ? formatCurrency(Math.abs(entry.amount), currency)
                                : formatCurrency(entry.amount, currency)}
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
                  className={`text-5xl font-semibold tracking-tight ${realReturn === null ? "text-white" : realReturn >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {realReturn === null ? "—" : formatSignedPercent(realReturn)}
                </p>
                <p
                  className={`text-sm mt-3 ${realProfit >= 0 ? "text-green-500" : "text-red-500"}`}
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
                  <span className="text-zinc-500">Deposits</span>
                  <span className="text-white font-medium">
                    {formatCurrency(displayedReviewDeposits, currency)}
                  </span>
                </div>
                {periodReallocated > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Reallocated</span>
                    <span className="text-white font-medium">
                      {formatCurrency(periodReallocated, currency)}
                    </span>
                  </div>
                )}
                {periodPortfolioCashProceeds > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">
                      Sold to portfolio cash
                    </span>
                    <span className="text-white font-medium">
                      {formatCurrency(periodPortfolioCashProceeds, currency)}
                    </span>
                  </div>
                )}
                {displayedReviewWithdrawals > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Withdrawn</span>
                    <span className="text-white font-medium">
                      {formatCurrency(displayedReviewWithdrawals, currency)}
                    </span>
                  </div>
                )}
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
                    className={`font-medium ${realProfit >= 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {formatSignedCurrency(realProfit, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-zinc-300">Real Return</span>
                  <span
                    className={`font-medium ${realReturn === null ? "text-zinc-500" : realReturn >= 0 ? "text-green-500" : "text-red-500"}`}
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
                        const isExpanded =
                          expandedReviewYear === yearGroup.year;
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
                                  prev === yearGroup.year
                                    ? null
                                    : yearGroup.year,
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
                                    {yearGroup.months.length === 1 ? "" : "s"}{" "}
                                    tracked
                                  </p>
                                )}
                              </div>
                              {!isExpanded && (
                                <div className="text-right shrink-0">
                                  <p
                                    className={`text-sm font-medium ${yearGroup.latestReturnPct === null ? "text-zinc-500" : yearGroup.latestReturnPct >= 0 ? "text-green-500" : "text-red-500"}`}
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
                                      onClick={() =>
                                        setSelectedPeriod(item.period)
                                      }
                                      className="w-full text-left transition-colors duration-200 ease-out hover:bg-white/[0.02]"
                                    >
                                      <div className="flex items-center justify-between gap-4">
                                        <p className="text-zinc-300 font-medium">
                                          {formatPeriodLabel(item.period)}
                                        </p>
                                        <span
                                          className={`font-medium ${item.returnPct === null ? "text-zinc-500" : item.returnPct >= 0 ? "text-green-500" : "text-red-500"}`}
                                        >
                                          {item.returnPct === null
                                            ? "—"
                                            : formatSignedPercent(
                                                item.returnPct,
                                              )}
                                        </span>
                                      </div>
                                      <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                                        Opening{" "}
                                        {formatCurrency(item.opening, currency)}{" "}
                                        · Deposits{" "}
                                        {formatCurrency(
                                          item.deposits,
                                          currency,
                                        )}{" "}
                                        · Closing{" "}
                                        {formatCurrency(item.closing, currency)}
                                      </p>
                                      <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                                        Reallocated{" "}
                                        {formatCurrency(
                                          item.reallocated,
                                          currency,
                                        )}{" "}
                                        · Withdrawn{" "}
                                        {formatCurrency(
                                          item.withdrawals,
                                          currency,
                                        )}
                                      </p>
                                      <p className="text-zinc-600 text-xs mt-1 leading-relaxed">
                                        Real Profit{" "}
                                        {formatSignedCurrency(
                                          item.profit,
                                          currency,
                                        )}
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

      {isManageCashOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 animate-[modalOverlayEnter_150ms_ease-out]"
          onClick={closeManageCash}
        >
          <div className="absolute inset-0 flex items-end md:items-center md:justify-center p-3 md:p-6">
            <div
              className="w-full md:max-w-lg rounded-t-[30px] md:rounded-[30px] bg-zinc-900/95 border border-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-4 md:p-5 animate-[modalContentEnter_180ms_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white text-sm font-medium">
                    Manage Portfolio Cash
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Adjust available cash inside your portfolio.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeManageCash}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors duration-200 ease-out cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 rounded-[22px] bg-zinc-800/40 border border-white/5 p-4">
                <p className="text-zinc-500 text-xs mb-2">Current portfolio cash</p>
                <p className="text-white text-xl font-semibold tracking-tight">
                  {formatCurrency(portfolioCashBalance, currency)}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setCashAction("deposit");
                    setError("");
                  }}
                  className={`rounded-full h-[42px] text-xs border transition-all duration-200 ease-out active:scale-[0.98] ${
                    cashAction === "deposit"
                      ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                      : "bg-zinc-800/80 border-white/5 text-zinc-400"
                  }`}
                >
                  Add cash
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCashAction("withdrawal");
                    setError("");
                  }}
                  className={`rounded-full h-[42px] text-xs border transition-all duration-200 ease-out active:scale-[0.98] ${
                    cashAction === "withdrawal"
                      ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                      : "bg-zinc-800/80 border-white/5 text-zinc-400"
                  }`}
                >
                  Withdraw
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCashAction("adjustment");
                    setCashTargetValue(String(Math.max(portfolioCashBalance, 0)));
                    setError("");
                  }}
                  className={`rounded-full h-[42px] text-xs border transition-all duration-200 ease-out active:scale-[0.98] ${
                    cashAction === "adjustment"
                      ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                      : "bg-zinc-800/80 border-white/5 text-zinc-400"
                  }`}
                >
                  Adjust
                </button>
              </div>

              <div className="grid gap-3">
                {cashAction === "adjustment" ? (
                  <input
                    placeholder="Set portfolio cash to"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashTargetValue}
                    onChange={(e) => setCashTargetValue(e.target.value)}
                    className={fieldClass}
                  />
                ) : (
                  <>
                    <input
                      placeholder="Amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className={fieldClass}
                    />

                    <input
                      type="date"
                      value={cashDate}
                      onChange={(e) => setCashDate(e.target.value)}
                      className={fieldClass}
                    />
                  </>
                )}

                <textarea
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800/70 border border-white/5 rounded-[18px] px-4 py-3 text-white outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/25 transition-colors resize-none"
                  placeholder="Optional notes"
                />

                {error && <p className="text-sm text-red-500 pt-1">{error}</p>}

                <button
                  type="button"
                  onClick={handlePortfolioCashSubmit}
                  className="w-full rounded-full bg-[var(--accent)] text-black h-[50px] font-medium transition-all duration-200 ease-out hover:bg-[var(--accent-strong)] active:scale-[0.98] cursor-pointer touch-manipulation mt-1"
                >
                  {cashAction === "adjustment" ? "Save cash balance" : cashAction === "deposit" ? "Add portfolio cash" : "Withdraw cash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  placeholder={`Deposits · ${formatCurrency(periodExternalDeposits, currency)}`}
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
                  placeholder={`Withdrawals · ${formatCurrency(periodWithdrawals, currency)}`}
                  value={reviewWithdrawalsValue}
                  onChange={(e) => {
                    setReviewWithdrawalsValue(e.target.value);
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssetFundingSource("external")}
                    className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${assetFundingSource === "external" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                  >
                    External cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetFundingSource("portfolio_cash")}
                    className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${assetFundingSource === "portfolio_cash" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                  >
                    Portfolio cash
                  </button>
                </div>
                {assetFundingSource === "portfolio_cash" && (
                  <p className="text-zinc-600 text-xs">
                    Available: {formatCurrency(portfolioCashBalance, currency)}
                  </p>
                )}
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
                      className={`text-sm font-medium ${selectedHolding.profitPct >= 0 ? "text-green-500" : "text-red-500"}`}
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
                    className={`text-sm font-medium ${selectedHolding.profit >= 0 ? "text-green-500" : "text-red-500"}`}
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

      {isSellOpen && (selectedHolding || selectedSellActivity) && (
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
                    {editingSellId ? "Edit sale" : `Sell ${sellModalName}`}
                  </p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Choose where the sale proceeds go.
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
                    {formatCurrency(sellModalCurrentValue, currency)}
                  </p>
                </div>
                <input
                  placeholder="Sell amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellAmount}
                  onChange={(e) => {
                    setSellAmount(e.target.value);
                    if (!reallocateAmount) setReallocateAmount(e.target.value);
                  }}
                  className={fieldClass}
                />
                <input
                  type="date"
                  value={sellDate}
                  onChange={(e) => setSellDate(e.target.value)}
                  className={fieldClass}
                />
                <div className="grid gap-2">
                  <p className="text-xs text-zinc-500">Destination</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSellDestination("portfolio_cash")}
                      className={`rounded-full h-[42px] text-xs border transition-all duration-200 ease-out active:scale-[0.98] ${sellDestination === "portfolio_cash" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                    >
                      Portfolio cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellDestination("personal_cash")}
                      className={`rounded-full h-[42px] text-xs border transition-all duration-200 ease-out active:scale-[0.98] ${sellDestination === "personal_cash" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                    >
                      Personal cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setSellDestination("reallocate")}
                      className={`rounded-full h-[42px] text-xs border transition-all duration-200 ease-out active:scale-[0.98] ${sellDestination === "reallocate" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                    >
                      Reallocate
                    </button>
                  </div>
                </div>
                {sellDestination === "reallocate" && (
                  <div className="grid gap-3 rounded-[22px] bg-zinc-800/30 border border-white/5 p-3">
                    <input
                      placeholder="New or existing asset"
                      value={reallocateName}
                      onChange={(e) => setReallocateName(e.target.value)}
                      className={fieldClass}
                    />
                    <select
                      value={reallocateType}
                      onChange={(e) =>
                        setReallocateType(e.target.value as AssetType)
                      }
                      className={fieldClass}
                    >
                      {assetTypes.map((assetType) => (
                        <option key={assetType.value} value={assetType.value}>
                          {assetType.label}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Ticker (optional)"
                      value={reallocateTicker}
                      onChange={(e) =>
                        setReallocateTicker(e.target.value.toUpperCase())
                      }
                      className={fieldClass}
                    />
                    <input
                      placeholder="Amount to reallocate"
                      type="number"
                      min="0"
                      step="0.01"
                      value={reallocateAmount}
                      onChange={(e) => setReallocateAmount(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                )}
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
                  {editingSellId ? "Save sale" : "Confirm sale"}
                </button>
                {editingSellId && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={cancelSellActivity}
                      className="w-full text-center text-red-400 text-xs py-1 transition-colors duration-200 ease-out hover:text-red-300 cursor-pointer"
                    >
                      Delete sale
                    </button>
                    <p className="text-center text-zinc-700 text-[11px] mt-1">
                      Removes this sale, its cash effects, and its review
                      impact.
                    </p>
                  </div>
                )}
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInvestMoreFundingSource("external")}
                    className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${investMoreFundingSource === "external" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                  >
                    External cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvestMoreFundingSource("portfolio_cash")}
                    className={`rounded-full h-[42px] text-sm border transition-all duration-200 ease-out active:scale-[0.98] ${investMoreFundingSource === "portfolio_cash" ? "bg-[var(--accent)] text-black border-[var(--accent)]" : "bg-zinc-800/80 border-white/5 text-zinc-400"}`}
                  >
                    Portfolio cash
                  </button>
                </div>
                {investMoreFundingSource === "portfolio_cash" && (
                  <p className="text-zinc-600 text-xs">
                    Available: {formatCurrency(portfolioCashBalance, currency)}
                  </p>
                )}
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

