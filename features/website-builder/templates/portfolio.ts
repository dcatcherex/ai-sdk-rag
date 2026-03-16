export const portfolioTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{metaTitle}}</title>
  <meta name="description" content="{{metaDescription}}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family={{fontHeading}}:wght@400;600;700&family={{fontBody}}:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --primary: {{primaryColor}};
      --accent: {{accentColor}};
      --font-heading: '{{fontHeading}}', sans-serif;
      --font-body: '{{fontBody}}', sans-serif;
    }
    body { font-family: var(--font-body); color: #1a1a2e; background: #fafafa; line-height: 1.6; }
    a { color: var(--primary); text-decoration: none; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 16px 0; position: sticky; top: 0; z-index: 100; }
    header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { font-family: var(--font-heading); font-weight: 700; font-size: 1.25rem; color: var(--primary); }
    nav a { margin-left: 24px; font-size: 0.9rem; color: #374151; }
    nav a:hover { color: var(--primary); }
    .btn { display: inline-block; padding: 12px 28px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { opacity: 0.9; color: #fff; }
    .btn-outline { border: 2px solid var(--primary); color: var(--primary); }
    .btn-outline:hover { background: var(--primary); color: #fff; }
    section { padding: 80px 0; }
    h1, h2, h3 { font-family: var(--font-heading); }
    footer { background: #111827; color: #9ca3af; text-align: center; padding: 32px 0; font-size: 0.875rem; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <div class="logo">{{siteName}}</div>
      <nav>
        <a href="#about">About</a>
        <a href="#work">Work</a>
        <a href="#contact">Contact</a>
      </nav>
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
