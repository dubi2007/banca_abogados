# Agent Context Protocol - Rules & Knowledge

## Design Guidelines (Absolute Priority)
1. **NO EMOJIS**: Under no circumstances should emojis be used as icons. Always use lightweight SVG icons.
2. **Minimalism**: UI must look extremely premium, mimicking high-end law firms. Use glassmorphism sparingly. Prefer solid dark backgrounds (#0A0A0A) and thin, elegant borders.
3. **Typography**: Headings use Playfair Display. Body text uses Inter. Keep fonts thin or normal (300/400).
4. **Forms**: Inputs should rarely have full borders. Use bottom-border only styles with floating or elegant labels.

## Project Architecture
- Framework: Astro + React.
- Styling: Vanilla CSS with Global Design Tokens.
- Translations: i18n managed via `t()` function and JSON files in `src/data/`.
