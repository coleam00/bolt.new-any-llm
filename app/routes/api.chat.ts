import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream } from 'ai';
import { MAX_RESPONSE_SEGMENTS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  try {
    const { messages, files, promptId } = await request.json<{
      messages: Messages;
      files: any;
      promptId?: string;
    }>();

    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
    const providerSettings: Record<string, IProviderSetting> = JSON.parse(
      parseCookies(cookieHeader || '').providers || '{}',
    );

    console.log('Starting chat action with:', {
      messageCount: messages.length,
      hasFiles: !!files,
      promptId,
      hasApiKeys: Object.keys(apiKeys).length > 0,
      hasProviderSettings: Object.keys(providerSettings).length > 0,
    });

    const stream = new SwitchableStream();

    const cumulativeUsage = {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    };

    const options: StreamingOptions = {
      toolChoice: 'none',
      onFinish: async ({ text: content, finishReason, usage }) => {
        console.log('Stream finished:', { finishReason, usage });

        if (usage) {
          cumulativeUsage.completionTokens += usage.completionTokens || 0;
          cumulativeUsage.promptTokens += usage.promptTokens || 0;
          cumulativeUsage.totalTokens += usage.totalTokens || 0;
        }

        if (finishReason !== 'length') {
          return stream
            .switchSource(
              createDataStream({
                async execute(dataStream) {
                  dataStream.writeMessageAnnotation({
                    type: 'usage',
                    value: {
                      completionTokens: cumulativeUsage.completionTokens,
                      promptTokens: cumulativeUsage.promptTokens,
                      totalTokens: cumulativeUsage.totalTokens,
                    },
                  });
                },
                onError: (error: any) => {
                  console.error('Data stream error:', error);
                  return `Error: ${error.message}`;
                },
              }),
            )
            .then(() => stream.close());
        }

        if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
          throw Error('Cannot continue message: Maximum segments reached');
        }

        const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;
        console.log(`Continuing message (${switchesLeft} switches left)`);

        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: CONTINUE_PROMPT });

        const result = await streamText({
          messages,
          env: context.cloudflare.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
        });

        return stream.switchSource(result.toDataStream());
      },
    };

    console.log('Initializing stream text');

    const result = await streamText({
      messages,
      env: context.cloudflare.env,
      options,
      apiKeys,
      files,
      providerSettings,
      promptId,
    });

    console.log('Stream text initialized, switching source');

    try {
      const dataStream = result.toDataStream();
      console.log('Data stream created:', {
        type: typeof dataStream,
        isReadableStream: dataStream instanceof ReadableStream,
      });

      await stream.switchSource(dataStream);
      console.log('Stream source switched successfully');
    } catch (error) {
      console.error('Error switching stream source:', error);
      throw error;
    }

    console.log('Returning streaming response');

    return new Response(stream.readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      provider: error.provider,
      model: error.model,
    });

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid or missing API key',
          details: error.message,
          provider: error.provider,
          model: error.model,
        }),
        {
          status: 401,
          statusText: 'Unauthorized',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        },
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorDetails = error instanceof Error ? error.stack : undefined;

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorDetails,
        provider: error.provider,
        model: error.model,
      }),
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      },
    );
  }
}
