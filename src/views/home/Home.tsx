import { useNavigate } from "react-router-dom";
import "./Home.css";

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="background-animation">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>

      <div className="content">
        <div className="logo-container">
          <div className="logo-ring">
            <div className="logo-inner">
              <svg
                className="swagger-icon"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  fill="url(#gradient1)"
                  className="animate-pulse-slow"
                />
                <path
                  d="M2 17L12 22L22 17L12 12L2 17Z"
                  fill="url(#gradient2)"
                  className="animate-pulse-slow"
                />
                <path
                  d="M2 12L12 17L22 12"
                  stroke="url(#gradient3)"
                  strokeWidth="2"
                  className="animate-pulse-slow"
                />
                <defs>
                  <linearGradient id="gradient1" x1="2" y1="7" x2="22" y2="7">
                    <stop offset="0%" stopColor="#646cff" />
                    <stop offset="100%" stopColor="#535bf2" />
                  </linearGradient>
                  <linearGradient id="gradient2" x1="2" y1="17" x2="22" y2="17">
                    <stop offset="0%" stopColor="#535bf2" />
                    <stop offset="100%" stopColor="#646cff" />
                  </linearGradient>
                  <linearGradient id="gradient3" x1="2" y1="12" x2="22" y2="12">
                    <stop offset="0%" stopColor="#646cff" />
                    <stop offset="100%" stopColor="#535bf2" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>

        <h1 className="title">
          <span className="title-main">Janus Spec View</span>
          <span className="title-sub">Swagger API Documentation Viewer</span>
        </h1>

        <p className="description">실시간 API 문서를 확인하고 관리하세요</p>

        <button
          className="cta-button"
          onClick={() => navigate("/swagger-view")}
        >
          <span className="button-content">
            <span className="button-icon">🚀</span>
            <span className="button-text">시작하기</span>
            <span className="button-arrow">→</span>
          </span>
          <div className="button-glow"></div>
        </button>

        <div className="features">
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <div className="feature-text">실시간 조회</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔄</div>
            <div className="feature-text">자동 새로고침</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <div className="feature-text">직관적인 UI</div>
          </div>
        </div>

        <footer className="home-footer">
          <p className="footer-created">
            Created by <span className="creator-name">BLACK</span>
          </p>
          <p className="footer-copyright">
            © 2025 Janus Spec View. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};
