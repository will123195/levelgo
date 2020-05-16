import level from 'level'
import sub from 'subleveldown'
import get from './get'
import product from './cartesianProduct'

function getIndexNamePrefix(collectionName) {
  return `${collectionName}-by-`
}

function getIndexName(collectionName, query) {
  const prefix = getIndexNamePrefix(collectionName)
  return `${prefix}${Object.keys(query).join('-')}`
}

// convert value into index key string based on the fields in 
// the config and append the id
function getIndexKey(config, id, value) {
  // if (id) console.log({ config, id, value })
  const indexedValues = Object.keys(config).map(field => {
    const indexedValue = get(value, field)
    if (indexedValue === null || indexedValue === undefined) return '!'
    return indexedValue
  })
  return `${indexedValues.join('!')}!${id}`
}

function isObject(value) {
  return value && typeof value === 'object'
}

// input: { a: 1, b: [{ c: 2 }, { c: 3 }] }
// output: [{ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }]
function cartesianNestedArrays(input) {
  if (!isObject(input)) return input
  const output = []
  const doc = JSON.parse(JSON.stringify(input))
  // process non-array, non-object keys
  Object.keys(doc).forEach(key => {
    const value = doc[key]
    if (Array.isArray(value) || isObject(value)) return
    doc[key] = value
  })
  // process object keys
  Object.keys(doc).forEach(key => {
    let value = doc[key]
    if (!isObject(value)) return
    doc[key] = cartesianNestedArrays(value)
  })
  // identify array keys
  const arrayKeys = {}
  Object.keys(doc).forEach(key => {
    const value = doc[key]
    if (Array.isArray(value) && value.length) {
      arrayKeys[key] = value
    }
  })
  if (!Object.keys(arrayKeys).length) return doc
  // create all permutations of the doc
  const arrayOfArrays = Object.keys(arrayKeys).map(key => arrayKeys[key])
  const cartesian = product(arrayOfArrays)
  cartesian.forEach(permutation => {
    permutation.forEach((value, i) => {
      const newDoc = { ...doc }
      const key = Object.keys(arrayKeys)[i]
      newDoc[key] = value
      output.push(newDoc)
    })
  })
  return output.length === 1 ? output[0] : output
}

function getIndexKeys(config, id, data) {
  let permutations = cartesianNestedArrays(data)
  permutations = Array.isArray(permutations) ? permutations : [permutations]
  const indexKeys = permutations.map(permutation => {
    return getIndexKey(config, id, permutation)
  })
  return [...new Set(indexKeys)]
}

function getReorderedQuery(collectionName, query, indices) {
  const prefix = getIndexNamePrefix(collectionName)
  const indexFields = Object.keys(indices).map(indexName => {
    return indexName.substr(prefix.length).split('-') 
  })
  const sIndices = indexFields.map(a => [...a].sort())
  const sQuery = Object.keys(query).sort()
  const n = sIndices.findIndex(fields => fields.join('-') === sQuery.join('-'))
  if (n === -1) return
  const fields = indexFields[n]
  const q = {}
  fields.forEach(field => {
    q[field] = query[field]
  })
  return q
}

