# levity

LevelDB with indexing and collections for Node.js

## Install

```
npm i levity
```

## Example

```js
import levity from 'levity'

const db = levity('example-db')

db.collection('books')  
db.books.createIndex({ author: 1 })

await db.books.put('book1', { 
  author: 'Hemmingway', 
  title: 'Islands in the Stream',
  year: 1970
})

const book = await db.books.get('book1')
const books = await db.books.find({ author: 'Hemmingway' })
```
