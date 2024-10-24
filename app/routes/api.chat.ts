// @ts-nocheck
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import { hashMessages } from '~/lib/crypto';
import { openDatabase, getCachedPrompt, setCachedPrompt, cleanupOldCache } from '~/lib/persistence/db';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatAPI');

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  try {
    const { messages } = await request.json<{ messages: Messages }>();

    // Initialize database but don't block on cache operations
    let db: IDBDatabase | undefined;
    try {
      db = await openDatabase();
      if (db) {
        cleanupOldCache(db).catch(err => logger.error('Cache cleanup error:', err));
      }
    } catch (err) {
      logger.error('Database initialization error:', err);
      // Continue without caching if database fails
    }

    // Try to get cached response if database is available
    let cachedResponse;
    if (db) {
      try {
        const hash = await hashMessages(messages);
        cachedResponse = await getCachedPrompt(db, hash);
      } catch (err) {
        logger.error('Cache lookup error:', err);
        // Continue without cache if lookup fails
      }
    }

    if (cachedResponse) {
      // Return cached response as a stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(cachedResponse.response));
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }

    const stream = new SwitchableStream();
    let fullResponse = '';
    let responseHash: string | undefined;

    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason }) => {
        fullResponse += content;

        if (finishReason !== 'length') {
          // Try to cache the complete response
          if (db) {
            try {
              if (!responseHash) {
                responseHash = await hashMessages(messages);
              }
              await setCachedPrompt(db, responseHash, messages, fullResponse);
            } catch (err) {
              logger.error('Cache storage error:', err);
              // Continue even if caching fails
            }
          }
          return stream.close();
        }

        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw Error('Cannot continue message: Maximum segments reached');
        }

        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;
        logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const result = await streamText(messages, context.cloudflare.env, options);
        return stream.switchSource(result.toAIStream());
      },
    };

    const result = await streamText(messages, context.cloudflare.env, options);
    stream.switchSource(result.toAIStream());

    return new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    logger.error('Chat API error:', error);
    
    // Return a more informative error response
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
