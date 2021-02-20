import * as path from 'path'
import { promises as fs } from 'fs'

import picomatch from 'picomatch'
import pipe from 'p-pipe'
import csvToJson from 'csvtojson'
import lunr from 'lunr'
import { Feed } from 'feed'
import createDebug from 'debug'

import DirectoryWatcher from './lib/directory-watcher.js'
import { createServer } from './lib/server.js'
import { stripMarkdown } from './lib/strip-markdown.js'

import { defaultTransformPreset } from './presets/default-transform-preset.js'

const debug = createDebug('earthball')

export class Earthball {
  constructor (config) {
    /*
      TODO:
      use Object.freeze on each collection so it can't be modified in transforms
    */

    this.config = config
    this.config.cwd = config.cwd || process.cwd()

    this.config.ignore = ['**/*.DS_Store', '_*'].concat(config.ignore || [])

    this.fileWatcher = null

    this.isIgnoreMatch = picomatch(config.ignore)
    this.isCopyMatch = picomatch(config.copy)

    this.config.layoutsDirectory = config.layoutsDirectory || 'layouts'
    this.isLayoutMatch = picomatch(path.join(this.config.layoutsDirectory, '**', '**'))
    this.layoutsWatcher = null
    this.layouts = {}
    this.layoutDependents = {}

    this.config.dataDirectory = config.dataDirectory || 'data'
    this.isDataMatch = picomatch(path.join(this.config.dataDirectory, '**', '**'))
    this.dataWatcher = null

    this.defaultTransforms = defaultTransformPreset(config)
    this.transformedCollections = {}

    this.rawCollections = {}

    this.data = {
      site: {},
      collections: {}
    }
  }

  async serve (config = {}, callback) {
    const options = Object.assign(this.config.server || {}, config)
    options.siteDirectory = options.siteDirectory || this.config.outputDirectory
    const server = createServer(options)
    server.listen(options.port, options.host, callback)
  }

  async build () {
    await this.buildData()
    await this.buildLayouts()
    await this.buildCollections()
  }

  async getLayout (filePath) {
    const parsedPath = path.parse(filePath)
    const inputFilePath = path.join(process.cwd(), this.config.inputDirectory, 'layouts', filePath)
    this.layouts[parsedPath.name] = await readers.js(inputFilePath)
    return parsedPath.name
  }

  async buildLayouts () {
    this.layoutsWatcher = new DirectoryWatcher({
      directoryPath: path.join(this.config.inputDirectory, this.config.layoutsDirectory),
      watch: this.config.watch,
      isIgnoreMatch: this.isIgnoreMatch,
      onInit: async ({ filePath }) => {
        await this.getLayout(filePath)
      },
      onChange: async ({ filePath }) => {
        const layoutName = await this.getLayout(filePath)

        this.layoutDependents[layoutName].forEach(async (dependentFilePath) => {
          const stats = await fs.stat(this.createInputFilePath(dependentFilePath))
          this.fileWatcher.emit('+', { path: dependentFilePath, stats })
        })
      },
      onDestroy: ({ parsedPath }) => {
        this.layouts[parsedPath.name] = undefined
      }
    })

    this.layoutsWatcher.start()
  }

  async buildData () {
    this.dataWatcher = new DirectoryWatcher({
      directoryPath: path.join(this.config.inputDirectory, this.config.dataDirectory),
      watch: this.config.watch,
      isIgnoreMatch: this.isIgnoreMatch,
      onInit: async ({ parsedPath, filePath }) => {
        await this.buildDataFile({ filePath: path.join(this.config.dataDirectory, filePath), parsedPath })
      },
      onChange: async ({ filePath, parsedPath }) => {
        await this.buildDataFile({ filePath: path.join(this.config.dataDirectory, filePath), parsedPath })
      },
      onDestroy: () => {
        /*
          TODO:
          remove data from built site
          may need to clear cache and rebuild
        */
      }
    })

    this.dataWatcher.start()
  }

  async buildDataFile ({ filePath, parsedPath, collection }) {
    const inputFilePath = this.createInputFilePath(filePath)
    const name = (collection && collection.name) || parsedPath.name

    let file
    if (parsedPath.ext === '.json') {
      file = await readers.json(inputFilePath)
    } else if (parsedPath.ext === '.js') {
      file = await readers.js(path.join(this.config.cwd, inputFilePath))

      if (typeof file.data === 'function') {
        file = await file.data(collection)
      } else if (typeof file.data === 'object') {
        file = file.data
      } else {
        throw new Error('collection data type not supported')
      }
    } else if (parsedPath.ext === '.csv') {
      file = await readers.csv(inputFilePath)
    }

    if (collection) {
      this.data.collections[name] = file
    } else {
      this.data[name] = file
    }
  }

