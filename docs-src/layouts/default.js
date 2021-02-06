function header ({ data }) {
  const { site } = data

  return `
    <header class="dt container border-box lh-solid mt3 mb5">
        <h1 class="dtc w-50 ma0 v-mid">${site.title}</h1>
        <ul class="dtc list pl0 w-50 v-mid ma0 tr">
          <li class="dib"><a href="/">Home</a></li>
          <li class="dib"><a href="/about">About</a></li>
          <li class="dib"><a href="/getting-started">Getting started</a></li>
        </ul>
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
    <link async rel="stylesheet" href="/assets/tachyons.css">
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
