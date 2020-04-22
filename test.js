import levelgo from '.'
import { equal, deepEqual } from 'assert'
import rimraf from 'rimraf'

rimraf.sync('test-db')

let db = levelgo('test-db')

db.collection('books')
db.collection('movies')
db.books.registerIndex({ author: 1 })
db.books.registerIndex({ year: 1 })
db.books.registerIndex({ year: 1, author: 1 })
db.books.registerIndex({ 'meta.isbn': 1 })
db.books.registerIndex({ 'chapters.name': 1 })

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
    year: 1970,
    meta: {
      isbn: 123
    },
    chapters: [
      { 
        num: 2,
        name: 'test' 
      }
    ]
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

  const f2 = await db.books.find({})
  equal(f2.length, 3)

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

  await db.books.find({ title: 'Islands in the Stream' })
    .catch(err => err)
    .then(err => {
      equal(err.message, 'Index not found: books-by-title')
    })

  let batch = db.batch()
  batch.books.put('book5', { 
    author: 'Dr. Seuss', 
    title: 'The Cat in the Hat',
    year: 1957
  })
  const j1 = await db.books.find({ author: 'Dr. Seuss' })
  equal(j1.length, 1)
  
  batch = db.batch()
  batch.books.put('book5', { 
    author: 'Dr. Seuss', 
    title: 'The Cat in the Hat',
    year: 1957
  })
  batch.books.del('book4')
  batch.movies.put(1, 'Avatar')
  await batch.write()
  const j2 = await db.books.find({ year: 1957 })
  equal(j2.length, 1)
  const j3 = await db.books.find({ author: 'Dr. Seuss' })
  equal(j3.length, 2)
  const j4 = await db.books.find()
  equal(j4.length, 3)
  const j5 = await db.movies.get(1)
  equal(j5, 'Avatar')

  await db.close()

  db = levelgo('test-db')
  db.collection('books')
  db.books.registerIndex({ year: 1 })
  db.books.registerIndex({ 'meta.isbn': 1 })
  db.books.registerIndex({ 'chapters.name': 1 })

  const k = await db.books.find({ year: 1970 })
  equal(k.length, 2)

  await db.books.put(0, 'abc')
  const l = await db.books.get(0)
  equal(l, 'abc')

  const m = await db.books.find({ year: { $gt: 1969 } })
  equal(m.length, 2)

  const n1 = await db.books.find({ 
    'meta.isbn': 123
  })
  equal(n1.length, 1)

  const n2 = await db.books.find({ 
    'chapters.name': 'test',
    // 'chapters.num': { $gt: 1 }
  })
  // console.log(n2)
  // equal(n2.length, 1)
}

example()
  .then(() => console.log('PASS'))
  .catch(console.log)