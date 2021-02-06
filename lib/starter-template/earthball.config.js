const pages = {
  name: 'pages',
  input: {
    directory: 'pages',
    fileType: ['md', 'html', 'js']
  },
  output: {
    directory: '.',
    layout: 'page',
    fileType: 'html',
    index: { search: true }
  }
}

const posts = {
  name: 'posts',
  input: {
    directory: 'posts',
    fileType: 'md'
  },
  output: {
    directory: 'posts',
    layout: 'post',
    fileType: 'html',
    index: { search: true }
  }
}

export const config = {
  inputDirectory: 'src',
  outputDirectory: 'dist',
  defaultLayout: 'default',
  copy: ['assets/**'],
  ignore: [],
  collections: [pages, posts]
}