  async buildCollections () {
    this.fileWatcher = new DirectoryWatcher({
      directoryPath: this.config.inputDirectory,
      watch: this.config.watch,
      isIgnoreMatch: this.isIgnoreMatch,
      onInit: async ({ filePath, parsedPath, stats }) => {
        await this.readCollectionFile({ filePath, stats, parsedPath })
      },
      afterInit: async () => {
        await this.transformCollections()
        await this.writeIndexes()
        await this.writeFeeds()
        await this.writeCollections()
      },
      onChange: async ({ filePath, parsedPath, stats }) => {
        debug('onChange', filePath)

        const collectionItem = await this.readCollectionFile({ filePath, stats, parsedPath })
        if (!collectionItem) {
          return
        }

        const transformedFile = await this.transformCollectionItem(collectionItem)

        if (transformedFile) {
          await this.writeCollectionFile(transformedFile)
          await this.transformCollections()
          await this.writeIndexes()
          await this.writeFeeds()
        }
      },
      onDestroy: async ({ filePath, stats, parsedPath }) => {
        await this.removeFile({ filePath, stats, parsedPath })
        await this.writeIndexes()
        await this.writeFeeds()
      }
    })

    this.fileWatcher.start()
    return this.fileWatcher.watchedFilepaths
  }

  async readCollectionFile ({ filePath, stats, parsedPath }) {
    if (stats.isDirectory()) {
      return
    }

    // if filePath matches a copy glob, do a passthrough copy
    if (this.isCopyMatch(filePath)) {
      return this.copyFile({ filePath, parsedPath, stats })
    }

    const collection = this.getCollection(parsedPath)

    // skip filePath if it doesn't belong to a collection or is data or a layout
    if (!collection || this.isLayoutMatch(filePath) || this.isDataMatch(filePath)) {
      return
    }

    // skip filePath if it doesn't match the filetype of the collection
    if (!collection.input.fileType) {
      /*
        TODO:
        either make collection.input.fileType required or infer fileType
      */
      return
    }

    debug('readCollectionFile', filePath)

    const fileType = path.extname(filePath).replace('.', '')
    const collectionFileType = Array.isArray(collection.input.fileType) ? collection.input.fileType : [collection.input.fileType]
    const fileTypeMatch = collectionFileType.includes(fileType)

    if (!fileTypeMatch) {
      return
    }

    // read based on fileType than transform
    let inputFilePath = this.createInputFilePath(filePath)

    if (fileType === 'js') {
      inputFilePath = path.join(this.config.cwd, inputFilePath)
    }

    const file = await readers[fileType](inputFilePath)

    if (!this.rawCollections[collection.name]) {
      this.rawCollections[collection.name] = {}
    }

    const collectionItem = { file, filePath, stats, parsedPath, collection }
    this.rawCollections[collection.name][filePath] = collectionItem
    return collectionItem
  }

  async transformCollections () {
    for (const collectionName in this.rawCollections) {
      const collection = this.rawCollections[collectionName]

      for (const itemFilePath in collection) {
        const item = collection[itemFilePath]
        await this.transformCollectionItem(item, collection)
      }
    }
  }

  async transformCollectionItem ({ file, filePath, stats, parsedPath, collection }) {
    const { transforms = this.defaultTransforms } = collection.output || {}

    const wrappedTransforms = transforms.transform.map((transformers) => {
      /*
      TODO:
      check transform input and output for common issues
      */
      return async (opts) => {
        if (!transformers.config.fileType.includes(parsedPath.ext.replace('.', ''))) {
          return opts
        }

        return transformers.transform(this.config)(opts)
      }
    })

    const transformers = pipe(...wrappedTransforms)
    const transformedFile = await transformers({
      file,
      data: {
        site: this.data.site,
        collections: this.data.collections
      },
      metadata: { stats },
      collection
    })

    transformedFile.filePath = filePath
    transformedFile.parsedPath = parsedPath
    transformedFile.outputFilePath = this.createOutputFilePath(transformedFile, collection)

    if (!transformedFile.data) {
      transformedFile.data = {}
    }

    if (!transformedFile.metadata) {
      transformedFile.metadata = {}
    }

    transformedFile.data.permalink = transformedFile.data.permalink || transformedFile.outputFilePath
      .replace(this.config.outputDirectory, '')
      .replace('index.html', '')

    if (!this.data.collections[collection.name]) {
      this.data.collections[collection.name] = {}
    }

    this.data.collections[collection.name][filePath] = (transformedFile)
    return transformedFile
  }

