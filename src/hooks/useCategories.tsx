import { useEffect, useState } from "react";
// ✅ FIX: Import from api.ts
import { fetchCategories, CategoryItem } from "@/lib/api";

export default function useCategories() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    fetchCategories()
      .then((response: any) => {
        if (!mounted) return;
        // Safety check for the data path
        const list = response?.data?.listOfCategories ?? [];
        setCategories(list);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        console.error("fetchCategories failed", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // We export CategoryItem here just in case other files try to import it from the hook
  // but ideally, they should import from @/lib/api
  return { categories, isLoading, error };
}
export type { CategoryItem }; // Re-export for convenience if neededs