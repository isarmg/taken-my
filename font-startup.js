// Prepare the three bundled complete faces before the application starts.
// Browser portrait facts, including device time-zone observations, are unchanged.
try {
  if (!document.fonts) throw new Error('Font Loading API is unavailable');
  const faces = [...document.fonts];
  if (faces.length !== 3) throw new Error('Bundled font styles are incomplete');
  await Promise.all(faces.map(face => face.load()));
  await document.fonts.ready;
  if (faces.some(face => face.status !== 'loaded')) throw new Error('Bundled fonts are incomplete');
  await import('./app.js');
  document.documentElement.dataset.takenFonts = 'ready';
} catch (error) {
  console.error('Application font preparation failed', error);
}
