import * as path from 'path'
import { promises as fs } from 'fs'

import CheapWatch from 'cheap-watch'

export default class DirectoryWatcher {
  constructor (config) {
    const {
      directoryPath,
      watch = true,
      isIgnoreMatch,
      onInit,
      afterInit,
      onChange,
      onDestroy
    } = config

    this.directoryPath = directoryPath
    this._watcher = new CheapWatch({ dir: directoryPath })
    this.watch = watch
    this.watchedFilePaths = null
    this.isIgnoreMatch = isIgnoreMatch
    this.onInit = onInit
    this.afterInit = afterInit
    this.onChange = onChange
    this.onDestroy = onDestroy
  }

  async parseFilePath (filePath) {
    const projectRootFilePath = path.join(this.directoryPath, filePath)
    const parsedPath = path.parse(filePath)
    const stats = await fs.stat(projectRootFilePath)
    return { filePath, projectRootFilePath, parsedPath, stats }
  }

  async start () {
    await this._watcher.init()
    this.watchedFilepaths = this._watcher.paths

    for (const [filePath] of this.watchedFilepaths) {
      if (this.onInit && !this.isIgnoreMatch(filePath)) {
        const { projectRootFilePath, parsedPath, stats } = await this.parseFilePath(filePath)
        await this.onInit({ filePath, parsedPath, stats, projectRootFilePath })
      }
    }

    if (this.afterInit) {
      await this.afterInit(this.watchedFilepaths)
    }

    if (!this.watch) {
      this.close()
      return
    }

    this._watcher.on('+', async ({ path: filePath, isNew }) => {
      if (this.onChange && !this.isIgnoreMatch(filePath)) {
        const { projectRootFilePath, parsedPath, stats } = await this.parseFilePath(filePath)
        await this.onChange({ filePath, parsedPath, stats, projectRootFilePath, isNew })
      }
    })

    this._watcher.on('-', async ({ path: filePath }) => {
      if (this.onDestroy && !this.isIgnoreMatch(filePath)) {
        const projectRootFilePath = path.join(this.directoryPath, filePath)
        await this.onDestroy({ filePath, projectRootFilePath })
      }
    })
  }

  emit (event, data) {
    this._watcher.emit(event, data)
  }

  close () {
    this._watcher.close()
  }
}
