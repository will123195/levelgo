# levelgo

Indexed collections for LevelDB (inspired by MongoDB)

## Install

```
npm i levelgo
```

## Example

```js
import levelgo from 'levelgo'

const db = levelgo('example-db')

db.collection('books')  
db.books.registerIndex({ author: 1 })

await db.books.put('book1', { 
  author: 'Hemingway', 
  title: 'Islands in the Stream',
  year: 1970
})

const book = await db.books.get('book1')
const books = await db.books.find({ author: 'Hemingway' })
```

## API

#### `db = levelgo( location )`
- `location` {String} path of the LevelDB location to be opened, or in browsers, the name of the IDBDatabase to be opened

#### `db.collection( colName )`
- `colName` {String} name of the collection to initialize

#### `db.*colName*.find( [query] )`
- `query` {Object} optional selection filter. An index with the same fields must be registered. If blank or empty object, returns all values in the collection.

#### `db.*colName*.get( id )`
- `id` {String|Number} primary key of the value to retrieve

#### `db.*colName*.registerIndex( fields )`
- `fields` {Object} fields to be indexed. Always set the value of each field to `1` since only ascending indices are currently supported.

#### `db.*colName*.put( id, value )`
- `id` {String|Number} primary key of the value to store
- `value` {mixed} any serializable value to store in the collection