import { useState, useEffect, useCallback } from "react";
import "./App.css";

function App() {
  const [url, setUrl] = useState(
    "http://3dpit.iptime.org:8000/api/v1/members/api-docs/swagger"
  );
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<Record<string, unknown> | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://127.0.0.1:8080/api/v1/swagger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "요청 중 오류가 발생했습니다"
      );
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchData();
  };

  // 1분 간격 자동 조회
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 1000); // 60초 = 1분

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  return (
    <div className="app">
      <h1>Swagger API Viewer</h1>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="url">Swagger URL:</label>
          <input
            type="text"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter Swagger URL"
            disabled={loading}
          />
        </div>

        <div className="controls">
          <button type="submit" disabled={loading}>
            {loading ? "로딩 중..." : "Swagger 가져오기"}
          </button>

          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "active" : ""}
            disabled={loading}
          >
            {autoRefresh ? "자동 조회 중지" : "1분 자동 조회"}
          </button>
        </div>
      </form>

      {error && (
        <div className="error">
          <h3>오류:</h3>
          <p>{error}</p>
        </div>
      )}

      {response && (
        <div className="response">
          <h3>응답:</h3>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
