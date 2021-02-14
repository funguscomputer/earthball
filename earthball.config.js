const pages = {
  name: 'pages',
  sourceFileTemplate: 'page',
  input: {
    directory: 'pages',
    fileType: ['md', 'html']
  },
  output: {
    directory: '.',
    layout: 'page',
    fileType: 'html',
    feeds: { atom: true, json: false },
    index: { search: true }
  }
}

const articles = {
  name: 'articles',
  sourceFileTemplate: 'article',
  input: {
    directory: 'articles',
    fileType: 'md'
  },
  output: {
    layout: 'article',
    directory: 'articles',
    fileType: 'html',
    feeds: { atom: true, json: true },
    index: { search: true }
  }
}

export const config = {
  inputDirectory: 'docs-src',
  outputDirectory: 'docs',
  defaultLayout: 'default',
  copy: ['assets/**'],
  ignore: [],
  collections: [pages, articles],
  pipelines: []
}
