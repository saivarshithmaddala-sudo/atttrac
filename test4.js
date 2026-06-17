const now = new Date();
const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
console.log('Now:', now);
console.log('todayUTC:', todayUTC);

const date = new Date('2026-06-16T00:00:00Z');
console.log('Date:', date);
console.log('isFuture:', date.getTime() > todayUTC.getTime());
