import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ApiView.css";

interface SwaggerCard {
  id: string;
  name: string;
  url: string;
  autoRefresh: boolean;
  loading: boolean;
  response: Record<string, unknown> | null;
  error: string | null;
  lastUpdated: Date | null;
}

const STORAGE_KEY = "swagger-cards";

// 로컬스토리지에서 카드 불러오기
const loadCardsFromStorage = (): SwaggerCard[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Date 객체 복원 및 loading만 초기화
      return parsed.map((card: SwaggerCard) => ({
        ...card,
        lastUpdated: card.lastUpdated ? new Date(card.lastUpdated) : null,
        loading: false, // 로딩 상태만 초기화
      }));
    }
  } catch (error) {
    console.error("Failed to load cards from storage:", error);
  }
  // 기본 카드
  return [
    {
      id: "1",
      name: "Members API",
      url: "http://3dpit.iptime.org:8000/api/v1/members/api-docs/swagger",
      autoRefresh: false,
      loading: false,
      response: null,
      error: null,
      lastUpdated: null,
    },
  ];
};

export const ApiView = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<SwaggerCard[]>(loadCardsFromStorage());
  const [newCardName, setNewCardName] = useState("");
  const [newCardUrl, setNewCardUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // 카드 변경 시 로컬스토리지에 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (error) {
      console.error("Failed to save cards to storage:", error);
    }
  }, [cards]);

  // 카드 클릭 시 상세 페이지로 이동
  const handleCardClick = (cardName: string) => {
    navigate(`/swagger-view/${encodeURIComponent(cardName)}`);
  };

  const fetchData = useCallback(
    async (cardId: string) => {
      setCards((prev) =>
        prev.map((card) =>
          card.id === cardId ? { ...card, loading: true } : card
        )
      );

      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      try {
        const res = await fetch("http://127.0.0.1:8080/api/v1/swagger", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: card.url }),
        });

        // HTTP 상태 코드 확인
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `HTTP ${res.status} ${res.statusText}: ${errorText || "응답 없음"}`
          );
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          throw new Error(
            `JSON이 아닌 응답을 받았습니다 (Content-Type: ${contentType}): ${text.substring(
              0,
              200
            )}`
          );
        }

        const data = await res.json();
        setCards((prev) =>
          prev.map((c) => {
            if (c.id === cardId) {
              // 이전 응답과 새 응답을 비교
              const responseChanged =
                JSON.stringify(c.response) !== JSON.stringify(data);
              return {
                ...c,
                response: data,
                error: null, // 성공 시 에러 제거 (오류 영역이 응답 영역으로 전환)
                loading: false,
                // 응답이 바뀐 경우에만 lastUpdated 업데이트
                lastUpdated: responseChanged ? new Date() : c.lastUpdated,
              };
            }
            return c;
          })
        );
      } catch (err) {
        let errorMessage = "요청 중 오류 발생";

        if (err instanceof TypeError && err.message.includes("fetch")) {
          errorMessage = `🔴 서버 연결 실패`;
        } else if (err instanceof Error) {
          // 오류 메시지를 간결하게 요약
          const msg = err.message;
          if (msg.includes("HTTP")) {
            const statusMatch = msg.match(/HTTP (\d+)/);
            errorMessage = statusMatch
              ? `🔴 HTTP ${statusMatch[1]} 오류`
              : "🔴 HTTP 오류";
          } else if (msg.includes("JSON")) {
            errorMessage = "🔴 잘못된 응답 형식";
          } else {
            // 메시지가 너무 길면 첫 50자만
            errorMessage = `🔴 ${
              msg.length > 50 ? msg.substring(0, 50) + "..." : msg
            }`;
          }
        }

        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, error: errorMessage, loading: false } : c
          )
        );
        console.error("Fetch error:", err);
      }
    },
    [cards]
  );

  const toggleAutoRefresh = (cardId: string) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, autoRefresh: !card.autoRefresh } : card
      )
    );
  };

  const addCard = () => {
    if (!newCardName.trim() || !newCardUrl.trim()) {
      alert("이름과 URL을 모두 입력해주세요.");
      return;
    }

    const newCard: SwaggerCard = {
      id: Date.now().toString(),
      name: newCardName,
      url: newCardUrl,
      autoRefresh: false,
      loading: false,
      response: null,
      error: null,
      lastUpdated: null,
    };

    setCards((prev) => [...prev, newCard]);
    setNewCardName("");
    setNewCardUrl("");
    setShowAddForm(false);
  };

  const deleteCard = (cardId: string) => {
    if (confirm("이 카드를 삭제하시겠습니까?")) {
      setCards((prev) => prev.filter((card) => card.id !== cardId));
    }
  };

  // 자동 새로고침
  useEffect(() => {
    const intervals: { [key: string]: number } = {};

    cards.forEach((card) => {
      if (card.autoRefresh) {
        intervals[card.id] = setInterval(() => {
          fetchData(card.id);
        }, 4000) as unknown as number; // 4초
      }
    });

    return () => {
      Object.values(intervals).forEach((interval) => clearInterval(interval));
    };
  }, [cards, fetchData]);

  return (
    <div className="app">
      <div className="header">
        <h1>Swagger API Viewer</h1>
        <button
          className="add-card-button"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? "취소" : "+ 새 카드 추가"}
        </button>
      </div>

      {showAddForm && (
        <div className="add-card-form">
          <h3>📝 새 Swagger URL 추가</h3>
          <div className="form-row">
            <label htmlFor="cardName">카드 이름</label>
            <input
              type="text"
              id="cardName"
              placeholder="예: Members API"
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              className="card-name-input"
            />
          </div>
          <div className="form-row">
            <label htmlFor="cardUrl">Swagger URL</label>
            <input
              type="text"
              id="cardUrl"
              placeholder="예: http://localhost:8080/api-docs/swagger"
              value={newCardUrl}
              onChange={(e) => setNewCardUrl(e.target.value)}
              className="card-url-input"
            />
          </div>
          <button className="submit-card-button" onClick={addCard}>
            ✅ 추가하기
          </button>
        </div>
      )}

      <div className="cards-container">
        {cards.map((card) => (
          <div key={card.id} className="swagger-card">
            <div className="card-header">
              <div className="card-title-section">
                <h2
                  className="clickable-title"
                  onClick={() => handleCardClick(card.name)}
                  title="상세 정보 보기"
                >
                  {card.name} →
                </h2>
                <p className="card-url">{card.url}</p>
                {card.lastUpdated && (
                  <p className="last-updated">
                    마지막 업데이트: {card.lastUpdated.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <button
                className="delete-button"
                onClick={() => deleteCard(card.id)}
                title="삭제"
              >
                ✕
              </button>
            </div>

            <div className="card-controls">
              <button
                onClick={() => fetchData(card.id)}
                disabled={card.loading}
                className="fetch-button"
              >
                {card.loading ? "로딩 중..." : "조회하기"}
              </button>

              <button
                onClick={() => toggleAutoRefresh(card.id)}
                className={`auto-refresh-button ${
                  card.autoRefresh ? "active" : ""
                }`}
                disabled={card.loading}
              >
                {card.autoRefresh ? "자동 조회 중지" : "자동 조회"}
              </button>
            </div>

            {(card.error || card.response) && (
              <div
                className={
                  card.error
                    ? "card-content error-mode"
                    : "card-content success-mode"
                }
              >
                {card.error ? (
                  <>
                    <h4>오류:</h4>
                    <div className="content-body">
                      <p>{card.error}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <h4>응답:</h4>
                    <div className="content-body">
                      <pre>{JSON.stringify(card.response, null, 2)}</pre>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
