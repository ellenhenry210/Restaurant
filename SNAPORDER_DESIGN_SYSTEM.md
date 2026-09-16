# SnapOrder Design System

## Design Philosophy

**"Confidence through clarity."**

Every design choice reflects SnapOrder's core values:
- **Transparency:** Clear hierarchy, visible information
- **Confidence:** Bold fonts, accurate numbers in monospace
- **Availability:** Green (go) vs. yellow (caution) vs. hidden (out of stock)
- **Authenticity:** Real reviews, real photos, real feedback
- **Integrity:** Exact customizations, no surprises
- **Authorization:** Clear roles, secure interactions

---

## Typography System

### Font Families

**Primary Font: Inter**
- Modern, clean, highly readable on small screens (4.7-6.1 inch phones)
- Perfect for health/wellness context
- Free and open-source (Google Fonts)
- Download: https://fonts.google.com/specimen/Inter

**Secondary Font: IBM Plex Mono**
- Used exclusively for: Order #, prices, ETAs, timestamps
- Monospace builds confidence in accuracy
- Download: https://fonts.google.com/specimen/IBM+Plex+Mono

### Font Sizing & Weights

| Role | Font | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|------|--------|-------------|-----------------|-----|
| **H1 (Main Title)** | Inter | 32px | 700 Bold | 40px (1.25x) | -0.5px | Page titles, main headings |
| **H2 (Section)** | Inter | 24px | 600 Semi | 32px (1.33x) | -0.25px | Section titles, modal titles |
| **H3 (Subsection)** | Inter | 18px | 600 Semi | 28px (1.55x) | 0px | Meal category, form sections |
| **Body (Primary)** | Inter | 16px | 400 Regular | 24px (1.5x) | 0px | Ingredient lists, descriptions |
| **Body Small** | Inter | 14px | 400 Regular | 20px (1.43x) | 0px | Secondary labels, timestamps |
| **Label/Caption** | Inter | 12px | 500 Medium | 16px (1.33x) | 0.25px | Field labels, badge text |
| **Micro** | Inter | 11px | 400 Regular | 16px (1.45x) | 0px | Disclaimers, hints |
| **Code/Numbers** | IBM Plex Mono | 14px | 600 Semi | 20px (1.43x) | 0px | Order #, prices, ETAs |

### Font Weight Scale

- **700 (Bold):** H1 headings only — maximum emphasis
- **600 (Semi-Bold):** H2, H3, labels, badges, button text
- **500 (Medium):** Small labels, field labels, emphasis within body
- **400 (Regular):** Body text, descriptions, secondary content

---

## Color System

### Brand Colors (Primary Palette)

| Name | Hex | RGB | Use | Semantic Meaning |
|------|-----|-----|-----|------------------|
| **Emerald Green** | #10B981 | 16, 185, 129 | Primary CTA, success, availability | ✅ Go ahead, healthy, available |
| **Deep Green** | #059669 | 5, 150, 105 | Hover states, depth, trust | Stability, reassurance |
| **Light Green** | #D1FAE5 | 209, 250, 229 | Success backgrounds, highlights | Calm, welcoming zone |

### Alert Colors (Status Palette)

| Name | Hex | RGB | Use | Meaning |
|------|-----|-----|-----|---------|
| **Amber Orange** | #F59E0B | 245, 158, 11 | Secondary CTA, warnings | ⚠️ Pay attention, caution |
| **Deep Orange** | #D97706 | 217, 119, 6 | Orange hover, urgent alerts | Stronger warning |
| **Light Orange** | #FEF3C7 | 254, 243, 199 | Warning backgrounds | Gentle warning zone |
| **Red (Danger)** | #EF4444 | 239, 68, 68 | Allergen warnings, errors | 🛑 STOP, critical, allergen |
| **Red (Light)** | #FEE2E2 | 254, 226, 226 | Allergen backgrounds | Alert zone, readable |
| **Yellow (Caution)** | #FBBF24 | 251, 191, 36 | Out of stock, slow prep | Out of stock, delays |
| **Yellow (Light)** | #FEF08A | 254, 240, 138 | Caution backgrounds | Warning zone |
| **Blue (Info)** | #3B82F6 | 59, 130, 246 | Info boxes, tips, help | ℹ️ Information, helpful |
| **Blue (Light)** | #EFF6FF | 239, 245, 255 | Info backgrounds | Subtle info |

