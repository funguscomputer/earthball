import * as path from 'path'

import remark from 'remark'
import html from 'remark-html'
import highlight from 'remark-highlight.js'
import visit from 'unist-util-visit'
import absolute from 'is-absolute-url'
import urlJoin from 'url-join'

function transform (config) {
  return async function ({ file, data, metadata, collection }) {
    const { contents, internalLinks } = await markdownToHtml(file, collection, config)

    metadata.internalLinks = internalLinks
    metadata.markdownSourceFile = file

    return {
      file: contents,
      data,
      metadata,
      collection
    }
  }
}

const config = {
  fileType: ['md', 'html']
}

export default {
  transform,
  config
}

async function markdownToHtml (input, collection, config) {
  const internalLinks = []

  const vfile = await remark()
    .use(getInternalLinks, { internalLinks, collection, config })
    .use(html)
    .use(highlight)
    .process(input)

  vfile.internalLinks = internalLinks
  return vfile
}

function getInternalLinks ({ internalLinks = [], collection, config }) {
  return function transformer (tree) {
    visit(tree, 'link', function visitor (node, i, parent) {
      if (!node.children) return
      if (absolute(node.url)) return

      const parsedFilepath = path.parse(node.url)
      const collectionName = parsedFilepath.dir.length ? parsedFilepath.dir.replace('../', '') : collection.name

      const link = {
        collectionName,
        name: parsedFilepath.base
      }

      internalLinks.push(link)
      const url = rewriteMarkdownUrl(node.url, node, collection, config)
      node.url = url
    })
  }
}

function rewriteMarkdownUrl (url, node, collection, config) {
  if (absolute(url)) return url
  const parsedUrl = path.parse(url)

  if (url.includes('../')) {
    const collectionName = parsedUrl.dir.replace('../', '')
    const referencedCollection = config.collections.find((item) => {
      return item.name === collectionName
    })

    const outputDirectory = referencedCollection.output.directory === '.' ? '' : referencedCollection.output.directory
    return urlJoin('/', outputDirectory, parsedUrl.name, '/')
  }

  return urlJoin('/', collection.output.directory, url.replace('./', '/').replace(parsedUrl.ext, '/'))
}
