const apiRoot = "https://api.airtable.com/v0";

export const COL = {
  name: "Patient Name",
  email: "Patient Email",
  phone: "Phone No",
  date: "Appointment Date",
  time: "Appointment Time",
  doctor: "Doctor",
  status: "Status",
  mode: "Mode",
  bloodGroup: "Blood Group",
  notes: "Medical Notes",
  age: "Age",
  gender: "Gender",
  zoomId: "Zoom Meeting ID",
  zoomUrl: "Zoom Join URL",
  calendarId: "Google Calendar Event ID",
  followupDay: "Follow-up Day",
  followupStart: "Follow-up Start",
} as const;

function hasAirtableConfig() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const base = process.env.AIRTABLE_BASE_ID?.trim();
  const table = process.env.AIRTABLE_TABLE_ID?.trim();
  return Boolean(token && token !== "xxx" && base && base !== "xxx" && table && table !== "xxx");
}

function config() {
  const token = process.env.AIRTABLE_TOKEN?.trim();
  const base = process.env.AIRTABLE_BASE_ID?.trim();
  const table = process.env.AIRTABLE_TABLE_ID?.trim();
  if (!token || token === "xxx" || !base || base === "xxx" || !table || table === "xxx") {
    throw new Error("Airtable is not configured or using placeholder credentials.");
  }
  return { token, base, table };
}

