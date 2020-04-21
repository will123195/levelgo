import level from 'level'
import sub from 'subleveldown'

function getIndexNamePrefix(collectionName) {
  return `${collectionName}-by-`
}

function getIndexName(collectionName, query) {
  const prefix = getIndexNamePrefix(collectionName)
  return `${prefix}${Object.keys(query).join('-')}`
}

function getIndexKey(query, key, value) {
  const indexedValues = Object.keys(query).map(field => value[field] || '!')
  return `${indexedValues.join('!')}!${key}`
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
  const db = level(path)

  db.collection = collectionName => {
    const collection = sub(db, collectionName, { valueEncoding: 'json' })
    const indices = {}

    collection.registerIndex = indexKeys => {
      const indexName = getIndexName(collectionName, indexKeys)
      const index = sub(db, indexName, { valueEncoding: 'json' })
      indices[indexName] = index

      collection.on('put', (key, value) => {
        const indexKey = getIndexKey(indexKeys, key, value)
        index.put(indexKey, Date.now())
      })
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

    function find(index, query) {
      return new Promise((resolve, reject) => {
        const results = []
        const gt = getIndexKey(query, '', query)
        const lt = `${gt}~`
        index.createReadStream({ gt, lt })
          .on('data', ({ key }) => results.push(key))
          .on('error', reject)
          .on('end', () => {
            Promise.all(results.map(indexKey => {
              const n = indexKey.lastIndexOf('!') + 1
              const key = indexKey.substr(n)
              return collection.get(key)
                .catch(() => index.del(indexKey))
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

    db[collectionName] = collection
  }

  return db
}
