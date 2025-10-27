/**
 * Unit tests for PlannerSessionDO (Durable Object)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlannerSessionDO } from './durable-object.js';

// Mock Durable Object state
class MockDurableObjectStorage {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key);
  }

  async put(key, value) {
    this.data.set(key, value);
  }

  async delete(key) {
    this.data.delete(key);
  }

  async setAlarm(time) {
    this.alarmTime = time;
  }
}

class MockDurableObjectId {
  constructor(name) {
    this.name = name;
  }

  toString() {
    return this.name;
  }
}

describe('PlannerSessionDO', () => {
  let mockState;
  let mockEnv;
  let durableObject;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock state
    mockState = {
      id: new MockDurableObjectId('test-session-123'),
      storage: new MockDurableObjectStorage()
    };

    // Mock environment
    mockEnv = {
      PLANNER_CONTAINER: {
        get: vi.fn((id) => ({
          fetch: vi.fn(async (url, options) => {
            return new Response(JSON.stringify({ success: true, mockData: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }),
          sleepAfter: vi.fn()
        }))
      },
      PLANNER_STORAGE: {
        get: vi.fn(async () => ({
          json: async () => ({ test: 'data' })
        })),
        put: vi.fn()
      }
    };

    // Create DO instance
    durableObject = new PlannerSessionDO(mockState, mockEnv);
  });

  describe('Initialization', () => {
    it('should initialize with default metadata', async () => {
      await durableObject.initialize();

      expect(durableObject.sessionMetadata).toBeDefined();
      expect(durableObject.sessionMetadata.createdAt).toBeDefined();
      expect(durableObject.sessionMetadata.modifications).toEqual([]);
    });

    it('should load existing metadata from storage', async () => {
      const existingMetadata = {
        createdAt: 1234567890,
        planId: 'existing-plan',
        modifications: [{ test: 'modification' }]
      };

      await mockState.storage.put('metadata', existingMetadata);
      await durableObject.initialize();

      expect(durableObject.sessionMetadata.planId).toBe('existing-plan');
      expect(durableObject.sessionMetadata.modifications).toHaveLength(1);
    });

    it('should only initialize once', async () => {
      await durableObject.initialize();
      const firstMetadata = durableObject.sessionMetadata;

      await durableObject.initialize();
      const secondMetadata = durableObject.sessionMetadata;

      expect(firstMetadata).toBe(secondMetadata);
    });
  });

  describe('Container Management', () => {
    it('should get container instance', async () => {
      const container = await durableObject.getContainer();

      expect(mockEnv.PLANNER_CONTAINER.get).toHaveBeenCalledWith('test-session-123');
      expect(container.sleepAfter).toHaveBeenCalledWith(60000);
      expect(durableObject.containerInstance).toBeDefined();
    });

    it('should reuse existing container instance', async () => {
      const container1 = await durableObject.getContainer();
      const container2 = await durableObject.getContainer();

      expect(container1).toBe(container2);
      expect(mockEnv.PLANNER_CONTAINER.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Command Execution', () => {
    it('should execute command successfully', async () => {
      const result = await durableObject.executeCommand('MODE_3D', {});

      expect(result.success).toBe(true);
      expect(durableObject.sessionMetadata.modifications).toHaveLength(1);
      expect(durableObject.sessionMetadata.modifications[0].command).toBe('MODE_3D');
    });

    it('should not log modification on failure', async () => {
      mockEnv.PLANNER_CONTAINER.get.mockReturnValue({
        fetch: vi.fn(async () => {
          return new Response(JSON.stringify({ success: false, error: 'Test error' }), {
            status: 500
          });
        }),
        sleepAfter: vi.fn()
      });

      const result = await durableObject.executeCommand('INVALID', {});

      expect(result.success).toBe(false);
      expect(durableObject.sessionMetadata.modifications).toHaveLength(0);
    });

    it('should update last activity timestamp', async () => {
      const beforeTime = durableObject.lastActivity;

      await new Promise(resolve => setTimeout(resolve, 10));
      await durableObject.executeCommand('MODE_3D', {});

      expect(durableObject.lastActivity).toBeGreaterThan(beforeTime);
    });

    it('should persist metadata after successful command', async () => {
      await durableObject.executeCommand('ADD_ITEM', { itemType: 'sofa' });

      const storedMetadata = await mockState.storage.get('metadata');
      expect(storedMetadata.modifications).toHaveLength(1);
      expect(storedMetadata.modifications[0].params.itemType).toBe('sofa');
    });
  });

  describe('Redux Action Dispatching', () => {
    it('should dispatch action to container', async () => {
      const action = { type: 'TEST_ACTION', payload: 'test' };
      const result = await durableObject.dispatchAction(action);

      expect(result.success).toBe(true);

      const containerCalls = mockEnv.PLANNER_CONTAINER.get().fetch.mock.calls;
      expect(containerCalls[0][0]).toContain('/action');

      const requestBody = JSON.parse(containerCalls[0][1].body);
      expect(requestBody.action.type).toBe('TEST_ACTION');
    });
  });

  describe('State Management', () => {
    it('should get current state', async () => {
      const result = await durableObject.getState();

      expect(result.success).toBe(true);

      const containerCalls = mockEnv.PLANNER_CONTAINER.get().fetch.mock.calls;
      expect(containerCalls[0][0]).toContain('/state');
    });

    it('should update last activity when getting state', async () => {
      const beforeTime = durableObject.lastActivity;

      await new Promise(resolve => setTimeout(resolve, 10));
      await durableObject.getState();

      expect(durableObject.lastActivity).toBeGreaterThan(beforeTime);
    });
  });

  describe('Script Execution', () => {
    it('should execute custom script', async () => {
      const script = 'return 2 + 2;';
      const result = await durableObject.executeScript(script);

      expect(result.success).toBe(true);

      const containerCalls = mockEnv.PLANNER_CONTAINER.get().fetch.mock.calls;
      expect(containerCalls[0][0]).toContain('/execute');

      const requestBody = JSON.parse(containerCalls[0][1].body);
      expect(requestBody.script).toBe(script);
    });
  });

  describe('Screenshot', () => {
    it('should take screenshot', async () => {
      const result = await durableObject.takeScreenshot();

      expect(result.success).toBe(true);

      const containerCalls = mockEnv.PLANNER_CONTAINER.get().fetch.mock.calls;
      expect(containerCalls[0][0]).toContain('/screenshot');
    });
  });

  describe('Plan Persistence', () => {
    it('should save plan to R2', async () => {
      mockEnv.PLANNER_CONTAINER.get.mockReturnValue({
        fetch: vi.fn(async (url) => {
          if (url.includes('/state')) {
            return new Response(JSON.stringify({
              success: true,
              state: { test: 'plan-data' }
            }), { status: 200 });
          }
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }),
        sleepAfter: vi.fn()
      });

      const result = await durableObject.savePlan('my-plan-123');

      expect(result.success).toBe(true);
      expect(result.planId).toBe('my-plan-123');
      expect(mockEnv.PLANNER_STORAGE.put).toHaveBeenCalled();

      const putCall = mockEnv.PLANNER_STORAGE.put.mock.calls[0];
      expect(putCall[0]).toBe('plans/my-plan-123.json');

      const storedMetadata = await mockState.storage.get('metadata');
      expect(storedMetadata.planId).toBe('my-plan-123');
      expect(storedMetadata.lastSaved).toBeDefined();
    });

    it('should load plan from R2', async () => {
      const mockPlan = {
        scene: { layers: [] },
        catalog: {}
      };

      mockEnv.PLANNER_STORAGE.get.mockResolvedValue({
        json: async () => mockPlan
      });

      const result = await durableObject.loadPlan('saved-plan');

      expect(mockEnv.PLANNER_STORAGE.get).toHaveBeenCalledWith('plans/saved-plan.json');

      const containerCalls = mockEnv.PLANNER_CONTAINER.get().fetch.mock.calls;
      const commandCall = containerCalls.find(call => call[0].includes('/command'));
      expect(commandCall).toBeDefined();

      const storedMetadata = await mockState.storage.get('metadata');
      expect(storedMetadata.planId).toBe('saved-plan');
    });

    it('should throw error if plan not found', async () => {
      mockEnv.PLANNER_STORAGE.get.mockResolvedValue(null);

      await expect(durableObject.loadPlan('non-existent')).rejects.toThrow('Plan not found');
    });
  });

  describe('Metadata', () => {
    it('should return session metadata', async () => {
      await durableObject.initialize();
      await durableObject.executeCommand('MODE_3D', {});

      const metadata = await durableObject.getMetadata();

      expect(metadata.sessionId).toBe('test-session-123');
      expect(metadata.lastActivity).toBeDefined();
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.modifications).toHaveLength(1);
    });
  });

  describe('HTTP Handler (fetch)', () => {
    it('should handle /command endpoint', async () => {
      const request = new Request('http://session/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'MODE_3D',
          params: {}
        })
      });

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle /action endpoint', async () => {
      const request = new Request('http://session/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: { type: 'TEST_ACTION' }
        })
      });

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle /state endpoint', async () => {
      const request = new Request('http://session/state');

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle /screenshot endpoint', async () => {
      const request = new Request('http://session/screenshot');

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle /metadata endpoint', async () => {
      const request = new Request('http://session/metadata');

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBe('test-session-123');
    });

    it('should return 404 for unknown paths', async () => {
      const request = new Request('http://session/unknown');

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not found');
    });

    it('should handle errors gracefully', async () => {
      mockEnv.PLANNER_CONTAINER.get.mockReturnValue({
        fetch: vi.fn().mockRejectedValue(new Error('Container error')),
        sleepAfter: vi.fn()
      });

      const request = new Request('http://session/state');

      const response = await durableObject.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Container error');
    });
  });

  describe('Alarm Handler', () => {
    it('should auto-save when alarm triggers with planId', async () => {
      await durableObject.initialize();
      durableObject.sessionMetadata.planId = 'auto-save-plan';
      durableObject.sessionMetadata.modifications = [{ test: 'modification' }];
      await mockState.storage.put('metadata', durableObject.sessionMetadata);

      mockEnv.PLANNER_CONTAINER.get.mockReturnValue({
        fetch: vi.fn(async (url) => {
          if (url.includes('/state')) {
            return new Response(JSON.stringify({
              success: true,
              state: { test: 'state' }
            }), { status: 200 });
          }
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }),
        sleepAfter: vi.fn()
      });

      await durableObject.alarm();

      expect(mockEnv.PLANNER_STORAGE.put).toHaveBeenCalled();
      expect(mockState.storage.alarmTime).toBeDefined();
    });

    it('should not auto-save without planId', async () => {
      await durableObject.initialize();
      durableObject.sessionMetadata.planId = null;
      durableObject.sessionMetadata.modifications = [{ test: 'modification' }];

      await durableObject.alarm();

      expect(mockEnv.PLANNER_STORAGE.put).not.toHaveBeenCalled();
    });

    it('should schedule next alarm', async () => {
      await durableObject.initialize();

      const beforeAlarmTime = Date.now();
      await durableObject.alarm();

      expect(mockState.storage.alarmTime).toBeGreaterThan(beforeAlarmTime);
      expect(mockState.storage.alarmTime).toBeLessThan(beforeAlarmTime + 301000);
    });

    it('should handle auto-save errors gracefully', async () => {
      await durableObject.initialize();
      durableObject.sessionMetadata.planId = 'error-plan';
      durableObject.sessionMetadata.modifications = [{ test: 'modification' }];

      mockEnv.PLANNER_STORAGE.put.mockRejectedValue(new Error('Storage error'));

      await expect(durableObject.alarm()).resolves.not.toThrow();
    });
  });
});
