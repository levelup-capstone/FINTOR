# Design System Strategy: The Financial Architect (고결한 금융의 미학)

이 문서는 단순한 가이드라인을 넘어, 데이터의 홍수 속에서 사용자에게 명확한 '길'을 제시하는 고품질 금융 경험을 설계하기 위한 전략적 지침서입니다. 우리는 단순히 '대시보드'를 만드는 것이 아니라, 신뢰와 기술이 결합된 '디지털 자산의 성소(Sanctuary)'를 구축합니다.

---

## 1. Overview & Creative North Star: "The Digital Curator" (디지털 큐레이터)

우리의 디자인 북극성은 **"The Digital Curator"**입니다. 일반적인 금융 서비스가 숫자를 '나열'할 때, 이 시스템은 숫자를 '큐레이션'합니다. 

단순히 그리드에 맞춘 박스 형태의 레이아웃을 지양합니다. 의도적인 비대칭성(Intentional Asymmetry), 여백을 통한 시선의 흐름 제어, 그리고 깊이감 있는 레이어링을 통해 사용자가 복잡한 금융 데이터 속에서도 평온함과 통제권을 느낄 수 있도록 설계합니다. 이는 '템플릿'처럼 보이는 표준 UI를 벗어나, 마치 고급 경제 잡지의 편집 레이아웃과 같은 권위와 세련미를 전달합니다.

---

## 2. Colors: Tonal Depth & Signature Accents

색상은 단순한 장식이 아닌, 정보의 위계와 자산의 성격(Asset Class)을 정의하는 언어입니다.

### The "No-Line" Rule (무선 원칙)
이 시스템에서 섹션을 구분하기 위한 **1px solid border 사용을 엄격히 금지합니다.** 경계는 선이 아닌 '면의 차이'로 정의합니다.
*   **Surface Hierarchy:** `surface` (배경) 위에 `surface-container-low` 섹션을 배치하고, 그 안에 `surface-container-lowest` 카드를 배치하여 톤의 변화만으로 입체감을 형성합니다.

