import { Liquid } from 'liquidjs'

function transform (config) {
  return async function ({ file, data, metadata, collection }) {
    const engine = new Liquid({
      extname: '.html'
    })

    const tpl = engine.parse(file)
    const body = await engine.render(tpl, data)

    return {
      file: body,
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
