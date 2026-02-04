/**
 * API Client for Multi-Drive Maestro
 *
 * Wraps the Claude Chat proxy REST API for Maestro operations.
 */

class ApiClient {
  constructor(baseUrl = 'http://localhost:8081') {
    this.baseUrl = baseUrl;
  }

  /**
   * Create a new tab
   */
  async createTab(options) {
    const response = await fetch(`${this.baseUrl}/api/tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabId: options.tabId,
        name: options.name,
        workingDirectory: options.workingDirectory,
        hatIds: options.hatIds,
        maestro: options.maestro // Extended fields for Maestro
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to create tab: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get a tab by ID
   */
  async getTab(tabId) {
    const response = await fetch(`${this.baseUrl}/api/tabs/${encodeURIComponent(tabId)}`);

    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.json();
      throw new Error(error.error || `Failed to get tab: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Update a tab
   */
  async updateTab(tabId, updates) {
    const response = await fetch(`${this.baseUrl}/api/tabs/${encodeURIComponent(tabId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to update tab: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Delete a tab
   */
  async deleteTab(tabId) {
    const response = await fetch(`${this.baseUrl}/api/tabs/${encodeURIComponent(tabId)}`, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
      const error = await response.json();
      throw new Error(error.error || `Failed to delete tab: ${response.status}`);
    }

    return true;
  }

  /**
   * List all tabs
   */
  async listTabs() {
    const response = await fetch(`${this.baseUrl}/api/tabs`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to list tabs: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send a message to a tab and wait for response
   */
  async sendMessage(tabId, message, options = {}) {
    // Send the message
    const sendResponse = await fetch(`${this.baseUrl}/api/chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tabId,
        message,
        workingDirectory: options.workingDirectory,
        hatIds: options.hatIds,
        history: options.history
      })
    });

    if (!sendResponse.ok) {
      const error = await sendResponse.json();
      throw new Error(error.error || `Failed to send message: ${sendResponse.status}`);
    }

    const { requestId } = await sendResponse.json();

    // Wait for response
    return this.waitForResponse(requestId, options.timeout);
  }

  /**
   * Wait for a response to complete
   */
  async waitForResponse(requestId, timeout = 300000) {
    const timeoutParam = timeout ? `?timeout=${timeout}` : '';
    const response = await fetch(
      `${this.baseUrl}/api/chat/response/${requestId}${timeoutParam}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to get response: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check status of a request without waiting
   */
  async checkStatus(requestId) {
    const response = await fetch(`${this.baseUrl}/api/chat/status/${requestId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to check status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Abort a running request
   */
  async abortRequest(requestId) {
    const response = await fetch(`${this.baseUrl}/api/chat/abort/${requestId}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to abort: ${response.status}`);
    }

    return response.json();
  }

  // ========== Maestro-specific endpoints ==========

  /**
   * Start a Maestro orchestration
   */
  async startMaestro(options) {
    const response = await fetch(`${this.baseUrl}/api/maestro/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: options.message,
        workingDirectory: options.workingDirectory,
        maxParallelAgents: options.maxParallelAgents || 3,
        hatId: options.hatId || 'product-maestro'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to start Maestro: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get Maestro orchestration status
   */
  async getMaestroStatus(rootTabId) {
    const response = await fetch(`${this.baseUrl}/api/maestro/status/${encodeURIComponent(rootTabId)}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to get Maestro status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Report a child result to its parent
   */
  async reportChildResult(parentTabId, childTabId, result) {
    const response = await fetch(`${this.baseUrl}/api/maestro/result/${encodeURIComponent(parentTabId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childTabId,
        status: result.status || 'success',
        result: result.result || result
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to report result: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Abort an entire Maestro orchestration tree
   */
  async abortMaestro(rootTabId) {
    const response = await fetch(`${this.baseUrl}/api/maestro/abort/${encodeURIComponent(rootTabId)}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Failed to abort Maestro: ${response.status}`);
    }

    return response.json();
  }
}

module.exports = ApiClient;
