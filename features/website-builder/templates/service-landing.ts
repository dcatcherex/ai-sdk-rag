export const serviceLandingTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{metaTitle}}</title>
  <meta name="description" content="{{metaDescription}}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family={{fontHeading}}:wght@400;600;700;800&family={{fontBody}}:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: {{primaryColor}};
      --accent: {{accentColor}};
      --font-heading: '{{fontHeading}}', sans-serif;
      --font-body: '{{fontBody}}', sans-serif;
    }
    body { font-family: var(--font-body); color: #111827; background: #fff; line-height: 1.6; }
    a { color: var(--primary); text-decoration: none; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    header { padding: 20px 0; border-bottom: 1px solid #f3f4f6; }
    header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { font-family: var(--font-heading); font-weight: 800; font-size: 1.375rem; color: var(--primary); }
    .btn { display: inline-block; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 0.95rem; transition: all 0.2s; cursor: pointer; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { opacity: 0.88; color: #fff; }
    .btn-accent { background: var(--accent); color: #fff; }
    .btn-accent:hover { opacity: 0.88; color: #fff; }
    section { padding: 80px 0; }
    h1, h2, h3 { font-family: var(--font-heading); }
    .section-heading { text-align: center; margin-bottom: 48px; }
    .section-heading h2 { font-size: 2rem; font-weight: 700; margin-bottom: 12px; }
    .section-heading p { color: #6b7280; max-width: 560px; margin: 0 auto; }
    footer { background: #111827; color: #9ca3af; text-align: center; padding: 32px 0; font-size: 0.875rem; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <div class="logo">{{siteName}}</div>
      <a href="#contact" class="btn btn-primary">Get Started</a>
    </div>
  </header>
  {{sections}}
  <footer>
    <div class="container">
      <p>&copy; {{currentYear}} {{siteName}}. All rights reserved.</p>
    </div>
  </footer>
</body>
</html>`;
