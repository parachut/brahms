import { CloudTasksClient } from '@google-cloud/tasks';

export async function createTask(
  taskPath: string,
  payload: any,
  queue: string = 'parachut-appengine-queue',
  inSeconds: number = 0,
) {
  const client = new CloudTasksClient();
  const parent = client.queuePath('parachut-216816', 'us-central1', queue);

  const task = {
    appEngineHttpRequest: {
      httpMethod: 'POST',
      relativeUri: `/tasks/${taskPath}`,
      body: Buffer.from(JSON.stringify(payload)).toString('base64'),
      headers: {
        'Content-Type': 'application/json',
      },
      scheduleTime: {
        seconds: inSeconds + Date.now() / 1000,
      },
    },
  };

  const request = {
    parent: parent,
    task: task,
  };

  return client.createTask(request);
}
