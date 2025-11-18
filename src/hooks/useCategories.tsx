// src/hooks/useCategories.ts
import { useEffect, useState } from "react";
import { Category, fetchCategories } from "@/lib/api";

export default function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchCategories()
      .then((data) => {
        if (!mounted) return;
        setCategories(data ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        console.error("fetchCategories failed", err);
      })
      .finally(() => {
        if (!mounted) setIsLoading(false);
        else setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { categories, isLoading, error };
}
