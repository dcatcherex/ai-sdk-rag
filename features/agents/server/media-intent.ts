export function wantsImageGeneration(text: string): boolean {
  const lower = text.toLowerCase();
  const englishImageIntent =
    /\b(create|generate|make|draw|design)\b[\s\S]{0,80}\b(image|photo|picture|illustration|poster|banner|ad|advertisement|social post|facebook post|instagram post|ig post|thumbnail|flyer)\b/.test(lower) ||
    /\b(image|photo|picture|illustration|poster|banner|ad|advertisement|social post|facebook post|instagram post|ig post|thumbnail|flyer)\b[\s\S]{0,80}\b(create|generate|make|draw|design)\b/.test(lower);

  const thaiActions = ['สร้าง', 'ทำ', 'วาด', 'ออกแบบ'];
  const thaiVisualTerms = ['ภาพ', 'รูป', 'โปสเตอร์', 'แบนเนอร์', 'โฆษณา', 'โพสต์', 'คอนเทนต์'];

  return englishImageIntent ||
    (thaiActions.some((term) => text.includes(term)) &&
      (thaiVisualTerms.some((term) => text.includes(term)) || lower.includes('social post')));
}
