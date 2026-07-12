// A .env legelső importként töltődik be, hogy minden más modul előtt fusson le.
try {
  process.loadEnvFile();
} catch {
  // A .env opcionális; ha nincs, a meglévő process.env értékekre támaszkodunk.
}
