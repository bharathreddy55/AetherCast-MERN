---
name: Serene Logic
colors:
  surface: '#fbf9f9'
  surface-dim: '#dcd9da'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f4'
  surface-container: '#f0edee'
  surface-container-high: '#eae7e8'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1b1c'
  on-surface-variant: '#414753'
  inverse-surface: '#303031'
  inverse-on-surface: '#f3f0f1'
  outline: '#717785'
  outline-variant: '#c1c6d5'
  surface-tint: '#026a67'
  primary: '#006764'
  on-primary: '#ffffff'
  primary-container: '#2b817e'
  on-primary-container: '#f3fffd'
  inverse-primary: '#84d4d0'
  secondary: '#485e89'
  on-secondary: '#ffffff'
  secondary-container: '#b5ccfd'
  on-secondary-container: '#3f5680'
  tertiary: '#6d5e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c1ab34'
  on-tertiary-container: '#4a3f00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a0f1ed'
  primary-fixed-dim: '#84d4d0'
  on-primary-fixed: '#00201f'
  on-primary-fixed-variant: '#00504e'
  secondary-fixed: '#d7e2ff'
  secondary-fixed-dim: '#b0c7f7'
  on-secondary-fixed: '#001b3f'
  on-secondary-fixed-variant: '#30476f'
  tertiary-fixed: '#fbe366'
  tertiary-fixed-dim: '#dec74d'
  on-tertiary-fixed: '#211b00'
  on-tertiary-fixed-variant: '#524600'
  background: '#fbf9f9'
  on-background: '#1b1b1c'
  surface-variant: '#e4e2e3'
typography:
  headline-lg:
    fontFamily: Merriweather
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Merriweather
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Archivo Narrow
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

# Serene Logic Design System

## Brand & Style
Serene Logic is a design system built on the principles of clarity, academic precision, and calm efficiency. The brand personality is professional yet approachable, moving away from high-energy urgency toward a focused, intellectual atmosphere. 

The design style is **Corporate / Modern** with a touch of **Minimalism**. It prioritizes high-quality typography and purposeful whitespace to reduce cognitive load. The aesthetic is meant to evoke a sense of reliability and quiet confidence, suitable for data-intensive applications or knowledge-management platforms.

## Colors
The color palette shifts from warm, earth-toned oranges to a sophisticated, cool-toned spectrum that emphasizes clarity.

*   **Primary (#8ededa):** An airy, light cyan that serves as the main highlight. It provides a refreshing, modern energy without being overwhelming.
*   **Secondary (#334a73):** A deep, scholarly navy blue used for structural elements and navigational cues, providing a stable foundation.
*   **Tertiary (#af9a23):** A muted olive-gold used sparingly for emphasis or to denote specific states that require attention without alarm.
*   **Neutral (#333334):** A professional charcoal-gray that anchors the interface, used for text and borders to ensure high legibility.

## Typography
The typography strategy utilizes a multi-font approach to create a clear information hierarchy.

*   **Headlines:** Uses **Merriweather**, a sophisticated serif font. This adds an editorial, authoritative feel to titles and section headers.
*   **Body:** Uses **Inter**, a highly legible sans-serif designed for screen readability. It ensures that long-form content is comfortable to consume.
*   **Labels:** Uses **Archivo Narrow**, providing a distinct, condensed look for functional elements, metadata, and UI controls where space is at a premium.

## Layout & Spacing
The system employs a **Fluid Grid** model with a base 8px rhythm. 

*   **Desktop:** 12-column grid with 24px margins and 16px gutters.
*   **Tablet:** 8-column grid with 16px margins and 16px gutters.
*   **Mobile:** 4-column grid with 16px margins and 12px gutters.

Spacing should be used to group related elements through proximity, utilizing larger gaps (24px+) to separate distinct conceptual blocks.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and soft, ambient shadows. Instead of heavy borders, the system uses subtle shifts in background color (neutral tints) to define surface containers. Where elevation is required (like modals or floating action buttons), use diffused shadows with a low-opacity neutral tint to maintain the clean, modern aesthetic.

## Shapes
The shape language is defined by a **Rounded** philosophy. UI elements like buttons, input fields, and cards feature a standard 0.5rem (8px) corner radius. This softens the interface, making the professional layout feel more modern and accessible. Large containers like cards may scale up to 1rem (16px) for a more pronounced "layered" appearance.

## Components
*   **Buttons:** Primarily use the Secondary navy for high-priority actions and the Primary cyan for secondary highlights. Corners are rounded (8px).
*   **Cards:** Utilize a very subtle neutral border or a slight tonal shift from the background with 16px rounding.
*   **Input Fields:** Use Inter for user input and Archivo Narrow for field labels. Borders should be low-contrast neutral.
*   **Chips:** Highly rounded (pill-style) using the Primary color at low opacity for a soft, integrated look.
