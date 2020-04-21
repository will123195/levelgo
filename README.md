# levelgo

Indexed collections and transactions for LevelDB (inspired by MongoDB)

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

// transaction
const batch = db.batch()
batch.books.del('book1')
await batch.write()
```

## API

#### <code>db = levelgo( location )</code>
- `location` {String} path of the LevelDB location to be opened, or in browsers, the name of the IDBDatabase to be opened

#### <code>db.collection( name )</code>
- `name` {String} name of the collection to initialize

## Collection methods

#### <code>db.*name*.del( id )</code>
- `id` {String|Number} primary key of the value to delete

#### <code>db.*name*.find( [query] )</code>
- `query` {Object} optional selection filter. An index with the same fields must be registered. If blank or empty object, returns all values in the collection.

#### <code>db.*name*.get( id )</code>
- `id` {String|Number} primary key of the value to retrieve

#### <code>db.*name*.put( id, value )</code>
- `id` {String|Number} primary key of the value to store
- `value` {mixed} any stringify-able value to store in the collection

#### <code>db.*name*.registerIndex( fields )</code>
- `fields` {Object} fields to be indexed. Always set the value of each field to `1` since only ascending indices are currently supported.

### Transactions

#### `batch = db.batch()`
#### `batch.write()` 
