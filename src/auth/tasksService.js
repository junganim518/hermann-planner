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
  return tasksApi.tasks.patch({
    tasklist: taskListId,
    task: taskId,
    requestBody: {
      status: completed ? 'completed' : 'needsAction',
    },
  });
}

module.exports = { listTasks, setTaskCompletion };