  async writeCollectionFile ({ file, outputFilePath, data, metadata, collection, filePath, parsedPath }) {
    const { transforms = this.defaultTransforms } = collection.output || {}
    let { layout: layoutName } = data

    if (!layoutName) {
      layoutName = collection.output.layout || this.config.defaultLayout
    }

    /*
      TODO:
      better validation and error handling of layout name
    */
    const layout = this.layouts[layoutName] || noopLayout

    if (!this.layoutDependents[layoutName]) {
      this.layoutDependents[layoutName] = []
    }

    if (!this.layoutDependents[layoutName].includes(filePath)) {
      this.layoutDependents[layoutName].push(filePath)
    }

    await mkdirp(path.dirname(outputFilePath))

    const wrappedTransforms = transforms.write.map((transformers) => {
      /*
      TODO:
      check transform input and output for common issues
      */
      return async (opts) => {
        if (!transformers.config.fileType.includes(parsedPath.ext.replace('.', ''))) {
          return opts
        }

        return transformers.transform(this.config)(opts)
      }
    })

    let fileData = Object.assign({}, layout.data || {}, data)

    const transformers = pipe(...wrappedTransforms)
    const transformedFile = await transformers({
      file,
      data: fileData,
      metadata,
      collection
    })

    let fileContent = layout.render({ content: transformedFile.file, data: transformedFile.data })

    /*
      TODO:
      consider allowing infinite nesting of layouts. right now it only goes one level
    */
    if (layout.layout) {
      /*
        TODO:
        better validation and error handling of parent layout name
      */
      const parentLayoutName = layout.layout
      const parentLayout = this.layouts[parentLayoutName]

      if (!this.layoutDependents[parentLayoutName]) {
        this.layoutDependents[parentLayoutName] = []
      }

      if (!this.layoutDependents[parentLayoutName].includes(filePath)) {
        this.layoutDependents[parentLayoutName].push(filePath)
      }

      fileData = Object.assign({}, parentLayout.data || {}, data)
      fileContent = parentLayout.render({ content: fileContent, data: fileData })
    }

    return writers.text(outputFilePath, fileContent)
  }

  async writeCollections () {
    this.iterateCollections(async (item) => {
      await this.writeCollectionFile(item)
    })
  }

  async iterateCollections (onItem) {
    for (const collectionName in this.data.collections) {
      const collection = this.data.collections[collectionName]

      for (const itemFilePath in collection) {
        const item = collection[itemFilePath]
        await onItem(item, collection)
      }
    }
  }

  async writeIndexes () {
    await this.writeSearchIndex()
  }

  async writeSearchIndex () {
    const documents = []

    await this.iterateCollections(async (item) => {
      const { contents } = await stripMarkdown(item.metadata.markdownSourceFile)

      documents.push({
        id: item.filePath,
        title: item.data.title,
        content: contents
      })
    })

    const index = await new Promise((resolve, reject) => {
      const documentIndexes = lunr(function () {
        this.ref('id')
        this.field('title')
        this.field('content')

        documents.forEach((doc) => {
          this.add(doc)
        })
      })

      resolve(documentIndexes)
    })

    const outputFilepath = path.join(this.config.outputDirectory, 'assets', 'search.json')
    await writers.json(outputFilepath, index)
  }

