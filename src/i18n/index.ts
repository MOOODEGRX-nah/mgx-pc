import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

const STORAGE_KEY = "mgxpc-lang";
const RTL_LANGS = ["ar"];

function applyDirection(lang: string) {
  const dir = RTL_LANGS.includes(lang) ? "rtl" : "ltr";
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

const savedLang =
  (typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY)) ||
  "ar";

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
});

applyDirection(savedLang);

i18n.on("languageChanged", (lang) => {
  applyDirection(lang);
  localStorage.setItem(STORAGE_KEY, lang);
});

export default i18n;
