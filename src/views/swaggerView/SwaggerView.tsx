import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./SwaggerView.css";

interface SwaggerCard {
  id: string;
  name: string;
  url: string;
  swaggerUrl?: string; // Swagger UI URL (선택적)
  autoRefresh: boolean;
  loading: boolean;
  response: Record<string, unknown> | null;
  error: string | null;
  lastUpdated: Date | null;
}

const STORAGE_KEY = "swagger-cards";
const REFRESH_INTERVAL_KEY = "swagger-refresh-interval";
const CHANGED_CARD_IDS_KEY = "swagger-changed-card-ids";

// 로컬스토리지에서 조회 간격 불러오기
const loadRefreshInterval = (): number => {
  try {
    const stored = localStorage.getItem(REFRESH_INTERVAL_KEY);
    if (stored) {
      const parsed = Number(stored);
      // 유효한 숫자인지 확인 (NaN이 아니고 양수인지)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Failed to load refresh interval:", error);
  }
  return 4000; // 기본 4초
};

// 로컬스토리지에서 변경된 카드 ID 불러오기
const loadChangedCardIds = (): Set<string> => {
  try {
    const stored = localStorage.getItem(CHANGED_CARD_IDS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return new Set(parsed);
      }
    }
  } catch (error) {
    console.error("Failed to load changed card IDs:", error);
  }
  return new Set();
};

// 로컬스토리지에서 카드 불러오기
const loadCardsFromStorage = (): SwaggerCard[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Date 객체 복원 및 loading만 초기화, autoRefresh 상태는 유지
      return parsed.map((card: SwaggerCard) => {
        return {
          id: card.id,
          name: card.name,
          url: card.url,
          swaggerUrl: card.swaggerUrl || undefined, // Swagger URL 복원
          autoRefresh: card.autoRefresh ?? false, // autoRefresh 상태 복원
          loading: false, // 로딩 상태만 초기화
          response: card.response || null,
          error: card.error || null,
          lastUpdated: card.lastUpdated ? new Date(card.lastUpdated) : null,
        };
      });
    }
  } catch (error) {
    console.error("Failed to load cards from storage:", error);
  }
  // 기본 카드
  return [
    {
      id: "1",
      name: "users",
      url: "http://3dpit.iptime.org:8000/api/v1/users/api-docs",
      swaggerUrl: undefined,
      autoRefresh: false,
      loading: false,
      response: null,
      error: null,
      lastUpdated: null,
    },
  ];
};

