"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Language, translations } from "@/lib/translations";
import { createClient } from "@/lib/supabase/client";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/app-config";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.fr;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Valider si une langue est supportée
const isValidLanguage = (lang: string | null): lang is Language => {
  return lang !== null && SUPPORTED_LANGUAGES.some(l => l.code === lang);
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  // Charger la préférence de langue au montage
  useEffect(() => {
    const loadLanguagePreference = async () => {
      try {
        // 1. Vérifier si l'utilisateur est connecté
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
          // 2. Charger la préférence depuis la base de données
          const { data: preference } = await supabase
            .from("user_preferences")
            .select("language")
            .eq("user_id", user.id)
            .single();

          if (preference && isValidLanguage(preference.language)) {
            setLanguageState(preference.language);
            localStorage.setItem("collectorverse-language", preference.language);
            setIsLoading(false);
            return;
          }
        }

        // 3. Fallback sur localStorage pour utilisateurs non connectés
        const savedLang = localStorage.getItem("collectorverse-language");
        if (isValidLanguage(savedLang)) {
          setLanguageState(savedLang);
        }
      } catch (error) {
        // En cas d'erreur, utiliser localStorage
        const savedLang = localStorage.getItem("collectorverse-language");
        if (isValidLanguage(savedLang)) {
          setLanguageState(savedLang);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguagePreference();

    // Écouter les changements d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUserId(session.user.id);
        // Charger la préférence de l'utilisateur depuis la BDD
        const { data: preference } = await supabase
          .from("user_preferences")
          .select("language")
          .eq("user_id", session.user.id)
          .single();

        if (preference && isValidLanguage(preference.language)) {
          setLanguageState(preference.language);
          localStorage.setItem("collectorverse-language", preference.language);
        } else {
          // Sauvegarder la préférence locale dans la BDD pour le nouvel utilisateur
          const currentLang = localStorage.getItem("collectorverse-language") || "fr";
          if (isValidLanguage(currentLang)) {
            await supabase
              .from("user_preferences")
              .upsert({
                user_id: session.user.id,
                language: currentLang
              }, {
                onConflict: "user_id"
              });
          }
        }
      } else if (event === "SIGNED_OUT") {
        setUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("collectorverse-language", lang);

    // Si l'utilisateur est connecté, sauvegarder en BDD
    if (userId) {
      try {
        await supabase
          .from("user_preferences")
          .upsert({
            user_id: userId,
            language: lang
          }, {
            onConflict: "user_id"
          });
      } catch (error) {
        console.error("Erreur lors de la sauvegarde de la langue:", error);
      }
    }
  }, [userId, supabase]);

  const value = {
    language,
    setLanguage,
    t: translations[language],
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

