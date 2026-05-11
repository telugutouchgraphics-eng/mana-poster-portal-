"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DashboardLanguage,
  DASHBOARD_LANGUAGES,
  isDashboardLanguage,
  languageCodeFor,
} from "@/lib/i18n/dashboard-languages";

const STORAGE_KEY = "mana-poster-dashboard-language";

interface DashboardLanguageContextValue {
  language: DashboardLanguage;
  setLanguage: (value: DashboardLanguage) => void;
  translating: boolean;
  setTranslating: (value: boolean) => void;
  languages: typeof DASHBOARD_LANGUAGES;
}

const DashboardLanguageContext = createContext<DashboardLanguageContextValue | null>(null);

export function DashboardLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DashboardLanguage>(() => {
    if (typeof window === "undefined") {
      return "english";
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved && isDashboardLanguage(saved) ? saved : "english";
  });
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    document.documentElement.lang = languageCodeFor(language);
  }, [language]);

  function setLanguage(value: DashboardLanguage) {
    setLanguageState(value);
    window.localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.lang = languageCodeFor(value);
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translating,
      setTranslating,
      languages: DASHBOARD_LANGUAGES,
    }),
    [language, translating],
  );

  return (
    <DashboardLanguageContext.Provider value={value}>
      {children}
    </DashboardLanguageContext.Provider>
  );
}

export function useDashboardLanguage() {
  const context = useContext(DashboardLanguageContext);
  if (!context) {
    throw new Error("useDashboardLanguage must be used inside DashboardLanguageProvider.");
  }
  return context;
}
