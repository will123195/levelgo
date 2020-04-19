# levelgo

LevelDB with indexing and collections for Node.js

## Install

```
npm i levelgo
```

## Example

```js
import levelgo from 'levelgo'

const db = levelgo('example-db')

db.collection('books')  
db.books.createIndex({ author: 1 })

await db.books.put('book1', { 
  author: 'Hemingway', 
  title: 'Islands in the Stream',
  year: 1970
})

const book = await db.books.get('book1')
const books = await db.books.find({ author: 'Hemingway' })
```
