import assert from 'node:assert/strict'
import test from 'node:test'
import { streamingJsonField } from './stream-json-field.ts'

test('streamingJsonField reads a growing JSON string field', () => {
  assert.equal(streamingJsonField('', 'content'), '')
  assert.equal(streamingJsonField('{"content":"', 'content'), '')
  assert.equal(streamingJsonField('{"content":"向量', 'content'), '向量')
  assert.equal(streamingJsonField('{"content":"向量与空间变换\\n核心是"}', 'content'), '向量与空间变换\n核心是')
  assert.equal(streamingJsonField('```json\n{ "content" : "hello" }', 'content'), 'hello')
})
