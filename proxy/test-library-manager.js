const fs = require('fs');
const path = require('path');

/**
 * Test Library Manager
 *
 * Manages a centralized repository of tests created by bug-fix and feature-development pipelines.
 * Tests are organized by type (bug-fix, feature, integration) and include metadata for tracking.
 */
class TestLibraryManager {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(__dirname, '..', 'test-library');
    this.categoriesDir = path.join(this.baseDir, 'categories');
    this.metadataFile = path.join(this.baseDir, 'test-metadata.json');

    this.initializeLibrary();
  }

  /**
   * Initialize test library directory structure
   */
  initializeLibrary() {
    // Create main directories
    const directories = [
      this.baseDir,
      this.categoriesDir,
      path.join(this.categoriesDir, 'bug-fixes'),
      path.join(this.categoriesDir, 'features'),
      path.join(this.categoriesDir, 'integration'),
      path.join(this.categoriesDir, 'regression')
    ];

    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[TEST-LIBRARY] Created directory: ${dir}`);
      }
    });

    // Initialize metadata file if it doesn't exist
    if (!fs.existsSync(this.metadataFile)) {
      const initialMetadata = {
        version: '1.0.0',
        created: new Date().toISOString(),
        tests: [],
        statistics: {
          totalTests: 0,
          bugFixTests: 0,
          featureTests: 0,
          integrationTests: 0,
          regressionTests: 0
        }
      };
      fs.writeFileSync(this.metadataFile, JSON.stringify(initialMetadata, null, 2));
      console.log(`[TEST-LIBRARY] Created metadata file: ${this.metadataFile}`);
    }
  }

  /**
   * Add tests from a completed pipeline
   *
   * @param {Object} pipelineInfo - Pipeline metadata
   * @param {string} pipelineInfo.id - Pipeline ID
   * @param {string} pipelineInfo.name - Pipeline name
   * @param {string} pipelineInfo.type - Pipeline type (bug-fix, feature-development)
   * @param {string} pipelineInfo.workingDir - Working directory where tests were created
   * @param {Object} pipelineInfo.results - Pipeline execution results
   * @returns {Object} - Collection results
   */
  async collectTestsFromPipeline(pipelineInfo) {
    console.log(`[TEST-LIBRARY] Collecting tests from pipeline: ${pipelineInfo.id}`);

    const { id, name, type, workingDir, results } = pipelineInfo;
    const collectionResults = {
      pipelineId: id,
      timestamp: new Date().toISOString(),
      testsFound: [],
      testsCopied: [],
      errors: []
    };

    try {
      // Determine test category based on pipeline type
      let category = 'integration';
      if (type.includes('bug-fix')) {
        category = 'bug-fixes';
      } else if (type.includes('feature')) {
        category = 'features';
      }

      // Search for test files in working directory
      const testPatterns = [
        'test-*.sh',
        'test-*.bat',
        '*test*.js',
        '*.test.js',
        '*.spec.js',
        'reproduction-*.sh',
        'reproduction-*.bat',
        'validation-*.sh',
        'validation-*.bat'
      ];

      const testFiles = this.findTestFiles(workingDir, testPatterns);
      collectionResults.testsFound = testFiles;

      // Copy tests to library
      for (const testFile of testFiles) {
        try {
          const copied = await this.copyTestToLibrary(testFile, category, {
            pipelineId: id,
            pipelineName: name,
            pipelineType: type,
            source: workingDir,
            results
          });

          if (copied) {
            collectionResults.testsCopied.push(copied);
          }
        } catch (error) {
          console.error(`[TEST-LIBRARY] Error copying test ${testFile}:`, error);
          collectionResults.errors.push({
            file: testFile,
            error: error.message
          });
        }
      }

      // Update metadata
      if (collectionResults.testsCopied.length > 0) {
        this.updateMetadata(collectionResults.testsCopied, category);
      }

      console.log(`[TEST-LIBRARY] Collection complete: ${collectionResults.testsCopied.length} tests added`);

    } catch (error) {
      console.error('[TEST-LIBRARY] Collection failed:', error);
      collectionResults.errors.push({
        general: error.message,
        stack: error.stack
      });
    }

    return collectionResults;
  }

  /**
   * Find test files matching patterns in a directory
   *
   * @param {string} directory - Directory to search
   * @param {Array<string>} patterns - Glob patterns to match
   * @returns {Array<string>} - Array of test file paths
   */
  findTestFiles(directory, patterns) {
    const testFiles = [];

    if (!fs.existsSync(directory)) {
      console.log(`[TEST-LIBRARY] Directory not found: ${directory}`);
      return testFiles;
    }

    try {
      const files = fs.readdirSync(directory, { recursive: true });

      files.forEach(file => {
        const filePath = path.join(directory, file);

        // Skip directories
        if (fs.statSync(filePath).isDirectory()) {
          return;
        }

        // Check if file matches any pattern
        const fileName = path.basename(file);
        const matches = patterns.some(pattern => {
          const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
          );
          return regex.test(fileName);
        });

        if (matches) {
          testFiles.push(filePath);
        }
      });
    } catch (error) {
      console.error(`[TEST-LIBRARY] Error scanning directory ${directory}:`, error);
    }

    return testFiles;
  }

  /**
   * Copy a test file to the library with metadata
   *
   * @param {string} testFile - Source test file path
   * @param {string} category - Test category
   * @param {Object} metadata - Test metadata
   * @returns {Object} - Copy result
   */
  async copyTestToLibrary(testFile, category, metadata) {
    const fileName = path.basename(testFile);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pipelinePrefix = metadata.pipelineId.replace(/[^a-zA-Z0-9-]/g, '_');

    // Create unique filename with pipeline ID and timestamp
    const newFileName = `${pipelinePrefix}_${timestamp}_${fileName}`;
    const destPath = path.join(this.categoriesDir, category, newFileName);

    // Copy test file
    fs.copyFileSync(testFile, destPath);
    console.log(`[TEST-LIBRARY] Copied: ${fileName} -> ${category}/${newFileName}`);

    // Create metadata sidecar file
    const metadataPath = destPath + '.metadata.json';
    const testMetadata = {
      originalFile: testFile,
      fileName: newFileName,
      category,
      addedAt: new Date().toISOString(),
      pipelineId: metadata.pipelineId,
      pipelineName: metadata.pipelineName,
      pipelineType: metadata.pipelineType,
      sourceDirectory: metadata.source,
      description: this.extractTestDescription(testFile),
      tags: this.generateTags(fileName, category, metadata)
    };

    fs.writeFileSync(metadataPath, JSON.stringify(testMetadata, null, 2));

    return {
      originalPath: testFile,
      libraryPath: destPath,
      metadataPath,
      fileName: newFileName,
      category
    };
  }

  /**
   * Extract test description from test file comments
   *
   * @param {string} testFile - Test file path
   * @returns {string} - Test description
   */
  extractTestDescription(testFile) {
    try {
      const content = fs.readFileSync(testFile, 'utf8');
      const lines = content.split('\n').slice(0, 20); // Check first 20 lines

      // Look for comments describing the test
      for (const line of lines) {
        // Shell/batch comments
        if (line.match(/^#\s*(.+)/)) {
          const desc = line.match(/^#\s*(.+)/)[1].trim();
          if (desc.length > 10 && !desc.startsWith('!')) {
            return desc;
          }
        }
        // JS comments
        if (line.match(/^\/\/\s*(.+)/) || line.match(/^\*\s*(.+)/)) {
          const match = line.match(/^(?:\/\/|\*)\s*(.+)/);
          if (match) {
            const desc = match[1].trim();
            if (desc.length > 10) {
              return desc;
            }
          }
        }
      }
    } catch (error) {
      console.error('[TEST-LIBRARY] Error extracting description:', error);
    }

    return 'No description available';
  }

  /**
   * Generate tags for test classification
   *
   * @param {string} fileName - Test file name
   * @param {string} category - Test category
   * @param {Object} metadata - Pipeline metadata
   * @returns {Array<string>} - Array of tags
   */
  generateTags(fileName, category, metadata) {
    const tags = [category];

    // Add file type tags
    if (fileName.endsWith('.sh')) tags.push('shell', 'linux', 'wsl');
    if (fileName.endsWith('.bat')) tags.push('batch', 'windows');
    if (fileName.endsWith('.js')) tags.push('javascript', 'node');

    // Add pipeline type tags
    if (metadata.pipelineType) {
      tags.push(metadata.pipelineType);
    }

    // Add descriptive tags based on filename
    if (fileName.includes('reproduction')) tags.push('reproduction');
    if (fileName.includes('validation')) tags.push('validation');
    if (fileName.includes('integration')) tags.push('integration');
    if (fileName.includes('e2e')) tags.push('end-to-end');
    if (fileName.includes('unit')) tags.push('unit-test');

    return tags;
  }

  /**
   * Update library metadata
   *
   * @param {Array<Object>} copiedTests - Array of copied test objects
   * @param {string} category - Test category
   */
  updateMetadata(copiedTests, category) {
    try {
      const metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));

      // Add new tests to metadata
      copiedTests.forEach(test => {
        const testMetadataPath = test.metadataPath;
        const testMetadata = JSON.parse(fs.readFileSync(testMetadataPath, 'utf8'));

        metadata.tests.push({
          id: path.basename(test.fileName),
          path: test.libraryPath,
          category: test.category,
          addedAt: testMetadata.addedAt,
          pipelineId: testMetadata.pipelineId,
          tags: testMetadata.tags
        });
      });

      // Update statistics
      metadata.statistics.totalTests = metadata.tests.length;
      metadata.statistics.bugFixTests = metadata.tests.filter(t => t.category === 'bug-fixes').length;
      metadata.statistics.featureTests = metadata.tests.filter(t => t.category === 'features').length;
      metadata.statistics.integrationTests = metadata.tests.filter(t => t.category === 'integration').length;
      metadata.statistics.regressionTests = metadata.tests.filter(t => t.category === 'regression').length;
      metadata.lastUpdated = new Date().toISOString();

      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
      console.log('[TEST-LIBRARY] Metadata updated');
    } catch (error) {
      console.error('[TEST-LIBRARY] Error updating metadata:', error);
    }
  }

  /**
   * Query tests by various criteria
   *
   * @param {Object} query - Query criteria
   * @returns {Array<Object>} - Array of matching tests
   */
  queryTests(query = {}) {
    try {
      const metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
      let results = metadata.tests;

      if (query.category) {
        results = results.filter(t => t.category === query.category);
      }

      if (query.pipelineId) {
        results = results.filter(t => t.pipelineId === query.pipelineId);
      }

      if (query.tags) {
        const queryTags = Array.isArray(query.tags) ? query.tags : [query.tags];
        results = results.filter(t =>
          queryTags.some(tag => t.tags && t.tags.includes(tag))
        );
      }

      if (query.since) {
        const sinceDate = new Date(query.since);
        results = results.filter(t => new Date(t.addedAt) >= sinceDate);
      }

      return results;
    } catch (error) {
      console.error('[TEST-LIBRARY] Error querying tests:', error);
      return [];
    }
  }

  /**
   * Get library statistics
   *
   * @returns {Object} - Library statistics
   */
  getStatistics() {
    try {
      const metadata = JSON.parse(fs.readFileSync(this.metadataFile, 'utf8'));
      return metadata.statistics;
    } catch (error) {
      console.error('[TEST-LIBRARY] Error reading statistics:', error);
      return null;
    }
  }

  /**
   * Validate collected tests by running basic checks
   *
   * @param {Array<Object>} copiedTests - Array of copied test objects
   * @returns {Object} - Validation results
   */
  async validateTests(copiedTests) {
    console.log(`[TEST-LIBRARY] Validating ${copiedTests.length} tests...`);

    const validationResults = {
      totalTests: copiedTests.length,
      validTests: [],
      invalidTests: [],
      warnings: []
    };

    for (const test of copiedTests) {
      const validation = {
        testFile: test.fileName,
        path: test.libraryPath,
        checks: {}
      };

      try {
        // Check 1: File exists and is readable
        if (!fs.existsSync(test.libraryPath)) {
          validation.checks.fileExists = false;
          validation.error = 'File does not exist';
          validationResults.invalidTests.push(validation);
          continue;
        }
        validation.checks.fileExists = true;

        // Check 2: File is not empty
        const stats = fs.statSync(test.libraryPath);
        if (stats.size === 0) {
          validation.checks.notEmpty = false;
          validation.error = 'File is empty';
          validationResults.invalidTests.push(validation);
          continue;
        }
        validation.checks.notEmpty = true;
        validation.checks.fileSize = stats.size;

        // Check 3: File has proper permissions (readable + executable for scripts)
        const isScript = test.fileName.endsWith('.sh') || test.fileName.endsWith('.bat');
        if (isScript && !(stats.mode & 0o100)) {
          // Not executable - add warning but don't fail
          validationResults.warnings.push({
            testFile: test.fileName,
            warning: 'Script is not executable, may need chmod +x'
          });
        }
        validation.checks.hasProperPermissions = true;

        // Check 4: Metadata file exists
        const metadataPath = test.libraryPath + '.metadata.json';
        if (!fs.existsSync(metadataPath)) {
          validation.checks.hasMetadata = false;
          validation.error = 'Metadata file missing';
          validationResults.invalidTests.push(validation);
          continue;
        }
        validation.checks.hasMetadata = true;

        // Check 5: Metadata is valid JSON
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          validation.checks.metadataValid = true;
          validation.checks.metadataComplete = !!(
            metadata.pipelineId &&
            metadata.category &&
            metadata.addedAt
          );
        } catch (jsonError) {
          validation.checks.metadataValid = false;
          validation.error = 'Invalid metadata JSON';
          validationResults.invalidTests.push(validation);
          continue;
        }

        // Check 6: File contains meaningful content (not just comments)
        const content = fs.readFileSync(test.libraryPath, 'utf8');
        const lines = content.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 &&
                 !trimmed.startsWith('#') &&
                 !trimmed.startsWith('//') &&
                 !trimmed.startsWith('/*');
        });

        if (lines.length < 3) {
          validationResults.warnings.push({
            testFile: test.fileName,
            warning: 'Test file has very few lines of actual code'
          });
        }
        validation.checks.hasContent = lines.length >= 3;
        validation.checks.codeLines = lines.length;

        // All checks passed
        validationResults.validTests.push(validation);

      } catch (error) {
        validation.error = error.message;
        validationResults.invalidTests.push(validation);
      }
    }

    console.log(`[TEST-LIBRARY] Validation complete: ${validationResults.validTests.length} valid, ${validationResults.invalidTests.length} invalid, ${validationResults.warnings.length} warnings`);

    return validationResults;
  }
}

module.exports = TestLibraryManager;
