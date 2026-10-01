const apiRoot = "https://api.airtable.com/v0";

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
      "Email": "aarav.sharma@example.com",
      "Phone": "+91 98765 43210",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient002",
    createdTime: new Date(Date.now() - 86400000 * 4).toISOString(),
    fields: {
      "Patient Name": "Meera Patel",
      "Email": "meera.patel@example.com",
      "Phone": "+91 98234 56789",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient003",
    createdTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    fields: {
      "Patient Name": "Rajesh Kumar",
      "Email": "rajesh.kumar@example.com",
      "Phone": "+91 97123 45678",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient004",
    createdTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    fields: {
      "Patient Name": "Priya Nair",
      "Email": "priya.nair@example.com",
      "Phone": "+91 99887 76655",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient005",
    createdTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    fields: {
      "Patient Name": "Sunita Gupta",
      "Email": "sunita.gupta@example.com",
      "Phone": "+91 98711 22334",
      "Status": "Registered",
    },
  },
  {
    id: "recPatient006",
    createdTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    fields: {
      "Patient Name": "Vikram Malhotra",
      "Email": "vikram.m@example.com",
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
      "Email": "aarav.sharma@example.com",
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
      "Email": "meera.patel@example.com",
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
      "Email": "rajesh.kumar@example.com",
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
      "Email": "priya.nair@example.com",
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
      "Email": "sunita.gupta@example.com",
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
      "Email": "vikram.m@example.com",
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
      "Email": "aarav.sharma@example.com",
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
  if (!response.ok) throw new Error(body.error?.message || body.message || `Airtable request failed (${response.status}).`);
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
  const values = { ...fields };
  Object.keys(values).forEach(key => { if (values[key] === "") delete values[key]; });

  if (hasAirtableConfig()) {
    try {
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
    } catch (error) {
      console.warn("Airtable save failed; persisting to local clinic store:", error instanceof Error ? error.message : "unknown");
    }
  }

  // In-memory fallback persistence
  if (id) {
    const existingIndex = mockStore.findIndex(r => r.id === id);
    if (existingIndex >= 0) {
      mockStore[existingIndex].fields = { ...mockStore[existingIndex].fields, ...values };
      return JSON.parse(JSON.stringify(mockStore[existingIndex]));
    }
  }

  const newId = id || `rec${Date.now()}${Math.random().toString(36).substring(2, 6)}`;
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
      return { ok: true };
    } catch (error) {
      console.warn("Airtable delete failed; removing from local clinic store:", error instanceof Error ? error.message : "unknown");
    }
  }
  const index = mockStore.findIndex(r => r.id === id);
  if (index >= 0) {
    mockStore.splice(index, 1);
  }
  return { ok: true };
}
