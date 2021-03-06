import utils from './utils.js'

const noop = utils.noop

const min = {}
export default min

/**
 * Set the field in the hash on the key with the value
 * @param  {String}   key      Hash key
 * @param  {String}   field    field to set
 * @param  {Mix}   value       value
 * @param  {Function} callback Callback
 * @return {Promise}           promise object
 */
min.hset = function(key, field, value, callback = noop) {
  const promise = new Promise((resolve, reject) => {
    // check the key status
    this.exists(key, (err, exists) => {
      if (err) {
        reject(err)
        return callback(err)
      }

      if (exists) {
        // fetch the value
        this.get(key, (err, body) => {
          if (err) {
            reject(err)
            return callback(err)
          }

          // update the hash
          body[field] = value

          this.set(key, body, err => {
            if (err) {
              reject(err)
              return callback(err)
            }

            resolve([key, field, value])
            callback(null, key, field, value)
          })
        })
      } else {
        // create a hash
        const body = {}

        body[field] = value

        this.set(key, body, err => {
          if (err) {
            reject(err)
            return callback(err)
          }

          this._keys[key] = 1

          resolve([key, field, value])
          callback(null, key, field, value)
        })
      }

    })
  })
  promise.then(_ => this.emit('hset', key, field, value))

  return promise
}

/**
 * Set the value of a hash field, only if the field does not exist
 * @param  {String}   key      key
 * @param  {String}   field    hash field
 * @param  {Mix}   value       value
 * @param  {Function} callback Callback
 * @return {Promise}            promise
 */
min.hsetnx = function(key, field, value, callback = noop) {
  return new Promise((resolve, reject) => {
    this.hexists(key, field, (err, exists) => {
      if (err) {
        reject(err)
        return callback(err)
      }

      if (!exists) {
        this.hset(key, field, value)
          .then(function([key, field, value]) {
            resolve([key, field, value])
            callback(null, key, field, value)
          })
      } else {
        const err = new Error('The field of the hash is exists')

        reject(err)
        return callback(err)
      }
    })
  })
}

/**
 * Set multiple hash fields to multiple values
 * @param  {String}   key      key
 * @param  {Object}   docs     values
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hmset = function(key, docs, callback = noop) {
  const keys = Object.keys(docs)

  let i = 0

  const results = []
  const errors = []

  return new Promise((resolve, reject) => {
    const next = (field, index) => {
      delete keys[index]

      this.hset(key, field, docs[field])
        .then(([key, field, value]) => {
          results.push([key, field, value])

          i++
          if (keys[i]) {
            next(keys[i], i)
          } else {
            out()
          }
        }, err => {
          errors.push(err)

          i++
          if (keys[i]) {
            return next(keys[i], i)
          } else {
            return out()
          }
        })
    }

    function out() {
      if (errors.length > 0) {
        callback(errors)
        reject(errors)
      } else {
        callback(null, results)
        resolve(results)
      }
    }

    next(keys[i], i)
  })
}

/**
 * Get the value of a hash field
 * @param  {String}   key      key
 * @param  {String}   field    hash field
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hget = function(key, field, callback = noop) {
  return new Promise((resolve, reject) => {

    this.hexists(key, field, (err, exists) => {
      if (err) {
        reject(err)
        return callback(err)
      }

      if (exists) {
        this.get(key)
          .then(
            value => {
              const data = value[field]
              resolve(data)
              callback(null, data)
            },
            err => {
              reject(err)
              callback(err)
            }
          )
      } else {
        const err = new Error('no such field')

        reject(err)
        callback(err)
      }
    })
  })
}

/**
 * Get the values of all the given hash fields
 * @param  {String}   key      key
 * @param  {Array}   fields    hash fields
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hmget = function(key, fields, callback = noop) {
  return new Promise((resolve, reject) => {
    const multi = this.multi()

    fields.forEach(field => {
      multi.hget(key, field)
    })

    multi.exec((err, replies) => {
      if (err) {
        callback(err)
        return reject(err)
      }

      resolve(replies)
      callback(null, replies)
    })
  })
}

/**
 * Get all the fields and values in a hash
 * @param  {String}   key      key
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hgetall = function(key, callback = noop) {
  return new Promise((resolve, reject) => {
    this.exists(key, (err, exists) => {
      if (err) {
        callback(err)
        return reject(err)
      }

      if (exists) {
        this.get(key)
          .then(data => {
            resolve(data)
            callback(null, data)
          })
          .catch(err => {
            reject(err)
            callback(err)
          })
      } else {
        const err = new Error('no such key')

        callback(err)
        return reject(err)
      }
    })
  })
}

/**
 * Delete one hash field
 * @param  {String}   key      key
 * @param  {String}   field    hash field
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hdel = function(key, field, callback = noop) {
  const promise = new Promise((resolve, reject) => {
    this.hexists(key, field, (err, exists) => {
      if (err) {
        callback(err)
        return reject(err)
      }

      if (exists) {
        this.get(key)
          .then(
            data => {
              const removed = data[field]
              delete data[field]

              this.set(key, data)
                .then(
                  _ => {
                    resolve([key, field, removed])
                    callback(null, key, field, removed)
                  },
                  err => {
                    reject(err)
                    callback(err)
                  }
                )
            },
            err => callback(err)
          )
      } else {
        const err = new Error('no such key')

        callback(err)
        return reject(err)
      }
    })
  })

  promise.then(([key, field, value]) => {
    this.emit('hdel', key, field, value)
  })

  return promise
}

/**
 * Get the number of fields in a hash
 * @param  {String}   key      key
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hlen = function(key, callback = noop) {
  return new Promise((resolve, reject) => {
    this.exists(key, (err, exists) => {
      if (err) {
        reject(err)
        return callback(err)
      }

      if (exists) {
        this.get(key)
          .then(
            data => {
              const length = Object.keys(data).length

              resolve(length)
              callback(null, length)
            },
            err => {
              reject(err)
              callback(err)
            }
          )
      } else {
        resolve(0)
        callback(null, 0)
      }
    })
  })
}

/**
 * Get all the fields in a hash
 * @param  {String}   key      key
 * @param  {Function} callback Callback
 * @return {Promise}           promise
 */
