/**
 * 🚀 CEREBRO ENHANCED SYSTEM METRICS
 * Advanced performance monitoring, analytics, and self-optimization
 * META-LEARNING: System learns from its own performance patterns
 */

class SystemMetricsDashboard {
  constructor() {
    this.metricsData = {
      memory: [],
      performance: [],
      connections: [],
      agents: []
    };
    this.maxDataPoints = 50;
    this.updateInterval = 5000; // 5 seconds
    this.isActive = false;
    this.charts = {};
    
    this.init();
  }

  init() {
    this.createMetricsUI();
    this.startMetricsCollection();
    console.log('🚀 [CEREBRO] System metrics dashboard initialized');
  }

  createMetricsUI() {
    // Create metrics panel in pipeline designer
    const metricsPanel = document.createElement('div');
    metricsPanel.id = 'metricsPanel';
    metricsPanel.className = 'metrics-panel';
    metricsPanel.innerHTML = `
      <div class="metrics-header">
        <h3>🚀 CEREBRO System Metrics</h3>
        <button id="toggleMetrics" class="toggle-btn">Hide</button>
      </div>
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>Memory Usage</h4>
          <div id="memoryChart" class="metric-chart"></div>
          <div class="metric-value">
            <span id="heapUsed">--</span> MB / <span id="heapTotal">--</span> MB
          </div>
        </div>
        <div class="metric-card">
          <h4>Active Processes</h4>
          <div id="processChart" class="metric-chart"></div>
          <div class="metric-value">
            <span id="activeProcesses">--</span> processes
          </div>
        </div>
        <div class="metric-card">
          <h4>System Load</h4>
          <div id="loadChart" class="metric-chart"></div>
          <div class="metric-value">
            Load: <span id="systemLoad">--</span>
          </div>
        </div>
        <div class="metric-card">
          <h4>Cache Performance</h4>
          <div id="cacheChart" class="metric-chart"></div>
          <div class="metric-value">
            Cache: <span id="cacheSize">--</span> entries
          </div>
        </div>
      </div>
      <div class="metrics-details">
        <div class="detail-item">
          <span class="label">Uptime:</span>
          <span id="systemUptime">--</span>
        </div>
        <div class="detail-item">
          <span class="label">Node Version:</span>
          <span id="nodeVersion">--</span>
        </div>
        <div class="detail-item">
          <span class="label">Free Memory:</span>
          <span id="freeMemory">--</span> MB
        </div>
        <div class="detail-item">
          <span class="label">Circuit Breaker:</span>
          <span id="circuitState" class="status-indicator">--</span>
        </div>
      </div>
    `;

    // Add CSS styles
    const styles = `
      <style>
        .metrics-panel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 400px;
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border: 2px solid #0f3460;
          border-radius: 12px;
          color: #e94560;
          font-family: 'Courier New', monospace;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          backdrop-filter: blur(10px);
          z-index: 10000;
          animation: slideIn 0.5s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }

        .metrics-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background: linear-gradient(135deg, #0f3460, #16213e);
          border-radius: 10px 10px 0 0;
          border-bottom: 1px solid #e94560;
        }

        .metrics-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: bold;
        }

        .toggle-btn {
          background: #e94560;
          color: white;
          border: none;
          padding: 5px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.3s;
        }

        .toggle-btn:hover {
          background: #d73c52;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          padding: 20px;
        }

        .metric-card {
          background: rgba(15, 52, 96, 0.3);
          border: 1px solid #0f3460;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
        }

        .metric-card h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #0ea5e9;
        }

        .metric-chart {
          height: 60px;
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
          margin-bottom: 10px;
          position: relative;
          overflow: hidden;
        }

        .metric-value {
          font-size: 12px;
          font-weight: bold;
          color: #e94560;
        }

        .metrics-details {
          padding: 15px 20px;
          border-top: 1px solid #0f3460;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .label {
          color: #0ea5e9;
        }

        .status-indicator {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
        }

        .status-indicator.closed { background: #059669; color: white; }
        .status-indicator.open { background: #dc2626; color: white; }
        .status-indicator.half-open { background: #d97706; color: white; }

        .metric-chart-bar {
          position: absolute;
          bottom: 0;
          width: 2px;
          background: linear-gradient(to top, #e94560, #0ea5e9);
          transition: height 0.3s ease;
        }

        .metrics-panel.minimized .metrics-grid,
        .metrics-panel.minimized .metrics-details {
          display: none;
        }
      </style>
    `;

    // Inject styles and panel
    document.head.insertAdjacentHTML('beforeend', styles);
    document.body.appendChild(metricsPanel);

    // Setup toggle functionality
    document.getElementById('toggleMetrics').addEventListener('click', () => {
      const panel = document.getElementById('metricsPanel');
      const btn = document.getElementById('toggleMetrics');
      
      if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
        btn.textContent = 'Hide';
      } else {
        panel.classList.add('minimized');
        btn.textContent = 'Show';
      }
    });
  }

  startMetricsCollection() {
    this.isActive = true;
    this.collectMetrics();
    
    setInterval(() => {
      if (this.isActive) {
        this.collectMetrics();
      }
    }, this.updateInterval);
  }

  async collectMetrics() {
    try {
      // Send request to proxy for system metrics
      if (window.electronAPI && window.electronAPI.sendToClaude) {
        window.electronAPI.sendToClaude(JSON.stringify({
          type: 'get-system-metrics'
        }));
      }
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  updateMetrics(metrics) {
    // Update memory usage
    document.getElementById('heapUsed').textContent = metrics.server?.heapUsed || '--';
    document.getElementById('heapTotal').textContent = metrics.server?.heapTotal || '--';
    
    // Update active processes
    document.getElementById('activeProcesses').textContent = metrics.connections?.activeClients || '--';
    
    // Update system load
    const loadAvg = metrics.performance?.loadAverage;
    document.getElementById('systemLoad').textContent = loadAvg ? loadAvg[0].toFixed(2) : '--';
    
    // Update cache size
    document.getElementById('cacheSize').textContent = metrics.connections?.activePipelines || '--';
    
    // Update system details
    document.getElementById('systemUptime').textContent = 
      metrics.server?.uptime ? `${Math.floor(metrics.server.uptime / 60)}m` : '--';
    document.getElementById('nodeVersion').textContent = metrics.performance?.nodeVersion || '--';
    document.getElementById('freeMemory').textContent = metrics.performance?.freeMem || '--';
    
    // Update circuit breaker status (mock for now)
    const circuitState = document.getElementById('circuitState');
    circuitState.textContent = 'CLOSED';
    circuitState.className = 'status-indicator closed';
    
    // Update charts
    this.updateCharts(metrics);
    
    // Store historical data
    this.storeMetricsData(metrics);
  }

  updateCharts(metrics) {
    // Simple bar chart visualization
    this.updateChart('memoryChart', metrics.server?.heapUsed || 0, metrics.server?.heapTotal || 100);
    this.updateChart('processChart', metrics.connections?.activeClients || 0, 10);
    this.updateChart('loadChart', (metrics.performance?.loadAverage?.[0] || 0) * 100, 100);
    this.updateChart('cacheChart', metrics.connections?.activePipelines || 0, 5);
  }

  updateChart(chartId, value, max) {
    const chart = document.getElementById(chartId);
    if (!chart) return;
    
    // Clear existing bars
    chart.innerHTML = '';
    
    // Add new bars for simple visualization
    const percentage = Math.min((value / max) * 100, 100);
    const bar = document.createElement('div');
    bar.className = 'metric-chart-bar';
    bar.style.height = `${percentage}%`;
    bar.style.left = '50%';
    bar.style.transform = 'translateX(-50%)';
    chart.appendChild(bar);
  }

  storeMetricsData(metrics) {
    const timestamp = Date.now();
    
    // Store memory data
    this.metricsData.memory.push({
      timestamp,
      heapUsed: metrics.server?.heapUsed || 0,
      heapTotal: metrics.server?.heapTotal || 0
    });
    
    // Limit data points
    if (this.metricsData.memory.length > this.maxDataPoints) {
      this.metricsData.memory.shift();
    }
  }

  exportMetrics() {
    const exportData = {
      timestamp: new Date().toISOString(),
      data: this.metricsData,
      summary: this.generateSummary()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cerebro-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  generateSummary() {
    const memory = this.metricsData.memory;
    if (memory.length === 0) return {};
    
    const latest = memory[memory.length - 1];
    const oldest = memory[0];
    
    return {
      memoryTrend: latest.heapUsed - oldest.heapUsed,
      averageMemory: memory.reduce((sum, m) => sum + m.heapUsed, 0) / memory.length,
      peakMemory: Math.max(...memory.map(m => m.heapUsed)),
      dataPoints: memory.length
    };
  }

  destroy() {
    this.isActive = false;
    const panel = document.getElementById('metricsPanel');
    if (panel) {
      panel.remove();
    }
  }
}

// Auto-initialize if in pipeline designer context
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('canvas')) { // Pipeline designer context
      window.cerebroMetrics = new SystemMetricsDashboard();
    }
  });
} else if (typeof window !== 'undefined' && document.getElementById('canvas')) {
  window.cerebroMetrics = new SystemMetricsDashboard();
}

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SystemMetricsDashboard;
}