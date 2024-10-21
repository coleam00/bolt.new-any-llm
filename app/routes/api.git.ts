import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { ActionRunner } from '~/lib/runtime/action-runner';
import { getWebContainer } from '~/lib/webcontainer';

export async function action(args: ActionFunctionArgs) {
  const { messageId, actionId, action } = await args.request.json();

  const webcontainer = await getWebContainer();
  const actionRunner = new ActionRunner(Promise.resolve(webcontainer));

  actionRunner.addAction({
    messageId,
    actionId,
    action,
  });

  actionRunner.runAction({
    messageId,
    actionId,
    action,
  });

  return new Response(JSON.stringify({ status: 'Action initiated' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

