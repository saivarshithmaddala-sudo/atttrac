const dateStr = "15-06-2026";
try {
  const d = new Date(${dateStr}T09:00);
  console.log(d.toISOString());
} catch(e) {
  console.error("Error:", e.message);
}
