import { enUS } from "./en-US"
import { ptBR } from "./pt-BR"

export type Language = "en-US" | "pt-BR"

export const defaultLanguage: Language = "en-US"

export const copyByLanguage = {
  "en-US": enUS,
  "pt-BR": ptBR,
}

export function getCopy(language: Language) {
  return copyByLanguage[language] ?? copyByLanguage[defaultLanguage]
}

export type Copy = typeof enUS