min.hkeys = function(key, callback = noop) {
  return new Promise((resolve, reject) => {

    this.exists(key, (err, exists) => {
      if (err) {
        reject(err)
        return callback(err)
      }

      if (exists) {
        this.get(key)
          .then(
            data => {
              const keys = Object.keys(data)

              resolve(keys)
              callback(null, keys)
            },
            err => {
              reject(err)
              callback(err)
            }
          )
      } else {
        resolve([])
        callback(null, [])
      }
    })
  })
}

/**
 * Determine if a hash field exists
 * @param  {String}   key      key of the hash
 * @param  {String}   field    the field
 * @param  {Function} callback Callback
 * @return {Promise}           promise object
 */
min.hexists = function(key, field, callback = noop) {
  return new Promise((resolve, reject) => {
    this.exists(key)
      .then(exists => {
        if (exists) {
          return this.get(key)
        } else {
          resolve(false)
          callback(null, false)
        }
      })
      .then(value => {
        if (value.hasOwnProperty(field)) {
          resolve(true)
          callback(null, true)
        } else {
          resolve(false)
          callback(null, false)
        }
      }, err => {
        reject(err)
        callback(err)
      })
  })
}

min.hincr = function(key, field, callback = noop) {
  const promise = new Promise((resolve, reject) => {
    this.hexists(key, field)
      .then(exists => {
        if (exists) {
          return this.hget(key, field)
        } else {
          const p = new Promise()

          p.resolve(0)

          return p
        }
      })
      .then(curr => {
        if (isNaN(parseFloat(curr))) {
          const err = new Error('value wrong')
          reject(err)
          return callback(err)
        }

        curr = parseFloat(curr)

        return this.hset(key, field, ++curr)
      })
      .then(([ , , value ]) => {
        resolve(value)
        callback(null, value)
      }, err => {
        reject(err)
        callback(null, err)
      })
  })

  promise.then(curr => this.emit('hincr', key, field, curr))

  return promise
}

min.hincrby = function(key, field, increment, callback = noop) {
  const promise = new Promise((resolve, reject) => {

    this.hexists(key, field)
      .then(exists => {
        if (exists) {
          return this.hget(key, field)
        } else {
          const p = new Promise()

          p.resolve(0)

          return p
        }
      })
      .then(curr => {
        if (isNaN(parseFloat(curr))) {
          const err = new Error('value wrong')
          reject(err)
          return callback(err)
        }

        curr = parseFloat(curr)

        return this.hset(key, field, curr + increment)
      })
      .then(([ , , value ]) => {
        resolve(value)
        callback(null, value)
      }, err => {
        reject(err)
        callback(null, err)
      })

  })

  promise.then(curr => {
    this.emit('hincr', key, field, curr)
  })
  return promise
}

min.hincrbyfloat = min.hincrby

min.hdecr = function(key, field, callback = noop) {
  const promise = new Promise((resolve, reject) => {
    this.hexists(key, field)
      .then(exists => {
        if (exists) {
          return this.hget(key, field)
        } else {
          const p = new Promise()

          p.resolve(0)

          return p
        }
      })
      .then(curr => {
        if (isNaN(parseFloat(curr))) {
          const err = new Error('value wrong')
          reject(err)
          return callback(err)
        }

        curr = parseFloat(curr)

        return this.hset(key, field, --curr)
      })
      .then(([ , , value ]) => {
        resolve(value)
        callback(null, value)
      }, err => {
        reject(err)
        callback(err)
      })
  })

  promise.then(curr => {
    this.emit('hdecr', key, field, curr)
  })

  return promise
}

min.hdecrby = function(key, field, decrement, callback = noop) {
  const promise = new Promise((resolve, reject) => {
    this.hexists(key, field)
      .then(exists => {
        if (exists) {
          return this.hget(key, field)
        } else {
          var p = new Promise()

          p.resolve(0)

          return p
        }
      })
      .then(curr => {
        if (isNaN(parseFloat(curr))) {
          let err = new Error('value wrong')
          reject(err)
          return callback(err)
        }

        curr = parseFloat(curr)

        return this.hset(key, field, curr - decrement)
      })
      .then(([ , , value ]) => {
        resolve(value)
        callback(null, value)
      }, err => {
        reject(err)
        callback(null, err)
      })
  })

  promise.then(curr => this.emit('hincr', key, field, curr))

  return promise
}

min.hdecrbyfloat = min.hdecrby
