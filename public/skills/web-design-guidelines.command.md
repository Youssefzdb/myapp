---
description: Review UI code for Vercel Web Interface Guidelines compliance
argument-hint: <file-or-pattern>
---

# Web Interface Guidelines Command

Review the files supplied in the argument against the rules below. Read the files first, then output concise, high-signal findings grouped by file using clickable `file:line` locations. Do not add a preamble.

## Mandatory rules

### Accessibility
- Icon-only buttons require `aria-label`; decorative icons require `aria-hidden="true"`.
- Form controls require a visible label or an accessible label.
- Use semantic HTML (`main`, `nav`, `header`, `footer`, `button`, `a`) before ARIA.
- Images require `alt`; meaningful media needs captions or descriptions.
- Use hierarchical headings and include a skip link for the main content.
- Async updates and validation messages need `aria-live="polite"`.
- Actions must use buttons; navigation must use links. Interactive elements need keyboard support.

### Focus and forms
- All interactive elements need visible `:focus-visible` states; never remove outlines without a replacement.
- Inputs need meaningful `name`, `autocomplete`, and the correct `type`/`inputmode`.
- Never block paste. Labels must be clickable and errors must appear inline.
- Keep submit buttons enabled until the request starts, then show a loading state.
- Warn before leaving with unsaved changes.

### Motion and layout
- Honor `prefers-reduced-motion`.
- Animate only `transform` and `opacity`; never use `transition: all`.
- Use flexbox/grid instead of JavaScript layout measurement.
- Prevent horizontal overflow and account for safe-area insets in full-bleed layouts.
- Modals and sheets need `overscroll-behavior: contain`.

### Typography and content
- Use `…` instead of `...`; loading labels end with `…`.
- Use balanced/prettified heading wrapping and handle long text with truncation or wrapping.
- Use active voice, specific action labels, and error messages that explain the fix.
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat` for dates and numbers.

### Images and performance
- Images need explicit dimensions; lazy-load below-the-fold images and prioritize critical images.
- Virtualize large lists; avoid layout reads during render.
- Keep controlled inputs cheap and configure asset/font domains correctly.

### State and interaction
- Reflect filters, tabs, pagination, and expanded state in the URL when deep-linking matters.
- Destructive actions require confirmation or an undo window.
- Touch targets need deliberate tap behavior and keyboard alternatives for gestures.
- Dark themes need `color-scheme: dark` and explicit native control colors.

## Output format

```text
## src/Button.tsx

src/Button.tsx:42 - icon button missing aria-label
src/Button.tsx:18 - input lacks label

## src/Modal.tsx

✓ pass
```

State the issue and location. Skip explanations unless the fix is non-obvious.
