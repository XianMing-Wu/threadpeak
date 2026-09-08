import assert from 'node:assert/strict'
export async function verifyNestedTransactions(db){
  await db.query('CREATE TEMP TABLE tp_nested_test (value text)')
  await assert.rejects(db.transaction(async tx=>{
    await tx.query("INSERT INTO tp_nested_test VALUES('outer')")
    await tx.transaction(async nested=>{await nested.query("INSERT INTO tp_nested_test VALUES('inner')")})
    throw Error('rollback outer')
  }),/rollback outer/)
  assert.deepEqual(await db.query('SELECT * FROM tp_nested_test'),[])
  await db.transaction(async tx=>{
    await tx.query("INSERT INTO tp_nested_test VALUES('retained')")
    await assert.rejects(tx.transaction(async nested=>{
      await nested.query("INSERT INTO tp_nested_test VALUES('rolled-back')")
      await nested.query('SELECT invalid_column')
    }))
    await Promise.all([tx.transaction(async nested=>nested.query("INSERT INTO tp_nested_test VALUES('sibling-a')")),tx.transaction(async nested=>nested.query("INSERT INTO tp_nested_test VALUES('sibling-b')"))])
  })
  assert.deepEqual((await db.query('SELECT value FROM tp_nested_test ORDER BY value')).map(r=>r.value),['retained','sibling-a','sibling-b'])
  await db.query('DROP TABLE tp_nested_test')
}
