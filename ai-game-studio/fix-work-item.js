/**
 * Quick fix script to change a work item from 'completed' back to 'error'
 * so it can be resumed.
 *
 * Usage: node fix-work-item.js
 */

const db = require('./services/db');

// Find the most recent completed work item
const stmt = db.db.prepare(`
  SELECT * FROM work_queue
  WHERE status = 'completed'
  ORDER BY completed_at DESC
  LIMIT 5
`);

const items = stmt.all();

if (items.length === 0) {
  console.log('No completed work items found');
  process.exit(0);
}

console.log('Recent completed work items:');
items.forEach((item, i) => {
  console.log(`${i + 1}. [${item.id}] ${item.description.substring(0, 60)}...`);
  console.log(`   Project: ${item.project_id}, Status: ${item.status}`);
  console.log(`   Pipeline: ${item.pipeline_id || 'none'}`);
  console.log('');
});

// Fix the most recent one
const toFix = items[0];
console.log(`Fixing work item ${toFix.id}...`);

db.updateWorkStatus(toFix.id, 'error');

console.log(`Done. Work item ${toFix.id} is now 'error' status.`);
console.log('Restart the server and the resume banner should appear.');
