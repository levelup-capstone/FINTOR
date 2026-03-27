# 1. Node.js 22 알파인 버전
FROM node:22-alpine

# 2. 작업 폴더 지정
WORKDIR /app

# 3. 패키지 파일 복사 및 설치 (캐시 최적화)
COPY package.json package-lock.json* ./
RUN npm install

# 4. 프론트엔드 소스 코드 복사
COPY . .

# 5. Vite 개발 서버 실행
CMD ["npm", "run", "dev"]