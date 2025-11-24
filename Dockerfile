# 1단계: 빌드 환경 설정
FROM node:18 AS build
LABEL solution=pwm
LABEL category=frontend
WORKDIR /app

# pnpm 준비 및 캐시 분리
RUN corepack enable && corepack prepare pnpm@latest --activate
#COPY pnpm-lock.yaml ./

# 전체 소스 코드 복사 및 install & build
COPY . .
RUN npm ci && npm run build

# 2단계: nginx를 이용한 정적 파일 서빙
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]
