import parse from 'front-matter'

function transform () {
  return async function ({ file, data, metadata, collection }) {
    const { attributes, body } = parse(file)

    return {
      file: body,
      data: Object.assign(data, attributes),
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
