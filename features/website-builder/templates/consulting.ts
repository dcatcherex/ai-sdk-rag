export const consultingTemplate = `<!DOCTYPE html>
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
    body { font-family: var(--font-body); color: #1f2937; background: #f8fafc; line-height: 1.7; }
    a { color: var(--primary); text-decoration: none; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 18px 0; position: sticky; top: 0; z-index: 100; }
    header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { font-family: var(--font-heading); font-weight: 700; font-size: 1.25rem; color: var(--primary); }
    nav a { margin-left: 28px; font-size: 0.9rem; color: #4b5563; font-weight: 500; }
    nav a:hover { color: var(--primary); }
    .btn { display: inline-block; padding: 11px 26px; border-radius: 6px; font-weight: 600; transition: all 0.2s; cursor: pointer; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { opacity: 0.9; color: #fff; }
    section { padding: 80px 0; }
    h1, h2, h3 { font-family: var(--font-heading); }
    .section-heading { margin-bottom: 48px; }
    .section-heading h2 { font-size: 2rem; font-weight: 700; margin-bottom: 12px; }
    footer { background: #0f172a; color: #94a3b8; text-align: center; padding: 36px 0; font-size: 0.875rem; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <div class="logo">{{siteName}}</div>
      <nav>
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="#testimonials">Results</a>
        <a href="#contact" class="btn btn-primary" style="margin-left:28px;">Book a Call</a>
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
