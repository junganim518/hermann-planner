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
        .then((res) => (res.data.items || []).map((event) => ({ ...event, calendarId: cal.id, calendarSummary: cal.summary, calendarColorId: cal.colorId })))
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

// Updates title/date/time, and if `calendarId` differs from the event's
// current calendar, moves it to the new calendar first (events.move only
// relocates the event; the follow-up patch applies the other field changes).
async function updateEvent(authClient, currentCalendarId, eventId, { summary, start, end, calendarId: newCalendarId }) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  let targetCalendarId = currentCalendarId;
  let targetEventId = eventId;

  if (newCalendarId && newCalendarId !== currentCalendarId) {
    const moveRes = await calendar.events.move({
      calendarId: currentCalendarId,
      eventId,
      destination: newCalendarId,
    });
    targetCalendarId = newCalendarId;
    targetEventId = moveRes.data.id;
  }

  const res = await calendar.events.patch({
    calendarId: targetCalendarId,
    eventId: targetEventId,
    requestBody: { summary, start, end },
  });
  return { ...res.data, calendarId: targetCalendarId };
}

async function createEvent(authClient, { calendarId, summary, start, end }) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const targetCalendarId = calendarId || 'primary';
  const res = await calendar.events.insert({
    calendarId: targetCalendarId,
    requestBody: { summary, start, end },
  });
  return { ...res.data, calendarId: targetCalendarId };
}

async function deleteEvent(authClient, calendarId, eventId) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  await calendar.events.delete({ calendarId, eventId });
}

// Calendars the user can create/edit events on (owner or writer access).
async function listWritableCalendars(authClient) {
  const calendar = google.calendar({ version: 'v3', auth: authClient });
  const res = await calendar.calendarList.list();
  const items = res.data.items || [];
  return items
    .filter((cal) => cal.accessRole === 'owner' || cal.accessRole === 'writer')
    .map((cal) => ({ id: cal.id, summary: cal.summary, primary: !!cal.primary }));
}

module.exports = { listEvents, updateEvent, createEvent, deleteEvent, listWritableCalendars };