  async writeFeeds () {
    const { href: jsonUrl } = new URL('/feeds/json', this.data.site.url)
    const { href: atomUrl } = new URL('/feeds/atom', this.data.site.url)
    const { href: faviconUrl } = new URL('/assets/favicon.ico', this.data.site.url)

    const globalFeed = new Feed({
      title: this.data.site.title,
      description: this.data.site.description,
      id: this.data.site.url,
      link: this.data.site.url,
      // image: this.data.site.image,
      // favicon: faviconUrl,
      copyright: "",
      generator: "Earthball",
      feedLinks: {
        json: jsonUrl,
        atom: atomUrl
      }
    })

    const collectionFeeds = {}
    let shouldWriteGlobalAtomFeed = null
    let shouldWriteGlobalJsonFeed = null

    for (const collectionName in this.data.collections) {
      const collection = this.data.collections[collectionName]
      const collectionConfig = this.config.collections.find((item) => {
        return item.name === collectionName
      })

      const shouldCreateFeeds = collectionConfig.output.feeds

      collectionFeeds[collectionName] = new Feed() // TODO: feed config per collection

      if (shouldCreateFeeds.json) {
        shouldWriteGlobalJsonFeed = true
      }

      if (shouldCreateFeeds.atom) {
        shouldWriteGlobalAtomFeed = true

        for (const itemFilePath in collection) {
          const item = collection[itemFilePath]
          const { href: url } = new URL(item.data.permalink, item.data.site.url)

          globalFeed.addItem({
            title: item.data.title,
            id: url,
            link: url,
            description: item.data.description || item.file.slice(0, 200) + ' ...',
            content: item.file,
            // author: [], // TODO: authors data
            date: item.metadata.stats.birthtime, //TODO: more reliable timestamps
            image: item.data.image
          })
        }
      }

      const feedsOutputFilePath = path.join(this.config.outputDirectory, 'feeds')

      if (shouldWriteGlobalJsonFeed || shouldWriteGlobalAtomFeed) {
        await mkdirp(feedsOutputFilePath)
      }

      if (shouldWriteGlobalJsonFeed) {
        const globalFeedJsonOutputFilePath = path.join(this.config.outputDirectory, 'feeds', 'json')
        await writers.text(globalFeedJsonOutputFilePath, globalFeed.json1())
      }

      if (shouldWriteGlobalAtomFeed) {
        const globalFeedAtomOutputFilePath = path.join(this.config.outputDirectory, 'feeds', 'atom')
        await writers.text(globalFeedAtomOutputFilePath, globalFeed.atom1())
      }
    }
  }

  createInputFilePath (filePath) {
    return path.join(this.config.inputDirectory, filePath)
  }

  createOutputFilePath ({ parsedPath, data }, collection) {
    if (!collection.output) {
      return
    }

    if (data && data.permalink) {
      return path.join(this.config.outputDirectory, data.permalink, 'index.html')
    }

    const { name, dir } = parsedPath

    let filename = name === 'index' ? 'index' : path.join(name, 'index')
    filename += '.' + collection.output.fileType

    let dirname = dir
    if (collection.output.directory) {
      dirname = dirname.replace(collection.input.directory, collection.output.directory)
    }

    return path.join(this.config.outputDirectory, dirname, filename)
  }

  getCollection (parsedPath) {
    return this.config.collections.find((collection) => {
      if (collection.input.directory) {
        const dirname = parsedPath.dir.split('/')[0]
        return collection.input.directory && collection.input.directory === dirname
      } else if (collection.input.file) {
        const filepath = path.join(parsedPath.dir, parsedPath.base)
        return collection.input.file === filepath
      }

      return null
    })
  }

  async copyFile ({ filePath }) {
    const inputFilePath = this.createInputFilePath(filePath)
    const outputFilePath = path.join(this.config.outputDirectory, filePath)
    await mkdirp(path.dirname(outputFilePath))
    return fs.copyFile(inputFilePath, outputFilePath)
  }

  async removeFile ({ parsedPath }) {
    const collection = this.getCollection(parsedPath)
    const outputFilepath = this.createOutputFilePath(parsedPath, collection)
    return fs.rm(outputFilepath, { force: true })
  }
}

const noopLayout = {
  render ({ content }) {
    return content
  },
  data: {}
}

async function mkdirp (filepath) {
  try {
    return fs.mkdir(filepath, { recursive: true })
  } catch (e) {
    if (e.code === 'EEXIST') {
      return
    }

    throw e
  }
}

async function readTextFile (inputFilePath) {
  return fs.readFile(inputFilePath, 'utf8')
}

async function readJsonFile (inputFilePath) {
  const jsonFile = await readTextFile(inputFilePath)
  return JSON.parse(jsonFile)
}

async function readJavaScriptFile (inputFilePath) {
  const importfilePath = path.join(inputFilePath + `?q=${new Date().toISOString()}`)
  return import(importfilePath)
}

async function readCsvFile (inputFilePath) {
  return csvToJson().fromFile(inputFilePath)
}

const readers = {
  html: readTextFile,
  md: readTextFile,
  json: readJsonFile,
  js: readJavaScriptFile,
  csv: readCsvFile
}

async function writeTextFile (outputFilePath, content) {
  return fs.writeFile(outputFilePath, content)
}

async function writeJsonFile (outputFilePath, content) {
  const str = JSON.stringify(content)
  return fs.writeFile(outputFilePath, str)
}

const writers = {
  json: writeJsonFile,
  text: writeTextFile
}
