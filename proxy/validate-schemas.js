#!/usr/bin/env node
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

const schemasDir = path.join(__dirname, 'schemas');
const results = {
  schemas: {},
  summary: { passed: 0, failed: 0, examples: { valid: 0, invalid: 0 } }
};

// Get all schema files
const schemaFiles = fs.readdirSync(schemasDir)
  .filter(f => f.endsWith('.schema.json'));

console.log('='.repeat(60));
console.log('JSON Schema Validation Report');
console.log('='.repeat(60));

for (const schemaFile of schemaFiles) {
  const schemaName = schemaFile.replace('.schema.json', '');
  const schemaPath = path.join(schemasDir, schemaFile);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  console.log(`\n## ${schemaName}`);
  results.schemas[schemaName] = { valid: false, validExamples: [], invalidExamples: [], errors: [] };

  let validate;
  try {
    validate = ajv.compile(schema);
    console.log('  ✅ Schema compiles successfully');
    results.schemas[schemaName].valid = true;
    results.summary.passed++;
  } catch (err) {
    console.log(`  ❌ Schema compilation failed: ${err.message}`);
    results.schemas[schemaName].errors.push(err.message);
    results.summary.failed++;
    continue;
  }

  // Check valid examples
  const validDir = path.join(schemasDir, 'examples', schemaName, 'valid');
  if (fs.existsSync(validDir)) {
    const validFiles = fs.readdirSync(validDir).filter(f => f.endsWith('.json'));
    console.log(`  Valid examples (${validFiles.length}):`);
    for (const file of validFiles) {
      const examplePath = path.join(validDir, file);
      const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
      const isValid = validate(example);
      if (isValid) {
        console.log(`    ✅ ${file}`);
        results.schemas[schemaName].validExamples.push({ file, passed: true });
        results.summary.examples.valid++;
      } else {
        console.log(`    ❌ ${file} - Expected valid but got errors:`);
        console.log(`       ${ajv.errorsText(validate.errors)}`);
        results.schemas[schemaName].validExamples.push({ file, passed: false, errors: validate.errors });
      }
    }
  }

  // Check invalid examples
  const invalidDir = path.join(schemasDir, 'examples', schemaName, 'invalid');
  if (fs.existsSync(invalidDir)) {
    const invalidFiles = fs.readdirSync(invalidDir).filter(f => f.endsWith('.json'));
    console.log(`  Invalid examples (${invalidFiles.length}):`);
    for (const file of invalidFiles) {
      const examplePath = path.join(invalidDir, file);
      const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
      const isValid = validate(example);
      if (!isValid) {
        console.log(`    ✅ ${file} - Correctly rejected`);
        results.schemas[schemaName].invalidExamples.push({ file, passed: true, errors: validate.errors });
        results.summary.examples.invalid++;
      } else {
        console.log(`    ❌ ${file} - Expected invalid but passed validation!`);
        results.schemas[schemaName].invalidExamples.push({ file, passed: false });
      }
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('Summary');
console.log('='.repeat(60));
console.log(`Schemas: ${results.summary.passed}/${schemaFiles.length} passed`);
console.log(`Valid examples verified: ${results.summary.examples.valid}`);
console.log(`Invalid examples correctly rejected: ${results.summary.examples.invalid}`);

// Check for overall pass
const allSchemasPassed = results.summary.passed === schemaFiles.length;
const allExamplesWork = Object.values(results.schemas).every(s =>
  s.validExamples.every(e => e.passed) && s.invalidExamples.every(e => e.passed)
);

if (allSchemasPassed && allExamplesWork) {
  console.log('\n✅ DECISION: APPROVED - All schemas valid, all examples work correctly');
  process.exit(0);
} else {
  console.log('\n❌ DECISION: NEEDS_FIXES - Issues found');
  process.exit(1);
}
