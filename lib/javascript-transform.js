function transform () {
  return async function ({ file, data, metadata, collection }) {
    const body = await file.render({ data })

    return {
      file: body,
      data,
      metadata,
      collection
    }
  }
}

const config = {
  fileType: ['js']
}

export default {
  transform,
  config
}