export default function levelgo(path) {
  const db = level(path, { valueEncoding: 'json' })
  const listeners = {}
  const collectionNames = {}

  db.originalBatch = db.batch
  db.batch = () => {
    const batch = db.originalBatch()
    const batchDB = {}
    Object.keys(collectionNames).forEach(collectionName => {
      batchDB[collectionName] = {
        put: (key, value) => batch.put(`!${collectionName}!${key}`, value),
        del: key => batch.del(`!${collectionName}!${key}`)
      }
    })
    batchDB.write = () => {
      const { ops } = batch
      return batch.write().then(() => {
        return Promise.all(ops.map(op => {
          if (op.type === 'put') {
            const collectionName = op.key.split('!')[1]
            if (!db[collectionName] || !listeners[collectionName]) return
            return Promise.all(listeners[collectionName].map(listener => {
              const key = op.key.substr(collectionName.length + 2)
              return listener(key, op.value)
            }))
          }
        }))
      })
    }
    return batchDB
  }

  db.collection = collectionName => {
    const collection = sub(db, collectionName, { valueEncoding: 'json' })
    const indices = {}

    collection.registerIndex = config => {
      const indexName = getIndexName(collectionName, config)
      const index = sub(db, indexName, { valueEncoding: 'json' })
      indices[indexName] = index
      const listener = (key, value) => {
        const indexKeys = getIndexKeys(config, key, value)
        // console.log({ indexName, indexKeys })
        return Promise.all(indexKeys.map(indexKey => {
          return index.put(indexKey, Date.now())
        }))
      }
      listeners[collectionName] = listeners[collectionName] || []
      listeners[collectionName].push(listener)
      collection.on('put', listener)
    }

    function findAll() {
      return new Promise((resolve, reject) => {
        const results = []
        collection.createReadStream()
          .on('data', ({ value }) => results.push(value))
          .on('error', reject)
          .on('end', () => resolve(results))
      })
    }

    function isMatch(query, key) {
      let match = true
      const fields = Object.keys(query)
      const values = key.split('!')
      fields.forEach((field, i) => {
        const value = values[i]
        const queryValue = query[field]
        if (!queryValue || typeof queryValue !== 'object') {
          if (value !== String(queryValue)) match = false
          return
        }
        Object.keys(queryValue).forEach(operator => {
          // TODO: validate the operator value
          switch (operator) {
            case '$gt': if (value <= queryValue.$gt) match = false ;break
            case '$gte': if (value < queryValue.$gte) match = false ;break
            case '$lt': if (value >= queryValue.$lt) match = false ;break
            case '$lte': if (value > queryValue.$lte) match = false ;break
            case '$in': if (!queryValue.$in.includes(value)) match = false ;break
            case '$nin': if (queryValue.$nin.includes(value)) match = false ;break
            case '$eq': if (queryValue.$eq != value) match = false ;break
            case '$ne': if (queryValue.$ne == value) match = false ;break
          }
        })
      })
      return match
    }    

    function getRange(query) {
      const parts = []
      let isConditional = false
      Object.keys(query).some(field => {
        const value = query[field] 
        const isObject = value && typeof value === 'object'
        if (!isObject) {
          parts.push(value)
        } else {
          isConditional = true
        }
        return isObject
      })
      const key = parts.join('!')
      return {
        gt: `${key}!`, 
        lt: isConditional ? `${key}~` : `${key}!~`,
        isConditional
      }
    }

    function find(index, query) {
      return new Promise((resolve, reject) => {
        const results = {}
        const { gt, lt, isConditional } = getRange(query)
        index.createReadStream({ gt, lt })
          .on('data', ({ key }) => {
            if (!isConditional || isMatch(query, key)) {
              const n = key.lastIndexOf('!') + 1
              const collectionKey = key.substr(n)
              results[collectionKey] = true
            }
          })
          .on('error', reject)
          .on('end', () => {
            Promise.all(Object.keys(results).map(key => {
              return collection.get(key).catch(() => index.del(key))
            }))
              .then(docs => docs.filter(Boolean))
              .then(resolve)
          })
      })
    }

    collection.find = query => {
      return Promise.resolve()
        .then(() => {
          if ((!query && query !== 0) || !Object.keys(query).length) {
            return findAll()
          }
          const indexName = getIndexName(collectionName, query)
          let index = indices[indexName]
          if (!index) {
            const reorderedQuery = getReorderedQuery(collectionName, query, indices)
            if (!reorderedQuery) {
              throw new Error(`Index not found: ${indexName}`)
            }
            index = indices[getIndexName(collectionName, reorderedQuery)]
            return find(index, reorderedQuery)
          } 
          return find(index, query)
        })
    }

    collectionNames[collectionName] = true
    db[collectionName] = collection
  }

  return db
}
