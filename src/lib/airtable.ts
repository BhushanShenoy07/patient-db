const apiRoot = "https://api.airtable.com/v0";

function config() {
  const token = process.env.AIRTABLE_TOKEN;
  const base = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_ID;
  if (!token || !base || !table) throw new Error("Configure AIRTABLE_TOKEN, AIRTABLE_BASE_ID, and AIRTABLE_TABLE_ID on the server.");
  return { token, base, table };
}

export async function airtableRequest(path = "", init: RequestInit = {}) {
  const c = config();
  const response = await fetch(`${apiRoot}/${c.base}/${encodeURIComponent(c.table)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await response.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  if (!response.ok) throw new Error(body.error?.message || body.message || `Airtable request failed (${response.status}).`);
  return body;
}

export async function listAirtableRecords() {
  let records: any[] = [];
  let offset = "";
  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (offset) query.set("offset", offset);
    const page = await airtableRequest(`?${query}`);
    records = records.concat(page.records || []);
    offset = page.offset || "";
  } while (offset);
  return records;
}

export async function saveAirtableRecord(id: string | null, fields: Record<string, unknown>) {
  const values = { ...fields };
  Object.keys(values).forEach(key => { if (values[key] === "") delete values[key]; });
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await airtableRequest(id ? `/${encodeURIComponent(id)}` : "", {
        method: id ? "PATCH" : "POST", body: JSON.stringify({ fields: values, typecast: true }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const unknownField = /Unknown field name: "([^"]+)"/i.exec(message)?.[1];
      if (unknownField && Object.hasOwn(values, unknownField) && unknownField !== "Patient Name") { delete values[unknownField]; continue; }
      throw error;
    }
  }
  throw new Error("Airtable rejected too many column names. Check the configured table fields.");
}
