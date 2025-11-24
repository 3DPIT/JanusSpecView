import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import "./SwaggerViewDetail.css";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

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

interface SchemaChange {
  schemaName: string;
  changeType: string;
  beforeJson: string | null;
  afterJson: string | null;
  beforeData?: {
    name: string;
    rawSchema: string;
    changedFields?: Record<string, string>;
  };
  afterData?: {
    name: string;
    rawSchema: string;
    changedFields?: Record<string, string>;
  };
}

interface DiffDetail {
  summary: DiffLog;
  addedEndpoints: EndpointChange[];
  removedEndpoints: EndpointChange[];
  updatedEndpoints: EndpointChange[];
  addedSchemas?: SchemaChange[];
  removedSchemas?: SchemaChange[];
  updatedSchemas?: SchemaChange[];
  diffJsonSummary: string;
}

export const SwaggerViewDetail = () => {
  const { serviceName } = useParams<{ serviceName: string }>();
  const navigate = useNavigate();
  const [diffLogs, setDiffLogs] = useState<DiffLog[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<DiffDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "chart">("summary");
  const [activeChartTab, setActiveChartTab] = useState<"endpoint" | "schema">(
    "endpoint"
  );
  const [schemaCounts, setSchemaCounts] = useState<
    Record<number, { added: number; removed: number; updated: number }>
  >({});

  const fetchDiffLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `http://3dpit.iptime.org:18081/api/v1/diff/service/${serviceName}?page=0&size=10`
      );
      if (!res.ok) throw new Error("Failed to fetch diff logs");
      const data = await res.json();
      const logs = data.content || [];
      setDiffLogs(logs);

      // 각 diffLog에 대한 스키마 개수 정보 미리 가져오기
      const schemaCountsMap: Record<
        number,
        { added: number; removed: number; updated: number }
      > = {};

      // 병렬로 모든 diffLog의 상세 정보 가져오기
      const detailPromises = logs.map(async (log: DiffLog) => {
        try {
          const detailRes = await fetch(
            `http://3dpit.iptime.org:18081/api/v1/diff/${log.diffLogId}`
          );
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            schemaCountsMap[log.diffLogId] = {
              added: detailData.addedSchemas?.length || 0,
              removed: detailData.removedSchemas?.length || 0,
              updated: detailData.updatedSchemas?.length || 0,
            };
          }
        } catch (err) {
          // 개별 실패는 무시하고 계속 진행
          console.error(
            `Failed to fetch detail for diffLog ${log.diffLogId}:`,
            err
          );
        }
      });

      await Promise.all(detailPromises);
      setSchemaCounts(schemaCountsMap);

      // 자동으로 가장 최신 diffLog 선택
      if (logs.length > 0) {
        fetchDiffDetail(logs[0].diffLogId);
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
      const res = await fetch(
        `http://3dpit.iptime.org:18081/api/v1/diff/${diffLogId}`
      );
      if (!res.ok) throw new Error("Failed to fetch diff detail");
      const data = await res.json();
      setSelectedDiff(data);

      // 스키마 개수 정보 저장
      setSchemaCounts((prev) => ({
        ...prev,
        [diffLogId]: {
          added: data.addedSchemas?.length || 0,
          removed: data.removedSchemas?.length || 0,
          updated: data.updatedSchemas?.length || 0,
        },
      }));
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

  // 엔드포인트 차트 데이터 생성 함수
  const generateEndpointPieChartData = () => {
    if (!selectedDiff) return null;

    const data = [
      selectedDiff.summary.addedCount,
      selectedDiff.summary.removedCount,
      selectedDiff.summary.updatedCount,
    ];

    const backgroundColors = ["#10B981", "#EF4444", "#F59E0B"]; // green, red, yellow

    return {
      labels: ["추가됨", "제거됨", "수정됨"],
      datasets: [
        {
          label: "엔드포인트",
          data: data,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map((color) => `${color}CC`),
          borderWidth: 2,
        },
      ],
    };
  };

  // 스키마 차트 데이터 생성 함수
  const generateSchemaPieChartData = () => {
    if (!selectedDiff) return null;

    const schemaAddedCount = selectedDiff.addedSchemas?.length || 0;
    const schemaRemovedCount = selectedDiff.removedSchemas?.length || 0;
    const schemaUpdatedCount = selectedDiff.updatedSchemas?.length || 0;

    const data = [schemaAddedCount, schemaRemovedCount, schemaUpdatedCount];

    const schemaColors = ["#34d399", "#f87171", "#fbbf24"]; // lighter shades for schema

    return {
      labels: ["추가됨", "제거됨", "수정됨"],
      datasets: [
        {
          label: "스키마",
          data: data,
          backgroundColor: schemaColors,
          borderColor: schemaColors.map((color) => `${color}CC`),
          borderWidth: 2,
        },
      ],
    };
  };

  // 엔드포인트 바 차트 데이터 생성 함수
  const generateEndpointBarChartData = () => {
    if (!selectedDiff) return null;

    const methodCounts: Record<
      string,
      { added: number; removed: number; updated: number }
    > = {};

    const processEndpoints = (
      endpoints: EndpointChange[],
      type: "added" | "removed" | "updated"
    ) => {
      endpoints.forEach((endpoint) => {
        const method = endpoint.httpMethod.toUpperCase();
        if (!methodCounts[method]) {
          methodCounts[method] = { added: 0, removed: 0, updated: 0 };
        }
        methodCounts[method][type]++;
      });
    };

    processEndpoints(selectedDiff.addedEndpoints, "added");
    processEndpoints(selectedDiff.removedEndpoints, "removed");
    processEndpoints(selectedDiff.updatedEndpoints, "updated");

    const labels = Object.keys(methodCounts);
    const addedData = labels.map((label) => methodCounts[label].added);
    const removedData = labels.map((label) => methodCounts[label].removed);
    const updatedData = labels.map((label) => methodCounts[label].updated);

    return {
      labels: labels,
      datasets: [
        {
          label: "추가됨",
          data: addedData,
          backgroundColor: "#10B981",
          borderColor: "#10B981",
          borderWidth: 1,
        },
        {
          label: "제거됨",
          data: removedData,
          backgroundColor: "#EF4444",
          borderColor: "#EF4444",
          borderWidth: 1,
        },
        {
          label: "수정됨",
          data: updatedData,
          backgroundColor: "#F59E0B",
          borderColor: "#F59E0B",
          borderWidth: 1,
        },
      ],
    };
  };

  // 스키마 바 차트 데이터 생성 함수
  const generateSchemaBarChartData = () => {
    if (!selectedDiff) return null;

    const schemaAddedCount = selectedDiff.addedSchemas?.length || 0;
    const schemaRemovedCount = selectedDiff.removedSchemas?.length || 0;
    const schemaUpdatedCount = selectedDiff.updatedSchemas?.length || 0;

    return {
      labels: ["스키마"],
      datasets: [
        {
          label: "추가됨",
          data: [schemaAddedCount],
          backgroundColor: "#34d399",
          borderColor: "#34d399",
          borderWidth: 1,
        },
        {
          label: "제거됨",
          data: [schemaRemovedCount],
          backgroundColor: "#f87171",
          borderColor: "#f87171",
          borderWidth: 1,
        },
        {
          label: "수정됨",
          data: [schemaUpdatedCount],
          backgroundColor: "#fbbf24",
          borderColor: "#fbbf24",
          borderWidth: 1,
        },
      ],
    };
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "rgba(255, 255, 255, 0.9)",
          font: {
            size: 12,
            weight: 600,
          },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "rgba(255, 255, 255, 0.9)",
          font: {
            size: 12,
            weight: 600,
          },
          padding: 15,
        },
      },
      title: {
        display: true,
        text: "HTTP 메서드별 변경 현황",
        color: "rgba(255, 255, 255, 0.9)",
        font: {
          size: 16,
          weight: 700,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "rgba(255, 255, 255, 0.9)",
        bodyColor: "rgba(255, 255, 255, 0.9)",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            size: 11,
            weight: 600,
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
      },
      y: {
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          font: {
            size: 11,
            weight: 600,
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        beginAtZero: true,
      },
    },
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
        <h1>
          <span className="header-icon">📊</span> API 변경 이력 - {serviceName}
        </h1>
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
                      +{log.addedCount} EP
                    </span>
                  )}
                  {log.removedCount > 0 && (
                    <span className="change-badge removed">
                      -{log.removedCount} EP
                    </span>
                  )}
                  {log.updatedCount > 0 && (
                    <span className="change-badge updated">
                      ~{log.updatedCount} EP
                    </span>
                  )}
                  {schemaCounts[log.diffLogId]?.added > 0 && (
                    <span className="change-badge schema-added">
                      +{schemaCounts[log.diffLogId].added} SC
                    </span>
                  )}
                  {schemaCounts[log.diffLogId]?.removed > 0 && (
                    <span className="change-badge schema-removed">
                      -{schemaCounts[log.diffLogId].removed} SC
                    </span>
                  )}
                  {schemaCounts[log.diffLogId]?.updated > 0 && (
                    <span className="change-badge schema-updated">
                      ~{schemaCounts[log.diffLogId].updated} SC
                    </span>
                  )}
                  <span className="total-changes">
                    {log.totalChanges +
                      (schemaCounts[log.diffLogId]
                        ? schemaCounts[log.diffLogId].added +
                          schemaCounts[log.diffLogId].removed +
                          schemaCounts[log.diffLogId].updated
                        : 0)}{" "}
                    변경
                  </span>
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
                <div className="section-header">
                  <h2>📝 변경 요약</h2>
                  <div className="tab-buttons">
                    <button
                      className={`tab-button ${
                        activeTab === "summary" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("summary")}
                    >
                      요약
                    </button>
                    <button
                      className={`tab-button ${
                        activeTab === "chart" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("chart")}
                    >
                      차트
                    </button>
                  </div>
                </div>

                {activeTab === "summary" && (
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
                        <div className="stat-label">엔드포인트 추가</div>
                      </div>
                      <div className="stat-box removed">
                        <div className="stat-number">
                          {selectedDiff.summary.removedCount}
                        </div>
                        <div className="stat-label">엔드포인트 제거</div>
                      </div>
                      <div className="stat-box updated">
                        <div className="stat-number">
                          {selectedDiff.summary.updatedCount}
                        </div>
                        <div className="stat-label">엔드포인트 수정</div>
                      </div>
                      <div className="stat-box total">
                        <div className="stat-number">
                          {selectedDiff.summary.totalChanges}
                        </div>
                        <div className="stat-label">총 엔드포인트 변경</div>
                      </div>
                    </div>
                    {(selectedDiff.addedSchemas ||
                      selectedDiff.removedSchemas ||
                      selectedDiff.updatedSchemas) && (
                      <div className="stats-row schema-stats">
                        <div className="stat-box schema-added">
                          <div className="stat-number">
                            {selectedDiff.addedSchemas?.length || 0}
                          </div>
                          <div className="stat-label">스키마 추가</div>
                        </div>
                        <div className="stat-box schema-removed">
                          <div className="stat-number">
                            {selectedDiff.removedSchemas?.length || 0}
                          </div>
                          <div className="stat-label">스키마 제거</div>
                        </div>
                        <div className="stat-box schema-updated">
                          <div className="stat-number">
                            {selectedDiff.updatedSchemas?.length || 0}
                          </div>
                          <div className="stat-label">스키마 수정</div>
                        </div>
                        <div className="stat-box schema-total">
                          <div className="stat-number">
                            {(selectedDiff.addedSchemas?.length || 0) +
                              (selectedDiff.removedSchemas?.length || 0) +
                              (selectedDiff.updatedSchemas?.length || 0)}
                          </div>
                          <div className="stat-label">총 스키마 변경</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "chart" && (
                  <div className="chart-container">
                    <div className="chart-group">
                      <div className="chart-tabs">
                        <button
                          className={`chart-tab-button ${
                            activeChartTab === "endpoint" ? "active" : ""
                          }`}
                          onClick={() => setActiveChartTab("endpoint")}
                        >
                          📡 엔드포인트
                        </button>
                        {(selectedDiff.addedSchemas ||
                          selectedDiff.removedSchemas ||
                          selectedDiff.updatedSchemas) && (
                          <button
                            className={`chart-tab-button ${
                              activeChartTab === "schema" ? "active" : ""
                            }`}
                            onClick={() => setActiveChartTab("schema")}
                          >
                            📋 스키마
                          </button>
                        )}
                      </div>

                      {activeChartTab === "endpoint" && (
                        <div className="chart-sections-grid">
                          {generateEndpointPieChartData() && (
                            <div className="chart-section">
                              <h3>변경 유형별 분포</h3>
                              <div className="pie-chart-wrapper">
                                <Pie
                                  data={generateEndpointPieChartData()!}
                                  options={pieChartOptions}
                                />
                              </div>
                            </div>
                          )}
                          {generateEndpointBarChartData() && (
                            <div className="chart-section">
                              <h3>HTTP 메서드별 변경 현황</h3>
                              <div className="bar-chart-wrapper">
                                <Bar
                                  data={generateEndpointBarChartData()!}
                                  options={barChartOptions}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeChartTab === "schema" &&
                        (selectedDiff.addedSchemas ||
                          selectedDiff.removedSchemas ||
                          selectedDiff.updatedSchemas) &&
                        generateSchemaPieChartData() && (
                          <div className="chart-sections-grid">
                            <div className="chart-section">
                              <h3>변경 유형별 분포</h3>
                              <div className="pie-chart-wrapper">
                                <Pie
                                  data={generateSchemaPieChartData()!}
                                  options={pieChartOptions}
                                />
                              </div>
                            </div>
                            {generateSchemaBarChartData() && (
                              <div className="chart-section">
                                <h3>변경 현황</h3>
                                <div className="bar-chart-wrapper">
                                  <Bar
                                    data={generateSchemaBarChartData()!}
                                    options={barChartOptions}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                )}
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
                      if (before.summary !== after.summary)
                        changes.push("설명");
                      if (before.operationId !== after.operationId)
                        changes.push("Operation ID");
                      if (before.deprecated !== after.deprecated)
                        changes.push("Deprecated 상태");
                      if (before.requestSchemaName !== after.requestSchemaName)
                        changes.push("Request Schema");
                      if (
                        before.responseSchemaName !== after.responseSchemaName
                      )
                        changes.push("Response Schema");
                    }

                    return (
                      <div key={idx} className="endpoint-card updated">
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

                        {changes.length > 0 && (
                          <div className="changes-indicator">
                            <strong>🔍 변경된 항목:</strong>{" "}
                            {changes.join(", ")}
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
                              <div className="field-label">
                                📥 Request Schema
                              </div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <code>
                                    {before?.requestSchemaName || "없음"}
                                  </code>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <code>
                                    {after?.requestSchemaName || "없음"}
                                  </code>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Response Schema 비교 */}
                          {before?.responseSchemaName !==
                            after?.responseSchemaName && (
                            <div className="field-comparison">
                              <div className="field-label">
                                📤 Response Schema
                              </div>
                              <div className="comparison-row">
                                <div className="before-value">
                                  <code>
                                    {before?.responseSchemaName || "없음"}
                                  </code>
                                </div>
                                <div className="arrow">→</div>
                                <div className="after-value">
                                  <code>
                                    {after?.responseSchemaName || "없음"}
                                  </code>
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

              {/* 추가된 스키마 */}
              {selectedDiff.addedSchemas &&
                selectedDiff.addedSchemas.length > 0 && (
                  <div className="endpoints-section">
                    <h2>
                      ✅ 추가된 스키마 ({selectedDiff.addedSchemas.length})
                    </h2>
                    {selectedDiff.addedSchemas.map((schema, idx) => (
                      <div key={idx} className="schema-card added">
                        <div className="schema-header">
                          <span className="schema-name">
                            {schema.schemaName}
                          </span>
                        </div>
                        {schema.afterData && (
                          <div className="schema-details">
                            <div className="schema-json">
                              <pre>
                                {(() => {
                                  try {
                                    return JSON.stringify(
                                      JSON.parse(schema.afterData!.rawSchema),
                                      null,
                                      2
                                    );
                                  } catch {
                                    return schema.afterData!.rawSchema;
                                  }
                                })()}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {/* 제거된 스키마 */}
              {selectedDiff.removedSchemas &&
                selectedDiff.removedSchemas.length > 0 && (
                  <div className="endpoints-section">
                    <h2>
                      ❌ 제거된 스키마 ({selectedDiff.removedSchemas.length})
                    </h2>
                    {selectedDiff.removedSchemas.map((schema, idx) => (
                      <div key={idx} className="schema-card removed">
                        <div className="schema-header">
                          <span className="schema-name">
                            {schema.schemaName}
                          </span>
                        </div>
                        {schema.beforeData && (
                          <div className="schema-details">
                            <div className="schema-json">
                              <pre>
                                {(() => {
                                  try {
                                    return JSON.stringify(
                                      JSON.parse(schema.beforeData!.rawSchema),
                                      null,
                                      2
                                    );
                                  } catch {
                                    return schema.beforeData!.rawSchema;
                                  }
                                })()}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              {/* 수정된 스키마 */}
              {selectedDiff.updatedSchemas &&
                selectedDiff.updatedSchemas.length > 0 && (
                  <div className="endpoints-section">
                    <h2>
                      🔄 수정된 스키마 ({selectedDiff.updatedSchemas.length})
                    </h2>
                    {selectedDiff.updatedSchemas.map((schema, idx) => {
                      const before = schema.beforeData;
                      const after = schema.afterData;

                      return (
                        <div key={idx} className="schema-card updated">
                          <div className="schema-header">
                            <span className="schema-name">
                              {schema.schemaName}
                            </span>
                          </div>

                          {before?.changedFields && after?.changedFields && (
                            <div className="schema-changes">
                              <div className="changes-indicator">
                                <strong>🔍 변경된 필드:</strong>{" "}
                                {Object.keys(before.changedFields).join(", ")}
                              </div>
                            </div>
                          )}

                          <div className="schema-comparison">
                            {before && after && (
                              <>
                                <div className="schema-before">
                                  <div className="schema-label">
                                    이전 스키마:
                                  </div>
                                  <div className="schema-json">
                                    <pre>
                                      {(() => {
                                        try {
                                          return JSON.stringify(
                                            JSON.parse(before.rawSchema),
                                            null,
                                            2
                                          );
                                        } catch {
                                          return before.rawSchema;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                </div>
                                <div className="schema-after">
                                  <div className="schema-label">
                                    이후 스키마:
                                  </div>
                                  <div className="schema-json">
                                    <pre>
                                      {(() => {
                                        try {
                                          return JSON.stringify(
                                            JSON.parse(after.rawSchema),
                                            null,
                                            2
                                          );
                                        } catch {
                                          return after.rawSchema;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {before?.changedFields && after?.changedFields && (
                            <div className="field-changes-detail">
                              <h4>필드별 변경사항:</h4>
                              {Object.keys(before.changedFields).map(
                                (fieldName) => (
                                  <div
                                    key={fieldName}
                                    className="field-change-item"
                                  >
                                    <div className="field-name">
                                      {fieldName}
                                    </div>
                                    <div className="field-comparison-row">
                                      <div className="before-value">
                                        <span className="label">이전:</span>
                                        <code>
                                          {(() => {
                                            try {
                                              return JSON.stringify(
                                                JSON.parse(
                                                  before.changedFields![
                                                    fieldName
                                                  ]
                                                ),
                                                null,
                                                2
                                              );
                                            } catch {
                                              return before.changedFields![
                                                fieldName
                                              ];
                                            }
                                          })()}
                                        </code>
                                      </div>
                                      <div className="arrow">→</div>
                                      <div className="after-value">
                                        <span className="label">이후:</span>
                                        <code>
                                          {(() => {
                                            try {
                                              return JSON.stringify(
                                                JSON.parse(
                                                  after.changedFields![
                                                    fieldName
                                                  ]
                                                ),
                                                null,
                                                2
                                              );
                                            } catch {
                                              return after.changedFields![
                                                fieldName
                                              ];
                                            }
                                          })()}
                                        </code>
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="detail-footer">
        <p className="footer-copyright">
          © 2025 Janus Spec View. All rights reserved.
        </p>
      </footer>
    </div>
  );
};