// Fallback in-memory clinic store with realistic seed data
function getISODate(daysOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = getISODate(0);
const tomorrow = getISODate(1);
const nextWeek = getISODate(4);

interface MockRecord {
  id: string;
  createdTime: string;
  fields: Record<string, any>;
}

const mockStore: MockRecord[] = [
  // Seed Patients
  {
    id: "recPatient001",
    createdTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    fields: {
      "Patient Name": "Aarav Sharma",
      "Patient Email": "aarav.sharma@example.com",
      "Email": "aarav.sharma@example.com",
      "Phone No": "+91 98765 43210",
      "Phone": "+91 98765 43210",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient002",
    createdTime: new Date(Date.now() - 86400000 * 4).toISOString(),
    fields: {
      "Patient Name": "Meera Patel",
      "Patient Email": "meera.patel@example.com",
      "Email": "meera.patel@example.com",
      "Phone No": "+91 98234 56789",
      "Phone": "+91 98234 56789",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient003",
    createdTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    fields: {
      "Patient Name": "Rajesh Kumar",
      "Patient Email": "rajesh.kumar@example.com",
      "Email": "rajesh.kumar@example.com",
      "Phone No": "+91 97123 45678",
      "Phone": "+91 97123 45678",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient004",
    createdTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    fields: {
      "Patient Name": "Priya Nair",
      "Patient Email": "priya.nair@example.com",
      "Email": "priya.nair@example.com",
      "Phone No": "+91 99887 76655",
      "Phone": "+91 99887 76655",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient005",
    createdTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    fields: {
      "Patient Name": "Sunita Gupta",
      "Patient Email": "sunita.gupta@example.com",
      "Email": "sunita.gupta@example.com",
      "Phone No": "+91 98711 22334",
      "Phone": "+91 98711 22334",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient006",
    createdTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    fields: {
      "Patient Name": "Vikram Malhotra",
      "Patient Email": "vikram.m@example.com",
      "Email": "vikram.m@example.com",
      "Phone No": "+91 91234 56780",
      "Phone": "+91 91234 56780",
      "Status": "Registered",
    },
  },
  // Seed Appointments
  {
    id: "recAppt001",
    createdTime: new Date(Date.now() - 3600000 * 6).toISOString(),
    fields: {
      "Patient Name": "Aarav Sharma",
      "Patient Email": "aarav.sharma@example.com",
      "Email": "aarav.sharma@example.com",
      "Phone No": "+91 98765 43210",
      "Phone": "+91 98765 43210",
      "Doctor": "Dr. Ananya Rao",
      "Appointment Date": today,
      "Appointment Time": "09:30",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "84729103948",
      "Zoom Join URL": "https://zoom.us/j/84729103948?pwd=CLINIC",
      "Google Calendar Event ID": "cal_seed_001",
    },
  },
  {
    id: "recAppt002",
    createdTime: new Date(Date.now() - 3600000 * 4).toISOString(),
    fields: {
      "Patient Name": "Meera Patel",
      "Patient Email": "meera.patel@example.com",
      "Email": "meera.patel@example.com",
      "Phone No": "+91 98234 56789",
      "Phone": "+91 98234 56789",
      "Doctor": "Dr. Arjun Mehta",
      "Appointment Date": today,
      "Appointment Time": "11:00",
      "Mode": "Offline",
      "Status": "Scheduled",
      "Google Calendar Event ID": "cal_seed_002",
    },
  },
  {
    id: "recAppt003",
    createdTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    fields: {
      "Patient Name": "Rajesh Kumar",
      "Patient Email": "rajesh.kumar@example.com",
      "Email": "rajesh.kumar@example.com",
      "Phone No": "+91 97123 45678",
      "Phone": "+91 97123 45678",
      "Doctor": "Dr. Neha Sharma",
      "Appointment Date": today,
      "Appointment Time": "14:30",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "85920194821",
      "Zoom Join URL": "https://zoom.us/j/85920194821?pwd=CLINIC",
      "Google Calendar Event ID": "cal_seed_003",
    },
  },
  {
    id: "recAppt004",
    createdTime: new Date(Date.now() - 3600000 * 8).toISOString(),
    fields: {
      "Patient Name": "Priya Nair",
      "Patient Email": "priya.nair@example.com",
      "Email": "priya.nair@example.com",
      "Phone No": "+91 99887 76655",
      "Phone": "+91 99887 76655",
      "Doctor": "Dr. Rohan Nair",
      "Appointment Date": today,
      "Appointment Time": "16:00",
      "Mode": "Offline",
      "Status": "Completed",
      "Google Calendar Event ID": "cal_seed_004",
    },
  },
  {
    id: "recAppt005",
    createdTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    fields: {
      "Patient Name": "Sunita Gupta",
      "Patient Email": "sunita.gupta@example.com",
      "Email": "sunita.gupta@example.com",
      "Phone No": "+91 98711 22334",
      "Phone": "+91 98711 22334",
      "Doctor": "Dr. Priya Menon",
      "Appointment Date": tomorrow,
      "Appointment Time": "10:30",
      "Mode": "Offline",
      "Status": "Scheduled",
      "Google Calendar Event ID": "cal_seed_005",
    },
  },
  {
    id: "recAppt006",
    createdTime: new Date(Date.now() - 3600000 * 14).toISOString(),
    fields: {
      "Patient Name": "Vikram Malhotra",
      "Patient Email": "vikram.m@example.com",
      "Email": "vikram.m@example.com",
      "Phone No": "+91 91234 56780",
      "Phone": "+91 91234 56780",
      "Doctor": "Dr. Bhushan Shenoy",
      "Appointment Date": tomorrow,
      "Appointment Time": "15:00",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "87391028472",
      "Zoom Join URL": "https://zoom.us/j/87391028472?pwd=CLINIC",
      "Google Calendar Event ID": "cal_seed_006",
    },
  },
  {
    id: "recAppt007",
    createdTime: new Date(Date.now() - 3600000 * 20).toISOString(),
    fields: {
      "Patient Name": "Aarav Sharma",
      "Patient Email": "aarav.sharma@example.com",
      "Email": "aarav.sharma@example.com",
      "Phone No": "+91 98765 43210",
      "Phone": "+91 98765 43210",
      "Doctor": "Dr. Karan Iyer",
      "Appointment Date": nextWeek,
      "Appointment Time": "11:30",
      "Mode": "Online",
      "Status": "Scheduled",
      "Zoom Meeting ID": "88492019283",
      "Zoom Join URL": "https://zoom.us/j/88492019283?pwd=CLINIC",
    },
  },
];

export function isAirtableLive() {
  return hasAirtableConfig();
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
  if (!response.ok) {
    const err = new Error(body.error?.message || body.message || `Airtable request failed (${response.status}).`);
    (err as any).status = response.status;
    (err as any).errorType = body.error?.type;
    throw err;
  }
  return body;
}

export async function listAirtableRecords() {
  if (hasAirtableConfig()) {
    try {
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
    } catch (error) {
      console.warn("Airtable API unreachable or failed; using resilient local clinic store:", error instanceof Error ? error.message : "unknown");
    }
  }
  // Return in-memory clinic store
  return JSON.parse(JSON.stringify(mockStore));
}

export async function saveAirtableRecord(id: string | null, fields: Record<string, unknown>) {
  const isUpdate = Boolean(id && !id.startsWith("patient:") && !id.startsWith("local:"));
  let currentId: string | null = isUpdate ? id : null;

  const values: Record<string, unknown> = { ...fields };
  Object.keys(values).forEach(key => {
    if (values[key] === undefined) {
      delete values[key];
    } else if (values[key] === "") {
      if (currentId) {
        values[key] = null; // In Airtable PATCH, null clears the cell
      } else {
        delete values[key]; // In Airtable POST, omit empty values
      }
    }
  });

  if (hasAirtableConfig()) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const result = await airtableRequest(currentId ? `/${encodeURIComponent(currentId)}` : "", {
          method: currentId ? "PATCH" : "POST",
          body: JSON.stringify({ fields: values, typecast: true }),
        });

        // Also keep local mockStore in sync for fallback continuity
        if (result?.id) {
          const idx = mockStore.findIndex(r => r.id === result.id || (currentId && r.id === currentId));
          if (idx >= 0) {
            mockStore[idx] = result;
          } else {
            mockStore.unshift(result);
          }
        }
        return result;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const message = lastError.message || "";
        const status = (lastError as any).status;

        // If the record ID was not found in Airtable (404 / NOT_FOUND / INVALID_RECORD_ID),
        // it may be an in-memory/mock ID. Fallback to POST as a new record in Airtable!
        if (currentId && (status === 404 || /NOT_FOUND|INVALID_RECORD_ID|Record not found/i.test(message))) {
          console.warn(`Record ${currentId} not found in Airtable; persisting as a new record.`);
          currentId = null;
          Object.keys(values).forEach(k => { if (values[k] === null || values[k] === "") delete values[k]; });
          continue;
        }

        // Check for unknown field names
        const unknownField = /Unknown field name: "([^"]+)"/i.exec(message)?.[1];
        if (unknownField && Object.hasOwn(values, unknownField) && unknownField !== "Patient Name") {
          try {
            const c = config();
            const fieldType = unknownField === "Medical Notes" ? "multilineText"
              : unknownField === "Appointment Date" ? "date"
              : unknownField === "Follow-up Day" ? "number"
              : "singleLineText";
            const fieldBody: any = { name: unknownField, type: fieldType };
            if (fieldType === "number") fieldBody.options = { precision: 0 };
            const metaRes = await fetch(`${apiRoot}/meta/bases/${c.base}/tables/${encodeURIComponent(c.table)}/fields`, {
              method: "POST",
              headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
              body: JSON.stringify(fieldBody),
            });
            if (metaRes.ok) {
              console.log(`Auto-created missing Airtable field: "${unknownField}"`);
              continue;
            }
          } catch {
            // Ignore meta creation failure, fall back to omitting the field
          }

          delete values[unknownField];
          continue;
        }

        // Non-recoverable error, throw to break out
        throw lastError;
      }
    }
    if (lastError) throw lastError;
  }

  // Fallback in-memory persistence when Airtable credentials are not configured
  if (currentId) {
    const existingIndex = mockStore.findIndex(r => r.id === currentId);
    if (existingIndex >= 0) {
      mockStore[existingIndex].fields = { ...mockStore[existingIndex].fields, ...values };
      return JSON.parse(JSON.stringify(mockStore[existingIndex]));
    }
  }

  const newId = currentId || `rec${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
  const newRecord: MockRecord = {
    id: newId,
    createdTime: new Date().toISOString(),
    fields: values,
  };
  mockStore.unshift(newRecord);
  return JSON.parse(JSON.stringify(newRecord));
}

export async function deleteAirtableRecord(id: string) {
  if (hasAirtableConfig()) {
    try {
      await airtableRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (error: any) {
      const status = error?.status;
      const message = error instanceof Error ? error.message : "";
      if (status !== 404 && !/NOT_FOUND|INVALID_RECORD_ID|Record not found/i.test(message)) {
        throw error;
      }
    }
  }
  const index = mockStore.findIndex(r => r.id === id);
  if (index >= 0) {
    mockStore.splice(index, 1);
  }
  return { ok: true };
}
