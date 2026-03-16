export const PROMPT_CATEGORIES = [
  'General',
  'Writing',
  'Coding',
  'Analysis',
  'Marketing',
  'Research',
  'Support',
  'Creative',
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

export type BuiltInPrompt = {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  tags: string[];
};

export const BUILT_IN_PROMPTS: BuiltInPrompt[] = [
  {
    id: 'builtin_summarize',
    title: 'Summarize text',
    content: 'Summarize the following text concisely, highlighting the key points:\n\n{{text}}',
    category: 'General',
    tags: ['summarize', 'summary'],
  },
  {
    id: 'builtin_explain_simple',
    title: 'Explain simply',
    content: 'Explain {{topic}} in simple terms, as if explaining to someone with no background in the subject.',
    category: 'General',
    tags: ['explain', 'beginner'],
  },
  {
    id: 'builtin_professional_email',
    title: 'Write a professional email',
    content: 'Write a professional {{tone}} email to {{recipient}} about {{subject}}. Keep it concise and action-oriented.',
    category: 'Writing',
    tags: ['email', 'professional'],
  },
  {
    id: 'builtin_proofread',
    title: 'Proofread and improve',
    content: 'Proofread the following text, fix grammar and spelling errors, and suggest improvements for clarity and flow:\n\n{{text}}',
    category: 'Writing',
    tags: ['proofread', 'grammar', 'editing'],
  },
  {
    id: 'builtin_code_review',
    title: 'Code review',
    content: 'Review the following code. Identify bugs, suggest performance improvements, and flag any security concerns:\n\n```\n{{code}}\n```',
    category: 'Coding',
    tags: ['review', 'bugs', 'security'],
  },
  {
    id: 'builtin_write_function',
    title: 'Write a function',
    content: 'Write a clean, well-commented {{language}} function that {{description}}. Include error handling and a brief usage example.',
    category: 'Coding',
    tags: ['function', 'implementation'],
  },
  {
    id: 'builtin_pros_cons',
    title: 'Pros and cons analysis',
    content: 'Provide a balanced pros and cons analysis of {{topic}}. Consider short-term and long-term implications.',
    category: 'Analysis',
    tags: ['analysis', 'comparison', 'decision'],
  },
  {
    id: 'builtin_compare',
    title: 'Compare two options',
    content: 'Compare {{option_a}} vs {{option_b}}. Create a structured comparison covering key criteria, trade-offs, and a recommendation.',
    category: 'Analysis',
    tags: ['compare', 'decision'],
  },
  {
    id: 'builtin_social_post',
    title: 'Social media post',
    content: 'Write an engaging {{platform}} post about {{topic}}. Include relevant hashtags and a call to action. Tone: {{tone}}.',
    category: 'Marketing',
    tags: ['social media', 'post', 'marketing'],
  },
  {
    id: 'builtin_tagline',
    title: 'Brand tagline',
    content: 'Create 5 compelling tagline options for {{brand_or_product}}. Each should be memorable, under 10 words, and convey the core value proposition.',
    category: 'Marketing',
    tags: ['tagline', 'branding', 'copywriting'],
  },
  {
    id: 'builtin_research_overview',
    title: 'Research overview',
    content: 'Provide a comprehensive overview of {{topic}}, covering: background, current state, key players, recent developments, and future outlook.',
    category: 'Research',
    tags: ['research', 'overview'],
  },
  {
    id: 'builtin_customer_response',
    title: 'Customer complaint response',
    content: 'Write a professional, empathetic response to the following customer complaint. Acknowledge the issue, apologize sincerely, and outline the resolution steps:\n\n{{complaint}}',
    category: 'Support',
    tags: ['customer support', 'complaint', 'response'],
  },
  {
    id: 'builtin_short_story',
    title: 'Short story',
    content: 'Write a compelling short story (300-500 words) featuring {{character}} who {{situation}}. Include vivid descriptions and an unexpected twist.',
    category: 'Creative',
    tags: ['story', 'fiction', 'creative writing'],
  },
];
