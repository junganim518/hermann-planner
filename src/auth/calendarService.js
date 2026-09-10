const { google } = require('googleapis');

// Returns upcoming events between timeMin and timeMax (ISO strings) across
// all of the user's writable calendars, merged and sorted by start time.
async function listEvents(authClient, timeMin, timeMax) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  const calendarList = await calendar.calendarList.list();
  const calendars = calendarList.data.items || [];

  const eventLists = await Promise.all(
    calendars.map((cal) =>
      calendar.events
        .list({
          calendarId: cal.id,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        })
        .then((res) => (res.data.items || []).map((event) => ({ ...event, calendarSummary: cal.summary, calendarColorId: cal.colorId })))
        .catch(() => [])
    )
  );

  return eventLists
    .flat()
    .sort((a, b) => {
      const aTime = a.start?.dateTime || a.start?.date;
      const bTime = b.start?.dateTime || b.start?.date;
      return new Date(aTime) - new Date(bTime);
    });
}

module.exports = { listEvents };