export const SwaggerView = () => {
  const navigate = useNavigate();
  const [cards, setCards] = useState<SwaggerCard[]>(loadCardsFromStorage());
  const [newCardName, setNewCardName] = useState("");
  const [newCardUrl, setNewCardUrl] = useState("");
  const [newCardSwaggerUrl, setNewCardSwaggerUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [globalRefreshInterval, setGlobalRefreshInterval] = useState<number>(
    loadRefreshInterval()
  );
  const [changedCardIds, setChangedCardIds] = useState<Set<string>>(
    loadChangedCardIds()
  );
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editCardName, setEditCardName] = useState("");
  const [editCardUrl, setEditCardUrl] = useState("");
  const [editCardSwaggerUrl, setEditCardSwaggerUrl] = useState("");
  const [showSwaggerModal, setShowSwaggerModal] = useState(false);
  const [swaggerModalUrl, setSwaggerModalUrl] = useState("");
  const [iframeError, setIframeError] = useState(false);

  // 카드 변경 시 로컬스토리지에 저장
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (error) {
      console.error("Failed to save cards to storage:", error);
    }
  }, [cards]);

  // 컴포넌트 마운트 시 로컬스토리지에서 조회 간격 불러오기
  useEffect(() => {
    const savedInterval = loadRefreshInterval();
    if (savedInterval !== globalRefreshInterval) {
      setGlobalRefreshInterval(savedInterval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 한 번만 실행

  // 전역 조회 간격 변경 시 로컬스토리지에 저장
  useEffect(() => {
    try {
      localStorage.setItem(REFRESH_INTERVAL_KEY, String(globalRefreshInterval));
    } catch (error) {
      console.error("Failed to save refresh interval:", error);
    }
  }, [globalRefreshInterval]);

  // 변경된 카드 ID 변경 시 로컬스토리지에 저장
  useEffect(() => {
    try {
      localStorage.setItem(
        CHANGED_CARD_IDS_KEY,
        JSON.stringify(Array.from(changedCardIds))
      );
    } catch (error) {
      console.error("Failed to save changed card IDs:", error);
    }
  }, [changedCardIds]);

  // 카드 클릭 시 상세 페이지로 이동
  const handleCardClick = (cardName: string, cardId: string) => {
    // 깜빡이는 카드인 경우에만 애니메이션 제거
    if (changedCardIds.has(cardId)) {
      setChangedCardIds((prevIds) => {
        const newSet = new Set(prevIds);
        newSet.delete(cardId);
        return newSet;
      });
    }
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
        const res = await fetch(
          "http://3dpit.iptime.org:18081/api/v1/swagger",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: card.url }),
          }
        );

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

              // 응답이 변경되었고, 자동조회 중인 경우 애니메이션 트리거
              // 디테일 페이지로 이동할 때까지 계속 깜빡임
              if (responseChanged && c.autoRefresh) {
                setChangedCardIds((prevIds) => {
                  const newSet = new Set(prevIds);
                  newSet.add(cardId);
                  return newSet;
                });
              }

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
      name: newCardName.trim(),
      url: newCardUrl.trim(),
      swaggerUrl: newCardSwaggerUrl.trim() || undefined,
      autoRefresh: false,
      loading: false,
      response: null,
      error: null,
      lastUpdated: null,
    };

    setCards((prev) => {
      const updatedCards = [...prev, newCard];
      // 명시적으로 로컬스토리지에 저장
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCards));
      } catch (error) {
        console.error("Failed to save new card to storage:", error);
      }
      return updatedCards;
    });
    setNewCardName("");
    setNewCardUrl("");
    setNewCardSwaggerUrl("");
    setShowAddForm(false);
  };

  const startEditCard = (card: SwaggerCard) => {
    setEditingCardId(card.id);
    setEditCardName(card.name);
    setEditCardUrl(card.url);
    setEditCardSwaggerUrl(card.swaggerUrl || "");
  };

  const cancelEdit = () => {
    setEditingCardId(null);
    setEditCardName("");
    setEditCardUrl("");
    setEditCardSwaggerUrl("");
  };

  const saveEditCard = () => {
    if (!editCardName.trim() || !editCardUrl.trim()) {
      alert("이름과 URL을 모두 입력해주세요.");
      return;
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === editingCardId
          ? {
              ...card,
              name: editCardName.trim(),
              url: editCardUrl.trim(),
              swaggerUrl: editCardSwaggerUrl.trim() || undefined,
            }
          : card
      )
    );
    cancelEdit();
  };

  const openSwaggerModal = (swaggerUrl: string) => {
    setSwaggerModalUrl(swaggerUrl);
    setShowSwaggerModal(true);
    setIframeError(false);
  };

  const closeSwaggerModal = () => {
    setShowSwaggerModal(false);
    setSwaggerModalUrl("");
    setIframeError(false);
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  const openInNewTab = () => {
    window.open(swaggerModalUrl, "_blank", "noopener,noreferrer");
  };

  const deleteCard = (cardId: string) => {
    if (confirm("이 카드를 삭제하시겠습니까?")) {
      // 카드 삭제
      setCards((prev) => prev.filter((card) => card.id !== cardId));
      // 깜빡임 상태도 함께 제거
      setChangedCardIds((prevIds) => {
        const newSet = new Set(prevIds);
        newSet.delete(cardId);
        return newSet;
      });
    }
  };

  // 응답을 보기 좋게 포맷팅하는 함수
  const formatResponse = (
    response: Record<string, unknown> | null
  ): ReactNode | null => {
    if (!response) return null;

    const result: ReactNode[] = [];

    // Info 섹션
    if (response.info && typeof response.info === "object") {
      const info = response.info as Record<string, unknown>;
      result.push(
        <div key="info" className="response-section">
          <h5 className="section-title">📋 API 정보</h5>
          <div className="response-item">
            {info.title != null && String(info.title).trim() !== "" && (
              <div className="response-row">
                <span className="response-label">제목:</span>
                <span className="response-value">{String(info.title)}</span>
              </div>
            )}
            {info.version != null && String(info.version).trim() !== "" && (
              <div className="response-row">
                <span className="response-label">버전:</span>
                <span className="response-value">{String(info.version)}</span>
              </div>
            )}
            {info.description != null &&
              String(info.description).trim() !== "" && (
                <div className="response-row">
                  <span className="response-label">설명:</span>
                  <span className="response-value">
                    {String(info.description)}
                  </span>
                </div>
              )}
          </div>
        </div>
      );
    }

    // Paths 섹션
    if (response.paths && typeof response.paths === "object") {
      const paths = response.paths as Record<string, unknown>;
      const pathEntries = Object.entries(paths);
      if (pathEntries.length > 0) {
        result.push(
          <div key="paths" className="response-section">
            <h5 className="section-title">
              🔗 엔드포인트 ({pathEntries.length}개)
            </h5>
            <div className="endpoints-list">
              {pathEntries.slice(0, 5).map(([path, methods], idx) => {
                if (typeof methods === "object" && methods !== null) {
                  const methodNames = Object.keys(
                    methods as Record<string, unknown>
                  );
                  return (
                    <div key={idx} className="endpoint-item">
                      <div className="endpoint-path-display">{path}</div>
                      <div className="endpoint-methods">
                        {methodNames.map((method) => (
                          <span
                            key={method}
                            className="method-tag"
                            style={{
                              backgroundColor:
                                method === "get"
                                  ? "#61affe"
                                  : method === "post"
                                  ? "#49cc90"
                                  : method === "put"
                                  ? "#fca130"
                                  : method === "delete"
                                  ? "#f93e3e"
                                  : "#50e3c2",
                            }}
                          >
                            {method.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
              {pathEntries.length > 5 && (
                <div className="more-endpoints">
                  + {pathEntries.length - 5}개 더...
                </div>
              )}
            </div>
          </div>
        );
      }
    }

    // Servers 섹션
    if (response.servers && Array.isArray(response.servers)) {
      const servers = response.servers as Array<Record<string, unknown>>;
      if (servers.length > 0) {
        result.push(
          <div key="servers" className="response-section">
            <h5 className="section-title">🌐 서버</h5>
            <div className="servers-list">
              {servers.map((server, idx) => (
                <div key={idx} className="server-item">
                  {server.url != null && String(server.url).trim() !== "" && (
                    <span className="server-url">{String(server.url)}</span>
                  )}
                  {server.description != null &&
                    String(server.description).trim() !== "" && (
                      <span className="server-desc">
                        {String(server.description)}
                      </span>
                    )}
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    // 기타 정보가 있는 경우
    const otherKeys = Object.keys(response).filter(
      (key) => !["info", "paths", "servers"].includes(key)
    );
    if (otherKeys.length > 0 && result.length === 0) {
      // 구조화된 정보가 없으면 간단한 키-값 형태로 표시
      return (
        <div className="response-simple">
          {Object.entries(response)
            .slice(0, 10)
            .map(([key, value], idx) => (
              <div key={idx} className="response-row">
                <span className="response-label">{key}:</span>
                <span className="response-value">
                  {typeof value === "object" && value !== null
                    ? JSON.stringify(value).substring(0, 100) + "..."
                    : String(value ?? "")}
                </span>
              </div>
            ))}
        </div>
      );
    }

    return result.length > 0 ? <>{result}</> : null;
  };

  // 자동 새로고침
  useEffect(() => {
    const intervals: { [key: string]: number } = {};

    cards.forEach((card) => {
      if (card.autoRefresh) {
        intervals[card.id] = setInterval(() => {
          fetchData(card.id);
        }, globalRefreshInterval) as unknown as number;
      }
    });

    return () => {
      Object.values(intervals).forEach((interval) => clearInterval(interval));
    };
  }, [cards, fetchData, globalRefreshInterval]);

  return (
    <div className="app">
      <div className="header">
        <div className="header-left">
          <button className="home-button" onClick={() => navigate("/")}>
            ← 시작화면
          </button>
          <h1>
            <span className="header-icon">📊</span> Swagger API Viewer
          </h1>
        </div>
        <div className="header-right">
          <div className="refresh-interval-control">
            <label className="interval-label-header">조회 간격:</label>
            <select
              className="interval-select-header"
              value={globalRefreshInterval}
              onChange={(e) => setGlobalRefreshInterval(Number(e.target.value))}
            >
              <option value={1000}>1초</option>
              <option value={2000}>2초</option>
              <option value={3000}>3초</option>
              <option value={4000}>4초</option>
              <option value={5000}>5초</option>
              <option value={10000}>10초</option>
              <option value={30000}>30초</option>
              <option value={60000}>1분</option>
              <option value={120000}>2분</option>
              <option value={300000}>5분</option>
              <option value={600000}>10분</option>
            </select>
          </div>
          <button
            className="add-card-button"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "✕ 취소" : "+ 새 카드 추가"}
          </button>
        </div>
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
            <label htmlFor="cardUrl">API URL</label>
            <input
              type="text"
              id="cardUrl"
              placeholder="예: http://3dpit.iptime.org:18081//api-docs/swagger"
              value={newCardUrl}
              onChange={(e) => setNewCardUrl(e.target.value)}
              className="card-url-input"
            />
          </div>
          <div className="form-row">
            <label htmlFor="cardSwaggerUrl">Swagger UI URL (선택사항)</label>
            <input
              type="text"
              id="cardSwaggerUrl"
              placeholder="예: http://3dpit.iptime.org:18081//swagger-ui/index.html"
              value={newCardSwaggerUrl}
              onChange={(e) => setNewCardSwaggerUrl(e.target.value)}
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
          <div
            key={card.id}
            className={`swagger-card ${
              changedCardIds.has(card.id) ? "card-changed" : ""
            }`}
          >
            <div className="card-header">
              <div className="card-title-section">
                {editingCardId === card.id ? (
                  <>
                    <input
                      type="text"
                      value={editCardName}
                      onChange={(e) => setEditCardName(e.target.value)}
                      className="edit-input"
                      placeholder="카드 이름"
                    />
                    <input
                      type="text"
                      value={editCardUrl}
                      onChange={(e) => setEditCardUrl(e.target.value)}
                      className="edit-input"
                      placeholder="API URL"
                    />
                    <input
                      type="text"
                      value={editCardSwaggerUrl}
                      onChange={(e) => setEditCardSwaggerUrl(e.target.value)}
                      className="edit-input"
                      placeholder="Swagger UI URL (선택사항)"
                    />
                  </>
                ) : (
                  <>
                    <h2
                      className="clickable-title"
                      onClick={() => handleCardClick(card.name, card.id)}
                      title="상세 정보 보기"
                    >
                      {card.name} →
                    </h2>
                    <p className="card-url">🔗 {card.url}</p>
                    {card.swaggerUrl && (
                      <p
                        className="card-swagger-url"
                        onClick={() => openSwaggerModal(card.swaggerUrl!)}
                        title="Swagger UI 열기"
                      >
                        📄 Swagger UI 보기
                      </p>
                    )}
                    {card.lastUpdated && (
                      <p className="last-updated">
                        마지막 업데이트: {card.lastUpdated.toLocaleTimeString()}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="card-header-buttons">
                {editingCardId === card.id ? (
                  <>
                    <button
                      className="save-button"
                      onClick={saveEditCard}
                      title="저장"
                    >
                      ✓
                    </button>
                    <button
                      className="cancel-button"
                      onClick={cancelEdit}
                      title="취소"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="edit-button"
                      onClick={() => startEditCard(card)}
                      title="수정"
                    >
                      ✎
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => deleteCard(card.id)}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
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
                      {formatResponse(card.response) || (
                        <pre>{JSON.stringify(card.response, null, 2)}</pre>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Swagger Modal */}
      {showSwaggerModal && (
        <div className="swagger-modal-overlay" onClick={closeSwaggerModal}>
          <div
            className="swagger-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="swagger-modal-header">
              <h3>Swagger UI</h3>
              <button
                className="modal-close-button"
                onClick={closeSwaggerModal}
                title="닫기"
              >
                ✕
              </button>
            </div>
            <div className="swagger-modal-body">
              {iframeError ? (
                <div className="iframe-error-container">
                  <div className="iframe-error-message">
                    <p>⚠️ 이 페이지는 iframe에 표시할 수 없습니다.</p>
                    <p>X-Frame-Options 정책으로 인해 차단되었습니다.</p>
                    <button
                      className="open-new-tab-button"
                      onClick={openInNewTab}
                    >
                      새 탭에서 열기
                    </button>
                  </div>
                </div>
              ) : (
                <object
                  data={swaggerModalUrl}
                  type="text/html"
                  className="swagger-object"
                  title="Swagger UI"
                  onError={handleIframeError}
                >
                  <div className="object-fallback">
                    <p>⚠️ 이 페이지를 표시할 수 없습니다.</p>
                    <button
                      className="open-new-tab-button"
                      onClick={openInNewTab}
                    >
                      새 탭에서 열기
                    </button>
                  </div>
                </object>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <p className="footer-copyright">
          © 2025 Janus Spec View. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
