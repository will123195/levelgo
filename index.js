import level from 'level'
import sub from 'subleveldown'
import get from './get'

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
    return get(value, field) || '!'
  })
  return `${indexedValues.join('!')}!${id}`
}

// TODO: index multiple chapter names if chapters is an array
// { 
//   config: { 'chapters.name': 1 },
//   key: 'book5',
//   value: { author: 'Dr. Seuss', chapters: [ { name: 'test' } ] } 
// }
function getIndexKeys(config, key, value) {
  return [getIndexKey(config, key, value)]
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

    function isConditionalQuery(query) {
      let isConditional = false
      Object.keys(query).forEach(field => {
        const queryValue = query[field]
        if (queryValue && typeof queryValue === 'object') isConditional = true
      })
      return isConditional
    }

    function isMatch(query, key) {
      let match = true
      const fields = Object.keys(query)
      const values = key.split('!')
      fields.forEach((field, i) => {
        const value = values[i]
        const queryValue = query[field]
        if (!queryValue || typeof queryValue !== 'object') return
        // console.log({ query, key, queryValue, value })
        Object.keys(queryValue).forEach(operator => {
          switch (operator) {
            case '$gt': if (value <= queryValue.$gt) match = false
            case '$gte': if (value < queryValue.$gte) match = false
            case '$lt': if (value >= queryValue.$lt) match = false
            case '$lte': if (value > queryValue.$lte) match = false
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
        const results = []
        // const isConditional = isConditionalQuery(query)
        // const gt = getIndexKey(query, '', query)
        // const lt = `${gt}~`
        // TODO: optimize getRange for compound index
        // i.e. { author: 'Hemingway', year: { $gt: 1969 } }
        const { gt, lt, isConditional } = getRange(query)
        // console.log({ gt, lt, isConditional })
        index.createReadStream({ gt, lt })
          .on('data', ({ key }) => {
            if (!isConditional || isMatch(query, key)) {
              results.push(key)
            }
          })
          .on('error', reject)
          .on('end', () => {
            Promise.all(results.map(indexKey => {
              const n = indexKey.lastIndexOf('!') + 1
              const key = indexKey.substr(n)
              return collection.get(key).catch(() => index.del(indexKey))
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