### Surface Hierarchy & Nesting
*   **Primary (#001846):** 신뢰의 근간이 되는 깊은 네이비입니다. 브랜드의 정체성과 핵심 액션에 사용합니다.
*   **Asset Accents:** 자산별 고유 성격에 따라 `tertiary` (Crypto), `primary-fixed` (Stocks), 혹은 별도의 Gold 톤을 전략적으로 배치하여 데이터 시각화의 명확성을 높입니다.
*   **The Glass & Gradient Rule:** 주요 CTA 버튼이나 히어로 섹션 배경에는 `primary`에서 `primary-container`로 흐르는 미세한 그라데이션을 적용하여 '디지털 소울'을 불어넣습니다. 플로팅 요소에는 `surface` 컬러에 60% 투명도와 `backdrop-blur`를 적용한 글래스모피즘(Glassmorphism)을 활용하십시오.

---

## 3. Typography: Editorial Authority

금융 데이터는 가독성을 넘어 '신뢰의 무게'를 담아야 합니다.

*   **Display & Headline (Manrope):** 영문 숫자와 헤드라인에 사용되는 Manrope는 현대적이고 기술적인 인상을 줍니다. 큰 스케일의 `display-lg`를 활용해 총 자산 규모를 강조할 때, 과감한 자간(Letter-spacing) 조절로 편집 디자인적 요소를 가미하십시오.
*   **Body & Label (Inter / Pretendard):** 본문과 데이터 숫자는 Inter 혹은 Pretendard를 사용하여 최상의 가독성을 확보합니다. 
*   **Hierarchy Strategy:** 중요한 수치 데이터는 `title-lg` 이상을 사용하여 시각적 앵커(Anchor) 역할을 하게 하고, 부연 설명은 `label-md`를 활용해 정보의 층위를 나눕니다.

---

## 4. Elevation & Depth: Tonal Layering

우리는 그림자(Shadow)보다 **톤의 적층(Tonal Layering)**을 통해 깊이를 만듭니다.

*   **The Layering Principle:** 
    *   Base: `surface` (#f8f9fa)
    *   Section: `surface-container-low` (#f3f4f5)
    *   Card: `surface-container-lowest` (#ffffff)
    *   이와 같은 계층 구조는 물리적인 종이가 겹쳐 있는 듯한 자연스러운 깊이감을 줍니다.
*   **Ambient Shadows:** 부유(Floating)하는 요소가 반드시 필요한 경우, `on-surface` 컬러를 4~8% 농도로 희석한 아주 넓고 부드러운 그림자를 사용하십시오. (Blur: 20px~40px)
*   **The "Ghost Border" Fallback:** 접근성 등의 이유로 경계가 반드시 필요하다면, `outline-variant` 토큰의 불투명도를 10%~20%로 낮춘 '고스트 보더'만을 허용합니다. 불투명한 고대비 선은 지양하십시오.

---

## 5. Components: The Refined Primitives

### Cards & Lists
*   **Forbid Dividers:** 리스트 아이템 사이의 구분선(Divider)을 사용하지 마십시오. 대신 `spacing-4` 이상의 여백이나, 마우스 호버 시 `surface-container-high`로 배경색이 변하는 인터랙션을 활용합니다.
*   **Roundedness:** 카드의 기본 곡률은 `DEFAULT` (0.5rem/8px)를 따르되, 강조하고 싶은 모달이나 대형 배너는 `lg` (1rem/16px)를 적용하여 부드러운 인상을 줍니다.

### Buttons & Inputs
*   **Primary Button:** `primary` 배경에 `on-primary` 텍스트를 사용하며, 미세한 상단 내부 광택(Inner Glow)을 주어 입체감을 구현합니다.
*   **Input Fields:** `surface-container-low` 배경을 기본으로 하며, 포커스 시 `primary` 컬러의 '고스트 보더'가 부드럽게 나타나도록 설계합니다.

### Specialized Components
*   **Asset Chips:** 각 자산 클래스의 컬러를 배경으로 사용하되, 텍스트 가독성을 위해 배경색의 채도를 낮춘 `container` 토큰을 활용합니다.
*   **Trend Indicators:** 상승/하락 지표는 단순 아이콘뿐만 아니라, 배경에 미세한 그라데이션 빔(Beam) 효과를 주어 기술적인 성숙도를 표현합니다.

---

## 6. Do's and Don'ts (실천 가이드)

### Do's
*   **여백을 두려워하지 마십시오:** `spacing-8` (2rem) 이상의 과감한 여백은 정보의 가치를 높입니다.
*   **데이터에 위계를 부여하십시오:** 모든 숫자가 중요할 수는 없습니다. `display-sm`과 `label-sm`을 대조적으로 배치하십시오.
*   **맥락 있는 컬러 사용:** 초록색(주식)과 보라색(크립토) 등 정의된 액센트 컬러를 일관되게 사용하여 사용자가 색상만으로 자산군을 인지하게 하십시오.

### Don'ts
*   **절대 100% 검정(#000000)을 사용하지 마십시오:** 대신 `on-surface` 혹은 `primary`를 사용하여 색의 깊이를 유지하십시오.
*   **복잡한 그리드 강박을 버리십시오:** 정보의 중요도에 따라 그리드 칸을 넘나드는 유연한 배치를 시도하십시오.
*   **표준 Drop Shadow를 금지합니다:** 기본 설정된 진한 그림자는 시스템의 우아함을 해칩니다. 항상 주변부와 조화되는 Ambient Shadow를 사용하십시오.

---
이 시스템은 사용자가 자신의 자산을 관리하는 행위가 단순한 계산이 아닌, **'가치 있는 미래를 설계하는 여정'**처럼 느껴지게 하는 데 목적이 있습니다. 디자인의 모든 요소는 이 고귀한 목적을 뒷받침해야 합니다.