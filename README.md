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
db.begin()
db.books.del('book1')
await db.commit()
```

## API

#### <code>db = levelgo( location )</code>
- `location` {String} path of the LevelDB location to be opened, or in browsers, the name of the IDBDatabase to be opened

#### <code>db.collection( colName )</code>
- `colName` {String} name of the collection to initialize

## Collection methods

#### <code>db.*myCollection*.del( id )</code>
- `id` {String|Number} primary key of the value to delete

#### <code>db.*myCollection*.find( [query] )</code>
- `query` {Object} optional selection filter. An index with the same fields must be registered. If blank or empty object, returns all values in the collection.

#### <code>db.*myCollection*.get( id )</code>
- `id` {String|Number} primary key of the value to retrieve

#### <code>db.*myCollection*.put( id, value )</code>
- `id` {String|Number} primary key of the value to store
- `value` {mixed} any stringify-able value to store in the collection

#### <code>db.*myCollection*.registerIndex( fields )</code>
- `fields` {Object} fields to be indexed. Always set the value of each field to `1` since only ascending indices are currently supported.

### Transactions

#### `db.begin()`
#### `db.commit()` 
#### `db.rollback()`
