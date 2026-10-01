import { NextResponse } from "next/server";
import { readClinicSession } from "@/lib/auth";
import { deleteAirtableRecord, listAirtableRecords, saveAirtableRecord } from "@/lib/airtable";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to view clinic records." }, { status: 401 });
  try {
    const records = await listAirtableRecords();
    const normalize = (s?: string) => String(s || "").toLowerCase().replace(/^dr\.?\s*/, "").trim();
    return NextResponse.json({
      records: session.role === "doctor"
        ? records.filter((record: any) => {
            const doc = normalize(record.fields?.Doctor);
            const myDoc = normalize(session.doctorName);
            if (!doc || !myDoc) return false;
            return doc === myDoc || doc.includes(myDoc) || myDoc.includes(doc);
          })
        : records,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load Airtable records." }, { status: 502 });
  }
}

export async function POST(request: Request) { return writeRecord(request, null); }
export async function PATCH(request: Request) {
  const url = new URL(request.url);
  return writeRecord(request, url.searchParams.get("id"));
}
async function writeRecord(request: Request, id: string | null) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to update clinic records." }, { status: 401 });
  if (session.role !== "receptionist" && session.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized to update clinic records." }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (!body?.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
      return NextResponse.json({ error: "Record fields are required." }, { status: 400 });
    }
    // Clean id: if id starts with 'patient:' or is not a standard Airtable ID, treat as null (new record)
    const validRecordId = (id && /^rec[a-zA-Z0-9]+$/.test(id)) ? id : null;
    const fields = { ...body.fields };
    if (Array.isArray(body.clearFields)) {
      for (const field of body.clearFields) {
        if (typeof field !== "string" || field.length > 100) return NextResponse.json({ error: "Invalid field name to clear." }, { status: 400 });
        fields[field] = null;
      }
    }
    return NextResponse.json(await saveAirtableRecord(validRecordId, fields));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Airtable record." }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const session = readClinicSession(request);
  if (!session) return NextResponse.json({ error: "Sign in to delete clinic records." }, { status: 401 });
  if (session.role !== "receptionist" && session.role !== "doctor") {
    return NextResponse.json({ error: "Unauthorized to delete clinic records." }, { status: 403 });
  }
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "Record ID is required." }, { status: 400 });
  try {
    await deleteAirtableRecord(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete Airtable record." }, { status: 502 });
  }
}
