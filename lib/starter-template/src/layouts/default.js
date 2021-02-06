function nav () {
  return `
    <ul class="list pl0">
      <li class="dib"><a href="/">Home</a></li>
      <li class="dib"><a href="/about">About</a></li>
    </ul>
  `
}

function header ({ data }) {
  const { site } = data

  return `
    <header>
      <div class="container">
        <h1>${site.title}</h1>
        ${nav()}
      </div>
    </header>
  `
}

export const data = {}

export function render ({ content, data }) {
  const { site } = data

  return `<!doctype html>
    <html lang="en" dir="ltr">
    <head>
    <title>${site.title}</title>
    <meta charset="utf-8">
    <meta name="description" content="${site.description}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link async rel="stylesheet" href="/assets/highlight.css">
    <link async rel="stylesheet" href="/assets/style.css">
    </head>
    <body class="sans-serif">
      ${header({ data })}
      <main>
        ${content}
      </main>
    </body>
    </html>
  `
}
