import * as path from 'path'
import { promises as fs } from 'fs'
import { Liquid } from 'liquidjs'

const engine = new Liquid()

export async function transformSourceTemplate (inputDirectoryPath, outputDirectoryPath, data = {}) {
  const inputFilePaths = new Set()

  async function readdirRecursive (inputDirectoryPath) {
    const stats = await fs.stat(inputDirectoryPath)
    if (stats.isDirectory()) {
      const results = await fs.readdir(inputDirectoryPath)
      const recursiveResults = results.map((value) => {
        return readdirRecursive(path.join(inputDirectoryPath, value))
      })

      await Promise.all(recursiveResults)
    } else {
      inputFilePaths.add(inputDirectoryPath)
    }
  }

  await readdirRecursive(inputDirectoryPath)

  const outputFilePaths = new Set()
  for (let inputFilePath of inputFilePaths) {
    const outputFilePath = inputFilePath.replace(inputDirectoryPath, outputDirectoryPath)
    outputFilePaths.add(outputFilePath)
    const content = await fs.readFile(inputFilePath, 'utf8')
    const template = engine.parse(content)
    const transformedContent = await engine.render(template, data)
    await fs.mkdir(path.dirname(outputFilePath), { recursive: true })
    await fs.writeFile(outputFilePath, transformedContent)
  }

  return outputFilePaths
}
