const { google } = require('googleapis');

// Returns incomplete + recently completed tasks across all task lists.
async function listTasks(authClient) {
  const tasksApi = google.tasks({ version: 'v1', auth: authClient });

  const taskLists = await tasksApi.tasklists.list();
  const lists = taskLists.data.items || [];

  const taskLists2d = await Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({ tasklist: list.id, showCompleted: true, showHidden: true })
        .then((res) => (res.data.items || []).map((task) => ({ ...task, taskListId: list.id, taskListTitle: list.title })))
        .catch(() => [])
    )
  );

  return taskLists2d.flat();
}

async function setTaskCompletion(authClient, taskListId, taskId, completed) {
  const tasksApi = google.tasks({ version: 'v1', auth: authClient });
  await tasksApi.tasks.patch({
    tasklist: taskListId,
    task: taskId,
    requestBody: {
      status: completed ? 'completed' : 'needsAction',
    },
  });
}

async function createTask(authClient, title) {
  const tasksApi = google.tasks({ version: 'v1', auth: authClient });
  const res = await tasksApi.tasks.insert({
    tasklist: '@default',
    requestBody: { title },
  });
  return { ...res.data, taskListId: '@default' };
}

async function deleteTask(authClient, taskListId, taskId) {
  const tasksApi = google.tasks({ version: 'v1', auth: authClient });
  await tasksApi.tasks.delete({ tasklist: taskListId, task: taskId });
}

async function updateTask(authClient, taskListId, taskId, title) {
  const tasksApi = google.tasks({ version: 'v1', auth: authClient });
  const res = await tasksApi.tasks.patch({
    tasklist: taskListId,
    task: taskId,
    requestBody: { title },
  });
  return { ...res.data, taskListId };
}

module.exports = { listTasks, setTaskCompletion, createTask, deleteTask, updateTask };
