import { useCallback, useEffect, useState } from "react";
import { getHealthStatus, getStagingPreview, type MatchRow } from "@/lib/api";

export default function useStagingMatches() {
  const [apiStatus, setApiStatus] = useState("Kontrol ediliyor...");
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getHealthStatus()
      .then((data) => {
        if (data.status === "ok") {
          setApiStatus("API çalışıyor");
        } else {
          setApiStatus("Beklenmeyen cevap geldi");
        }
      })
      .catch(() => {
        setApiStatus("API'ye bağlanamadı");
      });
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);

    getStagingPreview()
      .then((rows) => {
        setMatches(rows);
        setError("");
      })
      .catch((err: Error) => {
        setError(err.message || "API'den maç verisi alınamadı");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    apiStatus,
    matches,
    error,
    isLoading,
    refetch,
  };
}