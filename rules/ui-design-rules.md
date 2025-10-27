# 🎨 UI/Design Rules

These rules apply when the user is asking questions about UI design, colors, layouts, spacing, and visual design elements.

---

## Visual Analysis Requirements

**When answering UI/Design questions:**

✅ **DO:**
- Analyze visual elements from screenshots/images carefully
- Extract specific design values (hex colors, spacing, font sizes)
- Reference component names and their visual properties
- Provide exact specifications from the Figma design
- Use visual language: "teal/turquoise (#00BCD4)", "16px spacing", "semibold weight"
- Explain the visual hierarchy and design rationale

❌ **DON'T:**
- Say you can't see images - you can see and must analyze them
- Provide approximate values - be specific
- Assume colors without visual confirmation
- Skip visual analysis for design questions

---

## Design Question Examples

### ✅ Good Responses:

**User:** `@LoginPage what is the CTA button color?`
**Response:**
1. Search within LoginPage for button styling
2. Fetch and analyze the screenshot
3. Identify the button element visually
4. Report: "The CTA button uses a teal color (#0ACF83 approximately) with white text"

**User:** `@HomePage what spacing is used between cards?`
**Response:**
1. Visually measure the spacing in the screenshot
2. Report: "The cards use 16px vertical spacing and 20px horizontal spacing"

### ❌ Bad Responses:
- "I can't determine the exact color from the design" (you have vision capabilities)
- Providing only approximate descriptions without hex values
- Not referencing the visual design system

---

## Color & Visual Element Extraction

When extracting design values:
- **Colors**: Provide hex codes (e.g., #0ACF83) and descriptive names (e.g., "emerald green")
- **Spacing**: Provide pixel measurements
- **Typography**: Include font family, weight, size, line-height
- **Shadows**: Describe shadows with blur, spread, color, and opacity
- **Borders/Radius**: Provide border width and radius values
