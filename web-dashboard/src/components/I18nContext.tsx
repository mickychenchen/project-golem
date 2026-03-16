"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { translate } from "../../../src/i18n/i18n-core";

// Supported locales
const SUPPORTED_LOCALES = ['zh-TW', 'en', 'ja'];
const DEFAULT_LOCALE = 'en';

interface I18nContextType {
    locale: string;
    setLocale: (locale: string) => void;
    t: (key: string, vars?: any) => string;
    locales: string[];
    i18n: {
        language: string;
    };
}

const I18nContext = createContext<I18nContextType>({
    locale: DEFAULT_LOCALE,
    setLocale: () => { },
    t: (key: string) => key,
    locales: SUPPORTED_LOCALES,
    i18n: {
        language: DEFAULT_LOCALE
    }
});

export const useTranslation = () => useContext(I18nContext);

export function I18nProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<string>(DEFAULT_LOCALE);
    const [messages, setMessages] = useState<any>({});
    const [fallbackMessages, setFallbackMessages] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);

    // Initial load
    useEffect(() => {
        const savedLocale = localStorage.getItem("golem_locale") || DEFAULT_LOCALE;
        if (SUPPORTED_LOCALES.includes(savedLocale)) {
            setLocaleState(savedLocale);
        }
        
        // Load default locale messages (fallback)
        fetchLocale(DEFAULT_LOCALE).then(msgs => {
            setFallbackMessages(msgs);
        });
    }, []);

    // Load messages when locale changes
    useEffect(() => {
        setIsLoading(true);
        fetchLocale(locale).then(msgs => {
            setMessages(msgs);
            setIsLoading(false);
        });
        localStorage.setItem("golem_locale", locale);
    }, [locale]);

    const fetchLocale = async (loc: string) => {
        try {
            // In Next.js, we can fetch JSON from the public folder or a dynamic route
            // For now, let's assume we have an API or a way to serve these JSONs
            const res = await fetch(`/api/system/i18n?locale=${loc}`);
            if (!res.ok) throw new Error("Failed to fetch locale");
            const data = await res.json();
            return data;
        } catch (err) {
            console.error(`Failed to load locale ${loc}`, err);
            return {};
        }
    };

    const t = (key: string, vars: any = {}) => {
        return translate(messages, fallbackMessages, key, vars);
    };

    const setLocale = (newLocale: string) => {
        if (SUPPORTED_LOCALES.includes(newLocale)) {
            setLocaleState(newLocale);
        }
    };

    return (
        <I18nContext.Provider value={{
            locale,
            setLocale,
            t,
            locales: SUPPORTED_LOCALES,
            i18n: { language: locale }
        }}>
            {!isLoading && children}
            {isLoading && (
                 <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </I18nContext.Provider>
    );
}
