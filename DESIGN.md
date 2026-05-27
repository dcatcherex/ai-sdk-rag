---
name: Technical Precision
colors:
  surface: '#fcf8ff'
  surface-dim: '#dbd8e8'
  surface-bright: '#fcf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2ff'
  surface-container: '#efecfc'
  surface-container-high: '#e9e6f7'
  surface-container-highest: '#e3e0f1'
  on-surface: '#1b1a26'
  on-surface-variant: '#484552'
  inverse-surface: '#302f3b'
  inverse-on-surface: '#f2efff'
  outline: '#797584'
  outline-variant: '#cac4d4'
  surface-tint: '#624cb8'
  primary: '#624cb8'
  on-primary: '#ffffff'
  primary-container: '#a48fff'
  on-primary-container: '#391e8d'
  inverse-primary: '#cbbeff'
  secondary: '#6249c2'
  on-secondary: '#ffffff'
  secondary-container: '#9a83ff'
  on-secondary-container: '#300491'
  tertiary: '#59598c'
  on-tertiary: '#ffffff'
  tertiary-container: '#9b9ad2'
  on-tertiary-container: '#313161'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e6deff'
  primary-fixed-dim: '#cbbeff'
  on-primary-fixed: '#1d0061'
  on-primary-fixed-variant: '#4a329e'
  secondary-fixed: '#e6deff'
  secondary-fixed-dim: '#cbbeff'
  on-secondary-fixed: '#1d0061'
  on-secondary-fixed-variant: '#4a2ea9'
  tertiary-fixed: '#e2dfff'
  tertiary-fixed-dim: '#c2c1fb'
  on-tertiary-fixed: '#161545'
  on-tertiary-fixed-variant: '#424273'
  background: '#fcf8ff'
  on-background: '#1b1a26'
  surface-variant: '#e3e0f1'
typography:
  headline-lg:
    fontFamily: Noto Sans Thai
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Noto Sans Thai
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Noto Sans Thai
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Sarabun
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Sarabun
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

## Brand & Style

The design system is engineered for developers, architects, and AI engineers, now optimized for a **high-clarity Light Mode** environment. It prioritizes **high information density**, **technical reliability**, and **functional clarity**. The aesthetic transitions from a dark-IDE feel to a **Professional Technical Documentation** style, drawing inspiration from modern API references and white-themed developer consoles.

The interface must feel like a precision instrument. This is achieved through:
- **High-Density Layouts:** Maximizing screen real estate to show complex data without clutter.
- **Progressive Disclosure:** Using collapsible trees and drawers to hide complexity until needed.
- **Chromatic Clarity:** Utilizing the OKLCH color space to ensure consistent contrast and accessible legibility in light mode.
- **Technical Honesty:** Visible metadata (latencies, token counts, similarity scores) presented in monospaced fonts to reinforce the RAG SDK's underlying logic.

## Colors

The palette is optimized for daylight productivity and long-form reading, utilizing a **Light Mode** that emphasizes cleanliness and structure.

- **Primary:** An "Electric Violet" (#a48fff) used for focal points, active states, and primary actions.
- **Secondary:** A deeper "Slate Lavender" (#6e56cf) used for supportive interactive elements.
- **Backgrounds:** A crisp, neutral canvas is derived from the neutral hex, using light grays and off-whites for surface differentiation.
- **Borders:** Subtle hairline borders are used instead of heavy shadows to define structure, maintaining an airy but organized architectural feel.
- **Data Visualization:** High-saturation emerald, rose, and amber are reserved strictly for functional status indicators (Success, Error, Warning).

## Typography

The system utilizes a tri-font strategy to differentiate between brand, content, and data, with full optimization for Thai script.

1.  **Noto Sans Thai (Headlines):** Used for structure and hierarchy. It provides a modern, geometric look with tight tracking for a "premium tech" feel.
2.  **Sarabun (Body):** The workhorse for documentation and long-form text. Chosen for its professional character and exceptional legibility in Thai contexts.
3.  **JetBrains Mono (Data/Labels):** Essential for the "technical" personality. Use this for all metrics (token counts, scores), code blocks, file paths, and metadata labels.

**Thai Language Support:** Line height is consistently maintained at approximately 1.4-1.5x the font size across all levels to prevent clipping of tone marks and ensure comfortable reading.

## Layout & Spacing

This design system employs a **Fluid Grid** model with a base unit of **4px**. 

- **Grid:** A 12-column system is used for desktop dashboards. Components should snap to the 4px grid to maintain visual rigor.
- **Density:** Information density is high. Use `sm` (8px) for internal component spacing and `md` (16px) for layout gaps. 
- **Adaptation:** 
  - **Desktop:** Dual-panel layouts (sidebar navigation + main workbench). 
  - **Tablet:** Collapsible sidebars and stacked metrics.
  - **Mobile:** Respect `safe-area-inset` for mobile integration. Use full-width cards with 16px horizontal margins.

## Elevation & Depth

Depth is conveyed through **Subtle Tonal Layering** and **Soft Shadows** rather than the high-contrast layering of dark mode.

- **Surface Tiers:** 
  - `Level 0`: The Canvas (White/Off-white).
  - `Level 1`: Content Cards (Slightly tinted surfaces).
  - `Level 2`: Overlays, Popovers, and Tooltips (White with soft ambient shadows).
- **Borders:** Every card and section must use a 1px solid border. Use subtle grayscale borders in light mode to create definition.
- **Glassmorphism:** Apply `backdrop-blur-md` and `bg-white/80` for floating navigation bars or modal backdrops to maintain focus on the content beneath.

## Shapes

The shape language balances modern approachable design with technical precision. 

- **Outer Containers:** Main dashboard cards and modal windows use `rounded-xl` (1.5rem) to feel substantial and modern.
- **Inner Elements:** Buttons, input fields, and technical chips use `rounded-md` (0.75rem). 
- **Terminal/Code Blocks:** These are slightly sharper at `rounded-sm` (0.25rem) to maintain a "contained IDE" aesthetic.

## Components

- **Buttons:** 
  - *Primary:* Solid violet fill with high-contrast white text. 
  - *Technical:* Outline style with `JetBrains Mono` text for utility actions (e.g., "COPY LOGS").
- **Terminal:** 
  - Use a dark background contrasting with the light theme to preserve the traditional command-line aesthetic.
  - Log text should use `code-sm` typography with ANSI color support for streaming status.
- **Citations & Sources:** 
  - Inline badges like `[1]` should be small, interactive chips. 
  - The source drawer should use a collapsible layout with `JetBrains Mono` for displaying "Similarity Scores".
- **Inputs:** 
  - Minimalist fields with 1px borders. 
  - Focus state: `2px` primary color ring with `4px` offset.
- **Chain-of-Thought:** 
  - Vertically connected nodes using thin dotted lines (`border-dotted`). 
  - Each step is a collapsible summary showing "Latency" and "Token Usage" in the header.