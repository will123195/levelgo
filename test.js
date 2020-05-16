import levelgo from '.'
import { equal, deepEqual, ok } from 'assert'
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
db.books.registerIndex({ 'chapters.name': 1, 'chapters.num': 1 })
db.books.registerIndex({ 'tags': 1 })
db.books.registerIndex({ 'chapters.length': 1 })

async function example() {
  await db.books.put('book1', { 
    author: 'Hemingway', 
    title: 'Islands in the Stream',
    year: 1970,
    chapters: [
      { num: 4, name: 'A' }
    ],
    tags: ['classic']
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
    meta: [
      { isbn: 123 },
      { isbn: 234 }
    ],
    chapters: [
      { num: 1, name: 'A' },
      { num: 2, name: 'B' }
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
  // TODO: await levelgo() will allow persisting indices instead of registering them every time
  db.books.registerIndex({ year: 1 })
  db.books.registerIndex({ year: 1, author: 1 })
  db.books.registerIndex({ 'meta.isbn': 1 })
  db.books.registerIndex({ 'chapters.name': 1 })
  db.books.registerIndex({ 'chapters.name': 1, 'chapters.num': 1 })
  db.books.registerIndex({ 'tags': 1 })
  db.books.registerIndex({ 'chapters.length': 1 })

  const k = await db.books.find({ year: 1970 })
  equal(k.length, 2)

  await db.books.put(0, 'abc')
  const l = await db.books.get(0)
  equal(l, 'abc')

  const m1 = await db.books.find({ year: { $gt: 1969 } })
  equal(m1.length, 2)

  const m2 = await db.books.find({ 
    author: { $gte: 'H' },
    year: 1970
  })
  equal(m2.length, 1)

  const m3 = await db.books.find({ 
    author: 'Dr. Seuss',
    year: { $gt: 1969 } 
  })
  equal(m3.length, 1)

  const n1 = await db.books.find({ 
    'meta.isbn': 123
  })
  equal(n1.length, 1)

  const n2 = await db.books.find({ 
    'chapters.name': 'A'
  })
  equal(n2.length, 2)

  const n3 = await db.books.find({ 
    'chapters.name': 'A',
    'chapters.num': { $lte: 2 }
  })
  equal(n3.length, 1)

  const n4 = await db.books.find({ 
    'chapters.name': 'A',
    'chapters.num': { $gte: 1, $lt: 5 }
  })
  equal(n4.length, 2)

  const n5 = await db.books.find({ 
    tags: 'classic'
  })
  equal(n5.length, 1)

  const o1 = await db.books.find({ 'meta.isbn': { $eq: 123 } })
  equal(o1.length, 1)

  const o2 = await db.books.find({ 'chapters.name': { $eq: 'B' } })
  equal(o2.length, 1)

  const o3 = await db.books.find({ 'chapters.name': { $gt: null, $ne: 'A' } })
  equal(o3.length, 1)

  const o4 = await db.books.find({ 'chapters.name': { $in: ['A', 'B'] } })
  equal(o4.length, 2)

  const o5 = await db.books.find({ 'chapters.name': { $gt: null, $nin: ['A', 'C'] } })
  equal(o5.length, 1)

  const p1 = await db.books.find({ 'chapters.length': 2 })
  equal(p1.length, 1)

  await db.books.put('zero', { year: 0 })
  const q1 = await db.books.find({ year: 0 })
  ok(q1[0].year === 0)

  await db.books.put('zero+array[]', { year: 0, b: [] })
  const q1a = await db.books.find({ year: 0 })
  equal(q1a.length, 2)
  ok(q1a[0].year === 0)

  await db.books.put('zero+array[1]', { year: 0, b: [0] })
  const q1b = await db.books.find({ year: 0 })
  equal(q1b.length, 3)
  ok(q1b[2].year === 0)

  await db.books.put('zero+emptyobj', { year: 0, b: {} })
  const q1c = await db.books.find({ year: 0 })
  equal(q1c.length, 4)
  ok(q1c[3].year === 0)

  await db.books.put('false', { year: false })
  const q2 = await db.books.find({ year: false })
  ok(q2[0].year === false)
  equal(q2.length, 1)

  await db.books.put('null', { year: null })
  const q3 = await db.books.find({ year: null })
  equal(q3.length, 2)

  const q4 = await db.books.find({ year: undefined })
  equal(q4.length, 2)

  await db.books.put('empty', { year: '' })
  const q5 = await db.books.find({ year: '' })
  equal(q5.length, 3)

  const r1 = await db.books.findKeys({ year: 0 })
  equal(r1.length, 4)
  deepEqual(r1, ['zero', 'zero+array[1]', 'zero+array[]', 'zero+emptyobj'])

  const r2 = await db.books.findKeys()
  equal(r2[1], 'book1')
  equal(r2.length, 11)
}

example()
  .then(() => console.log('PASS'))
  .catch(console.log)