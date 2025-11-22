import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./SwaggerViewDetail.css";

interface DiffLog {
  diffLogId: number;
  serviceName: string;
  oldVersionId: number;
  oldVersionTag: string;
  newVersionId: number;
  newVersionTag: string;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  totalChanges: number;
  createdAt: string;
}

interface EndpointChange {
  path: string;
  httpMethod: string;
  changeType: string;
  beforeJson: string | null;
  afterJson: string | null;
  afterData?: {
    path: string;
    summary: string;
    deprecated: boolean;
    httpMethod: string;
    operationId: string;
    requestSchemaName: string;
    responseSchemaName: string;
  };
  beforeData?: {
    path: string;
    summary: string;
    deprecated: boolean;
    httpMethod: string;
    operationId: string;
    requestSchemaName: string;
    responseSchemaName: string;
  };
}

interface DiffDetail {
  summary: DiffLog;
  addedEndpoints: EndpointChange[];
  removedEndpoints: EndpointChange[];
  updatedEndpoints: EndpointChange[];
  diffJsonSummary: string;
}

export const SwaggerViewDetail = () => {
  const { serviceName } = useParams<{ serviceName: string }>();
  const navigate = useNavigate();
  const [diffLogs, setDiffLogs] = useState<DiffLog[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<DiffDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDiffLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `http://localhost:8080/api/v1/diff/service/${serviceName}?page=0&size=10`
      );
      if (!res.ok) throw new Error("Failed to fetch diff logs");
      const data = await res.json();
      setDiffLogs(data.content || []);

      // 자동으로 가장 최신 diffLog 선택
      if (data.content && data.content.length > 0) {
        fetchDiffDetail(data.content[0].diffLogId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceName) {
      fetchDiffLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceName]);

  const fetchDiffDetail = async (diffLogId: number) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8080/api/v1/diff/${diffLogId}`);
      if (!res.ok) throw new Error("Failed to fetch diff detail");
      const data = await res.json();
      setSelectedDiff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching detail");
    } finally {
      setLoading(false);
    }
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      get: "#61affe",
      post: "#49cc90",
      put: "#fca130",
      delete: "#f93e3e",
      patch: "#50e3c2",
    };
    return colors[method.toLowerCase()] || "#999";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="detail-container">
      <div className="detail-header">
        <button
          className="back-button"
          onClick={() => navigate("/swagger-view")}
        >
          ← 뒤로가기
        </button>
        <h1>📊 API 변경 이력 - {serviceName}</h1>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span> {error}
        </div>
      )}

      <div className="detail-content">
        {/* 왼쪽: Diff Log 리스트 */}
        <aside className="diff-logs-sidebar">
          <h2>변경 이력</h2>
          {loading && !selectedDiff && <p className="loading">로딩 중...</p>}
          <div className="diff-logs-list">
            {diffLogs.map((log) => (
              <div
                key={log.diffLogId}
                className={`diff-log-card ${
                  selectedDiff?.summary.diffLogId === log.diffLogId
                    ? "active"
                    : ""
                }`}
                onClick={() => fetchDiffDetail(log.diffLogId)}
              >
                <div className="log-header">
                  <span className="log-id">#{log.diffLogId}</span>
                  <span className="log-date">{formatDate(log.createdAt)}</span>
                </div>
                <div className="version-info">
                  <span className="version-badge old">{log.oldVersionTag}</span>
                  <span className="arrow">→</span>
                  <span className="version-badge new">{log.newVersionTag}</span>
                </div>
                <div className="changes-summary">
                  {log.addedCount > 0 && (
                    <span className="change-badge added">
                      +{log.addedCount}
                    </span>
                  )}
                  {log.removedCount > 0 && (
                    <span className="change-badge removed">
                      -{log.removedCount}
                    </span>
                  )}
                  {log.updatedCount > 0 && (
                    <span className="change-badge updated">
                      ~{log.updatedCount}
                    </span>
                  )}
                  <span className="total-changes">{log.totalChanges} 변경</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 오른쪽: 상세 정보 */}
        <main className="diff-detail-main">
          {loading && <p className="loading">로딩 중...</p>}
          {selectedDiff && !loading && (
            <>
              <div className="summary-section">
                <h2>📝 변경 요약</h2>
                <div className="summary-card">
                  <div className="summary-row">
                    <div className="summary-item">
                      <label>서비스</label>
                      <span className="value">
                        {selectedDiff.summary.serviceName}
                      </span>
                    </div>
                    <div className="summary-item">
                      <label>변경 ID</label>
                      <span className="value">
                        #{selectedDiff.summary.diffLogId}
                      </span>
                    </div>
                    <div className="summary-item">
                      <label>생성 시간</label>
                      <span className="value">
                        {formatDate(selectedDiff.summary.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="summary-row">
                    <div className="summary-item">
                      <label>이전 버전</label>
                      <span className="version-tag">
                        {selectedDiff.summary.oldVersionTag}
                      </span>
                    </div>
                    <div className="summary-item">
                      <label>새 버전</label>
                      <span className="version-tag">
                        {selectedDiff.summary.newVersionTag}
                      </span>
                    </div>
                  </div>
                  <div className="stats-row">
                    <div className="stat-box added">
                      <div className="stat-number">
                        {selectedDiff.summary.addedCount}
                      </div>
                      <div className="stat-label">추가됨</div>
                    </div>
                    <div className="stat-box removed">
                      <div className="stat-number">
                        {selectedDiff.summary.removedCount}
                      </div>
                      <div className="stat-label">제거됨</div>
                    </div>
                    <div className="stat-box updated">
                      <div className="stat-number">
                        {selectedDiff.summary.updatedCount}
                      </div>
                      <div className="stat-label">수정됨</div>
                    </div>
                    <div className="stat-box total">
                      <div className="stat-number">
                        {selectedDiff.summary.totalChanges}
                      </div>
                      <div className="stat-label">총 변경</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 추가된 엔드포인트 */}
              {selectedDiff.addedEndpoints.length > 0 && (
                <div className="endpoints-section">
                  <h2>
                    ✅ 추가된 엔드포인트 ({selectedDiff.addedEndpoints.length})
                  </h2>
                  {selectedDiff.addedEndpoints.map((endpoint, idx) => (
                    <div key={idx} className="endpoint-card added">
                      <div className="endpoint-header">
                        <span
                          className="method-badge"
                          style={{
                            backgroundColor: getMethodColor(
                              endpoint.httpMethod
                            ),
                          }}
                        >
                          {endpoint.httpMethod.toUpperCase()}
                        </span>
                        <span className="endpoint-path">{endpoint.path}</span>
                      </div>
                      {endpoint.afterData && (
                        <div className="endpoint-details">
                          <p className="endpoint-summary">
                            📋 {endpoint.afterData.summary || "설명 없음"}
                          </p>
                          <div className="endpoint-meta">
                            <span>
                              Operation ID:{" "}
                              <code>{endpoint.afterData.operationId}</code>
                            </span>
                            {endpoint.afterData.deprecated && (
                              <span className="deprecated-badge">
                                ⚠️ Deprecated
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 제거된 엔드포인트 */}
              {selectedDiff.removedEndpoints.length > 0 && (
                <div className="endpoints-section">
                  <h2>
                    ❌ 제거된 엔드포인트 ({selectedDiff.removedEndpoints.length}
                    )
                  </h2>
                  {selectedDiff.removedEndpoints.map((endpoint, idx) => (
                    <div key={idx} className="endpoint-card removed">
                      <div className="endpoint-header">
                        <span
                          className="method-badge"
                          style={{
                            backgroundColor: getMethodColor(
                              endpoint.httpMethod
                            ),
                          }}
                        >
                          {endpoint.httpMethod.toUpperCase()}
                        </span>
                        <span className="endpoint-path">{endpoint.path}</span>
                      </div>
                      {endpoint.beforeData && (
                        <div className="endpoint-details">
                          <p className="endpoint-summary">
                            📋 {endpoint.beforeData.summary || "설명 없음"}
                          </p>
                          <div className="endpoint-meta">
                            <span>
                              Operation ID:{" "}
                              <code>{endpoint.beforeData.operationId}</code>
                            </span>
                            {endpoint.beforeData.deprecated && (
                              <span className="deprecated-badge">
                                ⚠️ Deprecated
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 수정된 엔드포인트 */}
              {selectedDiff.updatedEndpoints.length > 0 && (
                <div className="endpoints-section">
                  <h2>
                    🔄 수정된 엔드포인트 ({selectedDiff.updatedEndpoints.length}
                    )
                  </h2>
                  {selectedDiff.updatedEndpoints.map((endpoint, idx) => {
                    const before = endpoint.beforeData;
                    const after = endpoint.afterData;
                    const changes: string[] = [];

                    // 변경사항 감지
                    if (before && after) {
                      if (before.summary !== after.summary) changes.push("설명");
                      if (before.operationId !== after.operationId)
                        changes.push("Operation ID");
                      if (before.deprecated !== after.deprecated)
                        changes.push("Deprecated 상태");
                      if (before.requestSchemaName !== after.requestSchemaName)
                        changes.push("Request Schema");
                      if (before.responseSchemaName !== after.responseSchemaName)
                        changes.push("Response Schema");
                    }

                    return (
                      <div key={idx} className="endpoint-card updated">
                        <div className="endpoint-header">
                          <span
                            className="method-badge"
                            style={{
                              backgroundColor: getMethodColor(endpoint.httpMethod),
                            }}
                          >
                            {endpoint.httpMethod.toUpperCase()}
                          </span>
                          <span className="endpoint-path">{endpoint.path}</span>
                        </div>

                        {changes.length > 0 && (
                          <div className="changes-indicator">
                            <strong>🔍 변경된 항목:</strong> {changes.join(", ")}
                          </div>
                        )}

                        <div className="detailed-comparison">
                          {/* Summary 비교 */}
                          {before?.summary !== after?.summary && (
                            <div className="field-comparison">
                              <div className="field-label">📋 설명</div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <span className="label">이전:</span>
                                  <span className="value">
                                    {before?.summary || "없음"}
                                  </span>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <span className="label">이후:</span>
                                  <span className="value">
                                    {after?.summary || "없음"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Operation ID 비교 */}
                          {before?.operationId !== after?.operationId && (
                            <div className="field-comparison">
                              <div className="field-label">🔑 Operation ID</div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <code>{before?.operationId || "없음"}</code>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <code>{after?.operationId || "없음"}</code>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Deprecated 상태 비교 */}
                          {before?.deprecated !== after?.deprecated && (
                            <div className="field-comparison">
                              <div className="field-label">⚠️ Deprecated</div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <span
                                    className={
                                      before?.deprecated
                                        ? "deprecated-yes"
                                        : "deprecated-no"
                                    }
                                  >
                                    {before?.deprecated ? "예" : "아니오"}
                                  </span>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <span
                                    className={
                                      after?.deprecated
                                        ? "deprecated-yes"
                                        : "deprecated-no"
                                    }
                                  >
                                    {after?.deprecated ? "예" : "아니오"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Request Schema 비교 */}
                          {before?.requestSchemaName !==
                            after?.requestSchemaName && (
                            <div className="field-comparison">
                              <div className="field-label">📥 Request Schema</div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <code>{before?.requestSchemaName || "없음"}</code>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <code>{after?.requestSchemaName || "없음"}</code>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Response Schema 비교 */}
                          {before?.responseSchemaName !==
                            after?.responseSchemaName && (
                            <div className="field-comparison">
                              <div className="field-label">📤 Response Schema</div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <code>
                                    {before?.responseSchemaName || "없음"}
                                  </code>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <code>{after?.responseSchemaName || "없음"}</code>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
