 """
일단 python seed.py가 안돼서 portfolio_templates에 값을 넣고 싶으면
cd backend 한뒤에
docker exec -it fintor-backend python seed.py
적으면 seed값 들어감
포트폴리오 템플릿 시드 스크립트
실행: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from database import get_db
from models import PortfolioTemplate

TEMPLATES = [
    # ===== Level 1: 안정형 (10개) =====
    {
        "risk_level": 1, "profile_id": "l1-deposit-heavy",
        "title": "예금·적금 집중 전략",
        "description": "원금 보존 최우선. 예금과 채권 중심에 금과 현금을 더해 안정성을 강화합니다.",
        "tags": ["deposit", "bonds", "gold", "krw"],
        "allocations": [
            {"asset": "deposit", "ratio": 50},
            {"asset": "bonds",   "ratio": 25},
            {"asset": "gold",    "ratio": 15},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-bond-focus",
        "title": "채권 중심 안정 전략",
        "description": "채권 비중을 높이고 예금·금·현금으로 분산해 안정적인 이자 수익을 기대합니다.",
        "tags": ["bonds", "deposit", "gold", "krw"],
        "allocations": [
            {"asset": "bonds",   "ratio": 50},
            {"asset": "deposit", "ratio": 25},
            {"asset": "gold",    "ratio": 15},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-cash-hold",
        "title": "현금 보유 우선 전략",
        "description": "유동성 확보를 최우선으로 현금·예금에 채권과 금을 더해 분산합니다.",
        "tags": ["krw", "deposit", "bonds", "gold"],
        "allocations": [
            {"asset": "krw",     "ratio": 40},
            {"asset": "deposit", "ratio": 30},
            {"asset": "bonds",   "ratio": 20},
            {"asset": "gold",    "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-gold-hedge",
        "title": "금 헤지 안정 전략",
        "description": "인플레이션 방어를 위해 금을 핵심으로 예금·채권·현금으로 구성한 초안전 포트폴리오입니다.",
        "tags": ["gold", "deposit", "bonds", "krw"],
        "allocations": [
            {"asset": "gold",    "ratio": 30},
            {"asset": "deposit", "ratio": 35},
            {"asset": "bonds",   "ratio": 25},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-short-bond",
        "title": "단기채 중심 전략",
        "description": "단기 채권 위주로 금리 변동 리스크를 최소화하고 예금·금·현금으로 보완합니다.",
        "tags": ["bonds", "deposit", "gold", "krw"],
        "allocations": [
            {"asset": "bonds",   "ratio": 55},
            {"asset": "deposit", "ratio": 25},
            {"asset": "gold",    "ratio": 10},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-origin-preserve",
        "title": "원금 보존 혼합 전략",
        "description": "예금·채권·금·현금의 4각 구성으로 원금 손실 리스크를 최소화합니다.",
        "tags": ["deposit", "bonds", "gold", "krw"],
        "allocations": [
            {"asset": "deposit", "ratio": 45},
            {"asset": "bonds",   "ratio": 30},
            {"asset": "gold",    "ratio": 15},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-gold-bond",
        "title": "금·채권 헤지 전략",
        "description": "금과 채권으로 침체·인플레이션에 동시 대응하고 예금·현금으로 유동성을 확보합니다.",
        "tags": ["gold", "bonds", "deposit", "krw"],
        "allocations": [
            {"asset": "gold",    "ratio": 25},
            {"asset": "bonds",   "ratio": 40},
            {"asset": "deposit", "ratio": 25},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-ultra-safe",
        "title": "초안정 예금형 전략",
        "description": "예금 비중을 극대화하고 채권·금·현금으로 분산해 변동성 없는 수익을 목표로 합니다.",
        "tags": ["deposit", "bonds", "gold", "krw"],
        "allocations": [
            {"asset": "deposit", "ratio": 55},
            {"asset": "bonds",   "ratio": 25},
            {"asset": "gold",    "ratio": 10},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-bond-deposit",
        "title": "채권 우선 안정 전략",
        "description": "채권을 주축으로 예금·금·현금을 보조 자산으로 구성한 안전 포트폴리오입니다.",
        "tags": ["bonds", "deposit", "gold", "krw"],
        "allocations": [
            {"asset": "bonds",   "ratio": 40},
            {"asset": "deposit", "ratio": 35},
            {"asset": "gold",    "ratio": 10},
            {"asset": "krw",     "ratio": 15},
        ],
    },
    {
        "risk_level": 1, "profile_id": "l1-multi-safe",
        "title": "4자산 분산 안정 전략",
        "description": "예금·채권·금·현금의 4가지 안전자산으로 분산하는 포트폴리오입니다.",
        "tags": ["deposit", "bonds", "gold", "krw"],
        "allocations": [
            {"asset": "deposit", "ratio": 35},
            {"asset": "bonds",   "ratio": 30},
            {"asset": "gold",    "ratio": 20},
            {"asset": "krw",     "ratio": 15},
        ],
    },

    # ===== Level 2: 안정추구형 (10개) =====
    {
        "risk_level": 2, "profile_id": "l2-bluechip-touch",
        "title": "배당주 소량 포함 전략",
        "description": "안전자산 중심에 배당 우량주를 소량 편입해 수익성을 높였습니다.",
        "tags": ["deposit", "bonds", "bluechip-stock"],
        "allocations": [
            {"asset": "deposit",        "ratio": 40},
            {"asset": "bonds",          "ratio": 35},
            {"asset": "bluechip-stock", "ratio": 15},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-etf-intro",
        "title": "ETF 입문 안정 전략",
        "description": "처음 ETF를 접하는 투자자를 위해 소량만 편입한 안정 포트폴리오입니다.",
        "tags": ["deposit", "bonds", "etf"],
        "allocations": [
            {"asset": "deposit", "ratio": 35},
            {"asset": "bonds",   "ratio": 35},
            {"asset": "etf",     "ratio": 20},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-bond-bluechip",
        "title": "채권·배당주 혼합 전략",
        "description": "채권의 안정성과 배당주의 수익성을 균형 있게 조합했습니다.",
        "tags": ["bonds", "bluechip-stock", "deposit"],
        "allocations": [
            {"asset": "bonds",          "ratio": 45},
            {"asset": "bluechip-stock", "ratio": 25},
            {"asset": "deposit",        "ratio": 20},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-gold-bluechip",
        "title": "금·배당주 방어 전략",
        "description": "금으로 인플레이션을 방어하면서 배당주로 소폭 수익을 추구합니다.",
        "tags": ["deposit", "bonds", "gold", "bluechip-stock"],
        "allocations": [
            {"asset": "deposit",        "ratio": 40},
            {"asset": "bonds",          "ratio": 30},
            {"asset": "gold",           "ratio": 20},
            {"asset": "bluechip-stock", "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-index-safe",
        "title": "인덱스 소량 편입 전략",
        "description": "안전자산을 기반으로 인덱스 ETF를 소량 편입해 시장 수익을 추구합니다.",
        "tags": ["deposit", "bonds", "etf"],
        "allocations": [
            {"asset": "deposit", "ratio": 45},
            {"asset": "bonds",   "ratio": 35},
            {"asset": "etf",     "ratio": 15},
            {"asset": "krw",     "ratio":  5},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-bluechip-focus",
        "title": "우량주 중심 안정추구 전략",
        "description": "시가총액 상위 배당주를 중심으로 안정적인 수익을 추구합니다.",
        "tags": ["deposit", "bonds", "bluechip-stock"],
        "allocations": [
            {"asset": "deposit",        "ratio": 35},
            {"asset": "bonds",          "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 25},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-etf-bond",
        "title": "ETF·채권 혼합 전략",
        "description": "ETF와 채권을 균등하게 배분해 안정성과 시장 참여를 동시에 추구합니다.",
        "tags": ["bonds", "etf", "deposit"],
        "allocations": [
            {"asset": "bonds",   "ratio": 40},
            {"asset": "etf",     "ratio": 25},
            {"asset": "deposit", "ratio": 25},
            {"asset": "krw",     "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-dividend-deposit",
        "title": "배당주 중심 안정추구 전략",
        "description": "고배당 우량주와 예금을 조합해 꾸준한 인컴 수익을 목표로 합니다.",
        "tags": ["bluechip-stock", "deposit", "bonds"],
        "allocations": [
            {"asset": "bluechip-stock", "ratio": 30},
            {"asset": "deposit",        "ratio": 35},
            {"asset": "bonds",          "ratio": 25},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-gold-etf",
        "title": "금·ETF 소량 포함 전략",
        "description": "금으로 방어하고 ETF로 성장을 소폭 추구하는 균형 잡힌 안정 전략입니다.",
        "tags": ["etf", "deposit", "bonds", "gold"],
        "allocations": [
            {"asset": "etf",     "ratio": 25},
            {"asset": "deposit", "ratio": 35},
            {"asset": "bonds",   "ratio": 30},
            {"asset": "gold",    "ratio": 10},
        ],
    },
    {
        "risk_level": 2, "profile_id": "l2-multi-stable",
        "title": "우량주·ETF 복합 안정 전략",
        "description": "예금·채권 기반에 우량주와 ETF를 고루 편입해 분산 효과를 극대화합니다.",
        "tags": ["deposit", "bonds", "bluechip-stock", "etf"],
        "allocations": [
            {"asset": "deposit",        "ratio": 30},
            {"asset": "bonds",          "ratio": 35},
            {"asset": "bluechip-stock", "ratio": 20},
            {"asset": "etf",            "ratio": 15},
        ],
    },

    # ===== Level 3: 위험중립형 (10개) =====
    {
        "risk_level": 3, "profile_id": "l3-classic-6040",
        "title": "클래식 60/40 균형 전략",
        "description": "주식 60%, 채권 40%의 전통적 자산배분 모델을 기반으로 합니다.",
        "tags": ["bluechip-stock", "etf", "bonds"],
        "allocations": [
            {"asset": "bluechip-stock", "ratio": 35},
            {"asset": "etf",            "ratio": 25},
            {"asset": "bonds",          "ratio": 30},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-etf-balance",
        "title": "ETF 균형 전략",
        "description": "인덱스 ETF를 주축으로 채권과 우량주를 보조 편입한 균형형입니다.",
        "tags": ["etf", "bonds", "bluechip-stock"],
        "allocations": [
            {"asset": "etf",            "ratio": 40},
            {"asset": "bonds",          "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 20},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-value-growth",
        "title": "가치·성장 혼합 전략",
        "description": "우량주(가치)와 성장주를 혼합해 안정성과 성장성을 동시에 추구합니다.",
        "tags": ["bluechip-stock", "bonds", "growth-stock"],
        "allocations": [
            {"asset": "bluechip-stock", "ratio": 35},
            {"asset": "bonds",          "ratio": 30},
            {"asset": "growth-stock",   "ratio": 20},
            {"asset": "deposit",        "ratio": 15},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-dividend-growth",
        "title": "배당·성장 균형 전략",
        "description": "배당 우량주와 성장주, ETF, 채권을 고루 담아 균형을 추구합니다.",
        "tags": ["bluechip-stock", "growth-stock", "bonds", "etf"],
        "allocations": [
            {"asset": "bluechip-stock", "ratio": 30},
            {"asset": "growth-stock",   "ratio": 25},
            {"asset": "bonds",          "ratio": 25},
            {"asset": "etf",            "ratio": 20},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-gold-balance",
        "title": "금 포함 균형 전략",
        "description": "ETF·우량주·채권·금으로 경기 사이클에 강한 균형 포트폴리오입니다.",
        "tags": ["etf", "bluechip-stock", "bonds", "gold"],
        "allocations": [
            {"asset": "etf",            "ratio": 35},
            {"asset": "bluechip-stock", "ratio": 25},
            {"asset": "bonds",          "ratio": 25},
            {"asset": "gold",           "ratio": 15},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-growth-neutral",
        "title": "성장 포함 균형 전략",
        "description": "성장주를 25% 편입해 수익 잠재력을 높인 위험중립형 포트폴리오입니다.",
        "tags": ["growth-stock", "etf", "bonds", "bluechip-stock"],
        "allocations": [
            {"asset": "growth-stock",   "ratio": 25},
            {"asset": "etf",            "ratio": 30},
            {"asset": "bonds",          "ratio": 25},
            {"asset": "bluechip-stock", "ratio": 20},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-index-core",
        "title": "인덱스 코어 전략",
        "description": "ETF를 핵심 자산으로 채권과 우량주가 보조하는 인덱스 중심 전략입니다.",
        "tags": ["etf", "bonds", "bluechip-stock", "deposit"],
        "allocations": [
            {"asset": "etf",            "ratio": 35},
            {"asset": "bonds",          "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 20},
            {"asset": "deposit",        "ratio": 15},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-allweather",
        "title": "올웨더 균형 전략",
        "description": "레이 달리오 All Weather 개념을 참고한 경기 사이클 무관 분산 전략입니다.",
        "tags": ["gold", "etf", "bonds", "bluechip-stock"],
        "allocations": [
            {"asset": "gold",           "ratio": 20},
            {"asset": "etf",            "ratio": 30},
            {"asset": "bonds",          "ratio": 25},
            {"asset": "bluechip-stock", "ratio": 25},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-growth-safe",
        "title": "성장·안전 50/50 전략",
        "description": "성장자산(ETF+성장주)과 안전자산(채권+현금)을 50:50으로 유지합니다.",
        "tags": ["growth-stock", "etf", "bonds"],
        "allocations": [
            {"asset": "growth-stock", "ratio": 30},
            {"asset": "etf",          "ratio": 30},
            {"asset": "bonds",        "ratio": 25},
            {"asset": "krw",          "ratio": 15},
        ],
    },
    {
        "risk_level": 3, "profile_id": "l3-multi-neutral",
        "title": "5자산 분산 균형 전략",
        "description": "5가지 자산에 고루 분산해 변동성을 낮춘 균형 잡힌 포트폴리오입니다.",
        "tags": ["bluechip-stock", "growth-stock", "etf", "bonds", "deposit"],
        "allocations": [
            {"asset": "bluechip-stock", "ratio": 30},
            {"asset": "growth-stock",   "ratio": 20},
            {"asset": "etf",            "ratio": 25},
            {"asset": "bonds",          "ratio": 15},
            {"asset": "deposit",        "ratio": 10},
        ],
    },

    # ===== Level 4: 적극투자형 (10개) =====
    {
        "risk_level": 4, "profile_id": "l4-growth-focus",
        "title": "성장주 집중 전략",
        "description": "고성장 기업 중심으로 공격적인 자본 이득을 추구하는 포트폴리오입니다.",
        "tags": ["growth-stock", "etf", "bluechip-stock"],
        "allocations": [
            {"asset": "growth-stock",   "ratio": 45},
            {"asset": "etf",            "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 15},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-etf-aggressive",
        "title": "ETF 중심 공격 전략",
        "description": "성장 섹터 ETF를 주축으로 수익률 극대화를 노리는 적극적 포트폴리오입니다.",
        "tags": ["etf", "growth-stock", "bluechip-stock"],
        "allocations": [
            {"asset": "etf",            "ratio": 45},
            {"asset": "growth-stock",   "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 15},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-coin-touch",
        "title": "코인 소량 편입 전략",
        "description": "성장주·ETF 중심에 암호화폐를 소량 편입해 수익 기회를 확장합니다.",
        "tags": ["growth-stock", "etf", "coin", "bluechip-stock"],
        "allocations": [
            {"asset": "growth-stock",   "ratio": 40},
            {"asset": "etf",            "ratio": 25},
            {"asset": "coin",           "ratio": 15},
            {"asset": "bluechip-stock", "ratio": 10},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-stock-heavy",
        "title": "주식 집중 적극 전략",
        "description": "배당·성장 우량주와 ETF로 주식 비중을 높인 적극 투자 포트폴리오입니다.",
        "tags": ["bluechip-stock", "growth-stock", "etf", "bonds"],
        "allocations": [
            {"asset": "bluechip-stock", "ratio": 30},
            {"asset": "growth-stock",   "ratio": 30},
            {"asset": "etf",            "ratio": 25},
            {"asset": "bonds",          "ratio": 15},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-etf-growth",
        "title": "ETF·성장주 듀얼 전략",
        "description": "인덱스 ETF와 성장주 두 축으로 시장 초과 수익을 목표로 합니다.",
        "tags": ["etf", "growth-stock", "bonds"],
        "allocations": [
            {"asset": "etf",          "ratio": 40},
            {"asset": "growth-stock", "ratio": 35},
            {"asset": "bonds",        "ratio": 15},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-growth-bluechip",
        "title": "성장·우량주 혼합 적극 전략",
        "description": "성장주와 배당 우량주를 균형 있게 담아 수익과 안정을 동시에 추구합니다.",
        "tags": ["growth-stock", "etf", "bluechip-stock"],
        "allocations": [
            {"asset": "growth-stock",   "ratio": 35},
            {"asset": "etf",            "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 25},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-etf-coin",
        "title": "ETF·코인 복합 전략",
        "description": "ETF와 암호화폐를 함께 편입해 디지털 자산 성장 기회를 포착합니다.",
        "tags": ["etf", "growth-stock", "coin"],
        "allocations": [
            {"asset": "etf",          "ratio": 45},
            {"asset": "growth-stock", "ratio": 25},
            {"asset": "coin",         "ratio": 15},
            {"asset": "krw",          "ratio": 15},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-growth-bond-hedge",
        "title": "성장주·채권 헤지 전략",
        "description": "성장주 비중을 높이되 채권으로 하방 리스크를 일부 헤지합니다.",
        "tags": ["growth-stock", "etf", "bonds"],
        "allocations": [
            {"asset": "growth-stock", "ratio": 40},
            {"asset": "etf",          "ratio": 30},
            {"asset": "bonds",        "ratio": 20},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-coin-bluechip",
        "title": "코인·우량주 편입 전략",
        "description": "성장주·ETF를 축으로 코인과 우량주를 함께 편입한 공격형 분산 전략입니다.",
        "tags": ["growth-stock", "etf", "coin", "bluechip-stock"],
        "allocations": [
            {"asset": "growth-stock",   "ratio": 35},
            {"asset": "etf",            "ratio": 25},
            {"asset": "coin",           "ratio": 20},
            {"asset": "bluechip-stock", "ratio": 10},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 4, "profile_id": "l4-gold-aggressive",
        "title": "금 헤지 적극 전략",
        "description": "공격적 주식 비중을 유지하면서 금으로 매크로 리스크를 방어합니다.",
        "tags": ["etf", "growth-stock", "gold", "bluechip-stock"],
        "allocations": [
            {"asset": "etf",            "ratio": 35},
            {"asset": "growth-stock",   "ratio": 30},
            {"asset": "gold",           "ratio": 15},
            {"asset": "bluechip-stock", "ratio": 10},
            {"asset": "krw",            "ratio": 10},
        ],
    },

    # ===== Level 5: 공격투자형 (10개) =====
    {
        "risk_level": 5, "profile_id": "l5-coin-growth",
        "title": "코인·성장주 집중 전략",
        "description": "고위험 고수익을 추구하며 코인과 성장주에 집중 투자합니다.",
        "tags": ["coin", "growth-stock", "etf"],
        "allocations": [
            {"asset": "coin",         "ratio": 35},
            {"asset": "growth-stock", "ratio": 40},
            {"asset": "etf",          "ratio": 15},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-growth-all-in",
        "title": "성장주 올인 전략",
        "description": "성장주·ETF를 주축으로 우량주와 현금을 더해 장기 고수익을 목표로 합니다.",
        "tags": ["growth-stock", "etf", "bluechip-stock", "krw"],
        "allocations": [
            {"asset": "growth-stock",   "ratio": 45},
            {"asset": "etf",            "ratio": 30},
            {"asset": "bluechip-stock", "ratio": 15},
            {"asset": "krw",            "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-coin-heavy",
        "title": "코인 중심 전략",
        "description": "암호화폐를 절반 가까이 담고 성장주·ETF·현금으로 디지털 자산 성장에 베팅합니다.",
        "tags": ["coin", "growth-stock", "etf", "krw"],
        "allocations": [
            {"asset": "coin",         "ratio": 45},
            {"asset": "growth-stock", "ratio": 30},
            {"asset": "etf",          "ratio": 15},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-growth-coin",
        "title": "성장·코인 양축 전략",
        "description": "성장주와 코인을 양대 축으로 삼고 ETF·현금을 곁들여 최대 수익률을 추구합니다.",
        "tags": ["growth-stock", "coin", "etf", "krw"],
        "allocations": [
            {"asset": "growth-stock", "ratio": 50},
            {"asset": "coin",         "ratio": 25},
            {"asset": "etf",          "ratio": 15},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-etf-aggressive",
        "title": "공격적 ETF 전략",
        "description": "테크·성장 섹터 ETF에 집중하고 성장주·코인·현금을 더해 인덱스 초과 수익을 목표로 합니다.",
        "tags": ["etf", "growth-stock", "coin", "krw"],
        "allocations": [
            {"asset": "etf",          "ratio": 45},
            {"asset": "growth-stock", "ratio": 35},
            {"asset": "coin",         "ratio": 10},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-coin-etf-spread",
        "title": "코인·ETF 분산 공격 전략",
        "description": "코인·성장주·ETF를 분산해 하이리스크 자산 내에서도 리스크를 분산합니다.",
        "tags": ["coin", "growth-stock", "etf"],
        "allocations": [
            {"asset": "coin",         "ratio": 30},
            {"asset": "growth-stock", "ratio": 35},
            {"asset": "etf",          "ratio": 25},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-high-growth",
        "title": "하이리스크 성장 전략",
        "description": "성장주·ETF·코인으로 구성된 최고 위험도 포트폴리오입니다.",
        "tags": ["growth-stock", "etf", "coin"],
        "allocations": [
            {"asset": "growth-stock", "ratio": 45},
            {"asset": "etf",          "ratio": 25},
            {"asset": "coin",         "ratio": 20},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-momentum",
        "title": "모멘텀 성장 전략",
        "description": "상승 모멘텀이 강한 성장주와 ETF를 집중 편입하는 전략입니다.",
        "tags": ["growth-stock", "etf", "coin"],
        "allocations": [
            {"asset": "growth-stock", "ratio": 40},
            {"asset": "etf",          "ratio": 30},
            {"asset": "coin",         "ratio": 20},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-etf-coin-focus",
        "title": "ETF·코인 집중 전략",
        "description": "ETF와 코인을 80% 이상 편입해 디지털·성장 자산에 집중합니다.",
        "tags": ["etf", "coin", "growth-stock"],
        "allocations": [
            {"asset": "etf",          "ratio": 50},
            {"asset": "coin",         "ratio": 30},
            {"asset": "growth-stock", "ratio": 10},
            {"asset": "krw",          "ratio": 10},
        ],
    },
    {
        "risk_level": 5, "profile_id": "l5-high-risk-multi",
        "title": "하이리스크 다자산 전략",
        "description": "코인·성장주·ETF·우량주를 모두 편입해 고위험 내 분산 효과를 추구합니다.",
        "tags": ["coin", "growth-stock", "etf", "bluechip-stock"],
        "allocations": [
            {"asset": "coin",           "ratio": 25},
            {"asset": "growth-stock",   "ratio": 35},
            {"asset": "etf",            "ratio": 25},
            {"asset": "bluechip-stock", "ratio": 15},
        ],
    },
]


def seed():
    db = next(get_db())
    count = 0
    try:
        for t in TEMPLATES:
            exists = db.query(PortfolioTemplate).filter_by(profile_id=t["profile_id"]).first()
            if not exists:
                db.add(PortfolioTemplate(**t))
                count += 1
        db.commit()
        print(f"✅ 시드 완료 ({count}개 추가, {len(TEMPLATES) - count}개 이미 존재)")
    except Exception as e:
        db.rollback()
        print(f"🚨 시드 실패: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
