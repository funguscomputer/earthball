import CustomError from 'custom-error-class'

/*
  TODO:
  provide useful, detailed error messages
*/

export class FileNotFound extends CustomError {
  constructor () {
    super('an error happened')
    this.code = 'E_EARTHBALL_FILE_NOT_FOUND'
  }
}

export class FilenameConflict extends CustomError {
  constructor () {
    super('an error happened')
    this.code = 'E_EARTHBALL_FILENAME_EXISTS'
  }
}

export class DataKeyConflict extends CustomError {
  constructor () {
    super('an error happened')
    this.code = 'E_EARTHBALL_DATA_KEY_EXISTS'
  }
}
