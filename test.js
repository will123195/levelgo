import levity from '.'
import { equal, deepEqual } from 'assert'
import rimraf from 'rimraf'

rimraf.sync('test-db')

const db = levity('test-db')

db.collection('books')
db.books.createIndex({ author: 1 })
db.books.createIndex({ year: 1 })
db.books.createIndex({ year: 1, author: 1 })

async function example() {
  await db.books.put('book1', { 
    author: 'Hemingway', 
    title: 'Islands in the Stream',
    year: 1970
  })
  await db.books.put('book2', { 
    author: 'Hemingway', 
    title: 'The Old Man and the Sea',
    year: 1952
  })
  await db.books.put('book3', { 
    author: 'Dr. Seuss', 
    title: 'Mr. Brown Can Moo! Can You?',
    year: 1970
  })
  
  const a = await db.books.find({ author: 'Tolstoy' })
  deepEqual(a, [])

  const b = await db.books.find({ author: 'Hemingway' })
  equal(b.length, 2)

  const c = await db.books.find({ year: 1970 })
  equal(c.length, 2)

  const d = await db.books.find({ author: 'Hemingway', year: 1970 })
  equal(d.length, 1)
  equal(d[0].title, 'Islands in the Stream')

  const e = await db.books.find({ year: 1970, author: 'Hemingway' })
  equal(e.length, 1)
  equal(d[0].title, 'Islands in the Stream')
  
  const f = await db.books.find()
  equal(f.length, 3)

  await db.books.del('book2')

  const g = await db.books.find({ author: 'Hemingway' })
  equal(g.length, 1)

  await db.books.put('book4', { 
    author: 'Will', 
    title: 'My Book'
  })

  const h = await db.books.find({ year: 1970 })
  equal(h.length, 2)

  const i = await db.books.find({ year: null })
  equal(i.length, 1)
}

example()
  .then(() => console.log('PASS'))
  .catch(console.log)