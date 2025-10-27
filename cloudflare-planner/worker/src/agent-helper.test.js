/**
 * Unit tests for AI Agent Helper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePromptWithAI, executeCommandSequence } from './agent-helper.js';

describe('AI Prompt Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parsePromptWithAI', () => {
    it('should parse prompt with AI successfully', async () => {
      const mockEnv = {
        AI: {
          run: vi.fn(async () => ({
            response: JSON.stringify({
              command: 'ADD_ITEM',
              params: { itemType: 'sofa' },
              reasoning: 'User wants to add a sofa'
            })
          }))
        }
      };

      const result = await parsePromptWithAI(mockEnv, 'Add a sofa');

      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('sofa');
      expect(result.reasoning).toBeDefined();
      expect(mockEnv.AI.run).toHaveBeenCalledWith(
        '@cf/meta/llama-3-8b-instruct',
        expect.objectContaining({
          messages: expect.any(Array),
          max_tokens: 500,
          temperature: 0.2
        })
      );
    });

    it('should handle AI response with extra text around JSON', async () => {
      const mockEnv = {
        AI: {
          run: vi.fn(async () => ({
            response: 'Here is the command: {"command": "MODE_3D", "params": {}, "reasoning": "Test"} hope this helps!'
          }))
        }
      };

      const result = await parsePromptWithAI(mockEnv, 'Switch to 3D');

      expect(result.command).toBe('MODE_3D');
      expect(result.params).toEqual({});
    });

    it('should fall back to rule-based parsing on AI error', async () => {
      const mockEnv = {
        AI: {
          run: vi.fn().mockRejectedValue(new Error('AI service error'))
        }
      };

      const result = await parsePromptWithAI(mockEnv, 'Add a sofa');

      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('sofa');
    });

    it('should fall back when AI returns invalid JSON', async () => {
      const mockEnv = {
        AI: {
          run: vi.fn(async () => ({
            response: 'This is not valid JSON at all'
          }))
        }
      };

      const result = await parsePromptWithAI(mockEnv, 'Add a chair');

      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('chair');
    });

    it('should include current state in AI context when provided', async () => {
      const mockEnv = {
        AI: {
          run: vi.fn(async () => ({
            response: '{"command": "ADD_ITEM", "params": {"itemType": "table"}, "reasoning": "Test"}'
          }))
        }
      };

      const currentState = {
        'react-planner': {
          scene: { layers: [] }
        }
      };

      await parsePromptWithAI(mockEnv, 'Add a table', currentState);

      const aiCall = mockEnv.AI.run.mock.calls[0];
      const userMessage = aiCall[1].messages.find(m => m.role === 'user');

      expect(userMessage.content).toContain(JSON.stringify(currentState));
    });
  });

  describe('Fallback Rule-Based Parsing', () => {
    const mockEnv = {
      AI: {
        run: vi.fn().mockRejectedValue(new Error('AI unavailable'))
      }
    };

    it('should detect sofa requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a sofa');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('sofa');
    });

    it('should detect couch as sofa', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a couch');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('sofa');
    });

    it('should detect chair requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Place a chair');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('chair');
    });

    it('should detect table requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'I need a table');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('table');
    });

    it('should detect desk requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a desk');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('desk');
    });

    it('should detect bed requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Put a bed here');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('bed');
    });

    it('should detect bookcase/bookshelf', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a bookshelf');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('bookcase');
    });

    it('should detect wardrobe/closet', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a closet');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('wardrobe');
    });

    it('should detect fridge/refrigerator', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a refrigerator');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('fridge');
    });

    it('should detect tv/television', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a television');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('tv');
    });

    it('should detect wall requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Draw a wall');
      expect(result.command).toBe('ADD_WALL');
    });

    it('should detect 3D view requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Show in 3D');
      expect(result.command).toBe('MODE_3D');
    });

    it('should detect 2D view requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Switch to 2D');
      expect(result.command).toBe('MODE_2D');
    });

    it('should extract coordinates when provided', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Add a sofa at 100, 200');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.position).toEqual({ x: 100, y: 200 });
    });

    it('should handle load requests with clarification', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Load my plan');
      expect(result.command).toBe('CLARIFY');
      expect(result.question).toBeDefined();
    });

    it('should return CLARIFY for unknown requests', async () => {
      const result = await parsePromptWithAI(mockEnv, 'Do something random');
      expect(result.command).toBe('CLARIFY');
      expect(result.question).toBeDefined();
    });

    it('should be case insensitive', async () => {
      const result = await parsePromptWithAI(mockEnv, 'ADD A SOFA');
      expect(result.command).toBe('ADD_ITEM');
      expect(result.params.itemType).toBe('sofa');
    });
  });
});

describe('Command Sequence Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute multiple commands in sequence', async () => {
    const mockSessionStub = {
      fetch: vi.fn(async () => {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    };

    const commands = [
      { command: 'ADD_ITEM', params: { itemType: 'sofa' } },
      { command: 'MODE_3D', params: {} }
    ];

    const results = await executeCommandSequence(mockSessionStub, commands);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(mockSessionStub.fetch).toHaveBeenCalledTimes(2);
  });

  it('should stop on first failure', async () => {
    const mockSessionStub = {
      fetch: vi.fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: false, error: 'Failed' }), {
            status: 400
          })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true }), {
            status: 200
          })
        )
    };

    const commands = [
      { command: 'INVALID', params: {} },
      { command: 'MODE_3D', params: {} }
    ];

    const results = await executeCommandSequence(mockSessionStub, commands);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(mockSessionStub.fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle network errors', async () => {
    const mockSessionStub = {
      fetch: vi.fn().mockRejectedValue(new Error('Network error'))
    };

    const commands = [
      { command: 'MODE_3D', params: {} }
    ];

    const results = await executeCommandSequence(mockSessionStub, commands);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('Network error');
  });

  it('should include command details in results', async () => {
    const mockSessionStub = {
      fetch: vi.fn(async () => {
        return new Response(JSON.stringify({ success: true, data: 'test' }), {
          status: 200
        });
      })
    };

    const commands = [
      { command: 'ADD_ITEM', params: { itemType: 'table' } }
    ];

    const results = await executeCommandSequence(mockSessionStub, commands);

    expect(results[0].command).toBe('ADD_ITEM');
    expect(results[0].params).toEqual({ itemType: 'table' });
    expect(results[0].result.data).toBe('test');
  });

  it('should handle empty command array', async () => {
    const mockSessionStub = {
      fetch: vi.fn()
    };

    const results = await executeCommandSequence(mockSessionStub, []);

    expect(results).toHaveLength(0);
    expect(mockSessionStub.fetch).not.toHaveBeenCalled();
  });
});
