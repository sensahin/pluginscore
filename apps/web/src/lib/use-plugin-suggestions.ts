"use client";

import { useEffect, useState } from "react";
import {
  fetchPluginSuggestions,
  type PluginSuggestion,
} from "@/lib/plugin-suggestions";

export function usePluginSuggestions(query: string) {
  const trimmedQuery = query.trim();
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{
    query: string;
    items: PluginSuggestion[];
  } | null>(null);

  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoadingQuery(trimmedQuery);
      fetchPluginSuggestions(trimmedQuery, controller.signal)
        .then((items) => setSuggestions({ query: trimmedQuery, items }))
        .catch((error: Error) => {
          if (error.name !== "AbortError") {
            setSuggestions(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoadingQuery(null);
          }
        });
    }, 150);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [trimmedQuery]);

  return {
    items: suggestions?.query === trimmedQuery ? suggestions.items : null,
    isLoading: loadingQuery === trimmedQuery,
    trimmedQuery,
  };
}
