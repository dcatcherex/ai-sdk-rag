export const personalTemplate = `<!DOCTYPE html>
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
    body { font-family: var(--font-body); color: #1a1a1a; background: #fff; line-height: 1.7; }
    a { color: var(--primary); text-decoration: none; }
    .container { max-width: 860px; margin: 0 auto; padding: 0 24px; }
    header { padding: 24px 0; border-bottom: 1px solid #f0f0f0; }
    header .container { display: flex; align-items: center; justify-content: space-between; }
    .logo { font-family: var(--font-heading); font-weight: 700; font-size: 1.2rem; color: #1a1a1a; }
    nav a { margin-left: 24px; font-size: 0.9rem; color: #555; }
    nav a:hover { color: var(--primary); }
    .btn { display: inline-block; padding: 10px 24px; border-radius: 50px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; cursor: pointer; }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { opacity: 0.9; color: #fff; }
    section { padding: 72px 0; }
    h1, h2, h3 { font-family: var(--font-heading); }
    footer { border-top: 1px solid #f0f0f0; text-align: center; padding: 28px 0; color: #888; font-size: 0.875rem; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <div class="logo">{{siteName}}</div>
      <nav>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </nav>
    </div>
  </header>
  {{sections}}
  <footer>
    <div class="container">
      <p>&copy; {{currentYear}} {{siteName}}</p>
    </div>
  </footer>
</body>
</html>`;
