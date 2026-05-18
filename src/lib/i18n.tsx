import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "es" | "en";

const dict = {
  es: {
    appName: "Portafolio",
    tagline: "Planifica · Controla · Invierte",
    login: "Iniciar sesión",
    signup: "Crear cuenta",
    logout: "Cerrar sesión",
    email: "Correo",
    password: "Contraseña",
    name: "Nombre",
    continueWithGoogle: "Continuar con Google",
    or: "o",
    dashboard: "Dashboard",
    stocks: "Acciones & ETF",
    crypto: "Cripto",
    goals: "Metas",
    recurring: "Aportes recurrentes",
    settings: "Ajustes",
    totalUSD: "Total USD",
    totalCOP: "Total COP",
    invested: "Invertido",
    pnl: "Ganancia / Pérdida",
    activeAssets: "Activos",
    distribution: "Distribución del portafolio",
    evolution: "Evolución del portafolio",
    addAsset: "Añadir activo",
    editAsset: "Editar activo",
    delete: "Eliminar",
    save: "Guardar",
    cancel: "Cancelar",
    ticker: "Categoría",
    assetName: "Nombre del activo",
    type: "Tipo de activo",
    platform: "Plataforma",
    quantity: "Cantidad",
    avgCost: "Monto invertido",
    currentPrice: "Valor actual",
    refreshPrices: "Actualizar precios",
    fxRate: "TRM (USD → otras monedas)",
    investedUsd: "Invertido (USD)",
    investedCop: "Invertido (COP)",
    currentUsd: "Valor actual (USD)",
    currentCop: "Valor actual (COP)",
    liveRates: "Tasas en vivo",
    period: "Periodo (semanas)",
    addGoal: "Añadir meta",
    goalName: "Nombre",
    target: "Objetivo",
    targetDate: "Fecha objetivo",
    progress: "Progreso",
    addRecurring: "Programar aporte",
    amount: "Monto",
    frequency: "Frecuencia",
    nextRun: "Próximo aporte",
    weekly: "Semanal",
    biweekly: "Quincenal",
    monthly: "Mensual",
    language: "Idioma",
    noData: "Aún no tienes datos. Empieza añadiendo tu primer activo.",
    welcome: "Tu portafolio, claro y al instante",
    welcomeSub: "Sigue tus acciones, ETFs y cripto con precios automáticos en USD y COP. Define metas, programa aportes y mide tu evolución.",
    getStarted: "Empezar gratis",
    portfolioOverview: "Resumen",
    last7: "7d",
    last30: "30d",
    last90: "90d",
    allTime: "Todo",
    confirmDelete: "¿Eliminar este registro?",
    pricesUpdated: "Precios actualizados",
    saved: "Guardado",
    error: "Algo salió mal",
  },
  en: {
    appName: "Portfolio",
    tagline: "Plan · Track · Invest",
    login: "Log in",
    signup: "Sign up",
    logout: "Log out",
    email: "Email",
    password: "Password",
    name: "Name",
    continueWithGoogle: "Continue with Google",
    or: "or",
    dashboard: "Dashboard",
    stocks: "Stocks & ETF",
    crypto: "Crypto",
    goals: "Goals",
    recurring: "Recurring",
    settings: "Settings",
    totalUSD: "Total USD",
    totalCOP: "Total COP",
    invested: "Invested",
    pnl: "Profit / Loss",
    activeAssets: "Holdings",
    distribution: "Portfolio distribution",
    evolution: "Portfolio evolution",
    addAsset: "Add asset",
    editAsset: "Edit asset",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    ticker: "Ticker",
    assetName: "Name",
    type: "Type",
    platform: "Platform",
    quantity: "Quantity",
    avgCost: "Avg cost (USD)",
    currentPrice: "Current price (USD)",
    refreshPrices: "Refresh prices",
    fxRate: "USD/COP rate",
    period: "Period (weeks)",
    addGoal: "Add goal",
    goalName: "Name",
    target: "Target",
    targetDate: "Target date",
    progress: "Progress",
    addRecurring: "Schedule contribution",
    amount: "Amount",
    frequency: "Frequency",
    nextRun: "Next run",
    weekly: "Weekly",
    biweekly: "Biweekly",
    monthly: "Monthly",
    language: "Language",
    noData: "No data yet. Add your first asset to get started.",
    welcome: "Your portfolio, crystal clear",
    welcomeSub: "Track stocks, ETFs and crypto with live USD/COP prices. Set goals, automate contributions, watch growth.",
    getStarted: "Start free",
    portfolioOverview: "Overview",
    last7: "7d",
    last30: "30d",
    last90: "90d",
    allTime: "All",
    confirmDelete: "Delete this entry?",
    pricesUpdated: "Prices updated",
    saved: "Saved",
    error: "Something went wrong",
  },
} as const;

type DictKey = keyof (typeof dict)["es"];

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: DictKey) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("lang") as Lang | null) : null;
    if (saved === "es" || saved === "en") setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };
  const t = (k: DictKey) => dict[lang][k] ?? k;
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