### Neutral Colors (Gray Scale)

| Name | Hex | RGB | Use |
|------|-----|-----|-----|
| **Charcoal (Text)** | #1F2937 | 31, 41, 55 | Primary text, high contrast (WCAG AAA) |
| **Gray (Secondary)** | #6B7280 | 107, 114, 128 | Secondary text, labels, muted content |
| **Light Gray (Border)** | #E5E7EB | 229, 231, 235 | Borders, dividers, subtle separation |
| **Very Light Gray (BG)** | #F9FAFB | 249, 250, 251 | Page backgrounds, reduce eye strain |
| **White (Card/Base)** | #FFFFFF | 255, 255, 255 | Card backgrounds, main content area |

### Color Usage Guidelines

**When to use each color:**

- **Emerald Green (#10B981):** Primary buttons, "add to order", success messages, available meals, checkmarks
- **Deep Green (#059669):** Hover/active states on primary buttons, depth, trust-building elements
- **Amber Orange (#F59E0B):** Secondary buttons, warnings, "out of stock soon", second CTAs
- **Red (#EF4444):** **ONLY** for allergen warnings and critical errors (do not overuse)
- **Yellow (#FBBF24):** Out-of-stock items, order delays, caution messages
- **Blue (#3B82F6):** Info messages, help text, tips, FAQs
- **Gray (#6B7280):** Disabled states, muted text, secondary information
- **Charcoal (#1F2937):** All body text (highest contrast, most readable)
- **White (#FFFFFF):** Card backgrounds, form inputs, clean spaces
- **Light Gray (#F9FAFB):** Page backgrounds (subtle, reduces eye strain)

### Accessibility Notes

- **Color Contrast:** All text meets WCAG 2.1 AA (4.5:1 ratio minimum)
- **Never rely on color alone:** Always pair colors with text, icons, or badges (e.g., not just "red background" but "🚨 Allergen badge")
- **Colorblind safe:** Green/red pairings include additional indicators (icons, text, patterns)

---

## Spacing System

### Base Unit: 8px

All spacing uses multiples of 8px for consistency:

| Token | Value | Example Use |
|-------|-------|------------|
| **xs** | 4px | Gap between icon and text |
| **sm** | 8px | Small padding, gap between elements |
| **md** | 16px | Standard card padding, section margins |
| **lg** | 24px | Large section padding, breathing room |
| **xl** | 32px | Major separators, section breaks |
| **2xl** | 48px | Page margins, huge gaps |

### Layout Examples

**Card Padding:** 16px (md) on all sides
**Button Padding:** 12px vertical (sm + xs) × 16px horizontal (md)
**Page Margin:** 16px (md) on mobile, 24px (lg) on tablet+
**Gap Between Cards:** 16px (md)
**Gap Between Form Fields:** 16px (md)
**Section Break:** 32px (xl) or 48px (2xl)

---

## Component Library

### Buttons

#### Primary Button (Main Action)
```
Background: #10B981
Text: White, 16px, 600 weight
Padding: 12px vertical, 16px horizontal
Min Height: 48px (touch-friendly)
Border Radius: 8px
Hover State: #059669 (Deep Green)
Active State: #047857 (darker)
Focus: 2px outline #10B981
Disabled: Background #F3F4F6, text #9CA3AF
```

**Use for:** "Add to Order", "Place Order", "Confirm", primary CTAs

#### Secondary Button (Alternative Action)
```
Background: White
Border: 2px solid #10B981
Text: #10B981, 16px, 600 weight
Padding: 12px vertical, 16px horizontal
Min Height: 48px
Border Radius: 8px
Hover: Background #F9FAFB
Active: Background #E8F5E9
Focus: 2px outline #10B981
```

**Use for:** "Continue Shopping", "Save for Later", alternative actions

#### Danger Button (Destructive)
```
Background: #EF4444
Text: White, 16px, 600 weight
Padding: 12px vertical, 16px horizontal
Min Height: 48px
Border Radius: 8px
Hover: #DC2626
Active: #B91C1C
Focus: 2px outline #EF4444
```

**Use for:** "Cancel Order", "Remove Item", destructive actions

#### Disabled Button (All Variants)
```
Background: #F3F4F6
Text: #9CA3AF
Cursor: not-allowed
Opacity: 0.5
No hover effect
```

### Form Elements

#### Input Field (Text, Email, Phone, etc.)
```
Border: 1px solid #E5E7EB
Focus Border: 2px solid #10B981 (overrides regular border)
Background: White
Padding: 12px (md)
Min Height: 44px
Font: 14px, regular weight
Placeholder: #9CA3AF
Border Radius: 8px
```

#### Textarea (Multi-line Text)
```
Border: 1px solid #E5E7EB
Focus Border: 2px solid #10B981
Background: White
Padding: 12px (md)
Min Height: 80px (special requests) or 100px (reviews)
Font: 14px, regular weight
Resize: vertical only
Border Radius: 8px
Line Height: 1.5
```

#### Select Dropdown
```
Border: 1px solid #E5E7EB
Focus: 2px solid #10B981
Background: White
Padding: 12px (md)
Height: 44px
Font: 14px, regular weight
Border Radius: 8px
```

#### Checkbox/Radio
```
Size: 18px × 18px (easy touch target)
Border: 2px solid #E5E7EB
Checked: Background #10B981, icon white
Focus: 2px outline #10B981
Border Radius: 4px (checkbox), 50% (radio)
```

### Cards & Containers

#### Standard Card
```
Background: White
Border: None (shadow provides depth)
Border Radius: 12px
Box Shadow: 0 1px 3px rgba(0,0,0,0.1)
Padding: 16px (md)
```

**Use for:** Meals, reviews, order details, feedback cards

#### Large Card (Emphasis)
```
Same as above, but:
Padding: 20px (custom, larger)
Box Shadow: 0 4px 6px rgba(0,0,0,0.1) (slightly stronger)
```

#### Card with Border (Alert Context)
```
Border: 1px solid #E5E7EB
Border Left: 4px solid [semantic color]
Padding: 16px (md)
Border Radius: 12px
Background: [light semantic color]
```

### Badges & Tags

#### Allergen Badge (Critical Alert)
```
Background: #FEE2E2 (light red)
Text: #7F1D1D (dark red), 12px, 600 weight
Padding: 8px horizontal, 8px vertical (compact)
Border Radius: 6px
Icon: ⚠️
```

**Use for:** "⚠️ Contains Peanuts", "⚠️ Contains Gluten"

#### Health Tag (Positive Badge)
```
Background: #D1FAE5 (light green)
Text: #065F46 (dark green), 12px, 600 weight
Padding: 6px horizontal, 6px vertical
Border Radius: 20px (pill shape)
Icon: 🟢
```

**Use for:** "🟢 Low Calorie", "🟢 High Protein", "🟢 Vegan"

#### Status Badge (Neutral)
```
Background: #F3F4F6 (light gray)
Text: #6B7280 (gray), 12px, 600 weight
Padding: 6px horizontal, 6px vertical
Border Radius: 20px
```

**Use for:** "Preparing", "Ready", status indicators

### Alert Boxes

#### Success Alert
```
Background: #D1FAE5
Border Left: 4px solid #10B981
Border Radius: 8px
Padding: 16px (md)
Title: 12px, 600 weight, #065F46
Body: 13px, 400 weight, #047857
Icon: ✅
```

#### Warning Alert
```
Background: #FEF08A
Border Left: 4px solid #FBBF24
Title: #854D0E
Body: #A16207
Icon: ⚠️
```

#### Danger Alert
```
Background: #FEE2E2
Border Left: 4px solid #EF4444
Title: #7F1D1D
Body: #991B1B
Icon: 🚨
```

#### Info Alert
```
Background: #EFF6FF
Border Left: 4px solid #3B82F6
Title: #1e40af
Body: #1e40af
Icon: ℹ️
```

---

## Mobile-First Approach

### Breakpoints

| Device | Viewport | Start | Use |
|--------|----------|-------|-----|
| **Mobile** | 320px - 640px | 375px (iPhone SE) | Default, vertical stack |
| **Tablet** | 641px - 1024px | 768px | Grid adjustments, 2-col layouts |
| **Desktop** | 1025px+ | 1024px | 3+ col layouts, full width |

### Mobile Constraints

- **Safe Area Margin:** 16px (md) on all sides (accounts for notches)
- **Touch Targets:** Minimum 48px × 48px (recommended)
- **Button Height:** 48px minimum (easy thumb reach)
- **Thumb Zone:** Bottom 30% of screen — critical actions here
- **Font Minimum:** 12px (nothing smaller on small screens)
- **Column Max-Width:** 100% - 32px (leaves breathing room)

### Responsive Images

- **Max-Width:** 100% (never wider than container)
- **Height:** Auto (maintains aspect ratio)
- **Lazy Loading:** Yes (load below fold on scroll)

---

## Dark Mode (Kitchen Display System)

The Kitchen Display System (KDS) uses a dark theme to reduce eye fatigue during service:

```
Background: #1F2937 (Charcoal)
Text: White
Card Background: #111827 (darker charcoal)
Borders: #374151 (muted dark)
Alerts: 
  - Red: #EF4444 (same, stands out on dark)
  - Yellow: #FBBF24 (same, stands out on dark)
  - Green: #10B981 (same, stands out on dark)
```

---

## CSS Variables (Tailwind/Custom Properties)

```css
/* Colors */
--color-emerald: #10B981;
--color-emerald-dark: #059669;
--color-emerald-light: #D1FAE5;
--color-orange: #F59E0B;
--color-orange-dark: #D97706;
--color-red: #EF4444;
--color-red-light: #FEE2E2;
--color-yellow: #FBBF24;
--color-blue: #3B82F6;
--color-blue-light: #EFF6FF;
--color-charcoal: #1F2937;
--color-gray: #6B7280;
--color-gray-light: #E5E7EB;
--color-gray-lighter: #F9FAFB;
--color-white: #FFFFFF;

/* Spacing */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
--spacing-xl: 32px;
--spacing-2xl: 48px;

/* Typography */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'IBM Plex Mono', monospace;

/* Border Radius */
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-pill: 20px;

/* Shadows */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

---

## Design Checklist

Before shipping any screen, confirm:

- [ ] Font sizes match typography scale
- [ ] Colors are from approved palette (no #rrggbb guessing)
- [ ] Spacing uses 8px multiples
- [ ] Touch targets are 48px minimum
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Form inputs clearly labeled (not just placeholder)
- [ ] Buttons have hover, active, disabled states
- [ ] Allergen warnings are red + text (not just color)
- [ ] No critical info in color alone
- [ ] Mobile-first: works on 375px first
- [ ] Focus states (2px outline) visible
- [ ] Loading states shown
- [ ] Error messages specific (not "Error")

---

## Brand Voice in UI

**Tone:** Direct, clear, reassuring, no jargon
**Language:** "Your Order", "Allergen Warning", "Ready Now" — not "Proceed to Checkout"
**Microcopy:** "We'll notify you when it's ready" (reassuring), not "Order pending" (vague)
**Error Messages:** "This meal contains peanuts and can't be removed" (specific), not "Invalid" (confusing)

---

**Design System Version:** 1.0  
**Last Updated:** Sept 16, 2025  
**Status:** Ready for development  
**Designed for:** Ellen Henry, SnapOrder MVP
