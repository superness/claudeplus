/**
 * Decision Parser for Multi-Drive Maestro
 *
 * Parses MAESTRO_DECISION markers from Claude responses.
 * These markers indicate whether an agent will implement directly or delegate.
 */

class DecisionParser {
  /**
   * Parse a Claude response for Maestro decision markers
   * @param {string} response - The full response from Claude
   * @returns {Object} Parsed decision with type, subtasks, results, etc.
   */
  static parse(response) {
    // Extract decision type
    const decisionMatch = response.match(/MAESTRO_DECISION:\s*(DELEGATE|IMPLEMENT)/i);

    if (!decisionMatch) {
      // No explicit decision - treat as implementation
      return {
        type: 'IMPLEMENT',
        implicit: true,
        result: {
          status: 'success',
          output: response
        },
        rawResponse: response
      };
    }

    const decisionType = decisionMatch[1].toUpperCase();

    if (decisionType === 'DELEGATE') {
      return this.parseDelegation(response);
    } else {
      return this.parseImplementation(response);
    }
  }

  /**
   * Parse a DELEGATE decision
   */
  static parseDelegation(response) {
    const result = {
      type: 'DELEGATE',
      complexityScore: null,
      complexityBreakdown: {},
      delegationReason: null,
      subtasks: [],
      rawResponse: response
    };

    // Extract complexity score
    const scoreMatch = response.match(/COMPLEXITY_SCORE:\s*(\d+)\/(\d+)/i);
    if (scoreMatch) {
      result.complexityScore = {
        score: parseInt(scoreMatch[1]),
        maxScore: parseInt(scoreMatch[2]),
        normalized: parseInt(scoreMatch[1]) / parseInt(scoreMatch[2])
      };
    }

    // Extract complexity breakdown (ABUDDI)
    const breakdownMatch = response.match(/COMPLEXITY_BREAKDOWN:([\s\S]*?)(?=DELEGATION_REASON:|SUBTASK|\[SUBTASK\]|$)/i);
    if (breakdownMatch) {
      const breakdownText = breakdownMatch[1];
      const dimensions = ['Atomic Scope', 'Breadth', 'Uncertainty', 'Dependencies', 'Depth', 'Impact'];

      for (const dim of dimensions) {
        const dimMatch = breakdownText.match(new RegExp(`${dim}[:\\s]+([^\\n]+)`, 'i'));
        if (dimMatch) {
          result.complexityBreakdown[dim.toLowerCase().replace(' ', '_')] = dimMatch[1].trim();
        }
      }
    }

    // Extract delegation reason
    const reasonMatch = response.match(/DELEGATION_REASON:\s*([^\n]+(?:\n(?!\[SUBTASK\])[^\n]+)*)/i);
    if (reasonMatch) {
      result.delegationReason = reasonMatch[1].trim();
    }

    // Extract subtasks
    const subtaskPattern = /\[SUBTASK\]([\s\S]*?)\[\/SUBTASK\]/gi;
    let match;

    while ((match = subtaskPattern.exec(response)) !== null) {
      try {
        const subtaskText = match[1].trim();

        // Try to parse as JSON
        const jsonMatch = subtaskText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const subtask = JSON.parse(jsonMatch[0]);

          // Validate required fields
          if (!subtask.name) {
            console.warn('Subtask missing name, skipping');
            continue;
          }

          result.subtasks.push({
            name: subtask.name,
            hat: subtask.hat || 'sub-ic',
            priority: subtask.priority || 1,
            context: subtask.context || subtask.description || '',
            workingDirectory: subtask.workingDirectory || null,
            dependencies: subtask.dependencies || []
          });
        }
      } catch (e) {
        console.warn('Failed to parse subtask:', e.message);
      }
    }

    return result;
  }

  /**
   * Parse an IMPLEMENT decision
   */
  static parseImplementation(response) {
    const result = {
      type: 'IMPLEMENT',
      implicit: false,
      summary: null,
      filesModified: [],
      result: null,
      rawResponse: response
    };

    // Extract implementation summary
    const summaryMatch = response.match(/IMPLEMENTATION_SUMMARY:\s*([^\n]+(?:\n(?!FILES_MODIFIED:|RESULT:)[^\n]+)*)/i);
    if (summaryMatch) {
      result.summary = summaryMatch[1].trim();
    }

    // Extract files modified
    const filesMatch = response.match(/FILES_MODIFIED:([\s\S]*?)(?=RESULT:|$)/i);
    if (filesMatch) {
      const filesText = filesMatch[1];
      const fileLines = filesText.match(/^[\s-]*([^\n]+)/gm);
      if (fileLines) {
        result.filesModified = fileLines
          .map(line => line.replace(/^[\s-]*/, '').trim())
          .filter(line => line.length > 0 && !line.startsWith('RESULT'));
      }
    }

    // Extract result JSON
    const resultMatch = response.match(/RESULT:\s*(\{[\s\S]*?\})\s*(?:$|MAESTRO_)/i);
    if (resultMatch) {
      try {
        result.result = JSON.parse(resultMatch[1]);
      } catch (e) {
        // If not valid JSON, store as text
        result.result = {
          status: 'success',
          raw: resultMatch[1].trim()
        };
      }
    } else {
      // No explicit result, create one from summary
      result.result = {
        status: 'success',
        output: result.summary || response
      };
    }

    return result;
  }

  /**
   * Parse a CHILD_RESULT_RECEIVED message
   */
  static parseChildResult(response) {
    const match = response.match(/CHILD_RESULT_RECEIVED:\s*(\{[\s\S]*?\})/i);
    if (!match) return null;

    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.warn('Failed to parse child result:', e.message);
      return null;
    }
  }

  /**
   * Check if response indicates all children are complete
   */
  static isAllChildrenComplete(response) {
    return /ALL_CHILDREN_COMPLETE:/i.test(response);
  }

  /**
   * Extract clean response without Maestro markers
   * (for displaying to user)
   */
  static stripMarkers(response) {
    return response
      .replace(/MAESTRO_DECISION:\s*(DELEGATE|IMPLEMENT)/gi, '')
      .replace(/COMPLEXITY_SCORE:\s*\d+\/\d+/gi, '')
      .replace(/COMPLEXITY_BREAKDOWN:[\s\S]*?(?=DELEGATION_REASON:|SUBTASK|\[SUBTASK\]|$)/gi, '')
      .replace(/DELEGATION_REASON:\s*[^\n]+(?:\n(?!\[SUBTASK\])[^\n]+)*/gi, '')
      .replace(/\[SUBTASK\][\s\S]*?\[\/SUBTASK\]/gi, '')
      .replace(/IMPLEMENTATION_SUMMARY:\s*[^\n]+(?:\n(?!FILES_MODIFIED:|RESULT:)[^\n]+)*/gi, '')
      .replace(/FILES_MODIFIED:[\s\S]*?(?=RESULT:|$)/gi, '')
      .replace(/RESULT:\s*\{[\s\S]*?\}/gi, '')
      .replace(/CHILD_RESULT_RECEIVED:[\s\S]*?\}/gi, '')
      .replace(/ALL_CHILDREN_COMPLETE:[\s\S]*$/gi, '')
      .trim();
  }
}

module.exports = DecisionParser;
